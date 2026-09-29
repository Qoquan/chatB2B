import { useCallback, useEffect, useState } from 'react';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import NewConversationPanel from '../components/NewConversationPanel';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import './Chat.css';

const API_URL = import.meta.env.VITE_API_URL;
const TYPING_TIMEOUT_MS = 3000;

function Chat() {
  const { user, token, logout } = useAuth();
  const socketRef = useSocket(token);

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsername, setTypingUsername] = useState(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [otherUsers, setOtherUsers] = useState([]);

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Charge la liste des conversations au montage
  useEffect(() => {
    fetch(`${API_URL}/api/conversations`, { headers: authHeaders })
      .then((res) => res.json())
      .then(setConversations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Rejoint les rooms socket de toutes les conversations une fois connues
  useEffect(() => {
    if (!conversations.length) return;
    socketRef.current?.emit(
      'join_conversations',
      conversations.map((c) => c.id)
    );
  }, [conversations, socketRef]);

  // Écoute les nouveaux messages / indicateur de frappe
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function handleNewMessage(message) {
      setMessages((prev) =>
        message.conversationId === activeId ? [...prev, message] : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === message.conversationId ? { ...c, messages: [message] } : c
        )
      );
    }

    let typingTimeout;
    function handleTyping({ username }) {
      setTypingUsername(username);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTypingUsername(null), TYPING_TIMEOUT_MS);
    }

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleTyping);
      clearTimeout(typingTimeout);
    };
  }, [socketRef, activeId]);

  // Sélectionne une conversation : charge ses messages et la marque comme lue
  function handleSelectConversation(conversationId) {
    setActiveId(conversationId);
    setTypingUsername(null);

    fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
      headers: authHeaders,
    })
      .then((res) => res.json())
      .then(setMessages);

    fetch(`${API_URL}/api/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: authHeaders,
    }).then(() => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
      );
    });
  }

  function handleOpenNewConversation() {
    setShowNewConversation(true);
    fetch(`${API_URL}/api/users`, { headers: authHeaders })
      .then((res) => res.json())
      .then(setOtherUsers);
  }

  // Crée (ou réutilise) une conversation 1:1 avec l'utilisateur choisi
  function handleStartConversation(otherUserId) {
    fetch(`${API_URL}/api/conversations`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: [otherUserId] }),
    })
      .then((res) => res.json())
      .then((conversation) => {
        setConversations((prev) =>
          prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]
        );
        setShowNewConversation(false);
        handleSelectConversation(conversation.id);
      });
  }

  const handleSend = useCallback(
    (content) => {
      if (!activeId) return;
      socketRef.current?.emit('send_message', { conversationId: activeId, content });
    },
    [activeId, socketRef]
  );

  const handleTyping = useCallback(() => {
    if (!activeId) return;
    socketRef.current?.emit('typing', { conversationId: activeId, username: user.username });
  }, [activeId, user, socketRef]);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const activeTitle =
    activeConversation?.name ||
    activeConversation?.members?.find((m) => m.user.id !== user.id)?.user.username ||
    'Sélectionne une conversation';

  return (
    <div className="chat-page">
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <span>{user.username}</span>
          <div>
            <button onClick={handleOpenNewConversation}>+</button>
            <button onClick={logout}>Déconnexion</button>
          </div>
        </div>
        {showNewConversation && (
          <NewConversationPanel
            users={otherUsers}
            onSelectUser={handleStartConversation}
            onClose={() => setShowNewConversation(false)}
          />
        )}
        <ConversationList
          conversations={conversations}
          activeId={activeId}
          currentUserId={user.id}
          onSelect={handleSelectConversation}
        />
      </aside>

      {activeId ? (
        <ChatWindow
          title={activeTitle}
          messages={messages}
          currentUserId={user.id}
          typingUsername={typingUsername}
          onSend={handleSend}
          onTyping={handleTyping}
        />
      ) : (
        <div className="chat-window chat-empty">Sélectionne une conversation à gauche</div>
      )}
    </div>
  );
}

export default Chat;
