import { withKid } from './format.ts';

/**
 * "Ask for ideas": a friendly message to someone whose wish list is thin, sent however you like
 * (the phone's share sheet: Messages, WhatsApp…). Where there's no share sheet, it's copied.
 */
export async function askForIdeas(name: string, next: { label: string; kid: string | null } | null): Promise<'shared' | 'copied' | 'cancelled'> {
	const first = name.split(' ')[0];
	const what = next ? (next.kid ? withKid(next.kid, next.label) : `your ${next.label.toLowerCase()}`) : null;
	const text = what
		? `Hey ${first}! ${what[0].toUpperCase()}${what.slice(1)} is coming up 🎁 Could you add a few ideas to your wish list on The Giver? Then I’ll know what you’d love.`
		: `Hey ${first}! Could you add a few ideas to your wish list on The Giver? 🎁 Then I’ll know what you’d love.`;
	const url = location.origin;
	if (navigator.share) {
		try {
			await navigator.share({ text, url });
			return 'shared';
		} catch {
			return 'cancelled';
		}
	}
	await navigator.clipboard.writeText(`${text} ${url}`);
	return 'copied';
}

/** Whether someone's list looks thin for what's coming: few gifts, and the day not far off. */
export const looksThin = (gifts: number, days: number | null | undefined) => gifts < 5 && days != null && days <= 45;
