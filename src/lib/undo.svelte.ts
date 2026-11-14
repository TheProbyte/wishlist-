/**
 * Undo instead of "are you sure?". Deleting something takes it off the screen at once and shows
 * a strip with Undo; the server is only told after a few seconds, so Undo simply puts it back.
 *
 * If the app is closed or put in the background before then, the change is sent straight away
 * (a keepalive request survives the page going), so nothing is ever lost or left half done.
 *
 * Things waiting to go are also listed in `hidden`, so a refresh of the page's data in the
 * meantime doesn't bring them back on screen.
 */

export interface UndoRequest {
	/** A form action, with the full path (e.g. `/lists/abc?/bulk`), never relative. */
	url: string;
	body: Record<string, string | string[]>;
}

interface Pending {
	id: number;
	message: string;
	requests: UndoRequest[];
	revert: () => void;
	done?: (ok: boolean) => void;
	keys: string[];
	timer: ReturnType<typeof setTimeout>;
}

export const UNDO_MS = 5000;

/** What's on screen: the strip's message, and when it started (for its draining ribbon). */
export const undoStrip = $state({ id: 0, message: '', started: 0 });
/** Gifts, lists and gift-on-list pairs waiting to be deleted: pages leave these out. */
export const hidden = $state<{ keys: string[] }>({ keys: [] });
export const isHidden = (key: string) => hidden.keys.includes(key);

let pending: Pending | null = null;
let seq = 0;
let installed = false;

function form(body: UndoRequest['body']) {
	const fd = new FormData();
	for (const [k, v] of Object.entries(body)) for (const one of Array.isArray(v) ? v : [v]) fd.append(k, one);
	return fd;
}

async function send(p: Pending) {
	let ok = true;
	for (const r of p.requests) {
		try {
			const res = await fetch(r.url, { method: 'POST', body: form(r.body), headers: { 'x-sveltekit-action': 'true' }, keepalive: true });
			const text = await res.text();
			ok &&= res.ok && !/"type":"(failure|error)"/.test(text);
		} catch {
			ok = false;
		}
	}
	hidden.keys = hidden.keys.filter((k) => !p.keys.includes(k));
	if (!ok) p.revert();
	p.done?.(ok);
}

/** Send whatever is waiting now (another delete is starting, or the app is going away). */
export function flushUndo() {
	const p = pending;
	if (!p) return;
	clearTimeout(p.timer);
	pending = null;
	if (undoStrip.id === p.id) undoStrip.id = 0;
	void send(p);
}

function install() {
	if (installed || typeof window === 'undefined') return;
	installed = true;
	const away = () => flushUndo();
	addEventListener('pagehide', away);
	document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && away());
}

/**
 * Do something undoable. The caller has already changed the screen; `revert` changes it back.
 * `keys` are what to keep hidden meanwhile (e.g. `gift:ID`, `list:ID`, `off:LIST:GIFT`).
 */
export function undoable(o: { message: string; requests: UndoRequest[]; revert: () => void; keys?: string[]; done?: (ok: boolean) => void }) {
	install();
	flushUndo();
	const id = ++seq;
	const keys = o.keys ?? [];
	hidden.keys = [...hidden.keys, ...keys];
	const p: Pending = { id, message: o.message, requests: o.requests, revert: o.revert, done: o.done, keys, timer: setTimeout(() => flushUndo(), UNDO_MS) };
	pending = p;
	undoStrip.id = id;
	undoStrip.message = o.message;
	undoStrip.started = performance.now();
}

/** Undo: nothing was sent, so just put it back. */
export function undo() {
	const p = pending;
	if (!p) return;
	clearTimeout(p.timer);
	pending = null;
	undoStrip.id = 0;
	hidden.keys = hidden.keys.filter((k) => !p.keys.includes(k));
	p.revert();
}
