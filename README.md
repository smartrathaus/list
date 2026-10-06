# Einkaufsliste

Eine moderne, mehrbenutzer-fähige Einkaufslisten-App mit Responsive Design, Multi-User-Freigabe und SQLite/Prisma im Backend.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- Backend: Node.js + Express + TypeScript + Prisma + SQLite
- Realtime: Socket.io
- Auth: JWT

## Projektstruktur

```bash
list/
├── backend/
│   ├── prisma/
│   ├── src/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── tailwind.config.js
├── .gitignore
├── README.md
└── package-lock.json (wird nach npm install erzeugt)
```

## Schnellstart

### 1) Backend

```bash
cd backend
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run dev
```

### 2) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

## Standardzugänge

Nach dem Start kannst du lokal auf:

- Frontend: http://localhost:5173
- Backend: http://localhost:5000

Einen neuen Benutzer über das Register-Formular anlegen und anschließend einloggen.

## Features

- Mehrbenutzer-Listen und Freigabe
- Einkaufsliste mit Kategorien und Prioritäten
- Responsive UI für Smartphone und Desktop
- SQLite/Prisma als Datenbankabstraktionslayer
- Realtime-Updates bei Änderungen
- JWT-basierte Authentifizierung

## Hinweis

Das Projekt ist als sauberer Starter für dein Wunschprodukt aufgebaut und kann nach Bedarf erweitert werden, z. B. mit Suchfunktion, Erinnerungen, PWA, Bestell-Liste, Einkaufskategorien und Benachrichtigungen.
