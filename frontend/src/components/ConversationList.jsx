// Pour une conversation 1:1 sans nom, affiche le pseudo de l'autre membre
function getDisplayName(conv, currentUserId) {
  if (conv.name) return conv.name;
  const other = conv.members?.find((m) => m.user.id !== currentUserId);
  return other?.user.username || 'Conversation';
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
            <div className="conversation-preview">
              {lastMessage ? lastMessage.content : 'Aucun message'}
            </div>
            {conv.unreadCount > 0 && <span className="unread-badge">{conv.unreadCount}</span>}
          </li>
        );
      })}
    </ul>
  );
}

export default ConversationList;
