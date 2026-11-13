import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseProductPage, parsePrice, normaliseUrl, storeName } from '../src/lib/server/importer.ts';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('Amazon page: title, price, big image, size and colour', () => {
	const url = new URL('https://www.amazon.com/Levis-Mens-Regular-Jeans/dp/B0018OKX68/ref=sr_1_3?th=1&psc=1');
	const r = parseProductPage(url, fixture('amazon-jeans.html'));
	assert.equal(r.ok, true);
	assert.equal(r.url, 'https://www.amazon.com/dp/B0018OKX68');
	assert.equal(r.store, 'Amazon');
	assert.equal(r.title, 'Levi\'s Men\'s 505 Regular Fit Jeans');
	assert.equal(r.price_cents, 4499);
	assert.equal(r.currency, 'USD');
	assert.equal(r.image_url, 'https://m.media-amazon.com/images/I/71bigjeans._AC_SL1500_.jpg');
	assert.deepEqual(r.specifics, [
		{ label: 'Size', value: '32W x 30L' },
		{ label: 'Colour', value: 'Dark Stonewash' }
	]);
	assert.equal(r.availability, 'in_stock');
	assert.equal(r.category_id, 'cat_clothes');
	assert.match(r.description ?? '', /100% Cotton/);
});

test('Amazon: hidden "unavailable" templates do not mean sold out', () => {
	const r = parseProductPage(new URL('https://www.amazon.com/dp/B09NMBB5YL'), fixture('amazon-hidden-oos.html'));
	assert.equal(r.availability, 'in_stock');
	assert.equal(r.price_cents, 4999);
});

test('Amazon: really sold out', () => {
	const r = parseProductPage(new URL('https://www.amazon.com/dp/B000000000'), fixture('amazon-oos.html'));
	assert.equal(r.availability, 'out_of_stock');
});

test('Amazon bot wall: blocked, but still a usable title from the link', () => {
	const url = new URL('https://www.amazon.co.uk/Sony-WH-1000XM5-Wireless-Cancelling-Headphones/dp/B09XS7JWHH');
	const r = parseProductPage(url, fixture('amazon-captcha.html'));
	assert.equal(r.blocked, true);
	assert.equal(r.title, 'Sony WH 1000XM5 Wireless Cancelling Headphones');
	assert.equal(r.currency, 'GBP');
	assert.equal(r.category_id, 'cat_tech');
	assert.match(r.error ?? '', /blocked/);
});

test('Shopify-style JSON-LD product', () => {
	const r = parseProductPage(new URL('https://www.allbirds.com/products/mens-tree-runners?utm_source=x'), fixture('shopify.html'));
	assert.equal(r.ok, true);
	assert.equal(r.url, 'https://www.allbirds.com/products/mens-tree-runners');
	assert.equal(r.title, "Men's Tree Runners - Jet Black");
	assert.equal(r.price_cents, 9800);
	assert.equal(r.currency, 'USD');
	assert.equal(r.image_url, 'https://cdn.allbirds.com/image/upload/tree-runner-1.png');
	assert.equal(r.store, 'Allbirds');
	assert.equal(r.availability, 'in_stock');
	assert.equal(r.category_id, 'cat_shoes');
});

test('Shop with only meta tags: relative image, European price', () => {
	const r = parseProductPage(new URL('https://littleshop.example.com/p/pourover'), fixture('meta-only.html'));
	assert.equal(r.ok, true);
	assert.equal(r.title, 'Ceramic Pour-Over Coffee Set');
	assert.equal(r.image_url, 'https://littleshop.example.com/media/pourover.jpg');
	assert.equal(r.price_cents, 124900);
	assert.equal(r.currency, 'EUR');
});

test('Error pages are not products', () => {
	const r = parseProductPage(new URL('https://shop.example.com/items/cozy-wool-blanket'), '<title>Just a moment...</title>', { status: 403 });
	assert.equal(r.blocked, true);
	assert.equal(r.title, 'Cozy Wool Blanket');
});

test('price parsing', () => {
	assert.deepEqual(parsePrice('$1,299.99'), { cents: 129999, currency: 'USD' });
	assert.deepEqual(parsePrice('1.299,99 €'), { cents: 129999, currency: 'EUR' });
	assert.deepEqual(parsePrice('£24'), { cents: 2400, currency: 'GBP' });
	assert.deepEqual(parsePrice('CA$ 19,99'), { cents: 1999, currency: 'CAD' });
	assert.equal(parsePrice('free'), null);
});

test('URL handling', () => {
	assert.equal(normaliseUrl('look at this https://a.co/d/abc123 !!')?.toString(), 'https://a.co/d/abc123');
	assert.equal(normaliseUrl('etsy.com/listing/123/mug')?.hostname, 'etsy.com');
	assert.equal(normaliseUrl('http://localhost:8787/admin'), null);
	assert.equal(normaliseUrl('http://192.168.1.1/'), null);
	assert.equal(normaliseUrl('file:///etc/passwd'), null);
	assert.equal(storeName(new URL('https://www.johnlewis.com/x')), 'John Lewis');
	assert.equal(storeName(new URL('https://shop.example.co.uk/x')), 'Example');
});
