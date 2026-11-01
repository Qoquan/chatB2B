import { useState } from 'react';

const COLORS = ['#5865f2', '#7a5af8', '#1b7a8f', '#2e8b57', '#c0562b', '#b23a7a'];

// Couleur stable pour un même nom, pour reconnaître les personnes d'un coup d'œil
function colorFor(name) {
  const sum = Array.from(name).reduce((total, char) => total + char.charCodeAt(0), 0);
  return COLORS[sum % COLORS.length];
}

// Photo si elle se charge, sinon initiale sur un fond coloré
function Avatar({ name = '?', src }) {
  const [broken, setBroken] = useState(false);

  if (src && !broken) {
    return <img className="avatar" src={src} alt="" onError={() => setBroken(true)} />;
  }

  return (
    <span className="avatar" style={{ background: colorFor(name) }} aria-hidden="true">
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

export default Avatar;
