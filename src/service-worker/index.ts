import { self as sw } from '$app/service-worker';
import { immutable, assets } from '$app/manifest';
import { version } from '$app/env';

/**
 * Makes The Giver installable (so it can appear in the phone's share menu) and keeps the app's
 * own code and icons cached so it opens fast.
 *
 * Your own pages always come fresh from the network, but a copy of each is kept on the phone
 * as you go: with no connection, they open from that copy (read-only; the page says it's
 * offline). Other people's pages, share links and sign-in are never kept, and signing out
 * clears the copies.
 */
const CACHE = `giver-${version}`;
const PAGES = 'giver-pages';
const KEEP = /^\/($|lists\/|me($|\/)|people\/?$|upcoming|getting|categories|add$)/;
const keepable = (url: URL) => KEEP.test(url.pathname) || (url.pathname.endsWith('/__data.json') && KEEP.test(url.pathname.replace(/\/?__data\.json$/, '/').replace(/^\/\/$/, '/')));
const ASSETS = new Set<string>([...immutable, ...assets].map((a) => a.path));

sw.addEventListener('install', (event) => {
	event.waitUntil(caches.open(CACHE).then((c) => c.addAll([...ASSETS])).then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== PAGES).map((k) => caches.delete(k))))
			.then(() => sw.clients.claim())
	);
});

sw.addEventListener('fetch', (event) => {
	const url = new URL(event.request.url);
	if (url.origin !== location.origin) return;
	// Signing out: forget the kept pages.
	if (event.request.method === 'POST' && url.pathname.startsWith('/auth/logout')) {
		event.waitUntil(caches.delete(PAGES));
		return;
	}
	if (event.request.method !== 'GET') return;
	if (ASSETS.has(url.pathname)) {
		event.respondWith(caches.match(url.pathname).then((hit) => hit ?? fetch(event.request)));
		return;
	}
	if (!keepable(url)) return;
	// Your pages: fresh from the network, with a copy kept for when there's no connection.
	event.respondWith(
		fetch(event.request)
			.then((res) => {
				if (res.ok && res.type === 'basic' && !res.redirected) {
					const copy = res.clone();
					event.waitUntil(caches.open(PAGES).then((c) => c.put(event.request, copy)));
				}
				return res;
			})
			.catch(async () => {
				const hit = await caches.match(event.request, { cacheName: PAGES, ignoreSearch: url.pathname.endsWith('__data.json') });
				if (hit) return hit;
				// A page never opened before: the shelf, if we have it.
				if (event.request.mode === 'navigate') return (await caches.match('/', { cacheName: PAGES })) ?? Response.error();
				return Response.error();
			})
	);
});
