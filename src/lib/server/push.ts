import { waitUntil } from 'cloudflare:workers';
import { newKeyPair, sendPush, type KeyPair } from './webpush.ts';
import { upcomingInCircles } from './people.ts';
import { withKid } from '#lib/format.ts';

/**
 * Notifications: reminders before your people's occasions, price drops on your own gifts, and
 * "names are drawn". The app's signing key (VAPID) is made the first time it's needed and kept in
 * the database, so there's nothing to set up.
 */

export interface Note {
	title: string;
	body: string;
	/** Where tapping it goes. */
	url: string;
	/** Notifications with the same tag replace each other. */
	tag?: string;
}

export async function vapidKeys(db: D1Database): Promise<KeyPair> {
	const row = await db.prepare("SELECT value FROM app_keys WHERE name = 'vapid'").first<{ value: string }>();
	if (row) return JSON.parse(row.value) as KeyPair;
	const keys = await newKeyPair();
	await db.prepare("INSERT OR IGNORE INTO app_keys (name, value) VALUES ('vapid', ?)").bind(JSON.stringify(keys)).run();
	// If two requests raced, use whichever was stored.
	const stored = await db.prepare("SELECT value FROM app_keys WHERE name = 'vapid'").first<{ value: string }>();
	return JSON.parse(stored!.value) as KeyPair;
}

/**
 * Send to every browser someone has turned notifications on in. With `once`, only if that exact
 * thing hasn't been sent to them before.
 */
export async function notify(db: D1Database, userId: string, note: Note, once?: { kind: string; ref: string }) {
	const { results: subs } = await db.prepare('SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?').bind(userId).all<{ endpoint: string; p256dh: string; auth: string }>();
	if (!subs.length) return;
	if (once) {
		const r = await db.prepare('INSERT OR IGNORE INTO push_sent (user_id, kind, ref) VALUES (?, ?, ?)').bind(userId, once.kind, once.ref).run();
		if (!r.meta.changes) return;
	}
	const [keys, origin] = await Promise.all([vapidKeys(db), db.prepare("SELECT value FROM app_keys WHERE name = 'origin'").first<{ value: string }>()]);
	// Who's sending, for the push services: the app's own address (saved when someone subscribes).
	const contact = origin?.value ?? 'https://thegiver.app';
	await Promise.allSettled(
		subs.map(async (s) => {
			const status = await sendPush(s, note, keys, contact);
			// Gone (unsubscribed, or the app was removed): forget it.
			if (status === 404 || status === 410) await db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').bind(s.endpoint).run();
		})
	);
}

/** Do it after the response has gone, so nobody waits for it. */
export function later(work: Promise<unknown>) {
	try {
		waitUntil(work.catch(() => {}));
	} catch {
		void work.catch(() => {});
	}
}

/**
 * Once a day (set off by the first visit of the day, so there's no scheduler to run): for each
 * person with notifications on, their people's occasions two weeks and three days away.
 */
let doneToday = '';
export async function dailyReminders(db: D1Database) {
	const today = new Date().toISOString().slice(0, 10);
	if (doneToday === today) return;
	doneToday = today;
	const claimed = await db
		.prepare("INSERT INTO app_keys (name, value) VALUES ('daily', ?) ON CONFLICT(name) DO UPDATE SET value = excluded.value WHERE app_keys.value <> excluded.value")
		.bind(today)
		.run();
	if (!claimed.meta.changes) return; // already done today
	const { results: users } = await db.prepare('SELECT DISTINCT user_id FROM push_subscriptions').all<{ user_id: string }>();
	for (const { user_id } of users) {
		const soon = (await upcomingInCircles(db, user_id, 14)).filter((u) => u.days === 14 || u.days === 3);
		for (const u of soon) {
			const who = u.kid ? withKid(u.kid, u.label) : `${u.name.split(' ')[0]}’s ${u.label.toLowerCase()}`;
			await notify(
				db,
				user_id,
				{
					title: `${who[0].toUpperCase()}${who.slice(1)} is ${u.days === 14 ? 'in 2 weeks' : 'in 3 days'}`,
					body: u.days === 14 ? 'Plenty of time to pick something from their wish list.' : 'Still time to get something from their wish list.',
					url: u.listId ? `/people/${u.personId}?list=${u.listId}` : `/people/${u.personId}`,
					tag: `occasion-${u.personId}-${u.date}`
				},
				{ kind: 'occasion', ref: `${u.personId}|${u.kid ?? ''}|${u.label}|${u.date}|${u.days}` }
			);
		}
	}
}
