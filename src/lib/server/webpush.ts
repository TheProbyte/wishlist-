/**
 * Web Push, with nothing but the platform's own crypto (no libraries): the message is encrypted
 * for the one browser it's going to (RFC 8291, "aes128gcm"), and the request is signed with the
 * app's VAPID key so the push service knows who's sending (RFC 8292).
 */

const enc = new TextEncoder();

export const b64u = (buf: ArrayBuffer | Uint8Array) =>
	btoa(String.fromCharCode(...new Uint8Array(buf)))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/, '');
export const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));

const concat = (...parts: Uint8Array[]) => {
	const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
	let at = 0;
	for (const p of parts) {
		out.set(p, at);
		at += p.length;
	}
	return out;
};
// (The platform's crypto wants plain ArrayBuffer-backed bytes.)
const bytes = (u: Uint8Array) => u as Uint8Array<ArrayBuffer>;
async function hmac(key: Uint8Array, data: Uint8Array) {
	const k = await crypto.subtle.importKey('raw', bytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	return new Uint8Array(await crypto.subtle.sign('HMAC', k, bytes(data)));
}
const ONE = new Uint8Array([1]);

/** A P-256 key pair as JWK (private) plus the public key as the 65 raw bytes, base64url. */
export interface KeyPair {
	publicKey: string;
	privateJwk: JsonWebKey;
}

export async function newKeyPair(): Promise<KeyPair> {
	const pair = (await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])) as CryptoKeyPair;
	return {
		publicKey: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)),
		privateJwk: (await crypto.subtle.exportKey('jwk', pair.privateKey)) as JsonWebKey
	};
}

/** The JWK for a raw P-256 private key, given its public key too. */
export function jwkFromRaw(privateB64u: string, publicB64u: string): JsonWebKey {
	const pub = unb64u(publicB64u);
	return { kty: 'EC', crv: 'P-256', d: privateB64u, x: b64u(pub.slice(1, 33)), y: b64u(pub.slice(33, 65)), ext: true };
}

/**
 * Encrypt a message for one subscription (RFC 8291). `ephemeral` and `salt` are only passed in
 * tests, to check against the RFC's worked example; normally both are fresh and random.
 */
export async function encrypt(
	payload: Uint8Array,
	sub: { p256dh: string; auth: string },
	test?: { ephemeral: { privateB64u: string; publicB64u: string }; salt: string }
): Promise<Uint8Array> {
	const uaPublic = unb64u(sub.p256dh);
	const authSecret = unb64u(sub.auth);
	let asPrivate: CryptoKey;
	let asPublic: Uint8Array;
	if (test) {
		asPrivate = await crypto.subtle.importKey('jwk', jwkFromRaw(test.ephemeral.privateB64u, test.ephemeral.publicB64u), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits']);
		asPublic = unb64u(test.ephemeral.publicB64u);
	} else {
		const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
		asPrivate = pair.privateKey;
		asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
	}
	const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));

	// IKM = HKDF(auth, shared, "WebPush: info" || ua_public || as_public, 32)
	const prkKey = await hmac(authSecret, shared);
	const ikm = await hmac(prkKey, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, ONE));
	// CEK and nonce from HKDF(salt, IKM, ...)
	const salt = test ? unb64u(test.salt) : crypto.getRandomValues(new Uint8Array(16));
	const prk = await hmac(salt, ikm);
	const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), ONE))).slice(0, 16);
	const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), ONE))).slice(0, 12);

	const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
	// One record: the message, then the "last record" delimiter.
	const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, new Uint8Array([2]))));
	const header = new Uint8Array(16 + 4 + 1 + asPublic.length);
	header.set(salt, 0);
	new DataView(header.buffer).setUint32(16, 4096);
	header[20] = asPublic.length;
	header.set(asPublic, 21);
	return concat(header, ciphertext);
}

/** The VAPID signature for one push service (RFC 8292): a short-lived ES256 JWT. */
export async function vapidAuth(endpoint: string, keys: KeyPair, contact: string): Promise<string> {
	const head = b64u(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
	const body = b64u(enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: contact })));
	const key = await crypto.subtle.importKey('jwk', keys.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
	const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(`${head}.${body}`));
	return `vapid t=${head}.${body}.${b64u(sig)}, k=${keys.publicKey}`;
}

/** Send one notification. Returns the push service's status (404/410: that subscription is gone). */
export async function sendPush(sub: { endpoint: string; p256dh: string; auth: string }, message: unknown, keys: KeyPair, contact: string): Promise<number> {
	const body = await encrypt(enc.encode(JSON.stringify(message)), sub);
	const res = await fetch(sub.endpoint, {
		method: 'POST',
		headers: {
			'content-encoding': 'aes128gcm',
			'content-type': 'application/octet-stream',
			ttl: String(3 * 24 * 3600),
			urgency: 'normal',
			authorization: await vapidAuth(sub.endpoint, keys, contact)
		},
		body: bytes(body)
	});
	return res.status;
}
