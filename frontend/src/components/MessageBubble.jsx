import Attachment from './Attachment';
import { isDeletedUser, DELETED_USER_LABEL } from '../utils/userName';
import './DeletedUser.css';

function MessageBubble({ message, isOwn, onMediaLoad }) {
  const time = new Date(message.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className={`message-bubble ${isOwn ? 'own' : ''}`}>
      {!isOwn && (
        <div className="message-author">
          {isDeletedUser(message.sender) ? (
            <span className="deleted-user-badge">{DELETED_USER_LABEL}</span>
          ) : (
            message.sender.username
          )}
        </div>
      )}
      {message.attachment && (
        <Attachment
          attachment={message.attachment}
          conversationId={message.conversationId}
          onMediaLoad={onMediaLoad}
        />
      )}
      {message.content && <div className="message-content">{message.content}</div>}
      <div className="message-time">{time}</div>
    </div>
  );
}

export default MessageBubble;
