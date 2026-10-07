import { useState } from 'react';
import Attachment from './Attachment';
import EmojiPicker from './EmojiPicker';
import { REACTION_EMOJIS } from '../utils/emojis';
import { isDeletedUser, DELETED_USER_LABEL } from '../utils/userName';
import { getEmojiOnly, chunk } from '../utils/emojiText';
import './DeletedUser.css';
import './Reactions.css';
import './EmojiSize.css';

// Regroupe les réactions par emoji : { emoji, count, mine }, dans l'ordre d'apparition
function groupReactions(reactions, currentUserId) {
  const groups = new Map();
  reactions.forEach(({ emoji, userId }) => {
    const group = groups.get(emoji) || { emoji, count: 0, mine: false };
    group.count += 1;
    if (userId === currentUserId) group.mine = true;
    groups.set(emoji, group);
  });
  return [...groups.values()];
}

// Texte du message. Un message composé UNIQUEMENT d'emojis est affiché en très grand :
// 1 ou 2 emojis sur une ligne, et au-delà par rangées de 2 (comme plusieurs messages
// empilés). Un emoji au milieu d'un texte garde la taille normale.
function MessageText({ text }) {
  const emojis = getEmojiOnly(text);
  if (!emojis) return <div className="message-content">{text}</div>;

  return (
    <div className="message-content emoji-only">
      {chunk(emojis, 2).map((row, index) => (
        <div key={index} className="emoji-row">
          {row.map((emoji, i) => (
            <span key={i}>{emoji}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

function MessageBubble({ message, isOwn, currentUserId, onMediaLoad, onToggleReaction }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const time = new Date(message.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const groups = groupReactions(message.reactions ?? [], currentUserId);

  function handlePick(emoji) {
    setPickerOpen(false);
    onToggleReaction(message.id, emoji);
  }

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
      {message.content && <MessageText text={message.content} />}
      <div className="message-time">{time}</div>

      {groups.length > 0 && (
        <div className="message-reactions">
          {groups.map((group) =>
            onToggleReaction ? (
              <button
                key={group.emoji}
                type="button"
                className={`reaction-chip${group.mine ? ' mine' : ''}`}
                aria-pressed={group.mine}
                onClick={() => onToggleReaction(message.id, group.emoji)}
              >
                {group.emoji} {group.count}
              </button>
            ) : (
              <span key={group.emoji} className="reaction-chip">
                {group.emoji} {group.count}
              </span>
            )
          )}
        </div>
      )}

      {onToggleReaction && (
        <>
          <button
            type="button"
            className="reaction-add"
            aria-label="Réagir à ce message"
            aria-expanded={pickerOpen}
            onClick={() => setPickerOpen((open) => !open)}
          >
            ☺
          </button>
          {pickerOpen && (
            <EmojiPicker
              emojis={REACTION_EMOJIS}
              onPick={handlePick}
              label="Choisir une réaction"
              className="reaction-picker"
            />
          )}
        </>
      )}
    </div>
  );
}

export default MessageBubble;
