# AtlasNow

**Optimize Every Location. Capture More Demand.**

Local Demand-to-Action Control Tower for multi-location brands (P2P Labs product).

> Turn existing Google presence into measurable local growth.

## Domain

- **Production:** [https://atlasnow.co](https://atlasnow.co)
- **Local:** [http://localhost:3000](http://localhost:3000)

Google OAuth redirect URIs (register both on the Web client):

- `https://atlasnow.co/api/google/oauth/callback`
- `http://localhost:3000/api/google/oauth/callback`

Set `APP_BASE_URL` to match the environment you are running.

## Fase 1 (current)

- Staff login (JWT cookie session)
- Multi-tenant membership + roles
- App shell + module navigation (PRD §5.1) + **Settings** (Branding + API Configuration)
- Frontend branding panel (logo, tagline, hero, promise, growth flow) → SQLite
- Control Tower: BrandStory + demo GBP Performance / Reviews / Posts
- Data Health: **live** Google Business Profile OAuth (agency), no mock
- Module placeholders for later sprints
- Audit log on login/logout

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind
- Prisma 5 + Postgres 16 (Docker). SQLite `dev.db` is unused leftover.
- jose + bcryptjs auth

## Paths

| | |
|---|---|
| Repo | `/Users/joefebrian/Downloads/Working Desk/Atlas Technology/atlasnow` |
| Vault | `/Users/joefebrian/Downloads/Working Desk/Obsidian/mygrok` → `02 Projects/atlasnow` (PRD, Blueprint, **Monetization PRD**) |

## Database

Postgres 16 (Docker). SQLite `prisma/dev.db` is leftover local history and is not used.

```bash
cp .env.example .env
npm run compose:dev          # Postgres :5433 (WAHA on laptop stays :3001)
npx prisma migrate deploy
npm run db:seed
npm run dev                  # http://localhost:3000
```

VPS (Biznet): see [`deploy/README.md`](deploy/README.md).

Open [http://localhost:3000](http://localhost:3000) → **Staff login**

### Demo users (agency admin)

| Email | Password | Role | Workspace |
|---|---|---|---|
| `admin@p2plabs.local` | `AtlasNow@2026` | SUPER_ADMIN | **P2P Labs** (`p2p-labs`) |
| `analyst@p2plabs.local` | `AtlasNow@2026` | ANALYST | **P2P Labs** (`p2p-labs`) |

Sample client: **Demo Brand** (`demo-brand`) — login inactive until activated under **Admin → Clients**.

- **Clients** (`/clients`) — client database, create brand, activate login  
- **Settings** (`/settings`) — logo, bilingual brand copy, language

## Scripts

```bash
npm run dev
npm run build
npm run db:seed
npm run db:migrate
```

## WAHA

Temporary WhatsApp bridge only — Meta Cloud API is the long-term target. Feature-flagged in later fase (Conversations module stub already in nav).
