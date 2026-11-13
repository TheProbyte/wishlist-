# The Giver

A dark, clean gift app for birthdays, Christmas and anything else. Paste a link from Amazon or any shop and the gift fills itself in. Rank what you want most, rate it, sort it into categories, note the size and colour, and share the list so givers can claim gifts without doubling up.

See [PLAN.md](PLAN.md) for the full plan.

## What works now

- **Lists** for any occasion, with a date and a countdown.
- **Add from a link:** title, picture, price, shop, and the selected size/colour on Amazon. It reads Amazon's page layout, the product data most shops publish for Google, and standard share tags. If a shop blocks the lookup, the editor opens with whatever was found (at worst, a name taken from the link) so you can finish by hand.
- **Add by hand** for anything without a link.
- **Details** per gift (size, colour, fit, model…). The category suggests which ones, e.g. Clothes asks for Size, Colour, Fit.
- **Most wanted** ranking (drag on desktop, arrows on phones), a 1–5 star rating, quantity and a note to the giver.
- **Sort** by most wanted, rating, price or newest. **Filter** by category.
- **Categories:** ten built-in, plus your own with icon, colour and suggested details.
- **Sharing:** a private link. Givers tap "I'll get this", other givers see it's taken, and no one needs an account.

## Not yet

- **Google sign-in.** For now the app runs as a single user (`src/lib/server/auth.ts`). Until sign-in lands, anyone who can open the site can edit the lists, so don't put the deployed URL anywhere public. It also means the owner can see claims on the share page.
- Price/stock re-checks, copying images into R2, the browser extension and phone share sheet. These are steps 5–6 in the plan.

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
   - **Project name:** `the-giver` (it must match `name` in `wrangler.jsonc`)
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
