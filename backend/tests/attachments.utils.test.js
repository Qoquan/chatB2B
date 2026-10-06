// Tests unitaires purs (aucune base de données requise) des règles de
// validation des pièces jointes : type, extension, signature réelle du
// contenu, nom de fichier et en-tête de téléchargement.

import { describe, it, expect } from 'vitest';
import {
  MAX_ATTACHMENT_SIZE,
  sanitizeFileName,
  isInlineImage,
  validateAttachmentFile,
  buildContentDisposition,
} from '../src/utils/attachments.js';

// Premiers octets réels de chaque format (la signature suffit pour le contrôle)
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex');
const JPEG = Buffer.from('ffd8ffe000104a464946', 'hex');
const GIF = Buffer.from('GIF89a\x01\x00\x01\x00', 'latin1');
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ', 'latin1');
const ZIP = Buffer.from('504b03040a0000000000', 'hex');

function file(buffer, mimetype, originalname) {
  return { buffer, mimetype, originalname };
}

describe('validateAttachmentFile — fichiers acceptés', () => {
  it.each([
    ['png', PNG, 'image/png', 'photo.png'],
    ['jpeg', JPEG, 'image/jpeg', 'photo.JPG'],
    ['gif', GIF, 'image/gif', 'anim.gif'],
    ['webp', WEBP, 'image/webp', 'image.webp'],
    ['pdf', PDF, 'application/pdf', 'contrat.pdf'],
    [
      'docx',
      ZIP,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'note.docx',
    ],
    [
      'xlsx',
      ZIP,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'budget.xlsx',
    ],
    ['txt', Buffer.from('Bonjour, ceci est du texte.'), 'text/plain', 'lisez-moi.txt'],
    ['csv', Buffer.from('a;b;c\n1;2;3\n'), 'text/csv', 'donnees.csv'],
  ])('accepte un fichier %s valide', (_label, buffer, mimetype, name) => {
    expect(validateAttachmentFile(file(buffer, mimetype, name))).toBeNull();
  });
});

describe('validateAttachmentFile — fichiers refusés', () => {
  it('refuse un fichier vide ou absent', () => {
    expect(validateAttachmentFile(null)).toMatch(/vide/i);
    expect(validateAttachmentFile(file(Buffer.alloc(0), 'image/png', 'a.png'))).toMatch(/vide/i);
  });

  it('refuse un type non autorisé (exécutable, SVG, HTML)', () => {
    expect(validateAttachmentFile(file(PNG, 'application/x-msdownload', 'virus.exe'))).toMatch(
      /non autorisé/i
    );
    expect(
      validateAttachmentFile(file(Buffer.from('<svg onload="x()"/>'), 'image/svg+xml', 'a.svg'))
    ).toMatch(/non autorisé/i);
    expect(validateAttachmentFile(file(Buffer.from('<html>'), 'text/html', 'page.html'))).toMatch(
      /non autorisé/i
    );
  });

  it('refuse une extension qui ne correspond pas au type annoncé', () => {
    expect(validateAttachmentFile(file(PNG, 'image/png', 'photo.exe'))).toMatch(/extension/i);
    expect(validateAttachmentFile(file(PNG, 'image/png', 'sans_extension'))).toMatch(/extension/i);
  });

  it('refuse un contenu qui ne correspond pas au type annoncé (fichier déguisé)', () => {
    // Un texte ou un exécutable renommé en .png avec un faux type image/png
    expect(validateAttachmentFile(file(Buffer.from('MZ\x90\x00'), 'image/png', 'a.png'))).toMatch(
      /contenu/i
    );
    // Un PNG présenté comme un PDF
    expect(validateAttachmentFile(file(PNG, 'application/pdf', 'a.pdf'))).toMatch(/contenu/i);
    // Un binaire (octets nuls) présenté comme du texte
    expect(
      validateAttachmentFile(file(Buffer.from([0x41, 0x00, 0x42]), 'text/plain', 'a.txt'))
    ).toMatch(/contenu/i);
  });
});

describe('sanitizeFileName', () => {
  it('retire les chemins et les caractères de contrôle', () => {
    expect(sanitizeFileName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeFileName('C:\\Users\\moi\\rapport.pdf')).toBe('rapport.pdf');
    expect(sanitizeFileName('a\u0000b\u001fc.txt')).toBe('abc.txt');
  });

  it('répare les accents lus en latin1 par le parseur multipart', () => {
    const mojibake = Buffer.from('rapport été.pdf', 'utf8').toString('latin1');
    expect(sanitizeFileName(mojibake)).toBe('rapport été.pdf');
    expect(sanitizeFileName('rapport été.pdf')).toBe('rapport été.pdf');
  });

  it('limite la longueur en conservant l’extension', () => {
    const name = sanitizeFileName(`${'a'.repeat(300)}.pdf`);
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.endsWith('.pdf')).toBe(true);
  });

  it('retourne un nom par défaut si rien ne reste', () => {
    expect(sanitizeFileName('')).toBe('fichier');
    expect(sanitizeFileName(undefined)).toBe('fichier');
    expect(sanitizeFileName('///')).toBe('fichier');
  });
});

describe('buildContentDisposition / isInlineImage', () => {
  it('affiche les images directement et télécharge les autres fichiers', () => {
    expect(isInlineImage('image/png')).toBe(true);
    expect(isInlineImage('application/pdf')).toBe(false);
    expect(buildContentDisposition('a.png', true)).toMatch(/^inline;/);
    expect(buildContentDisposition('a.pdf', false)).toMatch(/^attachment;/);
  });

  it('encode proprement les accents et les caractères spéciaux', () => {
    const header = buildContentDisposition('rapport "été" (v2).pdf', false);
    expect(header).toContain('filename="rapport __t__ _v2_.pdf"');
    expect(header).toContain("filename*=UTF-8''rapport%20%22%C3%A9t%C3%A9%22%20%28v2%29.pdf");
    // Aucun saut de ligne injectable dans l'en-tête
    expect(buildContentDisposition('a\r\nSet-Cookie: x=1.pdf', false)).not.toMatch(/[\r\n]/);
  });
});

describe('limite de taille', () => {
  it('vaut 5 Mo', () => {
    expect(MAX_ATTACHMENT_SIZE).toBe(5 * 1024 * 1024);
  });
});
