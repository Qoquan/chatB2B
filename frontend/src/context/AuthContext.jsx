import { createContext, useContext, useState, useCallback, useEffect } from 'react';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL;
const TOKEN_KEY = 'token';

// Où est gardé le jeton de session ?
// - « Se souvenir de moi » coché  -> localStorage (survit à la fermeture du navigateur,
//   le jeton expire de lui-même côté serveur au bout de 8 jours) ;
// - sinon                         -> sessionStorage (oublié à la fermeture de l'onglet).
// Le mot de passe, lui, n'est JAMAIS stocké.
// Les accès sont protégés par try/catch : en navigation privée stricte, le
// navigateur peut interdire le stockage, l'appli doit alors continuer de marcher.
function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token, remember) {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  } catch {
    // stockage indisponible : la session durera jusqu'au rechargement de la page
  }
}

function clearStoredToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // rien à faire
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(readStoredToken);
  // true tant qu'on vérifie auprès du serveur que le jeton retrouvé au
  // chargement de la page est encore valable (évite d'afficher un instant
  // l'écran de connexion).
  const [loading, setLoading] = useState(() => Boolean(readStoredToken()));

  // Au chargement de la page : si un jeton est conservé, on récupère le profil
  // pour rouvrir la session sans redemander le mot de passe.
  useEffect(() => {
    const storedToken = readStoredToken();
    if (!storedToken) return undefined;

    let cancelled = false;

    async function restoreSession() {
      try {
        const res = await fetch(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${storedToken}` },
        });
        if (cancelled) return;

        if (res.ok) {
          setUser(await res.json());
        } else if (res.status === 401) {
          // Jeton expiré, invalide, ou compte supprimé : on l'oublie.
          clearStoredToken();
          setToken(null);
        }
        // Autre erreur (serveur qui redémarre, par ex.) : on garde le jeton
        // pour réessayer au prochain chargement, sans déconnecter l'utilisateur.
      } catch {
        // Serveur injoignable : même logique, le jeton est conservé.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((data, remember = false) => {
    storeToken(data.token, remember);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((patch) => {
    setUser((prev) => ({ ...prev, ...patch }));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
