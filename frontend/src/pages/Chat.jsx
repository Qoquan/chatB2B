import { useCallback, useEffect, useRef, useState } from 'react';
import ConversationList from '../components/ConversationList';
import ChatWindow from '../components/ChatWindow';
import NewConversationPanel from '../components/NewConversationPanel';
import ToastContainer from '../components/ToastContainer';
import ProfilePage from '../components/ProfilePage';
import GroupSettings from '../components/GroupSettings';
import { getUserName, isDeletedUser } from '../utils/userName';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import './Chat.css';

const API_URL = import.meta.env.VITE_API_URL;
const TYPING_TIMEOUT_MS = 3000;
const TOAST_DURATION_MS = 4000;
const BASE_TITLE = 'ChatB2B';
const MAX_ATTACHMENT_MB = 5;

// Remplace les réactions d'un message dans la liste affichée (sans toucher aux autres)
function withReactions(messages, messageId, reactions) {
  return messages.map((m) => (m.id === messageId ? { ...m, reactions } : m));
}

// Texte court décrivant un message (toast, notification navigateur) : le texte
// s'il existe, sinon le nom du fichier pour un message qui n'a qu'une pièce jointe.
function describeMessage(message) {
  if (message.content) return message.content;
  if (message.attachment) return `[Pièce jointe] ${message.attachment.fileName}`;
  return '';
}

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
  const [uploading, setUploading] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Toujours à jour pour les écouteurs socket posés une seule fois (cf. effet plus bas),
  // afin de ne pas avoir à les reposer à chaque changement de conversation active.
  const activeIdRef = useRef(activeId);
  useEffect(() => {
    activeIdRef.current = activeId;
  }, [activeId]);

  const removeConversation = useCallback((conversationId) => {
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    if (activeIdRef.current === conversationId) {
      setActiveId(null);
      setMessages([]);
      setShowGroupSettings(false);
    }
  }, []);

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
        pushToast({ title: message.sender.username, body: describeMessage(message) });

        if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
          new Notification(message.sender.username, {
            body: describeMessage(message),
            icon: message.sender.avatarUrl || undefined,
          });
        }
      }
    }

    function handleReactionUpdated({ conversationId, messageId, reactions }) {
      if (conversationId !== activeIdRef.current) return;
      setMessages((prev) => withReactions(prev, messageId, reactions));
    }

    function handleConversationUpdated(conversation) {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversation.id ? { ...c, ...conversation } : c))
      );
    }

    function handleConversationDeleted({ id }) {
      removeConversation(id);
    }

    socket.on('conversation_created', handleConversationCreated);
    socket.on('conversation_updated', handleConversationUpdated);
    socket.on('conversation_deleted', handleConversationDeleted);
    socket.on('new_message', handleNewMessage);
    socket.on('reaction_updated', handleReactionUpdated);

    return () => {
      socket.off('conversation_created', handleConversationCreated);
      socket.off('conversation_updated', handleConversationUpdated);
      socket.off('conversation_deleted', handleConversationDeleted);
      socket.off('new_message', handleNewMessage);
      socket.off('reaction_updated', handleReactionUpdated);
    };
  }, [socketRef, user, pushToast, removeConversation]);

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
    setShowGroupSettings(false);
    setMenuOpen(false);

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

  function openConversation(conversation) {
    setConversations((prev) =>
      prev.some((c) => c.id === conversation.id) ? prev : [conversation, ...prev]
    );
    setShowNewConversation(false);
    handleSelectConversation(conversation.id);
  }

  // Crée (ou réutilise) une conversation 1:1 avec l'utilisateur choisi
  function handleStartConversation(otherUserId) {
    fetch(`${API_URL}/api/conversations`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds: [otherUserId] }),
    })
      .then((res) => res.json())
      .then(openConversation);
  }

  async function handleCreateGroup({ name, avatarUrl, memberIds }) {
    const res = await fetch(`${API_URL}/api/conversations`, {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberIds, isGroup: true, name, avatarUrl }),
    });
    const data = await res.json();
    if (!res.ok) return { error: data.error };
    openConversation(data);
    return {};
  }

  const handleSend = useCallback(
    (content) => {
      if (!activeId) return;
      socketRef.current?.emit('send_message', { conversationId: activeId, content });
    },
    [activeId, socketRef]
  );

  // Ajoute ou retire ma réaction sur un message. Le serveur répond avec la liste à jour
  // (appliquée tout de suite) et la diffuse aux autres membres via reaction_updated.
  const handleToggleReaction = useCallback(
    async (messageId, emoji) => {
      if (!activeId) return;
      try {
        const res = await fetch(
          `${API_URL}/api/conversations/${activeId}/messages/${messageId}/reactions`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          pushToast({ title: 'Réaction impossible', body: data.error || 'Erreur du serveur' });
          return;
        }
        setMessages((prev) => withReactions(prev, data.messageId, data.reactions));
      } catch {
        pushToast({ title: 'Réaction impossible', body: 'Connexion au serveur impossible' });
      }
    },
    [activeId, token, pushToast]
  );

  // Envoie un fichier (+ légende optionnelle) dans la conversation ouverte. Le message
  // n'est pas ajouté ici : le serveur le diffuse à tous les membres, expéditeur compris,
  // via l'évènement new_message déjà géré plus haut.
  const handleSendFile = useCallback(
    async (file, caption) => {
      if (!activeId) return false;

      if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
        pushToast({
          title: 'Envoi impossible',
          body: `Fichier trop volumineux (${MAX_ATTACHMENT_MB} Mo maximum)`,
        });
        return false;
      }

      setUploading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (caption) formData.append('content', caption);

        // Pas de Content-Type manuel : le navigateur ajoute lui-même la bonne valeur
        // (multipart/form-data + séparateur) pour un FormData.
        const res = await fetch(`${API_URL}/api/conversations/${activeId}/attachments`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          pushToast({
            title: 'Envoi impossible',
            body: data.error || "Erreur lors de l'envoi du fichier",
          });
          return false;
        }
        return true;
      } catch {
        pushToast({ title: 'Envoi impossible', body: 'Connexion au serveur impossible' });
        return false;
      } finally {
        setUploading(false);
      }
    },
    [activeId, token, pushToast]
  );

  const handleTyping = useCallback(() => {
    if (!activeId) return;
    socketRef.current?.emit('typing', { conversationId: activeId, username: user.username });
  }, [activeId, user, socketRef]);

  const activeConversation = conversations.find((c) => c.id === activeId);
  const activeTitle =
    activeConversation?.name ||
    getUserName(activeConversation?.members?.find((m) => m.user.id !== user.id)?.user) ||
    'Sélectionne une conversation';
  // Discussion privée dont l'autre personne a supprimé son compte : lecture seule
  const isReadOnly =
    Boolean(activeConversation) &&
    !activeConversation.isGroup &&
    activeConversation.members.some((m) => m.user.id !== user.id && isDeletedUser(m.user));

  return (
    <div className="chat-page">
      <ToastContainer toasts={toasts} />
      <aside className={`chat-sidebar${menuOpen ? ' open' : ''}`}>
        <div className="sidebar-header">
          <span>
            {user.username}
            <button
              title="Mon profil"
              onClick={() => {
                setShowProfile(true);
                setMenuOpen(false);
              }}
            >
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
            onCreateGroup={handleCreateGroup}
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
      {menuOpen && <div className="menu-overlay" onClick={() => setMenuOpen(false)} />}

      <main className="chat-main">
        <div className="mobile-topbar">
          <button
            className="menu-toggle"
            aria-label="Ouvrir le menu"
            onClick={() => setMenuOpen(true)}
          >
            ☰
          </button>
          <span>ChatB2B</span>
        </div>

        {showProfile ? (
          <ProfilePage onClose={() => setShowProfile(false)} />
        ) : showGroupSettings && activeConversation?.isGroup ? (
          <GroupSettings
            conversation={activeConversation}
            currentUserId={user.id}
            token={token}
            onClose={() => setShowGroupSettings(false)}
            onDeleted={removeConversation}
          />
        ) : activeId ? (
          <ChatWindow
            title={activeTitle}
            avatarUrl={activeConversation?.avatarUrl}
            onOpenSettings={
              activeConversation?.isGroup ? () => setShowGroupSettings(true) : undefined
            }
            messages={messages}
            readOnly={isReadOnly}
            uploading={uploading}
            currentUserId={user.id}
            typingUsername={typingUsername}
            onSend={handleSend}
            onSendFile={handleSendFile}
            onToggleReaction={handleToggleReaction}
            onTyping={handleTyping}
          />
        ) : (
          <div className="chat-window chat-empty">Sélectionne une conversation dans le menu</div>
        )}
      </main>
    </div>
  );
}

export default Chat;
