/**
 * Small per-device preferences (grid or list view, hints already seen). Stored in this browser
 * only; if storage is blocked (private mode) everything still works, it just isn't remembered.
 */
const KEY = 'giver:';

export function getPref(name: string): string | null {
	try {
		return localStorage.getItem(KEY + name);
	} catch {
		return null;
	}
}

export function setPref(name: string, value: string) {
	try {
		localStorage.setItem(KEY + name, value);
	} catch {
		/* not remembered, that's all */
	}
}

/** True the first time a hint is asked for on this device, false ever after. */
export function firstTime(hint: string): boolean {
	if (getPref(`hint:${hint}`)) return false;
	setPref(`hint:${hint}`, '1');
	return true;
}
