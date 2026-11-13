import type { ImportResult } from '../types';

/**
 * Turns a product URL from any shop into title, image, price and specifics.
 *
 * Order of attempts, each filling whatever the previous ones left empty:
 *   1. Shop adapter (Amazon)
 *   2. schema.org Product data (JSON-LD), which most shops publish for Google
 *   3. Open Graph / product meta tags
 *   4. Plain <title> and the URL itself
 *
 * Nothing here throws for a bad page: the caller always gets a result it can show
 * in the editor, with `ok: false` when nothing useful was found.
 */

const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 12_000;

const BROWSER_HEADERS: Record<string, string> = {
	'user-agent':
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
	accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
	'accept-language': 'en-US,en;q=0.9'
};

export function normaliseUrl(input: string): URL | null {
	let raw = input.trim();
	// Pull the first link out of pasted text like "Check this out https://..."
	const found = raw.match(/https?:\/\/[^\s<>"']+/i);
	if (found) raw = found[0];
	else if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(raw)) raw = 'https://' + raw;
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return null;
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
	if (isPrivateHost(url.hostname)) return null;
	return url;
}

function isPrivateHost(host: string): boolean {
	const h = host.toLowerCase().replace(/^\[|\]$/g, '');
	if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
	if (!h.includes('.') && !h.includes(':')) return true;
	if (h.includes(':')) return true; // IPv6 literals: not needed for shops, so refuse them all
	const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
	if (v4) {
		const [a, b] = [Number(v4[1]), Number(v4[2])];
		if (a === 10 || a === 127 || a === 0 || a >= 224) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true;
	}
	return false;
}

export async function importProduct(input: string): Promise<ImportResult> {
	const url = normaliseUrl(input);
	if (!url) return empty(input, 'That doesn’t look like a web link.');

	let res: Response;
	try {
		res = await fetch(url.toString(), {
			headers: BROWSER_HEADERS,
			redirect: 'follow',
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		const r = baseResult(url);
		r.error = 'The shop didn’t respond in time.';
		return finish(r, url);
	}

	// Short links (a.co, amzn.to, bit.ly) only become a product URL after redirects.
	let finalUrl = url;
	try {
		if (res.url) finalUrl = new URL(res.url);
	} catch {
		/* keep the original */
	}

	if ((res.headers.get('content-type') ?? '').startsWith('image/')) {
		const r = baseResult(finalUrl);
		r.image_url = finalUrl.toString();
		r.images = [r.image_url];
		r.ok = true;
		return r;
	}

	const html = await readCapped(res).catch(() => '');
	return parseProductPage(finalUrl, html, { status: res.status });
}

/** The parsing half of the importer: no network, so it can be tested with saved pages. */
export function parseProductPage(url: URL, html: string, opts: { status?: number } = {}): ImportResult {
	const result = baseResult(url);
	const status = opts.status ?? 200;
	if (status === 403 || status === 429 || status === 503) result.blocked = true;

	if (isAmazon(url) && isAmazonBotWall(html)) {
		result.blocked = true;
		return finish(result, url);
	}
	if (isAmazon(url)) fillFromAmazon(result, html, url);
	fillFromJsonLd(result, html, url);
	fillFromMeta(result, html, url);
	fillFromTitleTag(result, html);
	return finish(result, url);
}

function baseResult(url: URL): ImportResult {
	const amazon = isAmazon(url);
	const result = empty((amazon ? amazonCanonical(url) : stripTracking(url)).toString());
	result.store = storeName(url);
	if (amazon) result.currency = amazonCurrency(url.hostname);
	fillFromUrl(result, url);
	return result;
}

function empty(url: string, error?: string): ImportResult {
	return {
		ok: false,
		blocked: false,
		url,
		store: null,
		title: null,
		description: null,
		image_url: null,
		images: [],
		price_cents: null,
		currency: null,
		availability: 'unknown',
		specifics: [],
		category_id: null,
		error
	};
}

const BLOCK_TITLES =
	/^(access denied|just a moment|attention required|are you a (human|robot)|robot check|security check|captcha|page not found|404|403|forbidden|error|sorry!?|pardon our interruption)\b/i;

function finish(r: ImportResult, original: URL): ImportResult {
	// Bot walls and error pages still have a <title>; don't mistake them for a product.
	if (r.title && BLOCK_TITLES.test(r.title)) {
		r.blocked = true;
		r.title = null;
		r.description = null;
	}
	// The page couldn't be read: shops like Amazon put a readable name in the path.
	if (!r.title) r.title = titleFromSlug(original);
	if (r.title) r.title = tidyTitle(r.title, r.store);
	if (r.description) r.description = clip(r.description, 600);
	r.images = [...new Set(r.images.filter(Boolean))].slice(0, 8);
	if (!r.image_url && r.images.length) r.image_url = r.images[0];
	r.category_id = guessCategory(r.title ?? '');
	r.ok = Boolean(r.title && (r.image_url || r.price_cents != null));
	if (r.blocked && !r.error) r.error = `${r.store ?? 'The shop'} blocked the automatic lookup. Fill in what’s missing, or try again in a minute.`;
	return r;
}

async function readCapped(res: Response): Promise<string> {
	if (!res.body) return '';
	const reader = res.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	while (total < MAX_BYTES) {
		const { done, value } = await reader.read();
		if (done) break;
		chunks.push(value);
		total += value.length;
	}
	reader.cancel().catch(() => {});
	const all = new Uint8Array(total);
	let off = 0;
	for (const c of chunks) {
		all.set(c.subarray(0, Math.min(c.length, total - off)), off);
		off += c.length;
		if (off >= total) break;
	}
	return new TextDecoder('utf-8', { fatal: false }).decode(all);
}

/* ---------------------------------------------------------------- Amazon */

function isAmazon(url: URL): boolean {
	return /(^|\.)amazon\.[a-z.]+$/i.test(url.hostname) || /(^|\.)amzn\.(to|eu|asia)$/i.test(url.hostname) || url.hostname === 'a.co';
}

function amazonAsin(url: URL): string | null {
	const m = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|exec\/obidos\/asin|o\/asin)\/([A-Z0-9]{10})/i);
	return m ? m[1].toUpperCase() : null;
}

function amazonCanonical(url: URL): URL {
	const asin = amazonAsin(url);
	if (!asin || !/amazon\./i.test(url.hostname)) return url;
	return new URL(`https://${url.hostname.replace(/^(?!www\.)/, 'www.')}/dp/${asin}`);
}

function amazonCurrency(host: string): string {
	const h = host.toLowerCase();
	if (h.endsWith('.co.uk')) return 'GBP';
	if (/\.(de|fr|it|es|nl|ie|be)$/.test(h)) return 'EUR';
	if (h.endsWith('.ca')) return 'CAD';
	if (h.endsWith('.com.au')) return 'AUD';
	if (h.endsWith('.co.jp')) return 'JPY';
	if (h.endsWith('.in')) return 'INR';
	if (h.endsWith('.com.mx')) return 'MXN';
	return 'USD';
}

function isAmazonBotWall(html: string): boolean {
	return (
		/validateCaptcha|Enter the characters you see below|api-services-support@amazon\.com|To discuss automated access/i.test(html) ||
		(html.length < 15000 && !/productTitle/.test(html))
	);
}

const AMAZON_DIMENSIONS: Record<string, string> = {
	size: 'Size',
	color: 'Colour',
	style: 'Style',
	fit_type: 'Fit',
	pattern: 'Pattern',
	material_type: 'Material',
	configuration: 'Configuration',
	edition: 'Edition',
	platform_for_display: 'Platform',
	item_package_quantity: 'Pack size',
	flavor: 'Flavour',
	scent: 'Scent'
};

function fillFromAmazon(r: ImportResult, html: string, base: URL) {
	const title = html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i);
	if (title) r.title ||= text(title[1]);

	// Price: the "price to pay" block is the one shown in the buy box.
	const blocks = [
		/class=["'][^"']*priceToPay[^"']*["'][\s\S]{0,400}?class=["']a-offscreen["']>([^<]+)</i,
		/id=["']corePrice(?:Display_desktop)?_feature_div["'][\s\S]{0,1500}?class=["']a-offscreen["']>([^<]+)</i,
		/id=["']apex_desktop["'][\s\S]{0,2000}?class=["']a-offscreen["']>([^<]+)</i,
		/id=["']priceblock_(?:ourprice|dealprice|saleprice)["'][^>]*>([^<]+)</i,
		/class=["']a-offscreen["']>([^<]*\d[^<]*)</i
	];
	for (const re of blocks) {
		const m = html.match(re);
		const p = m && parsePrice(text(m[1]));
		if (p) {
			r.price_cents ??= p.cents;
			if (p.currency) r.currency = p.currency;
			break;
		}
	}

	const hires = html.match(/data-old-hires=["'](https:[^"']+)["']/i);
	if (hires) r.images.push(hires[1]);
	const dyn = html.match(/data-a-dynamic-image=["']([^"']+)["']/i);
	if (dyn) {
		const map = safeParse<Record<string, number[]>>(decode(dyn[1]));
		if (map) {
			const sorted = Object.entries(map).sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1]);
			for (const [src] of sorted) r.images.push(src);
		}
	}
	const landing = html.match(/id=["']landingImage["'][^>]*src=["'](https:[^"']+)["']/i);
	if (landing) r.images.push(landing[1]);
	for (const m of html.matchAll(/"hiRes":"(https:[^"]+)"/g)) r.images.push(m[1]);
	r.images = r.images.map((s) => absolute(s, base)).filter((s): s is string => !!s);

	// Selected variant: Amazon shows the chosen size/colour next to each dimension.
	const seen = new Set<string>();
	const add = (dim: string, value: string) => {
		const label = AMAZON_DIMENSIONS[dim.toLowerCase()] ?? titleCase(dim.replace(/_/g, ' '));
		const v = text(value).replace(/^:\s*/, '');
		if (!v || seen.has(label) || v.length > 60 || /^select$/i.test(v)) return;
		seen.add(label);
		r.specifics.push({ label, value: v });
	};
	for (const m of html.matchAll(/inline-twister-expanded-dimension-text-(\w+?)_name["'][^>]*>([^<]+)</g)) add(m[1], m[2]);
	for (const m of html.matchAll(/id=["']variation_(\w+?)_name["'][\s\S]{0,600}?class=["']selection["'][^>]*>([^<]+)</g))
		add(m[1], m[2]);
	for (const m of html.matchAll(/id=["']inline-twister-row-(\w+?)_name["'][\s\S]{0,800}?class=["'][^"']*a-text-bold[^"']*["'][^>]*>([^<]+)</g))
		add(m[1], m[2]);

	// Stock: Amazon pages carry hidden "outOfStock" templates and other sellers' "Currently
	// unavailable" text even for items that are in stock, so a buy button wins, and only the
	// main availability line can mark an item as sold out.
	const canBuy = /id=["'](?:add-to-cart-button|buy-now-button)["']/i.test(html);
	const availability = html.match(/<div[^>]*id=["']availability["'][^>]*>([\s\S]{0,1500}?)<\/div>/i);
	const availabilityText = availability ? text(availability[1]) : '';
	if (canBuy) r.availability = 'in_stock';
	else if (/currently unavailable|out of stock|temporarily out/i.test(availabilityText)) r.availability = 'out_of_stock';
	else if (/\bin stock\b|only \d+ left/i.test(availabilityText)) r.availability = 'in_stock';

	const desc = html.match(/id=["']feature-bullets["'][\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i);
	if (desc) {
		const bullets = [...desc[1].matchAll(/<span class=["']a-list-item["'][^>]*>([\s\S]*?)<\/span>/g)]
			.map((b) => text(b[1]))
			.filter(Boolean)
			.slice(0, 4);
		if (bullets.length) r.description ||= bullets.join(' · ');
	}
}

/* ---------------------------------------------------------------- JSON-LD */

type Json = Record<string, unknown>;

function fillFromJsonLd(r: ImportResult, html: string, base: URL) {
	const products: Json[] = [];
	for (const m of html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
		const data = safeParse<unknown>(m[1].trim());
		if (data) collectProducts(data, products);
	}
	if (!products.length) return;
	// Prefer a real Product over a ProductGroup.
	products.sort((a, b) => Number(isType(b, 'Product')) - Number(isType(a, 'Product')));
	const p = products[0];

	if (typeof p.name === 'string') r.title ||= text(p.name);
	if (typeof p.description === 'string') r.description ||= text(p.description);
	for (const img of toArray(p.image)) {
		const src = typeof img === 'string' ? img : typeof (img as Json)?.url === 'string' ? ((img as Json).url as string) : null;
		const abs = src && absolute(src, base);
		if (abs) r.images.push(abs);
	}

	let offers = toArray(p.offers).filter((o): o is Json => typeof o === 'object' && o !== null);
	if (!offers.length && isType(p, 'ProductGroup')) {
		const variant = toArray(p.hasVariant).find((v) => typeof v === 'object' && v && (v as Json).offers) as Json | undefined;
		if (variant) offers = toArray(variant.offers) as Json[];
	}
	const offer = offers[0];
	if (offer) {
		const spec = (offer.priceSpecification as Json) ?? {};
		const priceRaw = offer.price ?? offer.lowPrice ?? spec.price;
		const cur = (offer.priceCurrency ?? spec.priceCurrency) as string | undefined;
		if (r.price_cents == null && priceRaw != null) {
			const parsed = typeof priceRaw === 'number' ? { cents: Math.round(priceRaw * 100), currency: null } : parsePrice(String(priceRaw));
			if (parsed) r.price_cents = parsed.cents;
		}
		if (cur && /^[A-Z]{3}$/.test(cur) && r.currency == null) r.currency = cur;
		if (r.availability === 'unknown' && typeof offer.availability === 'string') {
			r.availability = /InStock|LimitedAvailability|OnlineOnly|PreOrder/i.test(offer.availability)
				? 'in_stock'
				: /OutOfStock|SoldOut|Discontinued/i.test(offer.availability)
					? 'out_of_stock'
					: 'unknown';
		}
	}
	// Variant attributes some shops include on the product itself.
	const add = (label: string, v: unknown) => {
		if (typeof v === 'string' && v.trim() && !r.specifics.some((s) => s.label === label)) r.specifics.push({ label, value: text(v) });
	};
	add('Size', p.size);
	add('Colour', p.color);
	add('Material', p.material);
}

function collectProducts(node: unknown, out: Json[]) {
	if (Array.isArray(node)) return node.forEach((n) => collectProducts(n, out));
	if (!node || typeof node !== 'object') return;
	const obj = node as Json;
	if (isType(obj, 'Product') || isType(obj, 'ProductGroup')) out.push(obj);
	if (obj['@graph']) collectProducts(obj['@graph'], out);
	if (obj.mainEntity) collectProducts(obj.mainEntity, out);
}

function isType(obj: Json, type: string): boolean {
	const t = obj['@type'];
	return Array.isArray(t) ? t.includes(type) : t === type;
}

/* ---------------------------------------------------------------- meta tags */

function fillFromMeta(r: ImportResult, html: string, base: URL) {
	const meta = new Map<string, string>();
	for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
		const attrs = parseAttrs(m[0]);
		const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? '').toLowerCase();
		const content = attrs.content;
		if (key && content != null && !meta.has(key)) meta.set(key, decode(content));
	}
	const get = (...keys: string[]) => keys.map((k) => meta.get(k)).find((v) => v && v.trim());

	r.title ||= get('og:title', 'twitter:title') ?? null;
	r.description ||= get('og:description', 'description', 'twitter:description') ?? null;
	const site = get('og:site_name');
	if (site && site.length < 40) r.store = site;
	const img = get('og:image:secure_url', 'og:image', 'twitter:image', 'twitter:image:src', 'image');
	const abs = img && absolute(img, base);
	if (abs) r.images.push(abs);

	if (r.price_cents == null) {
		const amount = get('product:price:amount', 'og:price:amount', 'price', 'twitter:data1');
		const p = amount && parsePrice(amount);
		if (p) {
			r.price_cents = p.cents;
			r.currency ??= p.currency;
		}
	}
	const cur = get('product:price:currency', 'og:price:currency', 'pricecurrency');
	if (cur && /^[A-Z]{3}$/i.test(cur) && r.currency == null) r.currency = cur.toUpperCase();
	const avail = get('product:availability', 'og:availability', 'availability');
	if (avail && r.availability === 'unknown') {
		if (/in ?stock|instock|available/i.test(avail) && !/out|unavailable/i.test(avail)) r.availability = 'in_stock';
		else if (/out ?of ?stock|oos|unavailable|sold/i.test(avail)) r.availability = 'out_of_stock';
	}
}

function fillFromTitleTag(r: ImportResult, html: string) {
	if (r.title) return;
	const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
	if (t) r.title = text(t[1]) || null;
}

/** Amazon and many shops put a readable slug in the path; use it when the page can't be read. */
function fillFromUrl(r: ImportResult, url: URL) {
	const params = url.searchParams;
	const size = params.get('size') ?? params.get('Size');
	const colour = params.get('color') ?? params.get('colour') ?? params.get('Color');
	if (size && size.length < 30) r.specifics.push({ label: 'Size', value: size });
	if (colour && colour.length < 30) r.specifics.push({ label: 'Colour', value: colour });
}

function titleFromSlug(url: URL): string | null {
	const parts = url.pathname.split('/').filter(Boolean);
	const dp = parts.findIndex((p) => /^(dp|gp)$/i.test(p));
	const slug = dp > 0 ? parts[dp - 1] : parts.filter((p) => /[a-z].*-.*[a-z]/i.test(p)).pop();
	if (!slug || slug.length < 6) return null;
	return decodeURIComponent(slug)
		.replace(/\.(html?|php|aspx?)$/i, '')
		.replace(/[-_+]+/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase())
		.trim();
}

/* ---------------------------------------------------------------- helpers */

export function parsePrice(raw: string): { cents: number; currency: string | null } | null {
	const s = raw.replace(/ /g, ' ').trim();
	if (!s) return null;
	let currency: string | null = null;
	const code = s.match(/\b(USD|GBP|EUR|CAD|AUD|JPY|INR|MXN|NZD|CHF|SEK|NOK|DKK)\b/i);
	if (code) currency = code[1].toUpperCase();
	else if (/C\$|CA\$/.test(s)) currency = 'CAD';
	else if (/A\$|AU\$/.test(s)) currency = 'AUD';
	else if (/£/.test(s)) currency = 'GBP';
	else if (/€/.test(s)) currency = 'EUR';
	else if (/¥|￥/.test(s)) currency = 'JPY';
	else if (/₹/.test(s)) currency = 'INR';
	else if (/\$/.test(s)) currency = 'USD';

	const num = s.match(/\d[\d.,\s']*/);
	if (!num) return null;
	let n = num[0].replace(/[\s']/g, '').replace(/[.,]$/, '');
	const lastDot = n.lastIndexOf('.');
	const lastComma = n.lastIndexOf(',');
	if (lastDot > -1 && lastComma > -1) {
		// Whichever comes last is the decimal separator.
		n = lastComma > lastDot ? n.replace(/\./g, '').replace(',', '.') : n.replace(/,/g, '');
	} else if (lastComma > -1) {
		n = /,\d{1,2}$/.test(n) ? n.replace(/,(?=\d{1,2}$)/, '.').replace(/,/g, '') : n.replace(/,/g, '');
	} else if ((n.match(/\./g) ?? []).length > 1) {
		n = n.replace(/\.(?=.*\.)/g, '');
	}
	const value = Number(n);
	if (!Number.isFinite(value) || value <= 0 || value > 10_000_000) return null;
	return { cents: Math.round(value * 100), currency };
}

function stripTracking(url: URL): URL {
	const u = new URL(url.toString());
	for (const key of [...u.searchParams.keys()]) {
		if (/^(utm_|fbclid|gclid|gbraid|wbraid|mc_|_ga|ref$|ref_|srsltid|igshid|si$|spm$)/i.test(key)) u.searchParams.delete(key);
	}
	u.hash = '';
	return u;
}

const STORE_NAMES: Record<string, string> = {
	amazon: 'Amazon',
	amzn: 'Amazon',
	ebay: 'eBay',
	etsy: 'Etsy',
	target: 'Target',
	walmart: 'Walmart',
	bestbuy: 'Best Buy',
	nike: 'Nike',
	adidas: 'adidas',
	ikea: 'IKEA',
	hm: 'H&M',
	zara: 'Zara',
	uniqlo: 'Uniqlo',
	levi: 'Levi’s',
	apple: 'Apple',
	lego: 'LEGO',
	sephora: 'Sephora',
	ulta: 'Ulta',
	wayfair: 'Wayfair',
	costco: 'Costco',
	homedepot: 'The Home Depot',
	lowes: 'Lowe’s',
	nordstrom: 'Nordstrom',
	macys: 'Macy’s',
	asos: 'ASOS',
	johnlewis: 'John Lewis',
	argos: 'Argos',
	steampowered: 'Steam',
	bookshop: 'Bookshop.org',
	barnesandnoble: 'Barnes & Noble',
	kohls: 'Kohl’s',
	gap: 'Gap',
	oldnavy: 'Old Navy',
	rei: 'REI',
	patagonia: 'Patagonia',
	newegg: 'Newegg',
	aliexpress: 'AliExpress',
	temu: 'Temu',
	shein: 'SHEIN'
};

export function storeName(url: URL): string {
	const host = url.hostname.replace(/^(www|m|smile|shop|store)\./i, '');
	const parts = host.split('.');
	// Drop public suffixes like .co.uk / .com.au
	let core = parts.length > 2 && /^(co|com|org|net)$/.test(parts[parts.length - 2]) ? parts[parts.length - 3] : parts[parts.length - 2] ?? parts[0];
	if (url.hostname === 'a.co') core = 'amazon';
	return STORE_NAMES[core.toLowerCase()] ?? core.charAt(0).toUpperCase() + core.slice(1);
}

function tidyTitle(title: string, store: string | null): string {
	let t = text(title);
	// "Product name | Store" / "Product name - Store" / "Amazon.com: Product name"
	t = t.replace(/^Amazon\.[a-z.]+\s*:\s*/i, '');
	t = t.replace(/\s*:\s*(Amazon\.[a-z.]+|[^:]{0,40})\s*$/i, (m, s: string) =>
		/amazon|clothing|shoes|jewelry|electronics|books|home|kitchen|toys|games|beauty/i.test(s) ? '' : m
	);
	if (store) {
		const esc = store.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		t = t.replace(new RegExp(`\\s*[|–—-]\\s*${esc}(\\.[a-z.]+)?\\s*$`, 'i'), '');
		t = t.replace(new RegExp(`^${esc}\\s*[|:–—-]\\s*`, 'i'), '');
	}
	return clip(t, 200);
}

const CATEGORY_WORDS: [string, RegExp][] = [
	['cat_shoes', /\b(shoes?|sneakers?|trainers?|runners?|boots?|sandals?|loafers?|heels|slippers?|cleats|running shoe)\b/i],
	[
		'cat_clothes',
		/\b(jeans|shirt|t-shirt|tee|hoodie|sweater|jumper|jacket|coat|dress|skirt|pants|trousers|shorts|leggings|socks|cardigan|blouse|pajamas?|pyjamas?|joggers|sweatpants|underwear|bra|scarf|beanie|hat|cap|gloves|vest|polo|parka|fleece)\b/i
	],
	['cat_books', /\b(book|novel|paperback|hardcover|hardback|kindle edition|audiobook|box set|cookbook)\b/i],
	[
		'cat_tech',
		/\b(headphones?|earbuds?|airpods|laptop|tablet|ipad|iphone|phone|smartwatch|watch|camera|speaker|monitor|keyboard|mouse|charger|usb|bluetooth|wireless|tv|television|console|ssd|router|kindle|echo|drone|projector|gpu|cpu)\b/i
	],
	['cat_games', /\b(lego|toy|puzzle|board game|card game|playstation|ps5|xbox|nintendo|switch|video game|plush|action figure)\b/i],
	['cat_beauty', /\b(perfume|cologne|fragrance|lipstick|mascara|serum|moisturi[sz]er|skincare|makeup|foundation|shampoo|conditioner|nail polish|eau de)\b/i],
	['cat_jewelry', /\b(necklace|bracelet|earrings?|ring|pendant|jewelry|jewellery|anklet|cufflinks)\b/i],
	[
		'cat_home',
		/\b(blanket|pillow|candle|mug|lamp|rug|sheets|duvet|towel|vase|cookware|pan|knife|kitchen|furniture|chair|desk|shelf|plant|frame|throw|diffuser|air fryer|blender|coffee maker|espresso)\b/i
	],
	['cat_exp', /\b(tickets?|concert|experience|class|lesson|voucher|gift card|subscription|membership)\b/i]
];

export function guessCategory(title: string): string | null {
	for (const [id, re] of CATEGORY_WORDS) if (re.test(title)) return id;
	return null;
}

function parseAttrs(tag: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const m of tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[m[1].toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
	return out;
}

function absolute(src: string, base: URL): string | null {
	try {
		const u = new URL(decode(src).trim(), base);
		return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null;
	} catch {
		return null;
	}
}

function safeParse<T>(s: string): T | null {
	try {
		return JSON.parse(s) as T;
	} catch {
		// Some shops leave raw newlines or trailing commas in JSON-LD.
		try {
			return JSON.parse(s.replace(/[\n\r\t]+/g, ' ').replace(/,\s*([}\]])/g, '$1')) as T;
		} catch {
			return null;
		}
	}
}

function toArray(v: unknown): unknown[] {
	return v == null ? [] : Array.isArray(v) ? v : [v];
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', trade: '™', reg: '®', copy: '©' };

function decode(s: string): string {
	return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
		if (e[0] === '#') {
			const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(code) ? String.fromCodePoint(code) : m;
		}
		return ENTITIES[e.toLowerCase()] ?? m;
	});
}

function text(html: string): string {
	return decode(html.replace(/<[^>]+>/g, ' '))
		.replace(/\s+/g, ' ')
		.trim();
}

function clip(s: string, n: number): string {
	return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
}

function titleCase(s: string): string {
	return s.replace(/\b\w/g, (c) => c.toUpperCase());
}


/* ------------------------------------------------- details read in the browser */

/** What the bookmark button (or a share) already read from the page. */
export interface ImportHint {
	url?: string;
	title?: string | null;
	image_url?: string | null;
	price?: string | number | null;
	currency?: string | null;
	specifics?: { label: string; value: string }[];
}

/**
 * Build a result from details read in the person's own browser, filling any gaps from the
 * server-side fetch. Shops can't block this, since it's their page in their browser.
 */
export async function importWithHint(hint: ImportHint, fetchGaps = true): Promise<ImportResult> {
	const url = hint.url ? normaliseUrl(hint.url) : null;
	const price = hint.price == null || hint.price === '' ? null : typeof hint.price === 'number' ? { cents: Math.round(hint.price * 100), currency: null } : parsePrice(String(hint.price));
	const complete = Boolean(hint.title && hint.image_url && price);
	const r = url && !complete && fetchGaps ? await importProduct(url.toString()) : url ? baseResult(url) : empty('');
	if (hint.title) r.title = tidyTitle(String(hint.title), r.store);
	if (hint.image_url && /^https?:\/\//.test(hint.image_url)) {
		r.image_url = hint.image_url;
		r.images = [hint.image_url, ...r.images.filter((i) => i !== hint.image_url)];
	}
	if (price) {
		r.price_cents = price.cents;
		r.currency = (hint.currency && /^[A-Z]{3}$/.test(hint.currency) ? hint.currency : null) ?? price.currency ?? r.currency ?? 'USD';
	}
	for (const s of hint.specifics ?? []) {
		if (s?.label && s?.value && !r.specifics.some((x) => x.label === s.label)) r.specifics.push({ label: String(s.label).slice(0, 40), value: String(s.value).slice(0, 120) });
	}
	r.category_id = guessCategory(r.title ?? '');
	r.blocked = r.blocked && !complete;
	if (!r.title && url) r.title = titleFromSlug(url);
	r.ok = Boolean(r.title && (r.image_url || r.price_cents != null));
	if (r.ok) r.error = undefined;
	return r;
}

/* ------------------------------------------------------------ Amazon wish lists */

export function isAmazonWishlist(url: URL): boolean {
	return isAmazon(url) && /\/(hz\/wishlist|gp\/registry\/wishlist|registries\/gl\/guest-view|wishlist)\b/i.test(url.pathname);
}

/** Read the items off an Amazon wish list page (public lists, as much as the page holds). */
export function parseAmazonWishlist(html: string, base: URL): ImportHint[] {
	const out: ImportHint[] = [];
	for (const m of html.matchAll(/<li[^>]*data-itemid=["'][^"']+["'][^>]*>([\s\S]*?)<\/li>\s*(?=<li[^>]*data-itemid|<\/ul>)/gi)) {
		const li = m[0];
		const link = li.match(/<a[^>]*id=["']itemName_[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i) ?? li.match(/<a[^>]*href=["']([^"']*\/dp\/[^"']+)["'][^>]*title=["']([^"']+)["']/i);
		if (!link) continue;
		const href = absolute(link[1], base);
		const img = li.match(/<img[^>]*src=["'](https:[^"']+)["']/i);
		const dataPrice = li.match(/data-price=["']([\d.]+)["']/i);
		const offscreen = li.match(/class=["']a-offscreen["']>([^<]+)</i);
		out.push({
			url: href ?? undefined,
			title: text(link[2]),
			image_url: img ? img[1].replace(/\._[^.]+_\./, '.') : null,
			price: dataPrice && Number(dataPrice[1]) > 0 ? Number(dataPrice[1]) : offscreen ? text(offscreen[1]) : null,
			currency: amazonCurrency(base.hostname)
		});
	}
	return out;
}

/** Fetch a public Amazon wish list and read its items. */
export async function importAmazonWishlist(input: string): Promise<{ items: ImportHint[]; blocked: boolean }> {
	const url = normaliseUrl(input);
	if (!url) return { items: [], blocked: false };
	try {
		const res = await fetch(url.toString(), { headers: BROWSER_HEADERS, redirect: 'follow', signal: AbortSignal.timeout(TIMEOUT_MS) });
		const html = await readCapped(res);
		if (isAmazonBotWall(html) && !/data-itemid/.test(html)) return { items: [], blocked: true };
		return { items: parseAmazonWishlist(html, new URL(res.url || url.toString())), blocked: false };
	} catch {
		return { items: [], blocked: true };
	}
}
