import { useLayoutEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import EmojiPicker from './EmojiPicker';
import { INPUT_EMOJIS } from '../utils/emojis';
import './Attachment.css';
import './DeletedUser.css';
import './Reactions.css';

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
  onToggleReaction,
  onOpenSettings,
  onLoadOlder,
  hasOlderMessages,
  loadingOlder,
  readOnly,
}) {
  const [draft, setDraft] = useState('');
  const [showEmojis, setShowEmojis] = useState(false);
  const bottomRef = useRef(null);
  const messagesRef = useRef(null);
  const lastMessageIdRef = useRef(null);
  // Hauteur de la liste avant l'ajout de messages plus anciens (0 sinon)
  const heightBeforeOlderRef = useRef(0);
  const fileInputRef = useRef(null);
  const textInputRef = useRef(null);

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }

  const lastMessageId = messages[messages.length - 1]?.id;

  // Descend en bas pour un nouveau message ou une autre conversation. Après le
  // chargement de messages plus anciens, garde au contraire la lecture en place.
  useLayoutEffect(() => {
    if (lastMessageId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = lastMessageId;
      heightBeforeOlderRef.current = 0;
      scrollToBottom();
    } else if (heightBeforeOlderRef.current && messagesRef.current) {
      const list = messagesRef.current;
      list.scrollTop += list.scrollHeight - heightBeforeOlderRef.current;
      heightBeforeOlderRef.current = 0;
    }
  }, [messages, lastMessageId]);

  function handleLoadOlder() {
    heightBeforeOlderRef.current = messagesRef.current?.scrollHeight || 0;
    onLoadOlder?.();
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  }

  // Ajoute l'emoji choisi à la fin du message en cours, puis remet le curseur dans le champ
  function handlePickEmoji(emoji) {
    setDraft((current) => current + emoji);
    setShowEmojis(false);
    textInputRef.current?.focus();
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

  return (
    <div className="chat-window">
      <div className="chat-header">
        {avatarUrl && <img className="chat-header-avatar" src={avatarUrl} alt="" />}
        <span>{title}</span>
        {onOpenSettings && (
          <button
            className="chat-header-settings"
            title="Paramètres du groupe"
            aria-label="Paramètres du groupe"
            onClick={onOpenSettings}
          >
            ⚙️
          </button>
        )}
      </div>

      <div className="chat-messages" ref={messagesRef}>
        {hasOlderMessages && (
          <button
            type="button"
            className="load-older"
            onClick={handleLoadOlder}
            disabled={loadingOlder}
          >
            {loadingOlder ? 'Chargement…' : 'Afficher les messages précédents'}
          </button>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isOwn={msg.senderId === currentUserId}
            currentUserId={currentUserId}
            onToggleReaction={readOnly ? undefined : onToggleReaction}
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
          <button
            type="button"
            className="emoji-button"
            onClick={() => setShowEmojis((open) => !open)}
            aria-label="Insérer un emoji"
            aria-expanded={showEmojis}
            title="Insérer un emoji"
          >
            😊
          </button>
          {showEmojis && (
            <EmojiPicker emojis={INPUT_EMOJIS} onPick={handlePickEmoji} label="Choisir un emoji" />
          )}
          <input
            ref={textInputRef}
            type="text"
            placeholder="Écrire un message..."
            aria-label="Écrire un message"
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
