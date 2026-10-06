const prisma = require('../config/db');
const { asyncHandler } = require('../middleware/error.middleware');
const {
  MAX_CAPTION_LENGTH,
  sanitizeFileName,
  isInlineImage,
  validateAttachmentFile,
  buildContentDisposition,
} = require('../utils/attachments');

// Un message avec pièce jointe renvoie uniquement les métadonnées du fichier
// (jamais son contenu binaire) : le contenu se télécharge à part, via la
// route GET protégée ci-dessous.
const MESSAGE_INCLUDE = {
  sender: { select: { id: true, username: true, avatarUrl: true } },
  attachment: { select: { id: true, fileName: true, mimeType: true, size: true } },
};

// Reçoit un fichier (+ une légende optionnelle), crée le message qui le
// porte, puis le diffuse en temps réel aux membres via l'évènement
// "new_message" déjà utilisé pour les messages texte : badge, toast et titre
// de l'onglet fonctionnent donc sans rien changer côté notifications.
// (L'appartenance à la conversation est déjà vérifiée par
// requireConversationMember, placé avant le parseur d'upload.)
const uploadAttachment = asyncHandler(async (req, res) => {
  const { conversationId } = req.params;

  if (!req.file) {
    return res.status(400).json({ error: 'Aucun fichier reçu (champ « file » attendu)' });
  }

  const fileError = validateAttachmentFile(req.file);
  if (fileError) {
    return res.status(400).json({ error: fileError });
  }

  const caption = typeof req.body.content === 'string' ? req.body.content.trim() : '';
  if (caption.length > MAX_CAPTION_LENGTH) {
    return res.status(400).json({ error: 'Le message associé au fichier est trop long' });
  }

  const message = await prisma.message.create({
    data: {
      content: caption,
      conversationId: conversationId,
      senderId: req.userId,
      attachment: {
        create: {
          fileName: sanitizeFileName(req.file.originalname),
          mimeType: req.file.mimetype,
          size: req.file.size,
          data: req.file.buffer,
        },
      },
    },
    include: MESSAGE_INCLUDE,
  });

  const io = req.app.get('io');
  if (io) {
    io.to(`conversation:${conversationId}`).emit('new_message', message);
  }

  res.status(201).json(message);
});

// Sert le contenu d'une pièce jointe aux seuls membres de la conversation.
// La recherche porte à la fois sur l'identifiant du fichier ET sur la
// conversation de l'URL : impossible d'accéder à un fichier d'une autre
// conversation en changeant simplement l'identifiant.
const downloadAttachment = asyncHandler(async (req, res) => {
  const { conversationId, attachmentId } = req.params;

  const attachment = await prisma.attachment.findFirst({
    where: { id: attachmentId, message: { conversationId: conversationId } },
  });
  if (!attachment) {
    return res.status(404).json({ error: 'Pièce jointe introuvable' });
  }

  res.set({
    'Content-Type': attachment.mimeType,
    'Content-Disposition': buildContentDisposition(
      attachment.fileName,
      isInlineImage(attachment.mimeType)
    ),
    // Empêche le navigateur de "deviner" un autre type que celui déclaré,
    // et interdit toute exécution de contenu actif depuis ce fichier.
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'Cache-Control': 'private, max-age=3600',
  });
  res.send(Buffer.from(attachment.data));
});

module.exports = { uploadAttachment, downloadAttachment };
