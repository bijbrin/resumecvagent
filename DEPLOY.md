# ResumeCVAgent Deployment Guide — Dokploy on Hostinger VPS

Deploys the **resumeweb** Next.js 16 app to the existing Dokploy instance on the
Hostinger VPS. Dokploy already runs there (managing Traefik + Let's Encrypt), so
this is "add a new app" — not a fresh server install. You link GitHub, set env
vars, mount one persistent volume, add the domain.

> This app is **not** like a typical stateless web app. Two things make its
> deploy unusual, and both are handled below:
>
> 1. **Database = Neon serverless Postgres (cloud).** There is no local Postgres
>    container. The app talks to Neon over the `PrismaNeon` adapter.
> 2. **Folder-as-source-of-truth.** Resume / cover-letter / JD markdown and the
>    master `MyResume.md` / `MyCoverLetter.md` live on the **filesystem**, not in
>    Postgres (the DB stores only metadata + folder paths + file hashes). In a
>    container that filesystem **must be a persistent volume**, or every redeploy
>    wipes your content.

---

## ⭐ What YOU do manually (checklist)

Everything an LLM/automation can't do for you, in order:

- [ ] **Neon**: create/confirm the Postgres project; copy the **pooled** and
      **direct** connection strings.
- [ ] **Push schema to Neon**: run `npx prisma db push` once (from your Mac is
      fine — Neon is reachable anywhere). See [§3](#3-create-the-neon-database).
- [ ] **GitHub**: push this repo (with the new `Dockerfile` + `.dockerignore`).
- [ ] **DNS** (Hostinger hPanel → bijbrin.cloud → DNS Zone): add an **A record**
      `resume → 72.62.72.132`, plus the **Clerk CNAMEs** ([§9](#9-clerk-production-dns)).
- [ ] **Hostinger edge firewall**: allow inbound **TCP 80** and **443**, source
      `any` (keep 3000 closed). This is the usual reason "it deployed but won't
      load". See [§8](#8-make-the-public-https-url-work).
- [ ] **Dokploy UI**: create the project/app, point at GitHub, set **Build Args**
      + **Environment variables**, add a **persistent volume**, add the **domain**.
- [ ] **Seed the volume**: rsync the workspace (master files + job folders) to the
      VPS, then run `npm run sync` inside the container ([§6](#6-seed-the-workspace-volume)).
- [ ] **Clerk dashboard**: set production domain, verify CNAMEs, add allowed
      origins ([§9](#9-clerk-production-dns)).

Claude has already created the `Dockerfile` and `.dockerignore` in this repo.

---

## Server facts

- **VPS:** Hostinger Ubuntu · public IPv4 `72.62.72.132` · Tailscale `100.78.187.64`
- **Domain (this app):** `resume.bijbrin.cloud`
- **Container port:** `3000` (Traefik routes 80/443 → 3000; never expose 3000 publicly)
- **Database:** Neon serverless Postgres (cloud) — not on the VPS
- **Workspace volume (in container):** `/data/workspace` (persistent; holds all
  resume/cover-letter content)
- **Dokploy dashboard:** `:3000` on the VPS (reach via SSH tunnel or Tailscale —
  see access note)
- **Traefik:** already handles `80`/`443` + Let's Encrypt for every Dokploy app

### Opening the Dokploy dashboard from your Mac

```bash
# Option A — SSH tunnel (works now)
ssh -L 3000:localhost:3000 root@100.78.187.64
#   then browse to  http://localhost:3000

# Option B — Tailscale (Mac on the tailnet)
#   then browse to  http://100.78.187.64:3000
```

---

## 1. Push the repo to GitHub

```bash
cd /Users/bijayadhs/Desktop/JobApplication/resumeweb
git add Dockerfile .dockerignore DEPLOY.md
git commit -m "Add Dockerfile and Dokploy deployment guide"
git push origin main
```

The repo already builds with `npm run build` (= `prisma generate && next build`)
and starts with `npm run start` (`next start`, port 3000). The `Dockerfile`
wires both up.

---

## 2. Container image (already in the repo)

The committed `Dockerfile`:

- Uses `node:22-alpine`. The Neon driver is pure JS, so **no** Prisma native
  engine / openssl is required — alpine just works.
- Takes the `NEXT_PUBLIC_*` values as **build args** (they're inlined into the
  browser bundle at build time — they cannot be set only at runtime).
- Installs **all** deps (prisma/tsx/typescript are devDeps needed for the build
  and for in-container `prisma db push` / `npm run sync`).
- Ships the full app (single stage) so the **folder sync** workflow works on the
  server.
- Declares the persistent workspace volume at `/data/workspace` and defaults
  `JOB_WORKSPACE_DIR` to it.

You don't edit it for a normal deploy — just set the build args + env in Dokploy.

---

## 3. Create the Neon database

1. In the [Neon console](https://console.neon.tech), create (or reuse) a project.
2. Copy two connection strings from **Connection Details**:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL` (used by the app at runtime).
   - **Direct** (no `-pooler`) → `DIRECT_URL` (used by Prisma CLI for `db push`).
3. **Apply the schema to Neon** (run once, from your Mac):

   ```bash
   cd /Users/bijayadhs/Desktop/JobApplication/resumeweb
   # prisma.config.ts reads DIRECT_URL for db push:
   DIRECT_URL="postgresql://<user>:<pw>@ep-xxx.<region>.aws.neon.tech/<db>?sslmode=require" \
     npx prisma db push
   ```

   This project has **no `prisma/migrations` dir** — it uses `prisma db push`,
   not `migrate deploy`. Re-run `db push` whenever `prisma/schema.prisma` changes.

> You can also run `db push` from inside the container later
> (`docker exec -it <container> npx prisma db push`) since Dokploy injects
> `DIRECT_URL` there — but doing it once from your Mac is simplest.

---

## 4. Create the Dokploy project + application

1. Open Dokploy (SSH tunnel / Tailscale, see above).
2. New **Project**: `resumeagent`.
3. Add **Application**: `resumeweb`.
4. **Source** = Git/GitHub → this repository, branch `main`.
5. **Build Type** = **Dockerfile** (path `Dockerfile`).

---

## 5. Build Args + Environment variables

### 5a. Build Args (app → Advanced → Build Args)

`NEXT_PUBLIC_*` are baked into the client bundle at build time, so they go here
(real values, not placeholders):

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_APP_URL=https://resume.bijbrin.cloud
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/optimizer
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/optimizer
```

### 5b. Runtime Environment variables (app → Environment)

**Required** (the app throws at startup if the DB URL or an LLM key is missing):

```env
DATABASE_URL=postgresql://<user>:<pw>@ep-xxx-pooler.<region>.aws.neon.tech/<db>?sslmode=require
DIRECT_URL=postgresql://<user>:<pw>@ep-xxx.<region>.aws.neon.tech/<db>?sslmode=require
OPENROUTER_API_KEY=sk-or-...          # primary LLM provider (>=1 LLM key required)
CLERK_SECRET_KEY=sk_live_...
# Also set the NEXT_PUBLIC_* values here so server-side reads match the bundle:
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
NEXT_PUBLIC_APP_URL=https://resume.bijbrin.cloud
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/optimizer
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/optimizer
# Workspace root (matches the volume mount in §6; Dockerfile already defaults it):
JOB_WORKSPACE_DIR=/data/workspace
```

**Optional** (set what you use):

```env
# Extra LLM fallbacks (chain: OpenRouter → Kimi → OpenAI → Anthropic)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
KIMI_API_KEY=...
USE_KIMI_STRATEGY=false
USE_KIMI_WRITER=false
USE_KIMI_COVER_LETTER=false
# Model overrides
# OPENROUTER_MODEL=deepseek/deepseek-v4-flash
# Enrichment
FIRECRAWL_API_KEY=
SERPER_API_KEY=
# "Request a feature" email (Gmail SMTP app password)
GMAIL_USER=bijbrin@gmail.com
GMAIL_APP_PASSWORD=xxxxxxxxxxxxxxxx
LOG_LEVEL=info
```

> **Not needed:** `BLOB_READ_WRITE_TOKEN` — `@vercel/blob` isn't installed and the
> token is unused at runtime. PDFs/DOCX are generated on the fly from the folder
> markdown (`pdf-lib`, `docx`, `mammoth`) — no Puppeteer/Chromium required.

---

## 6. Seed the workspace volume (the part people forget)

The app reads/writes the job folders + master files on disk. Without a
persistent volume the content disappears on every redeploy.

### 6a. Add the volume in Dokploy

App → **Advanced → Volumes / Mounts** → add a **Bind Mount**:

- **Host path:** `/srv/resumeagent/workspace`
- **Container path:** `/data/workspace`

(`JOB_WORKSPACE_DIR=/data/workspace` from §5 points the app at it.)

### 6b. Copy your workspace to the VPS

From your Mac, push the master files + all job folders (excluding the app itself):

```bash
rsync -avz \
  --exclude resumeweb --exclude node_modules --exclude tools --exclude '.git' \
  /Users/bijayadhs/Desktop/JobApplication/ \
  root@100.78.187.64:/srv/resumeagent/workspace/
```

After this, `/srv/resumeagent/workspace/` should contain `MyResume.md`,
`MyCoverLetter.md`, and each job folder (`coreconsumable/`, `giveagrab/`, …).

### 6c. Populate the DB from the folders

`npm run sync` must run **inside the container** so each `folderPath` it records
points at `/data/workspace/<slug>` (server paths, not Mac paths):

```bash
ssh root@100.78.187.64
docker ps | grep resumeweb            # find the container name/id
docker exec -it <container> npm run sync
```

This imports folders → Neon and writes `application.yaml` sidecars back to the
volume. Re-run it any time you add folders directly on the server.

---

## 7. Domain + SSL (Dokploy UI)

App → **Domains** → Add Domain:

- **Host:** `resume.bijbrin.cloud`
- **Internal port:** `3000`
- **HTTPS:** on · **Provider:** Let's Encrypt

The UI writes `/etc/dokploy/traefik/dynamic/resume.yml` (a `web` + `websecure`
router). **The UI is the source of truth** — don't hand-edit that file; a manual
edit reverts on the next redeploy.

Then click **Deploy** and watch the build logs.

---

## 8. Make the public HTTPS URL work

A green "running" status does **not** mean the URL is reachable. Run this
sequence (proven on this VPS for other apps). All `ssh` targets the VPS over
Tailscale: `ssh root@100.78.187.64`.

### 8.1 DNS points at the VPS
```bash
dig +short resume.bijbrin.cloud        # → 72.62.72.132
```
Add the A record in Hostinger hPanel → Domains → bijbrin.cloud → DNS Zone if missing.

### 8.2 Traefik is running
```bash
ssh root@100.78.187.64 'docker ps --filter name=dokploy-traefik --format "{{.Names}} {{.Status}}"'
```
If nothing returns, Traefik is down and no Dokploy domain serves. Make sure
nothing squats port 80 (`ss -tlnp | grep -E ":80 |:443 "`; stop any stray host
`nginx`), then restore it with Dokploy's own settings:
```bash
ssh root@100.78.187.64 'docker run -d --name dokploy-traefik --restart=always \
  --network dokploy-network \
  -v /etc/dokploy/traefik/traefik.yml:/etc/traefik/traefik.yml:ro \
  -v /etc/dokploy/traefik/dynamic:/etc/dokploy/traefik/dynamic \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p 80:80 -p 443:443/tcp -p 443:443/udp -p 8080:8080 \
  traefik:latest'
```

### 8.3 Open the edge firewall — the usual blocker
Host UFW may allow 80/443, but **Hostinger's cloud firewall drops them**. In
Hostinger hPanel → VPS → **Firewall**, add inbound:
`accept TCP 80 any any` and `accept TCP 443 any any`.

> Source **must be `any`** — Let's Encrypt validates over HTTP-01 from many
> rotating global IPs, so you can't restrict the source and still get a cert.

Rules take ~5 min to sync. Verify from your Mac (outside the VPS):
```bash
nc -z -G 8 72.62.72.132 80  && echo "80 OPEN"
nc -z -G 8 72.62.72.132 443 && echo "443 OPEN"
```

### 8.4 Force the cert + verify end-to-end
```bash
ssh root@100.78.187.64 'docker restart dokploy-traefik'    # forces ACME retry
# From your Mac (no -k → proves a real, trusted cert):
curl -s -o /dev/null -w "%{http_code}\n" https://resume.bijbrin.cloud/          # → 200
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://resume.bijbrin.cloud/  # → 308 → https
```
Done when `https://resume.bijbrin.cloud` returns 200 with a trusted cert. There
is no dedicated `/api/health` route — use `/` for health checks.

---

## 9. Clerk production DNS

Adding the domain in Dokploy is **not enough** for Clerk. A `pk_live_…` key loads
Clerk JS from your custom Frontend-API host (`clerk.resume.bijbrin.cloud`); with
no DNS record you get `ClerkRuntimeError: failed_to_load_clerk_js`. Fix it in
DNS — these subdomains are served by Clerk's infra, not Traefik.

### 9.1 Add Clerk CNAMEs (Hostinger hPanel → bijbrin.cloud → DNS Zone)
Copy the **exact targets** from Clerk Dashboard → **Configure → Domains**
(Production instance) — they're unique per app. ~5 records:

| Host (subdomain)             | Type  | Target (use the dashboard value) |
|------------------------------|-------|----------------------------------|
| `clerk.resume`               | CNAME | `frontend-api.clerk.services`    |
| `accounts.resume`            | CNAME | `accounts.clerk.services`        |
| `clkmail.resume`             | CNAME | `mail.…clerk.services`           |
| `clk._domainkey.resume`      | CNAME | DKIM target                      |
| `clk2._domainkey.resume`     | CNAME | DKIM target                      |

### 9.2 In the Clerk Dashboard (Production)
- Production domain = `resume.bijbrin.cloud`.
- After the CNAMEs propagate, click **Verify** so Clerk provisions its cert.
- Add `https://resume.bijbrin.cloud` to allowed origins / redirect URLs.
- Clerk production requires HTTPS on the app domain → Traefik provides it (needs
  edge ports 80/443 open, §8.3).

### 9.3 Keys: prod vs local
- **Production (Dokploy only):** `pk_live_…` / `sk_live_…`.
- **Local dev (`.env.local`):** keep the **test** keys (`pk_test_…`) — they load
  Clerk JS from `*.clerk.accounts.dev`, no custom DNS needed. Never commit either.

### 9.4 Verify Clerk
```bash
dig +short clerk.resume.bijbrin.cloud    # → Clerk CNAME target (not empty)
curl -I https://resume.bijbrin.cloud     # → 200, valid Let's Encrypt cert
```
Then load the site: no `failed_to_load_clerk_js`, and sign-in/up completes.

---

## 10. Verify the deployment

```bash
curl -I https://resume.bijbrin.cloud           # → 200 + trusted cert
```
In the browser: sign in, open **Applications** — your seeded job folders should
appear (proves the Neon DB + the workspace volume are both wired). Open one and
check Resume/Cover Letter render and the `.pdf` / `.docx` download buttons work.

---

## 11. Future deployments

Code changes redeploy themselves: **push to `main`** → in Dokploy click
**Deploy** (or enable auto-deploy via the GitHub webhook). The persistent volume
and Neon DB are untouched by a redeploy.

After a `prisma/schema.prisma` change, re-apply the schema:
```bash
DIRECT_URL="<neon-direct-url>" npx prisma db push     # from your Mac, or
docker exec -it <container> npx prisma db push         # inside the container
```

If you add job folders directly on the server volume, re-run sync:
```bash
docker exec -it <container> npm run sync
```

---

## Security summary

- [ ] Neon connection strings live **only** in Dokploy env (pooled = `DATABASE_URL`,
      direct = `DIRECT_URL`); never committed.
- [ ] `.env*` is gitignored; all secrets live in Dokploy (env + build args).
- [ ] Clerk keys are **production** (`pk_live_…`/`sk_live_…`) on the server,
      **test** keys locally.
- [ ] Container port `3000` is never published publicly — only Traefik (80/443)
      reaches it. Dokploy panel port `3000` stays closed at the edge firewall.
- [ ] Edge firewall (Hostinger hPanel) allows inbound `80`/`443` with source `any`.
- [ ] HTTPS via Traefik/Let's Encrypt; auto-renews.
- [ ] The `/data/workspace` volume holds all resume/cover-letter PII on disk —
      it is **never** in Postgres. Back it up (`rsync` the host path) like a DB.
