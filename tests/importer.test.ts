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

test('Amazon wish list page: every item with title, link, picture and price', async () => {
	const { parseAmazonWishlist } = await import('../src/lib/server/importer.ts');
	const html = `<ul id="g-items">
<li data-id="X" data-itemid="I1" data-price="24.99" class="g-item-sortable"><div><img src="https://m.media-amazon.com/images/I/81abc._SS135_.jpg">
<a id="itemName_I1" class="a-link-normal" title="Hydro Flask 32 oz" href="/dp/B01ACATW7E/?coliid=I1">Hydro Flask 32 oz Wide Mouth</a></div></li>
<li data-id="X" data-itemid="I2" data-price="-Infinity" class="g-item-sortable"><div><img src="https://m.media-amazon.com/images/I/71xyz._SS135_.jpg">
<a id="itemName_I2" href="/dp/B07FZ8S74R/">Echo Dot</a><span class="a-price"><span class="a-offscreen">$49.99</span></span></div></li>
</ul>`;
	const items = parseAmazonWishlist(html, new URL('https://www.amazon.com/hz/wishlist/ls/ABC123'));
	assert.equal(items.length, 2);
	assert.equal(items[0].title, 'Hydro Flask 32 oz Wide Mouth');
	assert.equal(items[0].url, 'https://www.amazon.com/dp/B01ACATW7E/?coliid=I1');
	assert.equal(items[0].price, 24.99);
	assert.equal(items[0].image_url, 'https://m.media-amazon.com/images/I/81abc.jpg');
	assert.equal(items[1].price, '$49.99');
});

test('Details read in the browser win, with no fetch when complete', async () => {
	const { importWithHint } = await import('../src/lib/server/importer.ts');
	const r = await importWithHint({ url: 'https://www.amazon.com/Some-Thing/dp/B000000001?ref=x', title: 'Amazon.com: Wool Socks', image_url: 'https://img.example/s.jpg', price: '$12.50', specifics: [{ label: 'Size', value: 'L' }] });
	assert.equal(r.ok, true);
	assert.equal(r.url, 'https://www.amazon.com/dp/B000000001');
	assert.equal(r.title, 'Wool Socks');
	assert.equal(r.price_cents, 1250);
	assert.equal(r.currency, 'USD');
	assert.deepEqual(r.specifics, [{ label: 'Size', value: 'L' }]);
	assert.equal(r.category_id, 'cat_clothes');
});

test('Amazon wish list: works whatever order the link attributes come in', async () => {
	const { parseAmazonWishlist } = await import('../src/lib/server/importer.ts');
	const html = `<ul id="g-items">
<li data-id="L1" data-itemId="IAAA" data-price="129.0" class="a-spacing-none g-item-sortable">
  <div class="a-row"><a class="a-link-normal" href="/dp/B0BX1/?coliid=IAAA&ref_=lv_ov_lig_dp_it" title="Instant Pot Duo 7-in-1"><img alt="Instant Pot" src="https://m.media-amazon.com/images/I/71V._SS135_.jpg"></a></div>
  <h2 class="a-size-base"><a class="a-link-normal" title="Instant Pot Duo 7-in-1 Electric Pressure Cooker" href="/dp/B0BX1/?coliid=IAAA" id="itemName_IAAA">Instant Pot Duo 7-in-1 Electric Pressure Cooker</a></h2>
  <ul class="a-unordered-list"><li><span>Add to cart</span></li></ul>
</li>
<li data-id="L1" data-itemId="IBBB" data-price="-Infinity" class="a-spacing-none g-item-sortable">
  <a href="/dp/B0CC2/" class="a-link-normal" title="Kindle Paperwhite"><img src="https://m.media-amazon.com/images/I/61K._SS135_.jpg"></a>
  <span class="a-price"><span class="a-offscreen">$149.99</span></span>
</li>
</ul>`;
	const items = parseAmazonWishlist(html, new URL('https://www.amazon.com/hz/wishlist/ls/ABC'));
	assert.equal(items.length, 2);
	assert.equal(items[0].title, 'Instant Pot Duo 7-in-1 Electric Pressure Cooker');
	assert.equal(items[0].price, 129);
	assert.equal(items[0].image_url, 'https://m.media-amazon.com/images/I/71V.jpg');
	assert.equal(items[1].title, 'Kindle Paperwhite');
	assert.equal(items[1].url, 'https://www.amazon.com/dp/B0CC2/');
	assert.equal(items[1].price, '$149.99');
});

test('Amazon gift lists (registries): owner links count, tiles are read', async () => {
	const { isAmazonWishlist, parseAmazonWishlist } = await import('../src/lib/server/importer.ts');
	assert.equal(isAmazonWishlist(new URL('https://www.amazon.com/registries/gl/owner-view/3LMO0WXVVPO88')), true);
	assert.equal(isAmazonWishlist(new URL('https://www.amazon.com/registries/gl/guest-view/3LMO0WXVVPO88')), true);
	const html = `<div class="gl-items">
<div class="tile"><a href="/dp/B08N5WRWNW?ref=gl" aria-label="Echo Dot (4th Gen) smart speaker"><img src="https://m.media-amazon.com/images/I/714._AC_SR200_.jpg" alt="Echo Dot"></a>
<a href="/dp/B08N5WRWNW?ref=gl">Echo Dot (4th Gen) smart speaker</a><span class="a-price"><span class="a-offscreen">$49.99</span></span></div>
<div class="tile"><a href="/dp/B07PGL2ZSL"><img src="https://m.media-amazon.com/images/I/81q._AC_SR200_.jpg" alt="Fire TV Stick 4K streaming device"></a><span class="a-offscreen">$39.99</span></div>
<a href="/dp/B07PGL2ZSL">See more</a>
</div>`;
	const items = parseAmazonWishlist(html, new URL('https://www.amazon.com/registries/gl/guest-view/X'));
	assert.equal(items.length, 2);
	assert.deepEqual(items.map((i) => i.title), ['Echo Dot (4th Gen) smart speaker', 'Fire TV Stick 4K streaming device']);
	assert.deepEqual(items.map((i) => i.price), ['$49.99', '$39.99']);
	assert.equal(items[0].url, 'https://www.amazon.com/dp/B08N5WRWNW');
	assert.equal(items[1].image_url, 'https://m.media-amazon.com/images/I/81q.jpg');
});
