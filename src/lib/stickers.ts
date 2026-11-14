import { INKS, type Ink } from './papers.ts';

/** Stickers people can use instead of a photo: an icon on one of the palette colours. */
export const STICKER_ICONS = ['gift', 'heart', 'sparkle', 'teddy', 'paw', 'music', 'camera', 'leaf', 'ball', 'plane', 'tree', 'cake', 'tulip', 'palette', 'gamepad', 'book', 'tent', 'headphones'] as const;
export const STICKER_INKS: Ink[] = ['mustard', 'rust', 'teal', 'pink', 'cream', 'cocoa'];

export function readSticker(s: string | null | undefined): { icon: string; bg: string; fg: string; ink: Ink } | null {
	const [icon, ink] = (s ?? '').split(':');
	if (!(STICKER_ICONS as readonly string[]).includes(icon) || !(ink in INKS)) return null;
	const k = ink as Ink;
	return { icon, ink: k, bg: INKS[k], fg: k === 'cocoa' || k === 'teal' || k === 'rust' ? INKS.cream : INKS.cocoa };
}

export const makeSticker = (icon: string, ink: Ink) => `${icon}:${ink}`;
