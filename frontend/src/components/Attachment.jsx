import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Attachment.css';

const API_URL = import.meta.env.VITE_API_URL;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

// Le fichier est protégé (réservé aux membres de la conversation) : on ne peut
// donc pas le charger avec un simple <img src="..."> ou un lien, qui
// n'enverraient pas le token. On le télécharge avec le token puis on en fait
// une URL locale (blob) utilisable par le navigateur.
async function fetchAttachmentBlob(conversationId, attachmentId, token) {
  const res = await fetch(
    `${API_URL}/api/conversations/${conversationId}/attachments/${attachmentId}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok) throw new Error('download_failed');
  return res.blob();
}

function ImageAttachment({ attachment, conversationId, onLoad }) {
  const { token } = useAuth();
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = null;

    fetchAttachmentBlob(conversationId, attachment.id, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, conversationId, token]);

  if (failed) {
    return <div className="attachment-status">Image indisponible : {attachment.fileName}</div>;
  }
  if (!src) {
    return <div className="attachment-status">Chargement de l&apos;image…</div>;
  }
  return (
    <a href={src} target="_blank" rel="noopener noreferrer">
      <img className="attachment-image" src={src} alt={attachment.fileName} onLoad={onLoad} />
    </a>
  );
}

function FileAttachment({ attachment, conversationId }) {
  const { token } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function handleDownload() {
    setBusy(true);
    setFailed(false);
    try {
      const blob = await fetchAttachmentBlob(conversationId, attachment.id, token);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = attachment.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  let meta = `${formatSize(attachment.size)} · Télécharger`;
  if (busy) meta = 'Téléchargement…';
  if (failed) meta = 'Échec du téléchargement, réessayer';

  return (
    <button type="button" className="attachment-file" onClick={handleDownload} disabled={busy}>
      <svg
        className="attachment-file-icon"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
      >
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8zM14 3v5h5"
        />
      </svg>
      <span className="attachment-file-info">
        <span className="attachment-name">{attachment.fileName}</span>
        <span className="attachment-meta">{meta}</span>
      </span>
    </button>
  );
}

// Affiche la pièce jointe d'un message : l'image directement dans la bulle,
// les autres fichiers sous forme de bouton de téléchargement.
function Attachment({ attachment, conversationId, onMediaLoad }) {
  if (attachment.mimeType.startsWith('image/')) {
    return (
      <ImageAttachment
        attachment={attachment}
        conversationId={conversationId}
        onLoad={onMediaLoad}
      />
    );
  }
  return <FileAttachment attachment={attachment} conversationId={conversationId} />;
}

export default Attachment;
