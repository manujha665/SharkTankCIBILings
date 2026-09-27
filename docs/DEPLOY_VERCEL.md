# Deploying PortfolioIQ to Vercel (private team link)

The prototype is a static site in `app/` — no build step, no dependencies, no secrets.
The AI Analyst runs on the built-in governed engine when hosted this way.

## Option A — from GitHub (recommended, ~2 minutes)

1. Go to **vercel.com → Add New… → Project** and import `manujha665/SharkTankCIBILings`.
2. **Project Name:** `portfolioiqtucl` (Vercel project names are lowercase; the URL is not case-sensitive).
   If the name is free you get `https://portfolioiqtucl.vercel.app`; if it is taken, Vercel shows it before you deploy and suggests a variant.
3. **Framework Preset:** `Other`. **Root Directory:** `app` (click *Edit* next to Root Directory).
   Leave Build Command and Install Command empty.
4. **Production branch:** set to `claude/adoring-keller-t6et8b`, or merge it into `main` first.
5. Click **Deploy**.

## Option B — Vercel CLI from your laptop

```bash
git clone https://github.com/manujha665/SharkTankCIBILings && cd SharkTankCIBILings
git checkout claude/adoring-keller-t6et8b
npx vercel login
npx vercel deploy app --prod --name portfolioiqtucl   # answer the prompts; root = app
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
The single-file version (`dist/PortfolioIQ.html`) is still the best offline backup for pitch day.

## Optional: approved LLM on Vercel

Hosting as a static site uses the governed engine. To use an approved LLM, the `/api/llm`
gateway in `server.js` would be ported to a Vercel Function with the key stored as an
environment variable — ask before enabling it on a shared link.
