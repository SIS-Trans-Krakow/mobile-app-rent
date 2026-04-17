# Trailer Handover Management App

Full-stack application for managing trailer (naczepa) handovers and returns. Includes a mobile app (Android + web build) built with Expo/React Native and a Node.js backend with SQLite database. The web build can be deployed to any static host (the included deploy script targets `/var/www/html/odbiory`).

## Features

- **User Authentication** - JWT-based login, admin creates user accounts
- **New Handover** - Record trailer handover to a company with photos mapped to trailer zones
- **Trailer Photo Template** - Interactive rectangular trailer diagram with 10 tappable zones (front, rear, sides, corners, top, interior)
- **Return Process** - Side-by-side photo comparison between handover and return state, issue marking
- **PDF Reports** - Server-generated PDF documents for handover protocols and return reports with photo comparisons
- **Admin Panel** - User management (create, activate/deactivate accounts)
- **i18n** - Polish and English language support

## Tech Stack


| Layer    | Technology                                         |
| -------- | -------------------------------------------------- |
| Mobile   | Expo SDK 54, React Native, Expo Router, TypeScript |
| Backend  | Node.js, Express, TypeScript                       |
| Database | SQLite (better-sqlite3)                            |
| Auth     | JWT (jsonwebtoken + bcrypt)                        |
| PDF      | PDFKit                                             |
| State    | Zustand                                            |
| i18n     | i18next + react-i18next                            |


## Quick Start

### Prerequisites

- Node.js 18+
- npm
- Android device/emulator (for mobile) or web browser
- Expo account logged in with EAS CLI for Android cloud builds

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

The mobile app reads the backend URL from environment variables. Copy the example file and adjust it to your backend:

```bash
cp mobile/.env.example mobile/.env
```


| File                     | Used when                      | Default value                |
| ------------------------ | ------------------------------ | ---------------------------- |
| `mobile/.env`            | development (`expo start`)     | `http://10.0.2.2:3001`       |
| `mobile/.env.production` | production build (`eas build`) | `https://api.twojadomena.pl` |


For the Android emulator, the safest default is `http://10.0.2.2:3001`. If you use `localhost`, the app also rewrites it to `10.0.2.2` on Android automatically.

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

### 4. Build Android App (EAS)

This repo already contains working npm scripts for Android builds. Use them from the `mobile` directory instead of running raw `eas build` from the repository root.

Before the first build, log in to Expo:

```bash
cd mobile
npx eas-cli@latest login
```

Set the production backend URL in `mobile/.env.production` before creating a release build:

```bash
EXPO_PUBLIC_API_URL=https://twoj-backend.example.com
```

Build types:

- `npm run build:android:apk` - creates an installable `.apk` with the `preview` profile (`distribution: internal`)
- `npm run build:android:aab` - creates a Play Store `.aab` with the `production` profile

Example commands:

```bash
cd mobile
npm install
npm run build:android:apk
```

```bash
cd mobile
npm install
npm run build:android:aab
```

Useful EAS commands:

```bash
cd mobile
npx eas-cli@latest build:list --platform android --limit 5
```

```bash
cd mobile
npx eas-cli@latest build:view <BUILD_ID>
```

### API Endpoints


| Method | Endpoint                | Description                 |
| ------ | ----------------------- | --------------------------- |
| POST   | `/api/auth/login`       | Authenticate user           |
| POST   | `/api/auth/refresh`     | Refresh access token        |
| GET    | `/api/users`            | List users (admin only)     |
| POST   | `/api/users`            | Create user (admin only)    |
| PATCH  | `/api/users/:id`        | Update user (admin only)    |
| GET    | `/api/companies`        | List companies              |
| POST   | `/api/companies`        | Create company              |
| GET    | `/api/trailers`         | List trailers               |
| POST   | `/api/trailers`         | Create trailer              |
| GET    | `/api/handovers`        | List handovers              |
| GET    | `/api/handovers/:id`    | Handover detail with photos |
| POST   | `/api/handovers`        | Create handover (multipart) |
| GET    | `/api/returns/:id`      | Return detail with photos   |
| POST   | `/api/returns`          | Create return (multipart)   |
| GET    | `/api/pdf/handover/:id` | Generate handover PDF       |
| GET    | `/api/pdf/return/:id`   | Generate return PDF         |


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


