import './Reactions.css';

// Petite barre de boutons emoji, utilisée pour réagir à un message et pour
// écrire un message. Le parent décide de la liste et de ce qui se passe au clic.
function EmojiPicker({ emojis, onPick, label, className = '' }) {
  return (
    <div className={`emoji-picker ${className}`} role="group" aria-label={label}>
      {emojis.map((emoji) => (
        <button
          key={emoji}
          type="button"
          className="emoji-option"
          onClick={() => onPick(emoji)}
          aria-label={emoji}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

export default EmojiPicker;
