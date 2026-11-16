import { onMount } from 'svelte';

/**
 * Long lists, built in two goes: the server sends the first few cards (so the page arrives fast
 * and the server stays well inside its time limit even for a list of hundreds), and the rest
 * are added on the phone the moment the page is up. Call during component setup.
 */
export function progressive() {
	let all = $state(false);
	onMount(() => {
		const t = requestAnimationFrame(() => (all = true));
		return () => cancelAnimationFrame(t);
	});
	return {
		/** The whole list once the page is up; until then only the first `first` of it. */
		cap: <T>(list: T[], first = 12): T[] => (all ? list : list.slice(0, first))
	};
}
