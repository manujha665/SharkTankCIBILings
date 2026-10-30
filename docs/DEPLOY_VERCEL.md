# Deploying TruFolio to Vercel (private team link)

The prototype is a static site in `app/` — no build step, no dependencies, no secrets.
The AI Analyst runs on the built-in governed engine when hosted this way.

## Option A — from GitHub (recommended, ~2 minutes)

1. Go to **vercel.com → Add New… → Project** and import `manujha665/SharkTankCIBILings`.
2. **Project Name:** `cibilings`. If the name is free you get `https://cibilings.vercel.app`.
   Vercel checks the name as you type it on this screen; if it is taken, it says so and the URL gets a suffix
   (for example `cibilings-xyz.vercel.app`). Quick check before you start: open https://cibilings.vercel.app —
   a Vercel "404: NOT_FOUND / DEPLOYMENT_NOT_FOUND" page means no project is using it yet.
3. **Framework Preset:** `Other`. **Root Directory:** `app` (click *Edit* next to Root Directory).
   Leave Build Command and Install Command empty.
4. **Production branch:** the repo's default branch is `main`, which does not have the latest work yet.
   After the first deploy, open **Settings → Git → Production Branch**, set it to `claude/adoring-keller-t6et8b`
   and redeploy; or merge that branch into `main` first (a pull request), and Vercel deploys `main`.
5. Click **Deploy**.

## Option B — Vercel CLI from your laptop

```bash
git clone https://github.com/manujha665/SharkTankCIBILings && cd SharkTankCIBILings
git checkout claude/adoring-keller-t6et8b
npx vercel login
cd app && npx vercel link --project cibilings   # creates the project if the name is free
npx vercel deploy --prod
```

## Keeping it private

A Vercel URL is public by default. To restrict it to your team, open the project's
**Settings → Deployment Protection** and choose what your plan supports:

- **Vercel Authentication** — viewers must be logged in to Vercel as members of your Vercel team.
- **Password Protection** — one shared password for the team (a paid-plan feature at the time of writing).
- Otherwise, share the link only within the team. The site sends `noindex` so search engines won't list it,
  but anyone with the link can open it.

Check the current options on your plan in the Vercel dashboard — they change over time.

## Updating

Every push to the production branch redeploys automatically (Option A).
The single-file version (`dist/TruFolio.html`) is still the best offline backup for pitch day.

## Optional: approved LLM on Vercel

Hosting as a static site uses the governed engine. To use an approved LLM, the `/api/llm`
gateway in `server.js` would be ported to a Vercel Function with the key stored as an
environment variable — ask before enabling it on a shared link.
