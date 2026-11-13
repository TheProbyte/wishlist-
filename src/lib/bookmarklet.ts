/**
 * The "Add to The Giver" bookmark. It runs on the shop page in the person's own browser, reads
 * the gift (or every item on an Amazon wish list) and opens The Giver's add page with it.
 * Reading the page here, rather than from our server, means shops can't block it.
 */
function grab(origin: string) {
	const d = document;
	const q = (s: string) => d.querySelector(s) as HTMLElement | null;
	const t = (e: Element | null) => (e && e.textContent ? e.textContent.replace(/\s+/g, ' ').trim() : '');
	const m = (p: string) => (d.querySelector(`meta[property="${p}"],meta[name="${p}"]`) as HTMLMetaElement | null)?.content || '';
	// The real product photo inside an element. Amazon lazy-loads pictures (the real address is in
	// srcset or data-* until it scrolls into view), and badges/icons aren't product photos.
	const photo = (root: Element | null): string | null => {
		if (!root) return null;
		const urls: string[] = [];
		root.querySelectorAll('img').forEach((im) => {
			const cands = [im.getAttribute('data-old-hires'), im.getAttribute('data-src'), im.getAttribute('data-a-hires'), (im as HTMLImageElement).currentSrc, im.getAttribute('src')];
			const set = im.getAttribute('srcset') || im.getAttribute('data-srcset');
			if (set) cands.unshift(set.split(',').map((x) => x.trim().split(' ')[0]).pop() || null);
			const dyn = im.getAttribute('data-a-dynamic-image');
			if (dyn) {
				try {
					cands.unshift(Object.keys(JSON.parse(dyn))[0]);
				} catch {
					/* ignore */
				}
			}
			cands.forEach((u) => {
				if (u && /^https?:/.test(u)) urls.push(u);
			});
		});
		const best = urls.find((u) => /\/images\/I\//.test(u)) || urls.find((u) => !/\/images\/G\/|sprite|transparent|pixel|grey-pixel/i.test(u));
		return best ? best.replace(/\._[^/]*_\./, '.') : null;
	};
	let data: unknown;
	if (/amazon\./.test(location.host) && /wishlist|registr/.test(location.pathname)) {
		const items: { url: string }[] = [];
		d.querySelectorAll('li[data-itemid]').forEach((li) => {
			const a = li.querySelector('a[id^="itemName_"]') as HTMLAnchorElement | null;
			if (!a) return;
			const p = li.getAttribute('data-price');
			items.push({ url: a.href, title: t(a), image_url: photo(li), price: p && p !== '-Infinity' ? Number(p) : t(li.querySelector('.a-price .a-offscreen')) } as { url: string });
		});
		// Gift lists and registries: read the product tiles on screen, one per product.
		if (!items.length) {
			const seen: Record<string, boolean> = {};
			d.querySelectorAll('a[href*="/dp/"]').forEach((el) => {
				const a = el as HTMLAnchorElement;
				const asin = (a.href.match(/\/dp\/([A-Z0-9]{10})/) || [])[1];
				if (!asin || seen[asin]) return;
				// Climb to this product's tile: the biggest box that is still only about this product.
				let tile: Element = a;
				for (let i = 0; i < 8 && tile.parentElement; i++) {
					const up = tile.parentElement;
					const asins = new Set(Array.from(up.querySelectorAll('a[href*="/dp/"]')).map((x) => ((x as HTMLAnchorElement).href.match(/\/dp\/([A-Z0-9]{10})/) || [])[1]));
					if (asins.size > 1) break;
					tile = up;
				}
				// The name: the link's label or text, else the alt text of the product photo.
				const alts = [a.querySelector('img'), ...Array.from(tile.querySelectorAll('img'))].map((im) => im && im.getAttribute('alt')).filter(Boolean);
				const name = [a.getAttribute('aria-label'), a.title, t(a), ...alts].filter(Boolean).sort((x, y) => (y as string).length - (x as string).length)[0] as string | undefined;
				if (!name || /^(see|shop|buy|add to|view|more)\b/i.test(name)) return;
				seen[asin] = true;
				items.push({ url: location.origin + '/dp/' + asin, title: name, image_url: photo(tile), price: t(tile.querySelector('.a-offscreen')) } as { url: string });
			});
		}
		data = { items, source: location.href };
	} else {
		const img = q('#landingImage') as HTMLImageElement | null;
		const specifics: { label: string; value: string }[] = [];
		d.querySelectorAll('[id^="inline-twister-expanded-dimension-text-"]').forEach((e) => {
			const key = e.id.replace('inline-twister-expanded-dimension-text-', '').replace(/_name$/, '');
			specifics.push({ label: key === 'color' ? 'Colour' : key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: t(e) });
		});
		[['size', 'Size'], ['color', 'Colour'], ['style', 'Style']].forEach(([k, label]) => {
			const v = t(q(`#variation_${k}_name .selection`));
			if (v && !specifics.some((s) => s.label === label)) specifics.push({ label, value: v });
		});
		data = {
			url: location.href,
			title: t(q('#productTitle')) || m('og:title') || d.title,
			image_url: photo(img && img.parentElement) || (img && img.src) || m('og:image'),
			price: t(q('.priceToPay .a-offscreen')) || t(q('#corePrice_feature_div .a-offscreen')) || m('product:price:amount') || m('og:price:amount'),
			currency: m('product:price:currency') || m('og:price:currency'),
			specifics
		};
	}
	const href = origin + '/add#' + encodeURIComponent(JSON.stringify(data));
	if (!window.open(href, '_blank')) location.href = href;
}

export function bookmarklet(origin: string): string {
	return `javascript:(${grab.toString()})(${JSON.stringify(origin)});void 0`;
}
