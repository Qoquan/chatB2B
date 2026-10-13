import { Link } from 'react-router-dom';

// Adresse affichée pour les demandes de devis (à remplacer par une vraie adresse de contact).
const CONTACT_EMAIL = 'contact@chatb2b.example';

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price: '0 €',
    period: 'pour toujours',
    description: 'Pour tester ChatB2B avec une petite équipe.',
    features: [
      'Jusqu’à 5 membres',
      '1 000 messages par mois',
      'Pièces jointes de 1 Mo, 50 Mo de stockage',
      'Historique conservé 30 jours',
      'Support communautaire',
    ],
    cta: { label: 'Essayer maintenant', to: '/register', style: 'btn-outline' },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '6 €',
    period: 'par utilisateur et par mois',
    description: 'Pour les équipes qui travaillent tous les jours dans ChatB2B.',
    popular: true,
    features: [
      'Membres illimités',
      'Messages illimités',
      'Pièces jointes de 5 Mo, 10 Go de stockage',
      'Historique conservé sans limite',
      'Support par e-mail',
    ],
    cta: { label: 'Essayer Pro maintenant', to: '/register', style: 'btn-primary' },
  },
  {
    id: 'enterprise',
    name: 'Entreprise',
    price: 'Sur devis',
    period: 'selon vos besoins',
    description: 'Pour les organisations avec des exigences de sécurité et de suivi.',
    features: [
      'Tout ce que contient Pro',
      'Quotas et rétention sur mesure',
      'Support prioritaire dédié',
      'Accompagnement au déploiement',
      'Options de sécurité sur demande',
    ],
    cta: {
      label: 'Demander un devis',
      href: `mailto:${CONTACT_EMAIL}?subject=Devis%20ChatB2B`,
      style: 'btn-outline',
    },
  },
];

const TABLE = [
  ['Membres', '5', 'Illimité', 'Illimité'],
  ['Messages par mois', '1 000', 'Illimité', 'Illimité'],
  ['Taille d’une pièce jointe', '1 Mo', '5 Mo', '5 Mo'],
  ['Stockage des pièces jointes', '50 Mo', '10 Go', 'Sur mesure'],
  ['Rétention de l’historique', '30 jours', 'Illimitée', 'Configurable'],
  ['Conversations privées et de groupe', '✓', '✓', '✓'],
  ['Messages en temps réel et notifications', '✓', '✓', '✓'],
  ['Réactions et emojis', '✓', '✓', '✓'],
  ['Suppression de compte conforme au RGPD', '✓', '✓', '✓'],
  ['Support', 'Communauté', 'E-mail', 'Prioritaire'],
  ['Options de sécurité avancées', '—', '—', 'Sur demande'],
];

const FAQ = [
  {
    q: 'Puis-je changer d’offre plus tard ?',
    a: 'Oui, vous pouvez passer d’une offre à l’autre à tout moment, sans perdre vos conversations.',
  },
  {
    q: 'Faut-il une carte bancaire pour commencer ?',
    a: 'Non. L’offre Free ne demande aucun moyen de paiement.',
  },
  {
    q: 'Comment fonctionne le tarif Pro ?',
    a: 'Il est facturé 6 € par utilisateur actif et par mois. Vous ne payez que pour les membres de votre équipe.',
  },
  {
    q: 'Que contient l’offre Entreprise ?',
    a: 'Elle est définie avec vous : taille de l’équipe, besoins de sécurité et accompagnement. Demandez un devis.',
  },
];

function Pricing() {
  return (
    <>
      <section className="section center-text">
        <span className="badge">Tarifs</span>
        <h1>Des tarifs simples, qui grandissent avec votre équipe</h1>
        <p className="lead">Commencez gratuitement, passez à Pro quand vous en avez besoin.</p>
      </section>

      <section className="plans">
        {PLANS.map((plan) => (
          <article className={`plan${plan.popular ? ' popular' : ''}`} key={plan.id}>
            {plan.popular && <span className="plan-flag">Le plus choisi</span>}
            <h2>{plan.name}</h2>
            <p className="plan-desc">{plan.description}</p>
            <p className="plan-price">
              <strong>{plan.price}</strong>
              <span>{plan.period}</span>
            </p>
            <ul>
              {plan.features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {plan.cta.to ? (
              <Link to={plan.cta.to} className={`btn ${plan.cta.style} btn-block`}>
                {plan.cta.label}
              </Link>
            ) : (
              <a href={plan.cta.href} className={`btn ${plan.cta.style} btn-block`}>
                {plan.cta.label}
              </a>
            )}
          </article>
        ))}
      </section>

      <section className="section">
        <h2>Comparer les offres</h2>
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th scope="col">Fonctionnalité</th>
                <th scope="col">Free</th>
                <th scope="col">Pro</th>
                <th scope="col">Entreprise</th>
              </tr>
            </thead>
            <tbody>
              {TABLE.map(([label, ...cells]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  {cells.map((c, i) => (
                    <td key={i}>{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="note">
          ChatB2B est un projet pédagogique : les prix et les limites des offres sont fictifs et
          aucun paiement n’est proposé.
        </p>
      </section>

      <section className="section alt">
        <h2>Questions fréquentes</h2>
        <div className="faq">
          {FAQ.map((item) => (
            <details key={item.q}>
              <summary>{item.q}</summary>
              <p>{item.a}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}

export default Pricing;
