# ChatB2B

Messagerie d'équipe en temps réel pour les petites entreprises : conversations privées et de groupe, fichiers, réactions et notifications.

- **Production :** https://chatb2b-frontend.onrender.com
- **Projet académique** — 5IDEV, 2026-2027

## Fonctionnalités

- Inscription, connexion par JWT et option « Se souvenir de moi »
- Conversations privées (1:1) et groupes (nom, photo, ajout de membres)
- Messages en temps réel, indicateur « écrit… » et historique paginé
- Notifications : badge de non-lus, toast, titre de l'onglet et notification du navigateur
- Pièces jointes (5 Mo maximum) et réactions emoji
- Page de profil et suppression de compte conforme au RGPD (anonymisation)
- Interface responsive, landing page et page de tarifs

## Stack technique

| Partie          | Technologies                                |
| --------------- | ------------------------------------------- |
| Backend         | Node.js 20, Express, Socket.io              |
| Base de données | PostgreSQL, Prisma                          |
| Frontend        | React, Vite                                 |
| Tests et CI     | Vitest, Supertest, GitHub Actions           |
| Hébergement     | Render (application), Neon (base de données) |

## Installation locale

### Prérequis

- Node.js 20 ou plus
- Une base PostgreSQL vide en UTF-8, en local ou sur une branche Neon de développement

N'utilisez jamais la base de production pour le développement ou les tests.

### 1. Récupérer le projet

```bash
git clone https://github.com/Qoquan/chatB2B.git
cd chatB2B
```

### 2. Backend

```bash
cd backend
cp .env.example .env     # puis renseigner DATABASE_URL, DIRECT_URL et JWT_SECRET
npm install
npx prisma migrate deploy
npm run db:seed          # facultatif : données de démonstration
npm run dev
```

L'API répond sur `http://localhost:3000`. Vérifiez avec `http://localhost:3000/health`.

### 3. Frontend

Dans un second terminal :

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

L'application s'ouvre sur `http://localhost:5173`.

### Données de démonstration

`npm run db:seed` crée cinq comptes, un groupe, des conversations privées, une pièce jointe et des réactions. Exemple de connexion : `clairemartin@demo.chatb2b.local`, mot de passe `demo1234`.

Le script peut être relancé sans créer de doublon. Il refuse de s'exécuter en production et sur une base distante, car ces comptes ont un mot de passe public. Pour une base distante de développement, ajoutez `ALLOW_REMOTE_SEED=true`.

## Variables d'environnement

| Fichier          | Variable                           | Rôle                                                 |
| ---------------- | ---------------------------------- | ---------------------------------------------------- |
| `backend/.env`   | `DATABASE_URL`                     | Connexion à la base (via le pooler sur Neon)         |
| `backend/.env`   | `DIRECT_URL`                       | Connexion directe, utilisée par les migrations       |
| `backend/.env`   | `JWT_SECRET`                       | Clé de signature des jetons                          |
| `backend/.env`   | `FRONTEND_URL`                     | Origine autorisée par CORS                           |
| `backend/.env`   | `ALLOWED_ORIGINS`                  | Origines supplémentaires, séparées par des virgules  |
| `frontend/.env`  | `VITE_API_URL`, `VITE_SOCKET_URL`  | Adresse du backend                                   |

## Commandes utiles

| Dossier    | Commande                 | Effet                                  |
| ---------- | ------------------------ | -------------------------------------- |
| `backend`  | `npm test`               | Lance les tests (base PostgreSQL requise) |
| `backend`  | `npm run lint`           | Vérifie le code                        |
| `backend`  | `npm run format:check`   | Vérifie le formatage                   |
| `backend`  | `npm run prisma:migrate` | Crée une migration                     |
| `frontend` | `npm run lint`           | Vérifie le code                        |
| `frontend` | `npm run build`          | Construit le site                      |

## Structure du projet

```
chatB2B/
├── backend/
│   ├── prisma/           # schéma, migrations et seed
│   ├── src/
│   │   ├── config/       # base de données, CORS
│   │   ├── controllers/  # logique métier
│   │   ├── middleware/   # authentification, erreurs, envoi de fichiers, limitation
│   │   ├── routes/       # routes REST
│   │   ├── sockets/      # événements Socket.io
│   │   └── utils/        # validation et règles métier
│   └── tests/
├── frontend/
│   └── src/
│       ├── components/
│       ├── context/      # session utilisateur
│       ├── hooks/        # connexion Socket.io
│       ├── pages/
│       └── utils/
├── render.yaml           # description des services Render
└── .github/workflows/ci.yml
```

## Déploiement

À chaque pull request, GitHub Actions lance le lint, le formatage, les tests sur une base PostgreSQL jetable et le build. Au merge sur `main`, Render redéploie le backend et le site statique, et applique les migrations avec `prisma migrate deploy`.

Les secrets sont dans les variables d'environnement de Render, jamais dans le dépôt.

## Équipe

- Charlotte Bizel
- Loïc Boulanger

## Licence

Projet académique — usage pédagogique uniquement.
