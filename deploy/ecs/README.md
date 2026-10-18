# ROKA IZUMI Alibaba Cloud ECS staging

This is a **staging** setup for the 2 vCPU / 2 GiB ECS. It does not point DNS to the ECS or modify any live database. The app binds to **127.0.0.1:3000 only**, so it is not publicly accessible. The MySQL volume is separate and initially empty.

## Prerequisites

- ECS Linux host with Docker Engine and Docker Compose v2 installed, Git installed, and enough free disk.
- Clone `https://github.com/809540023-lgtm/rokaizumi-tw-app.git` to the ECS.
- `cd rokaizumi-tw-app`
- `cp .env.example .env`, then securely edit `.env`. Set strong `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `JWT_SECRET`, and any required integrations. **Do not commit .env.** Avoid URL-reserved characters in DB_PASSWORD unless encoded in DATABASE_URL. Use staging Stripe keys and disable production outbound notifications until verified.
- Check `docker compose version`. If RAM is limited, add swap on the host according to your OS policy before building.

## Safe staging start

```bash
docker compose --env-file .env -f deploy/ecs/compose.yaml config --quiet
docker compose --env-file .env -f deploy/ecs/compose.yaml build app
docker compose --env-file .env -f deploy/ecs/compose.yaml up -d
docker compose --env-file .env -f deploy/ecs/compose.yaml ps
docker compose --env-file .env -f deploy/ecs/compose.yaml logs --tail=100 app
curl -I http://127.0.0.1:3000/
```

If the server is remote, use `ssh -L 3000:127.0.0.1:3000 USER@ECS_IP` from a local computer and open `http://127.0.0.1:3000`.

**Do not run** `pnpm db:push`, `scripts/seed-220-products.mjs`, or restore any SQL until an authoritative production backup is verified, a migration plan is approved, and the schema is compared. This compose setup creates an empty staging DB; the app provisions its own schema on first boot (see below). Never use `docker compose down -v` on a database containing valuable data.

## Schema bootstrap

`server/db.ts` calls `bootstrapDatabase()` once the pool connects. It applies every
`drizzle/*.sql` migration (idempotently, ignoring already-exists errors) and seeds
`products` from `data/products-full.json`. The runtime image therefore ships
`drizzle/` and `data/products-full.json` alongside `dist/` — do not remove those
`COPY` lines from `deploy/ecs/Dockerfile`, or the container will come up with an
empty database and silently fall back to static data.

Watch the first boot to confirm it worked:

```bash
docker compose --env-file .env -f deploy/ecs/compose.yaml logs -f app | grep -E "資料庫|bootstrap|商品"
```

To re-run the bootstrap manually, restart the app container — the bootstrap is
idempotent and runs on every boot:

```bash
docker compose --env-file .env -f deploy/ecs/compose.yaml restart app
```

Before production cutover: inventory all sites/branches, capture checksummed DB and uploads backups, compare orders/users, test checkout/webhooks/mail/LINE, add a reverse proxy with valid TLS, then change DNS. This staging stack is not a completed production migration.
