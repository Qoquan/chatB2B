import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import './Attachment.css';
import './DeletedUser.css';

// Types acceptés par le sélecteur de fichiers (le serveur revérifie de toute façon)
const ACCEPTED_FILES = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.docx,.xlsx,.pptx,.txt,.csv';

function ChatWindow({
  title,
  avatarUrl,
  messages,
  currentUserId,
  typingUsername,
  uploading,
  onSend,
  onSendFile,
  onTyping,
  onOpenSettings,
  readOnly,
}) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  }

  // Envoie le fichier choisi, avec le texte déjà saisi comme légende éventuelle
  function handleFileChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de re-choisir le même fichier ensuite
    if (!file || !onSendFile) return;
    Promise.resolve(onSendFile(file, draft.trim())).then((sent) => {
      if (sent) setDraft('');
    });
  }

  const lastMessageId = messages[messages.length - 1]?.id;

  return (
    <div className="chat-window">
      <div className="chat-header">
        {avatarUrl && <img className="chat-header-avatar" src={avatarUrl} alt="" />}
        <span>{title}</span>
        {onOpenSettings && (
          <button
            className="chat-header-settings"
            title="Paramètres du groupe"
            onClick={onOpenSettings}
          >
            ⚙️
          </button>
        )}
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === currentUserId}
            // Une image qui finit de charger agrandit la bulle : on recale le
            // défilement en bas, mais seulement pour le tout dernier message.
            onMediaLoad={msg.id === lastMessageId ? scrollToBottom : undefined}
          />
        ))}
        <div ref={bottomRef} />
      </div>

      {typingUsername && <div className="typing-indicator">{typingUsername} écrit...</div>}
      {uploading && <div className="typing-indicator">Envoi du fichier...</div>}

      {readOnly ? (
        <div className="chat-readonly-notice">
          Cet utilisateur a supprimé son compte : la conversation est en lecture seule.
        </div>
      ) : (
        <form className="chat-input" onSubmit={handleSubmit}>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILES}
            hidden
            onChange={handleFileChange}
          />
          <button
            type="button"
            className="attach-button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Joindre un fichier"
            title="Joindre un fichier (5 Mo maximum)"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <path
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 11.5l-8.6 8.6a5.5 5.5 0 0 1-7.8-7.8l9-9a3.7 3.7 0 0 1 5.2 5.2l-9 9a1.8 1.8 0 0 1-2.6-2.6l8.3-8.3"
              />
            </svg>
          </button>
          <input
            type="text"
            placeholder="Écrire un message..."
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onTyping?.();
            }}
          />
          <button type="submit">Envoyer</button>
        </form>
      )}
    </div>
  );
}

export default ChatWindow;
