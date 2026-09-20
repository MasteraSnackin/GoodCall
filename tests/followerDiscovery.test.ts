import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PublishedAdvice } from '../src/lib/types';
import { findAdviceMatches, parseDecisionBudget, searchPublishedAdvice } from '../src/lib/followerDiscovery';
import type { DecisionContext } from '../src/lib/followerDiscovery';

const advice = (id: string, overrides: Partial<PublishedAdvice> = {}): PublishedAdvice => ({ version: 1, demo: true, id, title: 'Daytime hydration', text: 'Compare Cloud Cream with Daily Gel for hydration. Read the original limits.', products: [{ name: 'Cloud Cream', price: 38, note: 'A rich finish.' }, { name: 'Daily Gel', price: 24, note: 'A lighter finish.' }], sourceRefs: [{ page: 2, label: 'Published notebook', excerpt: 'Moisturiser notes.' }], publishedAt: '2026-09-20T10:00:00.000Z', ...overrides });
const context = (overrides: Partial<DecisionContext> = {}): DecisionContext => ({ goal: 'hydration', budget: '', owned: '', note: '', ...overrides });

test('blank, zero and invalid budgets remain distinct', () => {
  assert.deepEqual(parseDecisionBudget(''), { status: 'empty' });
  assert.deepEqual(parseDecisionBudget('  £0.00 '), { status: 'valid', amount: 0 });
  assert.deepEqual(parseDecisionBudget('1,250.50'), { status: 'valid', amount: 1250.5 });
  for (const value of ['-1', 'NaN', 'Infinity', '40 pounds', '1e3', '1,25', '£', '0.001']) assert.deepEqual(parseDecisionBudget(value), { status: 'invalid' }, value);
});

test('budget markers compare each mentioned price and never invent a basket total', () => {
  const [match] = findAdviceMatches([advice('one')], context({ budget: '40' }));
  assert.deepEqual(match.pricesAtOrBelow, [{ name: 'Cloud Cream', price: 38 }, { name: 'Daily Gel', price: 24 }]);
  assert.deepEqual(match.pricesAbove, []);
  assert.equal('total' in match, false);
  const [zero] = findAdviceMatches([advice('one')], context({ budget: '0' }));
  assert.equal(zero.pricesAtOrBelow.length, 0); assert.equal(zero.pricesAbove.length, 2);
  const [mixed] = findAdviceMatches([advice('one')], context({ budget: '25' }));
  assert.deepEqual(mixed.pricesAtOrBelow.map(item => item.name), ['Daily Gel']); assert.deepEqual(mixed.pricesAbove.map(item => item.name), ['Cloud Cream']);
});

test('invalid and missing prices do not produce budget claims', () => {
  const [invalid] = findAdviceMatches([advice('one')], context({ budget: 'invalid' }));
  assert.deepEqual(invalid.budget, { status: 'invalid' }); assert.deepEqual(invalid.pricesAtOrBelow, []); assert.deepEqual(invalid.pricesAbove, []);
  const [none] = findAdviceMatches([advice('none', { products: [] })], context({ budget: '50' }));
  assert.deepEqual(none.pricesAtOrBelow, []); assert.deepEqual(none.pricesAbove, []);
});

test('owned product overlap requires a complete name and does not alter ranking', () => {
  const items = [advice('one'), advice('two', { title: 'Hydration for daytime' })];
  const before = JSON.stringify(items);
  const matches = findAdviceMatches(items, context({ owned: 'I already have CLOUD CREAM, and a cleanser' }));
  assert.deepEqual(matches[0].ownedProducts, ['Cloud Cream']);
  assert.deepEqual(matches.map(match => match.advice.id), findAdviceMatches(items, context()).map(match => match.advice.id));
  assert.deepEqual(findAdviceMatches(items, context({ owned: 'cream' }))[0].ownedProducts, []);
  assert.equal(JSON.stringify(items), before);
});

test('only lexical mentions rank, including cautions without a suitability claim', () => {
  const caution = advice('caution', { title: 'A careful choice', text: 'Do not assume hydration means this will suit you.', products: [] });
  const strong = advice('strong', { title: 'Hydration and moisturiser', text: 'Published hydration notes.', products: [] });
  const matches = findAdviceMatches([caution, strong], context({ goal: 'hydration moisturiser' }));
  assert.equal(matches[0].advice.id, 'strong');
  assert.deepEqual(matches[1].matchedTerms, ['hydration', 'moisturiser']);
  assert.equal('suitable' in matches[1], false);
  assert.deepEqual(findAdviceMatches([strong], context({ goal: 'unmentioned zebra' })), []);
  assert.deepEqual(findAdviceMatches([strong], context({ goal: 'I would like help' })), []);
  assert.deepEqual(findAdviceMatches([], context()), []);
});

test('browse searches only published words and requires every meaningful search term', () => {
  const item = advice('one');
  assert.deepEqual(searchPublishedAdvice([item], 'cloud cream'), [item]);
  assert.deepEqual(searchPublishedAdvice([item], 'MOISTURISER'), [item]);
  assert.deepEqual(searchPublishedAdvice([item], 'cloud zebra'), []);
  assert.deepEqual(searchPublishedAdvice([item], ''), [item]);
  assert.deepEqual(searchPublishedAdvice([item], 'the'), []);
});
