/**
 * App themes: the whole app's background, cards and text, swapped as a set (layout.css,
 * :root[data-theme]). Mustard, rust and teal stay the same everywhere, so it's still The Giver.
 */
export const THEMES = [
	{ id: 'cocoa', name: 'Cocoa', note: 'Warm brown, the original', page: '#2b1d14', card: '#3a2719', raised: '#44301f', text: '#f3e7cf' },
	{ id: 'midnight', name: 'Midnight', note: 'Deep navy, like a winter night', page: '#141a2b', card: '#1f2840', raised: '#27324d', text: '#eef0f6' },
	{ id: 'forest', name: 'Forest', note: 'Evergreen, cosy and calm', page: '#14211a', card: '#1f3026', raised: '#273b2f', text: '#eef3e6' },
	{ id: 'plum', name: 'Plum', note: 'Rich and a little fancy', page: '#231623', card: '#332033', raised: '#3e283e', text: '#f6eaf1' },
	{ id: 'charcoal', name: 'Charcoal', note: 'Plain and quiet', page: '#18181a', card: '#232326', raised: '#2c2c30', text: '#f1efeb' },
	{ id: 'berry', name: 'Berry', note: 'Cranberry red, festive', page: '#2a1215', card: '#3b1b20', raised: '#472128', text: '#f8ebe6' }
] as const;
export type ThemeId = (typeof THEMES)[number]['id'];

/** Highlight colours: what picked chips, the active tab and title bars use. "auto" follows the tab. */
export const HIGHLIGHTS = [
	{ id: 'auto', name: 'By tab', color: 'conic-gradient(#e8a83a 0 33%, #7cc2ba 0 66%, #ec9468 0)' },
	{ id: 'mustard', name: 'Mustard', color: '#e8a83a' },
	{ id: 'teal', name: 'Teal', color: '#7cc2ba' },
	{ id: 'rust', name: 'Rust', color: '#ec9468' },
	{ id: 'pink', name: 'Pink', color: '#ef8f9b' },
	{ id: 'cream', name: 'Cream', color: '#f3e7cf' }
] as const;
export type HighlightId = (typeof HIGHLIGHTS)[number]['id'];

export const isTheme = (v: unknown): v is ThemeId => THEMES.some((t) => t.id === v);
export const isHighlight = (v: unknown): v is HighlightId => HIGHLIGHTS.some((h) => h.id === v);
export const themeBackground = (id: string | null | undefined) => THEMES.find((t) => t.id === id)?.page ?? THEMES[0].page;
