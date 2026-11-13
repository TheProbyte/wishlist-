import { test } from 'node:test';
import assert from 'node:assert/strict';
import { occasionDate, milestone, nextAnnual, storedDate } from '../src/lib/format.ts';

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
