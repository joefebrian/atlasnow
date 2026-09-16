# Deploy AtlasNow (Biznet VPS + Docker)

Stack: **Caddy** (HTTPS) → **Next.js** → **Postgres 16** + **WAHA**.

SQLite (`prisma/dev.db`) is local history only. Production and laptop dev now use Postgres. That file is **not** copied to the server.

## Laptop (hari ini)

```bash
cp .env.example .env   # if you do not already have .env
# DATABASE_URL must be the Postgres URL below

npm run compose:dev    # postgres :5433 + waha :3001
npx prisma migrate deploy
npm run db:seed        # first time only — creates admin@p2plabs.local
npm run dev            # http://localhost:3000
```

`DATABASE_URL` for laptop:

```
postgresql://atlasnow:atlasnow@localhost:5433/atlasnow?schema=public
```

Settings → API → WAHA base URL while developing: `http://localhost:3001`.

## Biznet VPS (besok)

Assume Ubuntu, domain `atlasnow.co` already pointing **A** `@` and `www` at the VPS IP. Open **TCP 80 and 443** in the Biznet panel. Do **not** open 5432 / 3000 / 3001 to the world.

```bash
sudo apt-get update
sudo apt-get install -y git docker.io docker-compose-v2
sudo usermod -aG docker "$USER"   # then log out/in

git clone <this-repo> /opt/atlasnow
cd /opt/atlasnow
cp .env.example .env
nano .env   # see required vars below
```

Required in `.env` on the VPS:

```
AUTH_SECRET=<long random, not the laptop one>
POSTGRES_PASSWORD=<long random>
WAHA_API_KEY=<long random>
APP_BASE_URL=https://atlasnow.co
ATLAS_DOMAIN=atlasnow.co
CADDY_EMAIL=hello@atlasnow.co
```

Then:

```bash
docker compose --profile prod up -d --build
docker compose exec atlas npx prisma migrate deploy   # already runs on boot
```

First admin (only if the database is empty):

```bash
# from your laptop, with DATABASE_URL tunneled, OR add tsx later.
# Fastest: create the user in the app after a one-off seed from CI/laptop
# via `ssh -L 5433:127.0.0.1:5432` then:
# DATABASE_URL=postgresql://atlasnow:PASSWORD@127.0.0.1:5433/atlasnow npm run db:seed
```

Wait ~30s for Caddy to get a Let’s Encrypt cert, then:

- https://atlasnow.co
- https://atlasnow.co/privacy
- Meta webhook: `https://atlasnow.co/api/webhooks/meta`
- Meta OAuth: `https://atlasnow.co/api/meta/oauth/callback`

## After DNS + HTTPS is green

1. Meta Developer → App Mode **Live**
2. Webhook callback = `https://atlasnow.co/api/webhooks/meta`
3. Settings → API on the server: WAHA URL `http://waha:3000` (Docker DNS, not localhost)
4. Re-scan WhatsApp QR **on the server** — laptop sessions do not move

## Data warning

Laptop `dev.db` does not come with you. Prod is a clean Postgres. Seed creates the demo agency admin, not P2P Labs production chats.
