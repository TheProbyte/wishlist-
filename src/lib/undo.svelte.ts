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
export const undoStrip = $state({ id: 0, message: '', started: 0, kind: 'undo' as 'undo' | 'toast', action: '', ms: UNDO_MS });
let toastAction: (() => void) | null = null;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

/** A plain message in the same strip, with one optional thing to do (e.g. "Add another"). */
export function toast(message: string, action?: { label: string; run: () => void }, ms = 4000) {
	flushUndo();
	clearTimeout(toastTimer);
	const id = ++seq;
	toastAction = action?.run ?? null;
	Object.assign(undoStrip, { id, message, started: performance.now(), kind: 'toast', action: action?.label ?? '', ms });
	toastTimer = setTimeout(() => undoStrip.id === id && (undoStrip.id = 0), ms);
}
/** The strip's button: Undo, or the toast's own action. */
export function stripAction() {
	if (undoStrip.kind === 'undo') return undo();
	const run = toastAction;
	undoStrip.id = 0;
	run?.();
}
/** Close the strip (sends a waiting undo now). */
export function dismissStrip() {
	if (undoStrip.kind === 'undo') return flushUndo();
	undoStrip.id = 0;
}
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
	clearTimeout(toastTimer);
	Object.assign(undoStrip, { id, message: o.message, started: performance.now(), kind: 'undo', action: 'Undo', ms: UNDO_MS });
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
