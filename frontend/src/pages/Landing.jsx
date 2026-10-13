import { Link } from 'react-router-dom';

const FEATURES = [
  {
    icon: '⚡',
    title: 'Temps réel',
    text: 'Les messages arrivent instantanément, sans recharger la page, avec l’indicateur « en train d’écrire ».',
  },
  {
    icon: '👥',
    title: 'Conversations privées et de groupe',
    text: 'Échangez à deux ou en équipe, avec nom, avatar et gestion des membres.',
  },
  {
    icon: '🔔',
    title: 'Notifications utiles',
    text: 'Badge de messages non lus, alerte à l’écran, compteur dans l’onglet et notification du navigateur.',
  },
  {
    icon: '📎',
    title: 'Pièces jointes sécurisées',
    text: 'Images, PDF et documents Office jusqu’à 5 Mo, vérifiés avant d’être acceptés.',
  },
  {
    icon: '😀',
    title: 'Réactions et emojis',
    text: 'Répondez d’un clic avec une réaction ; un message composé d’emojis s’affiche en grand.',
  },
  {
    icon: '🔒',
    title: 'Vos données vous appartiennent',
    text: 'Suppression de compte conforme au RGPD : vos données personnelles sont anonymisées.',
  },
];

const STEPS = [
  { n: '1', title: 'Créez votre compte', text: 'Une adresse e-mail et un mot de passe suffisent.' },
  {
    n: '2',
    title: 'Invitez votre équipe',
    text: 'Ouvrez des conversations privées ou créez un groupe.',
  },
  {
    n: '3',
    title: 'Échangez en direct',
    text: 'Messages, fichiers et réactions, sur ordinateur comme sur mobile.',
  },
];

function Landing() {
  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="badge">Messagerie d’équipe B2B</span>
          <h1>La messagerie d’équipe simple, sécurisée et en temps réel.</h1>
          <p className="lead">
            ChatB2B réunit vos conversations, vos fichiers et vos décisions au même endroit, pour
            que votre équipe avance sans noyer ses échanges dans les e-mails.
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn btn-primary btn-lg">
              Essayer maintenant
            </Link>
            <Link to="/pricing" className="btn btn-outline btn-lg">
              Voir les tarifs
            </Link>
          </div>
          <p className="hint">Gratuit pour démarrer · Aucune carte bancaire demandée</p>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="mock">
            <div className="mock-side">
              <div className="mock-item active">Équipe produit</div>
              <div className="mock-item">Design</div>
              <div className="mock-item">Support</div>
            </div>
            <div className="mock-chat">
              <div className="mock-title">Équipe produit</div>
              <div className="bubble other">La maquette est validée 👍</div>
              <div className="bubble me">Parfait, je la mets en ligne.</div>
              <div className="bubble other">
                <span className="file">📎 planning.pdf</span>
              </div>
              <div className="reaction">❤️ 2</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2>Tout ce qu’il faut pour travailler ensemble</h2>
        <p className="section-lead">
          Des fonctionnalités concrètes, déjà disponibles en production.
        </p>
        <div className="grid">
          {FEATURES.map((f) => (
            <article className="card" key={f.title}>
              <div className="card-icon" aria-hidden="true">
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section alt">
        <h2>Prêt en trois étapes</h2>
        <div className="steps">
          {STEPS.map((s) => (
            <div className="step" key={s.n}>
              <span className="step-n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="cta-band">
          <h2>Passez à une messagerie qui vous ressemble</h2>
          <p>Créez votre compte en moins d’une minute et invitez votre équipe.</p>
          <div className="hero-cta center">
            <Link to="/register" className="btn btn-light btn-lg">
              Essayer maintenant
            </Link>
            <Link to="/pricing" className="btn btn-outline-light btn-lg">
              Comparer les offres
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

export default Landing;