| Username | Password | Role  |
| -------- | -------- | ----- |
| admin    | admin123 | Admin |


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
# Optional — defaults to /var/www/html/odbiory
DEPLOY_WEB_PATH=/var/www/html/odbiory
# Optional — sub-path the web app is served from. Defaults to /<basename of DEPLOY_WEB_PATH>
# (e.g. /odbiory). Set to "/" if you serve at the web server root.
DEPLOY_WEB_BASE_URL=/odbiory
```

> The web deploy step uses `sudo` on the remote server only for `mkdir`/`chown` of `${DEPLOY_WEB_PATH}` (interactive — you'll be prompted for the sudo password once via TTY). The actual `rsync` runs as `${DEPLOY_USER}` after the directory ownership has been set, so no passwordless sudo is required.

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
8. Build the mobile **web app** (`expo export --platform web`) and upload `mobile/dist/` to `/var/www/html/odbiory` on the server

### 3. Deploy code updates

```bash
cd backend
./deploy.sh
```

Syncs code → `npm install` → build → PM2 restart → build & upload mobile web app to `/var/www/html/odbiory`.

### Deploying just the web app

If only the mobile/web bundle changed, you can skip the backend steps:

```bash
cd backend
./deploy.sh --web
```

This runs `npm install` + `EXPO_BASE_URL=/odbiory npx expo export --platform web` in `mobile/`, then `rsync`s `mobile/dist/` to `${DEPLOY_WEB_PATH}` (default `/var/www/html/odbiory`) on the server. After upload, ownership is set to `www-data:www-data` so the web server can read the files.

> **Important — sub-path serving:** because the app is served from `/odbiory/` (not `/`), the build is produced with `EXPO_BASE_URL=/odbiory` so all asset URLs and Expo Router routes are prefixed correctly. The deploy script derives this prefix automatically from the basename of `DEPLOY_WEB_PATH`, but you can override it via `DEPLOY_WEB_BASE_URL` in `backend/.env`. If you ever serve the app from the root of a domain, set `DEPLOY_WEB_BASE_URL=/`.

#### Apache configuration

The deploy script automatically writes a `.htaccess` file into `mobile/dist/` (and therefore into `${DEPLOY_WEB_PATH}` after upload) that:

- Falls back unknown routes to `index.html` so Expo Router deep links and full-page refreshes work.
- Sets correct MIME types for `.ttf` / `.woff2` font files used by `@expo/vector-icons`.
- Enables gzip compression and sane `Cache-Control` defaults for static assets.

For this to work, Apache needs:

1. `mod_rewrite`, `mod_mime`, `mod_deflate`, `mod_expires` enabled
   ```bash
   sudo a2enmod rewrite mime deflate expires
   sudo systemctl reload apache2
   ```
2. `AllowOverride All` for `/var/www/` (so the `.htaccess` is honoured). **On stock Ubuntu / Debian Apache this defaults to `None`, which silently disables `.htaccess` — you must change it.** Verify and fix in `/etc/apache2/apache2.conf`:
   ```bash
   grep -A3 "Directory /var/www" /etc/apache2/apache2.conf
   ```
   The block must look like this (note `AllowOverride All`, not `None`):
   ```apache
   <Directory /var/www/>
       Options Indexes FollowSymLinks
       AllowOverride All
       Require all granted
   </Directory>
   ```
   One-liner to flip it from `None` to `All`:
   ```bash
   sudo sed -i 's|AllowOverride None|AllowOverride All|' /etc/apache2/apache2.conf
   sudo apache2ctl configtest && sudo systemctl reload apache2
   ```

That's it — no VirtualHost changes are required. The app will be served at `http://<server>/odbiory/`.

##### Symptom: 404 on deep links / page refresh

If `http://<server>/odbiory/` loads fine, but visiting (or refreshing) a sub-route like `http://<server>/odbiory/return/select` returns Apache's **404 Not Found**, it means the `.htaccess` SPA fallback isn't being applied. Quick checklist:

```bash
# 1. .htaccess is actually deployed
ls -la /var/www/html/odbiory/.htaccess

# 2. mod_rewrite is loaded
apache2ctl -M | grep rewrite

# 3. AllowOverride is "All" for /var/www/
grep -A3 "Directory /var/www" /etc/apache2/apache2.conf
```

If any of these is missing, fix it as described above and reload Apache.

If you instead want a dedicated VirtualHost (e.g. `odbiory.example.com`) and serve from the root, build with `DEPLOY_WEB_BASE_URL=/` and use:

```apache
<VirtualHost *:80>
    ServerName odbiory.example.com
    DocumentRoot /var/www/html/odbiory

    <Directory /var/www/html/odbiory>
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
```

### All commands


| Command                            | Description                                           |
| ---------------------------------- | ----------------------------------------------------- |
| `./deploy.sh`                      | Push code update (sync → build → restart → web)       |
| `./deploy.sh --init`               | First-time full setup (incl. web upload)              |
| `./deploy.sh --host 10.0.0.5`      | Override target IP for any command                    |
| `./deploy.sh --env`                | Push local `.env` to server                           |
| `./deploy.sh --web`                | Build & upload mobile web app → `/var/www/html/odbiory` |
| `./deploy.sh --db-pull`            | Download `data/app.db` from server → local            |
| `./deploy.sh --db-push`            | Upload local DB to server (stops app during transfer) |
| `./deploy.sh --db-migrate OLD NEW` | Transfer DB directly between two servers              |
| `./deploy.sh --redirect NEW_IP`    | Stop app, set up HTTP 301 redirect to new server      |
| `./deploy.sh --redirect-stop`      | Remove redirect, restart normal app                   |
| `./deploy.sh --logs`               | Tail PM2 logs live                                    |
| `./deploy.sh --status`             | Show PM2 process status                               |


### Production mobile app URL

After deploying the backend, update `mobile/.env.production` with the server's IP or domain:

```
EXPO_PUBLIC_API_URL=http://1.2.3.4:3001
```

Then rebuild the mobile app with the repo scripts:

```bash
cd mobile
npm run build:android:aab
```

