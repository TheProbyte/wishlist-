/**
 * One line-icon set for the whole app: 24px grid, 2px stroke, round ends.
 * Values are inner SVG markup (trusted, static).
 */
export const ICONS = {
	gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13M12 8C10.5 4.5 6.5 4 6.5 6.25S10 8 12 8zM12 8c1.5-3.5 5.5-4 5.5-1.75S14 8 12 8z"/>',
	link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
	plus: '<path d="M12 5v14M5 12h14"/>',
	close: '<path d="M6 6l12 12M18 6L6 18"/>',
	'chevron-left': '<path d="M15 6l-6 6 6 6"/>',
	'chevron-right': '<path d="M9 6l6 6-6 6"/>',
	'chevron-up': '<path d="M6 15l6-6 6 6"/>',
	'chevron-down': '<path d="M6 9l6 6 6-6"/>',
	share: '<path d="M12 15V3M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
	more: '<circle cx="5" cy="12" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/><circle cx="19" cy="12" r="1.4" fill="currentColor"/>',
	external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
	alert: '<path d="M12 3.5L22 20H2z"/><path d="M12 10v4M12 17v.01"/>',
	check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
	calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
	tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/>',
	// Occasions
	cake: '<rect x="4" y="11" width="16" height="9" rx="2"/><path d="M4 15.5c2.5 1.5 3.5 1.5 5.33 0s2.84-1.5 5.34 0 3.33 1.5 5.33 0M12 11V8M12 5v.01"/>',
	tree: '<path d="M12 3l6 8h-3l4 6H5l4-6H6zM12 17v4"/>',
	rings: '<circle cx="9" cy="14" r="5"/><circle cx="15" cy="14" r="5"/><path d="M10 5l2-2 2 2"/>',
	bottle: '<path d="M9 3h6M10 3v3l-2 3v10a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V9l-2-3V3M8 13h4M8 16h4"/>',
	tulip: '<path d="M12 21v-9M7 4l2.5 2L12 3l2.5 3L17 4v4a5 5 0 0 1-10 0zM12 17c-2-2-4.5-2-6-1.5M12 18c2-2 4.5-2 6-1.5"/>',
	sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z"/>',
	// Categories
	shirt: '<path d="M8 3L3 6l2 4 3-1v12h8V9l3 1 2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/>',
	shoe: '<path d="M3 18V8l4 1 3 3 5 1.5c3 .8 6 1.8 6 4.5v1H3zM3 15h18M10 12l-1 2M13 13l-1 1.5"/>',
	headphones: '<path d="M4 15v-3a8 8 0 0 1 16 0v3"/><rect x="3" y="14" width="5" height="7" rx="2"/><rect x="16" y="14" width="5" height="7" rx="2"/>',
	book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13v15H6a2 2 0 0 0-2 2 2 2 0 0 0 2 2h13v-4M8 7h7"/>',
	sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3M3 13a2 2 0 0 1 4 0v1h10v-1a2 2 0 0 1 4 0v5H3zM6 18v2M18 18v2"/>',
	lipstick: '<path d="M9 21h6v-9H9zM9 12V8l6-4v8M8 16h8"/>',
	gamepad: '<path d="M7 8h10a4 4 0 0 1 4 4v2a3 3 0 0 1-5.4 1.8L14.5 14h-5l-1.1 1.8A3 3 0 0 1 3 14v-2a4 4 0 0 1 4-4zM8 10v4M6 12h4M15.5 11.5v.01M17.5 13v.01"/>',
	ring: '<circle cx="12" cy="15" r="6"/><path d="M9 6l3-3 3 3-3 3z"/>',
	ticket: '<path d="M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4zM14 6v2M14 11v2M14 16v2"/>',
	pan: '<circle cx="10" cy="12" r="6"/><path d="M16 12h6"/>',
	leaf: '<path d="M5 19C5 10 10 5 20 4c-1 10-6 15-15 15zM5 19l8-8"/>',
	teddy: '<circle cx="12" cy="13" r="6"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="7" r="2.5"/><path d="M10 12v.01M14 12v.01M10.5 15.5c1 .7 2 .7 3 0"/>',
	tent: '<path d="M3 20L12 4l9 16zM12 4v16M9 20l3-6 3 6"/>',
	palette: '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.5-.8 1.5-1.5 0-1.2-1-1.5-1-2.5s.9-1.5 2-1.5h2A4.5 4.5 0 0 0 21 11c0-4.5-4-8-9-8z"/><path d="M7.5 11v.01M10 7.5v.01M15 7.5v.01"/>',
	paw: '<circle cx="7" cy="10" r="1.8"/><circle cx="10.5" cy="6.5" r="1.8"/><circle cx="14.5" cy="6.5" r="1.8"/><circle cx="17.5" cy="10.5" r="1.8"/><path d="M12 12c-3 0-5.5 3.5-5.5 6 0 1.5 1.5 2 3 1.5s1.5-.5 2.5-.5 1.5 0 2.5.5 3 0 3-1.5c0-2.5-2.5-6-5.5-6z"/>',
	ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
	wine: '<path d="M8 3h8l-.5 6a3.5 3.5 0 0 1-7 0zM12 12.5V20M8.5 21h7"/>',
	plane: '<path d="M3 11l18-7-6 17-3-7zM12 14l3-3"/>',
	laptop: '<rect x="4" y="5" width="16" height="11" rx="1.5"/><path d="M2 19h20"/>',
	camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
	music: '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
	heart: '<path d="M12 20s-8-4.5-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.5 12 20 12 20z"/>',
	home: '<path d="M3 11l9-7 9 7M5 10v10h14V10M10 20v-5h4v5"/>',
	people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.2a5 5 0 0 1 6 4.8"/>',
	user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
	shuffle: '<path d="M3 6h3.5c4 0 6 12 10 12H21M18 15l3 3-3 3M3 18h3.5c1.6 0 2.8-2 3.9-4.5M13.6 9.5C14.7 7.6 15.6 6 17 6h4M18 3l3 3-3 3"/>'
} as const;

export type IconName = keyof typeof ICONS;

/** Icons offered when making a category. */
export const CATEGORY_ICONS: IconName[] = [
	'gift', 'shirt', 'shoe', 'headphones', 'book', 'sofa', 'lipstick', 'gamepad', 'ring', 'ticket',
	'pan', 'leaf', 'teddy', 'tent', 'palette', 'paw', 'ball', 'wine', 'plane', 'laptop', 'camera', 'music', 'heart', 'home'
];

export function isIcon(name: string | null | undefined): name is IconName {
	return !!name && name in ICONS;
}
