# Trailer Handover Management App

Full-stack application for managing trailer (naczepa) handovers and returns. Includes a mobile app (Android + web preview) built with Expo/React Native and a Node.js backend with SQLite database.

## Features

- **User Authentication** - JWT-based login, admin creates user accounts
- **New Handover** - Record trailer handover to a company with photos mapped to trailer zones
- **Trailer Photo Template** - Interactive rectangular trailer diagram with 10 tappable zones (front, rear, sides, corners, top, interior)
- **Return Process** - Side-by-side photo comparison between handover and return state, issue marking
- **PDF Reports** - Server-generated PDF documents for handover protocols and return reports with photo comparisons
- **Admin Panel** - User management (create, activate/deactivate accounts)
- **i18n** - Polish and English language support

## Tech Stack

| Layer    | Technology                                              |
|----------|---------------------------------------------------------|
| Mobile   | Expo SDK 54, React Native, Expo Router, TypeScript      |
| Backend  | Node.js, Express, TypeScript                            |
| Database | SQLite (better-sqlite3)                                 |
| Auth     | JWT (jsonwebtoken + bcrypt)                             |
| PDF      | PDFKit                                                  |
| State    | Zustand                                                 |
| i18n     | i18next + react-i18next                                 |

## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Android device/emulator (for mobile) or web browser

### 1. Start the Backend

```bash
cd backend
npm install
npm run dev
```

The backend starts on `http://localhost:3001`. A default admin user is created automatically:
- **Username:** `admin`
- **Password:** `admin123`

### 2. Configure the Mobile App

The mobile app reads the backend URL from environment variables. Copy the example file and adjust if needed:

```bash
cp mobile/.env.example mobile/.env
```

| File | Used when | Default value |
|---|---|---|
| `mobile/.env` | development (`expo start`) | `http://localhost:3001` |
| `mobile/.env.production` | production build (`eas build`) | `https://api.twojadomena.pl` |

The app automatically replaces `localhost` with `10.0.2.2` when running on the Android emulator, so you don't need to change anything for local development.

For a **physical device** on a local network, set your machine's local IP in `mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://192.168.1.100:3001
```

### 3. Start the Mobile App

```bash
cd mobile
npm install
npx expo start
```

Then press:
- `w` for web browser
- `a` for Android emulator
- Scan QR code with Expo Go app on physical device

### API Endpoints

| Method | Endpoint                  | Description                  |
|--------|---------------------------|------------------------------|
| POST   | `/api/auth/login`         | Authenticate user            |
| POST   | `/api/auth/refresh`       | Refresh access token         |
| GET    | `/api/users`              | List users (admin only)      |
| POST   | `/api/users`              | Create user (admin only)     |
| PATCH  | `/api/users/:id`          | Update user (admin only)     |
| GET    | `/api/companies`          | List companies               |
| POST   | `/api/companies`          | Create company               |
| GET    | `/api/trailers`           | List trailers                |
| POST   | `/api/trailers`           | Create trailer               |
| GET    | `/api/handovers`          | List handovers               |
| GET    | `/api/handovers/:id`      | Handover detail with photos  |
| POST   | `/api/handovers`          | Create handover (multipart)  |
| GET    | `/api/returns/:id`        | Return detail with photos    |
| POST   | `/api/returns`            | Create return (multipart)    |
| GET    | `/api/pdf/handover/:id`   | Generate handover PDF        |
| GET    | `/api/pdf/return/:id`     | Generate return PDF           |

## Project Structure

```
mobile-app-rent/
├── backend/
│   ├── src/
│   │   ├── index.ts              # Express server entry
│   │   ├── database/
│   │   │   ├── schema.ts         # SQLite schema
│   │   │   └── seed.ts           # Default admin user
│   │   ├── middleware/
│   │   │   └── auth.ts           # JWT auth middleware
│   │   ├── routes/
│   │   │   ├── auth.ts           # Login / refresh
│   │   │   ├── users.ts          # User CRUD (admin)
│   │   │   ├── companies.ts      # Company CRUD
│   │   │   ├── trailers.ts       # Trailer CRUD
│   │   │   ├── handovers.ts      # Handover CRUD
│   │   │   ├── returns.ts        # Return CRUD
│   │   │   └── pdf.ts            # PDF generation
│   │   ├── services/
│   │   │   └── pdf.service.ts    # PDF rendering (PDFKit)
│   │   └── types/
│   │       └── index.ts          # TypeScript types
│   ├── uploads/                  # Photo storage
│   └── data/                     # SQLite database
├── mobile/
│   ├── app/                      # Expo Router screens
│   │   ├── (auth)/login.tsx      # Login screen
│   │   └── (app)/
│   │       ├── index.tsx         # Dashboard
│   │       ├── handover/         # Handover flow
│   │       ├── return/           # Return flow
│   │       └── admin/            # Admin panel
│   ├── components/
│   │   ├── TrailerTemplate.tsx   # Interactive trailer diagram
│   │   └── PhotoCapture.tsx      # Camera/gallery photo capture
│   ├── i18n/                     # PL/EN translations
│   ├── services/api.ts           # Axios API client
│   ├── stores/auth.ts            # Zustand auth store
│   └── constants/theme.ts        # Colors, spacing, fonts
└── README.md
```

## Default Credentials

| Username | Password   | Role  |
|----------|------------|-------|
| admin    | admin123   | Admin |

---

## Backend Deployment (Production)

The backend ships with a `deploy.sh` script for deploying to a remote Ubuntu server via SSH. All commands are run from your machine, not the server.

### Prerequisites

- SSH access to the server (key-based auth recommended)
- `rsync` and `scp` available locally

### 1. Configure deploy variables

Add the following to `backend/.env` (copy from `.env.example`):

```
DEPLOY_USER=ubuntu
DEPLOY_HOST=1.2.3.4
DEPLOY_PATH=/home/ubuntu/trailer-handover-api
```

### 2. First deploy

```bash
cd backend
./deploy.sh --init
```

This will (only installs what's missing — safe on shared servers):
1. Install system packages (`build-essential`, `sqlite3`, etc.)
2. Install Node.js 20 if not present or version is older
3. Install PM2 globally if not present; configure `pm2-logrotate` if not already set up
4. Sync code via `rsync`
5. Push local `.env` to server
6. Run `npm install` + `tsc` build
7. Start app with PM2 and enable systemd autostart

### 3. Deploy code updates

```bash
cd backend
./deploy.sh
```

Syncs code → `npm install` → build → PM2 restart.

### All commands

| Command | Description |
|---|---|
| `./deploy.sh` | Push code update (sync → build → restart) |
| `./deploy.sh --init` | First-time full setup |
| `./deploy.sh --host 10.0.0.5` | Override target IP for any command |
| `./deploy.sh --env` | Push local `.env` to server |
| `./deploy.sh --db-pull` | Download `data/app.db` from server → local |
| `./deploy.sh --db-push` | Upload local DB to server (stops app during transfer) |
| `./deploy.sh --db-migrate OLD NEW` | Transfer DB directly between two servers |
| `./deploy.sh --redirect NEW_IP` | Stop app, set up HTTP 301 redirect to new server |
| `./deploy.sh --redirect-stop` | Remove redirect, restart normal app |
| `./deploy.sh --logs` | Tail PM2 logs live |
| `./deploy.sh --status` | Show PM2 process status |

### Production mobile app URL

After deploying the backend, update `mobile/.env.production` with the server's IP or domain:

```
EXPO_PUBLIC_API_URL=http://1.2.3.4:3001
```

Then rebuild the mobile app with EAS:

```bash
cd mobile
eas build --profile production --platform android
```
