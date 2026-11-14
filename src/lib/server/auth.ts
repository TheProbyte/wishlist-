import { env } from 'cloudflare:workers';
import { ensureMaster, newId, newToken } from './db';
import type { User } from '#lib/types.ts';
import type { Cookies } from '@sveltejs/kit';

/**
 * Sign-in.
 *
 * With GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET set (as Worker secrets), people sign in with
 * Google and each has their own lists. Without them the app runs as one local user, as before,
 * so the site never breaks while the keys are being set up.
 *
 * The first Google account to sign in inherits the lists made in single-user mode.
 */
export function authEnabled(): boolean {
	return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export const SESSION_COOKIE = 'session';
export const SESSION_DAYS = 90;

const LOCAL_USER: User = { id: 'local', name: 'You', email: null, avatar_url: null };
let localReady = false;

export async function localUser(db: D1Database): Promise<User> {
	if (!localReady) {
		await db.prepare('INSERT OR IGNORE INTO users (id, name) VALUES (?, ?)').bind(LOCAL_USER.id, LOCAL_USER.name).run();
		await ensureMaster(db, LOCAL_USER.id);
		localReady = true;
	}
	return LOCAL_USER;
}

async function sha256(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export async function userFromSession(db: D1Database, token: string): Promise<User | null> {
	return db
		.prepare(
			`SELECT u.id, u.name, u.email, u.avatar_url FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.id = ? AND s.expires_at > unixepoch()`
		)
		.bind(await sha256(token))
		.first<User>();
}

export async function createSession(db: D1Database, userId: string): Promise<string> {
	const token = newToken() + newToken();
	await db
		.prepare('INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, unixepoch() + ?)')
		.bind(await sha256(token), userId, SESSION_DAYS * 86400)
		.run();
	// Tidy up expired sessions now and then.
	if (Math.random() < 0.05) await db.prepare('DELETE FROM sessions WHERE expires_at < unixepoch()').run();
	return token;
}

export async function deleteSession(db: D1Database, token: string) {
	await db.prepare('DELETE FROM sessions WHERE id = ?').bind(await sha256(token)).run();
}

/* ------------------------------------------------------------------ Google */

export function googleAuthUrl(origin: string, state: string): string {
	const params = new URLSearchParams({
		client_id: env.GOOGLE_CLIENT_ID!,
		redirect_uri: `${origin}/auth/callback`,
		response_type: 'code',
		scope: 'openid email profile',
		state,
		prompt: 'select_account'
	});
	return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export interface GoogleProfile {
	sub: string;
	email: string | null;
	name: string;
	picture: string | null;
}

/** Swap the one-time code for the signed-in person's profile. */
export async function googleProfile(origin: string, code: string): Promise<GoogleProfile> {
	const res = await fetch('https://oauth2.googleapis.com/token', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({
			code,
			client_id: env.GOOGLE_CLIENT_ID!,
			client_secret: env.GOOGLE_CLIENT_SECRET!,
			redirect_uri: `${origin}/auth/callback`,
			grant_type: 'authorization_code'
		})
	});
	if (!res.ok) throw new Error(`Google token exchange failed (${res.status})`);
	const { id_token } = (await res.json()) as { id_token?: string };
	if (!id_token) throw new Error('Google sent no ID token');
	// The token came straight from Google over TLS in exchange for our secret, so its claims
	// can be read without re-verifying the signature (OpenID Connect Core §3.1.3.7).
	const claims = JSON.parse(atob(id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
	if (claims.aud !== env.GOOGLE_CLIENT_ID) throw new Error('ID token is for another app');
	if (claims.iss !== 'https://accounts.google.com' && claims.iss !== 'accounts.google.com') throw new Error('ID token has the wrong issuer');
	if (typeof claims.exp === 'number' && claims.exp * 1000 < Date.now()) throw new Error('ID token has expired');
	return {
		sub: String(claims.sub),
		email: typeof claims.email === 'string' ? claims.email : null,
		name: typeof claims.name === 'string' && claims.name ? claims.name : typeof claims.email === 'string' ? claims.email.split('@')[0] : 'Friend',
		picture: typeof claims.picture === 'string' ? claims.picture : null
	};
}

/** Find or create the account for a Google profile. */
export async function upsertGoogleUser(db: D1Database, p: GoogleProfile): Promise<User> {
	const existing = await db.prepare('SELECT id FROM users WHERE google_sub = ?').bind(p.sub).first<{ id: string }>();
	let id = existing?.id;
	if (id) {
		await db.prepare('UPDATE users SET email = ?, name = ?, avatar_url = ? WHERE id = ?').bind(p.email, p.name, p.picture, id).run();
	} else {
		// The very first account takes over the lists made before sign-in existed.
		const anyAccount = await db.prepare('SELECT 1 FROM users WHERE google_sub IS NOT NULL LIMIT 1').first();
		const local = anyAccount ? null : await db.prepare("SELECT id FROM users WHERE id = 'local' AND google_sub IS NULL").first<{ id: string }>();
		if (local) {
			id = local.id;
			await db.prepare('UPDATE users SET google_sub = ?, email = ?, name = ?, avatar_url = ? WHERE id = ?').bind(p.sub, p.email, p.name, p.picture, id).run();
		} else {
			id = newId('usr');
			await db.prepare('INSERT INTO users (id, google_sub, email, name, avatar_url) VALUES (?, ?, ?, ?, ?)').bind(id, p.sub, p.email, p.name, p.picture).run();
		}
	}
	await ensureMaster(db, id);
	return { id, name: p.name, email: p.email, avatar_url: p.picture };
}

/* ------------------------------------------------ keeping surprises from the owner */

/**
 * Every device you've signed in on keeps a private marker for you (a long-lived cookie that
 * signing out doesn't clear). Your own share links check it, so on those devices claims stay
 * hidden even when you're signed out. Up to four people's markers are kept, for shared devices.
 */
export const OWNER_COOKIE = 'giver_me';
const OWNER_COOKIE_YEARS = 5;
const MAX_MARKS = 4;

export function ownerMarks(cookies: Cookies): string[] {
	return (cookies.get(OWNER_COOKIE) ?? '').split('.').filter((m) => /^[A-Za-z0-9_-]{20,64}$/.test(m));
}

/** Make sure this device carries the signed-in person's marker. */
export async function rememberOwner(db: D1Database, cookies: Cookies, userId: string, secure: boolean) {
	const row = await db.prepare('SELECT owner_mark FROM users WHERE id = ?').bind(userId).first<{ owner_mark: string | null }>();
	let mark = row?.owner_mark ?? null;
	if (!mark) {
		mark = newToken() + newToken();
		await db.prepare('UPDATE users SET owner_mark = ? WHERE id = ? AND owner_mark IS NULL').bind(mark, userId).run();
		mark = (await db.prepare('SELECT owner_mark FROM users WHERE id = ?').bind(userId).first<{ owner_mark: string | null }>())?.owner_mark ?? mark;
	}
	const marks = ownerMarks(cookies);
	if (marks[0] === mark) return;
	const next = [mark, ...marks.filter((m) => m !== mark)].slice(0, MAX_MARKS);
	cookies.set(OWNER_COOKIE, next.join('.'), { path: '/', httpOnly: true, sameSite: 'lax', secure, maxAge: OWNER_COOKIE_YEARS * 365 * 86400 });
}

/** Whether this device belongs to the person who owns `ownerId`'s lists (signed in or not). */
export async function isOwnersDevice(db: D1Database, cookies: Cookies, ownerId: string): Promise<boolean> {
	const marks = ownerMarks(cookies);
	if (!marks.length) return false;
	const row = await db.prepare('SELECT owner_mark FROM users WHERE id = ?').bind(ownerId).first<{ owner_mark: string | null }>();
	return !!row?.owner_mark && marks.includes(row.owner_mark);
}
