import { getUserName } from '../utils/userName';

// Pour une conversation 1:1 sans nom, affiche le pseudo de l'autre membre
function getDisplayName(conv, currentUserId) {
  if (conv.name) return conv.name;
  const other = conv.members?.find((m) => m.user.id !== currentUserId);
  return getUserName(other?.user) || 'Conversation';
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
        return (
          <li
            key={conv.id}
            className={conv.id === activeId ? 'active' : ''}
            onClick={() => onSelect(conv.id)}
          >
            <div className="conversation-name">{getDisplayName(conv, currentUserId)}</div>
            <div className="conversation-preview">{getPreview(lastMessage)}</div>
            {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export default ConversationList;
