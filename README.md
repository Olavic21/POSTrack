# POSTrack

> Plateforme de gestion et suivi de la chaîne **Partenaire → DSM → BTS → POS → Client**

Application web académique (MVP 14 jours) — 3 équipes : Base de données, Backend, Frontend.

## Démarrage en 2 minutes

```powershell
# Backend
cd backend
.\venv\Scripts\activate
.\venv\Scripts\python main.py

# Frontend (autre terminal)
# Important : exécuter les commandes depuis le dossier frontend/
cd frontend
npm run dev
```

→ Interface : http://localhost:5173  
→ Si le port 5173 est déjà pris, Vite bascule automatiquement sur le port suivant (ex. 5174)

Login : `admin@postrack.local` / `admin123`

**Première installation ?** Voir [docs/guides/GETTING_STARTED.md](docs/guides/GETTING_STARTED.md)

## Documentation

| Guide | Contenu |
|---|---|
| **[docs/README.md](docs/README.md)** | Index de toute la documentation |
| [docs/guides/GETTING_STARTED.md](docs/guides/GETTING_STARTED.md) | Installation complète |
| [docs/guides/DATASETUP.md](docs/guides/DATASETUP.md) | Importer les données de démo |
| [docs/architecture/PROJECT_STRUCTURE.md](docs/architecture/PROJECT_STRUCTURE.md) | Organisation des fichiers |

## Architecture

```
POSTrack/
├── backend/      # FastAPI + SQLAlchemy + SQLite
├── frontend/     # React + Vite + Tailwind
├── database/     # Schéma SQL, seed, imports Excel
└── docs/         # Documentation centralisée
```

## Stack

| Couche | Technologie |
|---|---|
| Frontend | React 19, Vite, Tailwind, Axios |
| Backend | Python, FastAPI, SQLAlchemy, JWT |
| Base | SQLite (Alembic migrations) |

## Fonctionnalités (état actuel)

- Authentification JWT (4 rôles)
- CRUD Partenaires, DSM, BTS (+ relevés)
- Lecture POS, Primes, Dashboard
- Données de démo importables depuis `database/seed.sql`

## API

- Swagger : http://localhost:8000/docs
- Health : http://localhost:8000/health

## Docker

Stack complète (MySQL + API + frontend Nginx) en une commande :

```powershell
docker compose up --build
```

→ Frontend : http://localhost:8080 · Détails dans [DOCKER.md](DOCKER.md).

## Qualité

| Commande | Cible | Résultat attendu |
|---|---|---|
| `cd backend && python -m pytest -q` | Backend | 173 tests |
| `cd frontend && npm run test:run` | Frontend | 181 tests (46 fichiers) |
| `cd frontend && npm run lint` | Frontend | 0 erreur |
| `cd frontend && npm run build` | Frontend | build de production |

Les quatre sont exécutés par la CI sur chaque push (`dev`, `main`) et chaque PR :
voir [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

### Dette technique connue

Points identifiés, volontairement laissés visibles plutôt que masqués :

1. **`frontend/src/test/vitestRuntime.js`** — l'import `vitest` dans un fichier
   de test est résolu comme dépendance externe et ne partage pas l'état du
   worker (`Cannot read properties of undefined (reading 'config')`). Le pont
   d'alias règle le symptôme, pas la cause. Retirer ce fichier dès que
   l'outillage Vite/Vitest le permet.
2. **Fichiers non typés** — `Dashboard.tsx`, `PartnersList.tsx` et
   `UsersPage.tsx` portent un `@ts-nocheck` et des `any`. Ils sont listés
   explicitement dans `frontend/eslint.config.js` pour ne pas bloquer la CI ;
   les supprimer de cette liste au fur et à mesure du retotypage.
3. **Python non épinglé localement** — les tests ont été exécutés avec les
   paquets du `site-packages` global. Utiliser un virtualenv à partir de
   `backend/requirements.txt` (c'est ce que fait la CI).
4. **Vite 7 / Node 22** — versions fixées par `.nvmrc` et `package.json`
   `engines`, à conserver alignées entre local et CI.

## Équipe

9 étudiants — 3 par équipe (DB, Backend, Frontend).

## Licence

Projet académique — tous droits réservés.
