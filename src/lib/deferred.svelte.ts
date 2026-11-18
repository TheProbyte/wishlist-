import type { Component } from 'svelte';

/** When the browser has a quiet moment (Safari has no requestIdleCallback: a short wait instead). */
function idle(work: () => void) {
	const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
	if (ric) ric(work, { timeout: 2500 });
	else setTimeout(work, 900);
}

/**
 * A component nobody needs for the first paint (an editor, a menu, confetti). Its code is
 * fetched once the page is up and the browser is idle, so it's ready by the time it's wanted
 * without holding up the page; `now()` fetches it at once if it's wanted sooner.
 *
 *     const Editor = deferred(() => import('./ItemEditor.svelte'));
 *     {#if Editor.component}<Editor.component … />{/if}
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deferred<C extends Component<any>>(load: () => Promise<{ default: C }>) {
	let component = $state<C | null>(null);
	let started: Promise<void> | null = null;
	const now = () => (started ??= load().then((m) => void (component = m.default)));
	if (typeof window !== 'undefined') idle(now);
	return {
		get component() {
			return component;
		},
		now
	};
}
