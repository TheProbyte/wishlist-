import { test } from 'node:test';
import assert from 'node:assert/strict';
import { b64u, encrypt, newKeyPair, vapidAuth, unb64u } from '../src/lib/server/webpush.ts';

// The worked example in RFC 8291, Appendix A.
test('Web Push encryption matches the RFC 8291 example', async () => {
	const body = await encrypt(
		new TextEncoder().encode('When I grow up, I want to be a watermelon'),
		{
			p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
			auth: 'BTBZMqHH6r4Tts7J_aSIgg'
		},
		{
			ephemeral: {
				privateB64u: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',
				publicB64u: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8'
			},
			salt: 'DGv6ra1nlYgDCS1FRnbzlw'
		}
	);
	assert.equal(
		b64u(body),
		'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN'
	);
});

test('VAPID header is a signed ES256 token for the push service', async () => {
	const keys = await newKeyPair();
	const auth = await vapidAuth('https://fcm.googleapis.com/fcm/send/abc', keys, 'https://example.test');
	const [, token, k] = auth.match(/^vapid t=([^,]+), k=(.+)$/)!;
	assert.equal(k, keys.publicKey);
	const [h, p, s] = token.split('.');
	const claims = JSON.parse(new TextDecoder().decode(unb64u(p)));
	assert.equal(claims.aud, 'https://fcm.googleapis.com');
	assert.equal(claims.sub, 'https://example.test');
	const pub = await crypto.subtle.importKey('raw', unb64u(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
	assert.ok(await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, unb64u(s), new TextEncoder().encode(`${h}.${p}`)));
});

// The whole trip: send to a stand-in push service, then open it the way the phone would.
test('a sent notification decrypts on the receiving end, with the right headers', async () => {
	const { sendPush } = await import('../src/lib/server/webpush.ts');
	const enc = new TextEncoder();
	const ua = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair;
	const uaPublic = new Uint8Array(await crypto.subtle.exportKey('raw', ua.publicKey));
	const auth = crypto.getRandomValues(new Uint8Array(16));
	const keys = await newKeyPair();
	let seen: { url: string; headers: Record<string, string>; body: Uint8Array } | null = null;
	const realFetch = globalThis.fetch;
	globalThis.fetch = (async (url: string, init: RequestInit) => {
		seen = { url, headers: init.headers as Record<string, string>, body: new Uint8Array(init.body as ArrayBuffer) };
		return new Response(null, { status: 201 });
	}) as typeof fetch;
	try {
		const status = await sendPush({ endpoint: 'https://push.example.test/abc', p256dh: b64u(uaPublic), auth: b64u(auth) }, { title: 'Hi', url: '/x' }, keys, 'https://app.test');
		assert.equal(status, 201);
	} finally {
		globalThis.fetch = realFetch;
	}
	assert.ok(seen);
	const s = seen as { url: string; headers: Record<string, string>; body: Uint8Array };
	assert.equal(s.headers['content-encoding'], 'aes128gcm');
	assert.match(s.headers.authorization, /^vapid t=.+, k=/);
	// Read the header, rebuild the keys from the phone's side, and decrypt.
	const body = s.body;
	const salt = body.slice(0, 16);
	const idlen = body[20];
	const asPublic = body.slice(21, 21 + idlen);
	const hmac = async (key: Uint8Array, data: Uint8Array) => new Uint8Array(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data));
	const cat = (...p: Uint8Array[]) => { const o = new Uint8Array(p.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of p) { o.set(x, i); i += x.length; } return o; };
	const asKey = await crypto.subtle.importKey('raw', asPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
	const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: asKey }, ua.privateKey, 256));
	const ikm = await hmac(await hmac(auth, shared), cat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])));
	const prk = await hmac(salt, ikm);
	const cek = (await hmac(prk, cat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
	const nonce = (await hmac(prk, cat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
	const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['decrypt']), body.slice(21 + idlen)));
	assert.equal(plain.at(-1), 2);
	assert.deepEqual(JSON.parse(new TextDecoder().decode(plain.slice(0, -1))), { title: 'Hi', url: '/x' });
});
