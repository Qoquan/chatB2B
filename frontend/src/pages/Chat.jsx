import { useCallback, useEffect, useRef, useState } from 'react';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import NewConversationPanel from '../components/NewConversationPanel';
import ToastContainer from '../components/ToastContainer';
import ProfilePage from '../components/ProfilePage';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import './Chat.css';

const API_URL = import.meta.env.VITE_API_URL;
const TYPING_TIMEOUT_MS = 3000;
const TOAST_DURATION_MS = 4000;
const BASE_TITLE = 'ChatB2B';

function Chat() {
  const { user, token, logout } = useAuth();
  const socketRef = useSocket(token);

  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsername, setTypingUsername] = useState(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [otherUsers, setOtherUsers] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [showProfile, setShowProfile] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Toujours à jour pour les écouteurs socket posés une seule fois (cf. effet plus bas),
  // afin de ne pas avoir à les reposer à chaque changement de conversation active.
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const toastIdRef = useRef(0);
  const pushToast = useCallback((toast) => {
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, ...toast }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_DURATION_MS);
  }, []);

  // Demande la permission de notification navigateur une seule fois après connexion
  useEffect(() => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Notification dans le titre de l'onglet : affiche "(n) ChatB2B" dès qu'il y a des
  // messages non lus, visible même si l'onglet est en arrière-plan ou le navigateur
  // minimisé (contrairement à un toast ou une Notification navigateur classique).
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
  useEffect(() => {
    document.title = totalUnread > 0 ? `(${totalUnread}) ${BASE_TITLE}` : BASE_TITLE;

    // Remet le titre par défaut si le composant est démonté (ex. déconnexion)
    return () => {
      document.title = BASE_TITLE;
    };
  }, [totalUnread]);

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

  // Écoute globale : nouvelles conversations + nouveaux messages (toutes conversations,
  // pas seulement celle ouverte). Posée une seule fois par connexion socket : les handlers
  // lisent activeIdRef plutôt que activeId pour ne jamais avoir à être reposés.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    function handleConversationCreated(conversation) {
      setConversations((prev) =>
        prev.some((c) => c.id === conversation.id)
          ? prev
          : [{ ...conversation, unreadCount: 0 }, ...prev]
      );
    }

    function handleNewMessage(message) {
      const isOwnMessage = message.sender.id === user.id;
      const isActiveConversation = message.conversationId === activeIdRef.current;

      if (isActiveConversation) {
        setMessages((prev) => [...prev, message]);
      }

      setConversations((prev) =>
        prev.map((c) =>
          c.id === message.conversationId
            ? {
                ...c,
                messages: [message],
                unreadCount:
                  isActiveConversation || isOwnMessage ? c.unreadCount : (c.unreadCount || 0) + 1,
              }
            : c
        )
      );

      if (!isActiveConversation && !isOwnMessage) {
        pushToast({ title: message.sender.username, body: message.content });

        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification(message.sender.username, {
            body: message.content,
            icon: message.sender.avatarUrl || undefined,
          });
        }
      }
    }

    socket.on('conversation_created', handleConversationCreated);
    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('conversation_created', handleConversationCreated);
      socket.off('new_message', handleNewMessage);
    };
  }, [socketRef, user, pushToast]);

  // Indicateur de frappe
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    let typingTimeout;
    function handleTyping({ username }) {
      setTypingUsername(username);
      clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => setTypingUsername(null), TYPING_TIMEOUT_MS);
    }

    socket.on('user_typing', handleTyping);

    return () => {
      socket.off('user_typing', handleTyping);
      clearTimeout(typingTimeout);
    };
  }, [socketRef]);

  // Sélectionne une conversation : charge ses messages et la marque comme lue
  function handleSelectConversation(conversationId) {
    setActiveId(conversationId);
    setTypingUsername(null);
    setShowProfile(false);

    // Remise à zéro optimiste du compteur non-lus, en plus de l'appel API vers /read
    setConversations((prev) =>
      prev.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
    );

    fetch(`${API_URL}/api/conversations/${conversationId}/messages`, {
      headers: authHeaders,
    })
      .then((res) => res.json())
      .then(setMessages);

    fetch(`${API_URL}/api/conversations/${conversationId}/read`, {
      method: 'POST',
      headers: authHeaders,
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
      <ToastContainer toasts={toasts} />
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <span>
            {user.username}
            <button title="Mon profil" onClick={() => setShowProfile(true)}>
              ⚙️
            </button>
          </span>
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

      {showProfile ? (
        <ProfilePage onClose={() => setShowProfile(false)} />
      ) : activeId ? (
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
