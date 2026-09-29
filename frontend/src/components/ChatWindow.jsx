import { useEffect, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';

function ChatWindow({ title, messages, currentUserId, typingUsername, onSend, onTyping }) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!draft.trim()) return;
    onSend(draft.trim());
    setDraft('');
  }

  return (
    <div className="chat-window">
      <div className="chat-header">{title}</div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} isOwn={msg.senderId === currentUserId} />
        ))}
        <div ref={bottomRef} />
      </div>

      {typingUsername && <div className="typing-indicator">{typingUsername} écrit...</div>}

      <form className="chat-input" onSubmit={handleSubmit}>
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
    </div>
  );
}

export default ChatWindow;
