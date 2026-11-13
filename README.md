# The Giver

A dark, clean gift app for birthdays, Christmas and anything else. Paste a link from Amazon or any shop and the gift fills itself in. Rank what you want most, rate it, sort it into categories, note the size and colour, and share the list so givers can claim gifts without doubling up.

See [PLAN.md](PLAN.md) for the full plan.

## What works now

- **Everything list:** one list holding every gift you’d love. Occasion lists (birthday, Christmas…) are optional: put any gift on any of them. A gift claimed on one list is taken everywhere.
- **Add from anywhere:** paste a link, use your phone’s share menu (Android, once installed), or the “Add to The Giver” bookmark (any browser, including iPhone Safari). The bookmark reads the page in your browser, so shops can’t block it, and on an Amazon wish list it brings in every item. Pasting a public Amazon wish list link also works.
- **Gift details:** size, colour and more, with sizes filled in from your saved sizes. Your own photo, ratings, ranking, notes, duplicate warning, move/copy between lists.
- **Dates that look after themselves:** Christmas needs no date; birthdays are entered once and roll on every year.
- **Sharing:** a private link to your Everything list or any single list. Givers filter by category and price, see your sizes, and tap “I’ll get this”. You never see who’s getting what.
- **Kids’ lists:** keep lists for your kids, clearly labelled with their names.
- **People** (needs sign-in): family and friend circles, everyone’s upcoming birthdays, “gifts I’m getting” with a bought tick, and Secret Santa with a fair draw where each person sees only their own match.
- **Price drops and stock:** gifts are re-checked as lists are viewed (about once a day each); a drop shows a sticker and the old price.

## Switch on Google sign-in

Until this is done the app runs as one shared account (everything works except People). About 10 minutes:

1. Go to [console.cloud.google.com](https://console.cloud.google.com), create a project (any name).
2. **APIs & Services → OAuth consent screen:** choose *External*, app name “The Giver”, your email as support and developer contact. Save. Then **Publish app** (basic sign-in needs no review).
3. **APIs & Services → Credentials → Create credentials → OAuth client ID:** type *Web application*. Under **Authorized redirect URIs** add `https://YOUR-SITE/auth/callback` (your workers.dev address or own domain). Create, and keep the Client ID and Client secret.
4. In Cloudflare: **Workers & Pages → thegiver → Settings → Runtime variables and secrets → Add variable**. Type *Secret*, name `GOOGLE_CLIENT_ID`, paste the ID. Add another: `GOOGLE_CLIENT_SECRET` with the secret. Save (Cloudflare redeploys by itself).
5. Open the site and sign in **first**: the first account to sign in takes over the lists you made before sign-in.

## Run it locally

```sh
npm install
npm run db:migrate     # creates the local D1 database
npm run dev            # http://localhost:5173
npm test               # importer tests (saved product pages, no network)
```

## Put it online (auto-updates on every push)

One-time setup in the Cloudflare dashboard. After this, every push to GitHub rebuilds and redeploys the site by itself.

1. Sign in at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Workers & Pages → Create → Import a repository**, connect GitHub, and pick this repo.
3. On the settings screen:
   - **Project name:** `thegiver` (it must match `name` in `wrangler.jsonc`, currently `thegiver`)
   - **Build command:** `npm run build`
   - **Deploy command:** `npm run deploy`
   - **Production branch:** the branch you want live
4. **Save and Deploy.** The first build takes 1–2 minutes and gives you a `the-giver.<you>.workers.dev` address.

The first deploy also creates the database (D1, named `the-giver`), and every deploy applies any new database changes from `migrations/`. You don't need to create the database yourself.

To use your own domain later: the project → **Settings → Domains & Routes → Add**.

### Deploying by hand instead

```sh
npx wrangler login
npm run build && npm run deploy
```

## Stack

SvelteKit 3 on Cloudflare Workers, D1 (SQLite) for data, Tailwind 4. The importer is `src/lib/server/importer.ts`.
