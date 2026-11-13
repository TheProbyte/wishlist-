# Wishlist: build plan

A dark, clean gift app for birthdays, Christmas and any other occasion. Each person signs in with their own Google account, pastes a link from any shop, and the item appears with its picture, title and price. Items can be ranked, rated, categorised and given specifics such as size and colour.

## 1. What the app does

**Lists and occasions**
- A person has any number of lists: "Birthday 2027", "Christmas", "House stuff", or a general always-on list.
- A list can have an occasion date, which drives a countdown and sorts upcoming occasions first.

**Adding an item from any website**
- Paste a URL, and the app fetches the title, main image, price, currency, shop name and description.
- Everything fetched is editable, and an item can also be added entirely by hand (for things with no link).
- Three ways in, all feeding the same importer:
  1. Paste box in the app.
  2. Browser extension / bookmarklet: one click on the product page you are looking at.
  3. Phone share sheet: the app installs as a PWA and appears as a share target, so "Share → Wishlist" works from the Amazon app or any browser.

**Organising**
- **Most wanted:** drag to reorder, plus a 1–5 "how much I want it" rating. Sort by rank, rating, price, date added.
- **Categories:** Clothes, Tech, Books, Home, and so on. A few are built in; people can add their own, with a colour and icon.
- Filter by category, price range, shop, and "still available".

**Specifics (size, colour, and so on)**
- Every item has a free-form list of specifics: `Size: 32x32`, `Colour: dark indigo`, `Fit: slim`.
- The category suggests the fields, so Clothes offers size / colour / fit, Shoes offers size / width, Tech offers storage / colour, and Books offers format.
- When the link already points at a chosen variant (Amazon and most shops encode this in the URL or page), the importer pre-fills those specifics.
- Also: quantity wanted, and a note to the gift-giver ("any colour but red").

**Sharing and claiming**
- Share a list by link, or with specific people by their Google email.
- A viewer can mark an item "I'm getting this", so nobody buys it twice. The list owner never sees who claimed what, or that anything was claimed, so the surprise is kept.

## 2. Amazon and auto-sync: what is and is not possible

| Wanted | Possible? | How |
|---|---|---|
| Paste an Amazon link, get picture, title, price | Yes | Importer (section 4) |
| Prices and availability stay current | Yes | Scheduled re-check of every item; shows "price dropped" and "out of stock" |
| Automatically mirror your Amazon wish list into the app | No official way | Amazon has no API for reading a customer's wish list |
| One-off import of an existing Amazon list | Yes, with the extension | The extension reads the list page while you are logged in to Amazon and sends the items over |
| Mark as bought when someone orders on Amazon | No | Amazon does not expose order data to third parties |

Two caveats that shape the design:

- **Amazon blocks server-side fetching fairly often.** Requests from Cloudflare's network will sometimes get a robot check instead of the product page. This is why the extension and share sheet matter: they read the page in your own browser, where it always loads. The server importer is the first attempt, the extension the reliable one.
- **Amazon's official product API is only for affiliates.** It gives clean price and image data, but needs an Amazon Associates account that keeps generating sales. It is optional: worth adding later if the app gets real use, in which case links can carry an affiliate tag. The current name and terms of that API should be checked at the time, as Amazon has been changing it.

## 3. Tech stack (all on Cloudflare)

| Piece | Choice |
|---|---|
| Hosting and server | Cloudflare Workers with static assets |
| App framework | SvelteKit with the Cloudflare adapter, TypeScript |
| Styling | Tailwind CSS, dark theme only |
| Database | D1 (SQLite), Drizzle for schema and migrations |
| Images | R2: product images are copied in at import time so they never break or hotlink |
| Background work | Cron Triggers plus Queues for price re-checks |
| Sign-in | Google OAuth 2.0 (OpenID Connect), sessions in D1 behind a secure HTTP-only cookie |
| Hard pages | Cloudflare Browser Rendering as a fallback for shops that need JavaScript to show a price |

Expected cost at personal / family scale: the free tiers, apart from the domain.

## 4. How the importer works

For a given URL, try each step until the fields are filled:

1. **Shop-specific adapter** for the big ones (Amazon first, then others as needed): knows exactly where title, price, image and selected variant live.
2. **Structured data:** `schema.org/Product` JSON-LD and microdata, which most shops publish for Google and which includes price, currency and availability.
3. **Open Graph / meta tags:** title, image, description.
4. **Heuristics:** largest image, price-shaped text near the title.
5. **Headless render** through Browser Rendering, then steps 2–4 again.
6. **Give up gracefully:** show the form with whatever was found and let the person fill in the rest.

The extension and share sheet run steps 1–4 in the browser and post the result, skipping the fetch entirely.

Safety: only fetch public `http(s)` URLs, block internal addresses, cap response size and time, rate-limit per user.

## 5. Data model

- `users`: id, Google subject id, name, email, avatar
- `sessions`: id, user id, expiry
- `lists`: id, owner, name, occasion type, occasion date, visibility (private / link / people), share token
- `list_members`: list id, email or user id (who it is shared with)
- `categories`: id, owner (null for built-in), name, colour, icon, suggested specifics
- `items`: id, list id, category id, url, shop, title, description, image key, price, currency, availability, rank, rating, quantity, note, last checked
- `item_specifics`: item id, label, value, position
- `price_history`: item id, price, checked at
- `claims`: item id, claimer user id, quantity, created at (never returned to the list owner)

## 6. Look and feel

- Dark only. Near-black background (`#0b0b0f`), slightly lifted cards, hairline borders, one accent colour (warm violet or amber, to be picked on the first screen build).
- Image-led card grid with a compact list view toggle. Big product image, title, price, rating stars, category chip, specifics as small pills.
- Generous spacing, one typeface (Inter), soft rounded corners, subtle motion on add / reorder.
- Adding an item is the centrepiece: a paste box always in reach, with the card filling itself in as data arrives.
- Works as well on a phone as on a desktop; installable.

## 7. Build order

1. **Foundation:** project scaffold, D1 schema, deploy pipeline to Cloudflare, Google sign-in, empty dark shell.
2. **Lists and manual items:** create lists, add / edit / delete items by hand, categories, specifics, rating, drag-to-rank, sort and filter.
3. **Importer:** paste a URL and get a filled-in item; Amazon adapter; images into R2.
4. **Sharing and claiming:** share links, invited people, hidden claims.
5. **Keeping current:** scheduled price and stock checks, price history, "price dropped" badges.
6. **Capture everywhere:** PWA with share target, then the browser extension, including one-off Amazon list import.
7. **Optional:** Amazon affiliate API, email reminders before an occasion, price-drop notifications.

Steps 1–3 give a usable personal app; 4 makes it a gift app.

## 8. Needed from you before building

- A Cloudflare account (and a domain, if you want one other than `*.workers.dev`).
- A Google Cloud project with an OAuth client ID and secret; I can walk through the consent-screen setup.
- A name for the app, and a preference on accent colour.
- Whether sign-in should be open to anyone with a Google account or limited to an invite list of emails.
