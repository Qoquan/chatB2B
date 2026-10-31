import Avatar from './Avatar';
import { getUserName } from '../utils/userName';

function getOtherMember(conv, currentUserId) {
  return conv.members?.find((m) => m.user.id !== currentUserId)?.user;
}

// Pour une conversation 1:1 sans nom, affiche le pseudo de l'autre membre
function getDisplayName(conv, currentUserId) {
  if (conv.name) return conv.name;
  return getUserName(getOtherMember(conv, currentUserId)) || 'Conversation';
}

// Aperçu du dernier message : son texte, ou le nom du fichier s'il n'a qu'une pièce jointe
function getPreview(lastMessage) {
  if (!lastMessage) return 'Aucun message';
  if (lastMessage.content) return lastMessage.content;
  if (lastMessage.attachment) return `[Pièce jointe] ${lastMessage.attachment.fileName}`;
  return '';
}

function ConversationList({ conversations, activeId, currentUserId, onSelect }) {
  return (
    <ul className="conversation-list">
      {conversations.map((conv) => {
        const lastMessage = conv.messages?.[0];
        const name = getDisplayName(conv, currentUserId);
        const avatarUrl = conv.isGroup
          ? conv.avatarUrl
          : getOtherMember(conv, currentUserId)?.avatarUrl;
        const isActive = conv.id === activeId;
        return (
          <li key={conv.id} className={isActive ? 'active' : ''}>
            <button
              type="button"
              className="conversation-item"
              aria-current={isActive ? 'true' : undefined}
              onClick={() => onSelect(conv.id)}
            >
              <Avatar name={name} src={avatarUrl} />
              <span className="conversation-text">
                <span className="conversation-name">{name}</span>
                <span className="conversation-preview">{getPreview(lastMessage)}</span>
              </span>
              {conv.unreadCount > 0 && (
                <span className="unread-badge" aria-label={`${conv.unreadCount} non lus`}>
                  {conv.unreadCount}
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default ConversationList;
