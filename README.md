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

### 2. Start the Mobile App

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
