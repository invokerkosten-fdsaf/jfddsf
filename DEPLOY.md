# Deploy everything on Render (auto-working)

You get 3 pieces, all on Render:
1. **Database** — your existing `invokers` Postgres (already live)
2. **API** — `client134-api` (Node + Express + pg, from `server/`)
3. **Frontend** — `client134-web` (Vite static, auto-wired to the API)

## One-click deploy

1. Push this folder to GitHub (make sure `server/.env` and `.env` are NOT
   committed — they are gitignored).
2. Render dashboard → **New → Blueprint** → select the repo.
3. When asked for `DATABASE_URL`, paste your invokers Postgres URL.
4. Deploy. Render builds API first, then the frontend with
   `VITE_API_URL=https://client134-api.onrender.com` baked in.

## Verify (no refresh needed anywhere)

- API health: `https://client134-api.onrender.com/api/health` → `{"ok":true}`
- Site: `https://client134-web.onrender.com/` → click any bank → loader
- Admin: `https://client134-web.onrender.com/#/admin`
  login `admin / admin123` → visitor auto-opens in ~2s → Ask Login → …

## If you renamed the API service

The frontend points at `https://client134-api.onrender.com` (see
`render.yaml`). If your API service has a different name, update that one
line, or set `VITE_API_URL` in the static site's Environment tab and redeploy.

## QR images (BIL flow) via Cloudinary

No upload preset needed (signed uploads — secret stays on the server).

1. Free account at cloudinary.com → Dashboard home → copy
   **Cloud name**, **API Key**, **API Secret**.
2. API service → Environment → add:
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
   `CLOUDINARY_FOLDER=qr`.
3. Admin uploads go straight to Cloudinary (with progress); replacing or
   deleting removes the old file, so exactly one image exists per session.
   Without these vars the panel falls back to Postgres storage automatically.

## Local testing (same behavior, your machine)

```powershell
cd server
npm install
npm run dev        # reads server/.env -> your Render Postgres
```
```powershell
# project root, second terminal (uses .env -> http://127.0.0.1:4000)
npm run dev
```
