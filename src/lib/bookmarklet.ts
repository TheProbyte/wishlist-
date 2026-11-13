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
	let data: unknown;
	if (/amazon\./.test(location.host) && /wishlist|registry/.test(location.pathname)) {
		const items: unknown[] = [];
		d.querySelectorAll('li[data-itemid]').forEach((li) => {
			const a = li.querySelector('a[id^="itemName_"]') as HTMLAnchorElement | null;
			if (!a) return;
			const img = li.querySelector('img') as HTMLImageElement | null;
			const p = li.getAttribute('data-price');
			items.push({ url: a.href, title: t(a), image_url: img && img.src.replace(/\._[^.]+_\./, '.'), price: p && p !== '-Infinity' ? Number(p) : t(li.querySelector('.a-price .a-offscreen')) });
		});
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
			image_url: (img && (img.getAttribute('data-old-hires') || img.src)) || m('og:image'),
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
