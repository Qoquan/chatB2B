# ChatB2B

Application de messagerie temps réel pour équipes (B2B) — projet académique.

## Stack technique

- **Backend** : Node.js + Express + Socket.io (WebSockets)
- **Base de données** : PostgreSQL + Prisma ORM
- **Frontend** : React (Vite)
- **Auth** : JWT
- **Déploiement** : Docker + Docker Compose, VPS (Oracle Cloud Always Free)
- **CI/CD** : GitHub Actions

## Fonctionnalités MVP

- [ ] Authentification (inscription / connexion, JWT)
- [ ] Conversations privées (1:1)
- [ ] Conversations de groupe
- [ ] Envoi/réception de messages en temps réel (Socket.io)
- [ ] Notifications in-app (badge, toast, compteur non-lus)
- [ ] Permissions basiques (accès aux conversations)
- [ ] Interface responsive

## Structure du projet

```
chatB2B/
├── backend/          # API Express + Socket.io
│   ├── src/
│   │   ├── config/       # connexion DB, variables d'env
│   │   ├── controllers/  # logique métier
│   │   ├── middleware/   # auth, error handling
│   │   ├── routes/       # routes REST
│   │   └── sockets/      # gestion événements Socket.io
│   └── prisma/
│       └── schema.prisma # modèle de données
├── frontend/         # App React (Vite)
│   └── src/
│       ├── components/
│       ├── pages/
│       ├── hooks/
│       └── context/
├── docker-compose.yml
└── .github/workflows/ci.yml
```

## Démarrage local

### Prérequis
- Node.js 20+
- Docker + Docker Compose

### 1. Cloner le projet
```bash
git clone https://github.com/Qoquan/chatB2B.git
cd chatB2B
```

### 2. Lancer la base de données
```bash
docker compose up -d db
```

### 3. Backend
```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

### 4. Frontend
```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

L'app backend tourne sur `http://localhost:3000`, le frontend sur `http://localhost:5173`.

## Équipe

- [Nom 1] — github.com/Qoquan
- [Nom 2]

## Licence

Projet académique — usage pédagogique uniquement.
