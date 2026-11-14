import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occasionDate, milestone, nextAnnual, storedDate, withKid } from '../src/lib/format.ts';

const at = (s: string) => {
	const [y, m, d] = s.split('-').map(Number);
	return new Date(y, m - 1, d, 15, 0);
};

test('Christmas needs no date and always means the next Dec 25', () => {
	assert.equal(occasionDate('christmas', null, at('2026-11-13')), '2026-12-25');
	assert.equal(occasionDate('christmas', null, at('2026-12-25')), '2026-12-25');
	assert.equal(occasionDate('christmas', null, at('2026-12-26')), '2027-12-25');
	assert.equal(storedDate('christmas', '2026-12-25'), null);
});

test('Birthday rolls to the next one every year', () => {
	assert.equal(occasionDate('birthday', '1995-03-04', at('2026-11-13')), '2027-03-04');
	assert.equal(occasionDate('birthday', '1995-12-02', at('2026-11-13')), '2026-12-02');
	assert.equal(milestone('birthday', '1995-12-02', at('2026-11-13')), 'turns 31');
	assert.equal(milestone('birthday', '1995-03-04', at('2026-11-13')), 'turns 32');
	assert.equal(milestone('anniversary', '2020-06-01', at('2026-11-13')), '7 years');
});

test('Leap-day birthdays land on Feb 28 in other years', () => {
	assert.equal(nextAnnual(2, 29, at('2026-11-13')), '2027-02-28');
	assert.equal(nextAnnual(2, 29, at('2027-11-13')), '2028-02-29');
});

test('Anytime lists have no date; one-off dates stay as entered', () => {
	assert.equal(occasionDate('general', '2026-05-05'), null);
	assert.equal(occasionDate('wedding', '2027-06-12', at('2026-11-13')), '2027-06-12');
});

test('Secret Santa: everyone gives to one other person, nobody draws themselves', async () => {
	const { drawNames } = await import('../src/lib/server/santa.ts');
	for (let n = 2; n <= 12; n++) {
		const people = Array.from({ length: n }, (_, i) => `p${i}`);
		for (let trial = 0; trial < 50; trial++) {
			const pairs = drawNames(people);
			assert.equal(pairs.size, n);
			assert.equal(new Set(pairs.values()).size, n, 'each person receives exactly once');
			for (const [giver, receiver] of pairs) assert.notEqual(giver, receiver);
		}
	}
});

test('withKid names a child once', () => {
	assert.equal(withKid('Kya', 'Kya’s birthday'), 'Kya’s birthday');
	assert.equal(withKid('kya', 'Kya’s birthday'), 'Kya’s birthday');
	assert.equal(withKid('Kya', 'Christmas'), 'Kya’s Christmas');
	assert.equal(withKid(null, 'Birthday'), 'Birthday');
});
