# Setup guide

This walks you through the two things Caddie Book can use: an **OpenRouter** key (for the AI
coach) and a **Turso** database (for cloud storage). You can do it by hand, or let **Claude Code**
do most of it for you.

> **TL;DR for the impatient:** to just try it on your laptop you only need an OpenRouter key.
> Turso is only needed if you want to deploy it to the cloud. Skip to
> [Path A](#path-a--run-it-on-your-laptop-easiest).

---

## Doing it with Claude Code (recommended)

If you have [Claude Code](https://claude.com/claude-code) installed, you don't have to follow the
manual steps below. Open this project folder in Claude Code and paste:

```
Set up Caddie Book on my machine. Read SETUP.md, then walk me through getting an
OpenRouter key, create a Turso database for me if I want cloud storage, write my
.env.local, and start the app. Ask me for anything you can't get yourself.
```

Claude Code can run every command in this guide for you: create the Turso DB, capture the URL
and token, write `.env.local`, and launch the dev server. The only things it can't do are the
parts that need *your* login: signing up for OpenRouter and pasting your key, and approving the
Turso browser sign-in. It'll pause and ask you for those.

---

## Path A: Run it on your laptop (easiest)

You only need an OpenRouter key for this. Rounds save to a local `caddie.db` file. No database
account required.

### 1. Get an OpenRouter key
1. Go to https://openrouter.ai and sign up.
2. Open https://openrouter.ai/keys and click **Create Key**. Copy it (starts with `sk-or-`).
3. Add a few dollars of credit at https://openrouter.ai/credits (the coach uses cents per use).

### 2. Put it in the project
```bash
cp .env.example .env.local
```
Open `.env.local` and paste your key:
```
OPENROUTER_API_KEY=sk-or-your-key-here
```
Leave the `TURSO_*` lines blank.

### 3. Run it
```bash
npm install
npm run dev
```
Open the URL it prints. Done. Your rounds live in `caddie.db` on your machine.

> No key? The app still loads, the demo buttons work without one. You just won't get the AI coach.

---

## Path B: Deploy it to the cloud (so it's on your phone)

To run on Vercel you need **Turso**, because Vercel's filesystem is read-only and the local-file
fallback can't save there. Turso's free tier is plenty.

### 1. Create a Turso database
Install the Turso CLI (pick one):
```bash
brew install tursodatabase/tap/turso          # macOS, Homebrew
# or:
curl -sSfL https://tur.so/install.sh | bash   # macOS / Linux
```

Then create the database and grab its credentials:
```bash
turso auth signup                              # opens a browser to sign in
turso db create caddie-book
turso db show caddie-book --url                # -> TURSO_DATABASE_URL  (libsql://...)
turso db tokens create caddie-book             # -> TURSO_AUTH_TOKEN
```

### 2. Deploy to Vercel
The fastest way is the **Deploy with Vercel** button in the [README](README.md#deploy-your-own-copy-recommended-for-sharing).
It'll prompt you for the env vars. Paste in:

| Variable | Value |
|----------|-------|
| `OPENROUTER_API_KEY` | your `sk-or-...` key |
| `TURSO_DATABASE_URL` | the `libsql://...` URL from above |
| `TURSO_AUTH_TOKEN` | the token from above |
| `APP_PASSCODE` | any passcode you want, to lock the app (optional) |

Or from the CLI in this folder:
```bash
npm i -g vercel
vercel link
vercel env add OPENROUTER_API_KEY production
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel env add APP_PASSCODE production          # optional
vercel --prod
```

### 3. Add it to your phone
Open your Vercel URL in Safari → **Share** → **Add to Home Screen**. It installs like an app.

---

## Loading your golf data

Once it's running, get your rounds in via the **Upload** tab → **18Birdies** tile. See
[the README](README.md#get-your-data-in-the-front-door) for how to export your 18Birdies archive.

---

## Each person runs their own copy

Caddie Book holds one golfer's data per deployment. If you're sharing it with friends, have each
of them do their own setup above, that way everyone's rounds stay private and separate. Don't
have friends type into your live URL; they'd be writing into your database.
