import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import '../pages/Site.css';

const THEME_KEY = 'chatb2b-site-theme';

// Thème initial : choix mémorisé, sinon préférence du système.
function readTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light') return saved;
  } catch (err) {
    // stockage indisponible : on retombe sur la préférence du système
  }
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
}

// Cadre commun des pages publiques (accueil et tarifs) : en-tête, contenu, pied de page.
function SiteLayout() {
  const [theme, setTheme] = useState(readTheme);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      // pas grave : le thème sera simplement oublié au prochain chargement
    }
  }, [theme]);

  return (
    <div className="site" data-theme={theme}>
      <header className="site-header">
        <Link to="/" className="site-brand">
          <span aria-hidden="true">🐾</span> ChatB2B
        </Link>

        <nav className="site-nav" aria-label="Navigation principale">
          <NavLink to="/" end>
            Accueil
          </NavLink>
          <NavLink to="/pricing">Tarifs</NavLink>
        </nav>

        <div className="site-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
            title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <Link to="/login" className="btn btn-ghost">
            Se connecter
          </Link>
          <Link to="/register" className="btn btn-primary">
            Essayer maintenant
          </Link>
        </div>
      </header>

      <main className="site-main">
        <Outlet />
      </main>

      <footer className="site-footer">
        <span>© 2026 ChatB2B — projet pédagogique 5IDEV</span>
        <span>
          <Link to="/pricing">Tarifs</Link> · <Link to="/login">Connexion</Link>
        </span>
      </footer>
    </div>
  );
}

export default SiteLayout;
