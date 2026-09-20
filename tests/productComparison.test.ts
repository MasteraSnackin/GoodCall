import test from 'node:test';
import assert from 'node:assert/strict';
import { compareProducts, confirmedComparisonBudget, priceInPence } from '../src/lib/productComparison';
import { seedProducts } from '../src/lib/seed';

const ids = ['cloud-cream', 'daily-gel'];
const buy = { 'cloud-cream': { role: 'buy' as const }, 'daily-gel': { role: 'buy' as const } };

test('selection alone and unresolved roles never infer a basket', () => {
  assert.deepEqual(compareProducts(seedProducts(), ids, 'unknown', {}).options, []);
  assert.deepEqual(compareProducts(seedProducts(), ids, 'together', { 'cloud-cream': buy['cloud-cream'] }).options, []);
});

test('explicit alternatives retain separate identities even when their prices match', () => {
  const products = seedProducts().map(product => ids.includes(product.id) ? { ...product, price: 24 } : product);
  const comparison = compareProducts(products, ids, 'choose-one', buy, '30');
  assert.equal(comparison.problems.length, 0);
  assert.deepEqual(comparison.options.map(option => [option.id, option.label, option.totalPence, option.remainingPence]), [
    ['option:cloud-cream', 'Cloud Cream', 2400, 600], ['option:daily-gel', 'Daily Gel', 2400, 600],
  ]);
});

test('basket counts only confirmed new purchases; changing an owned product to buy is repurchase', () => {
  const owned = { ...buy, 'cloud-cream': { role: 'owned' as const } };
  const comparison = compareProducts(seedProducts(), ids, 'together', owned, '30');
  assert.deepEqual(comparison.options[0].purchaseProductIds, ['daily-gel']);
  assert.equal(comparison.options[0].totalPence, 2400);
  assert.equal(comparison.options[0].remainingPence, 600);
  const repurchase = compareProducts(seedProducts(), ids, 'together', buy, '30');
  assert.equal(repurchase.options[0].totalPence, 6200);
  assert.equal(repurchase.options[0].remainingPence, -3200);
});

test('keeping an owned alternative has zero new spending and unknown budget has no remainder', () => {
  const comparison = compareProducts(seedProducts(), ids, 'choose-one', { ...buy, 'cloud-cream': { role: 'owned' } });
  assert.equal(comparison.options[0].totalPence, 0);
  assert.equal(comparison.options[0].remainingPence, null);
  assert.equal(comparison.options[1].totalPence, 2400);
  assert.equal(comparison.options[1].remainingPence, null);
});

test('missing product, invalid price, invalid budget and unsupported quantities produce no total', () => {
  assert.deepEqual(compareProducts(seedProducts().filter(product => product.id !== 'cloud-cream'), ids, 'together', buy).options, []);
  for (const price of [NaN, Infinity, -1, 3.333, Number.MAX_SAFE_INTEGER]) {
    const products = seedProducts().map(product => product.id === 'cloud-cream' ? { ...product, price } : product);
    assert.deepEqual(compareProducts(products, ids, 'together', buy).options, []);
  }
  for (const quantity of [0, 2, 1.5, NaN, Infinity]) {
    assert.deepEqual(compareProducts(seedProducts(), ids, 'together', { ...buy, 'cloud-cream': { role: 'buy', quantity } }).options, []);
  }
  for (const budget of ['unknown', '-2', '£20', '10.005', '1e3']) {
    assert.deepEqual(compareProducts(seedProducts(), ids, 'together', buy, budget).options, []);
    assert.equal(confirmedComparisonBudget(budget).status, 'invalid');
  }
  assert.deepEqual(confirmedComparisonBudget(''), { status: 'unknown', pence: null });
  assert.deepEqual(confirmedComparisonBudget('0'), { status: 'confirmed', pence: 0 });
});

test('sums integer pennies and updates recorded prices without mutating inputs', () => {
  const products = seedProducts().map(product => product.id === 'cloud-cream' ? { ...product, price: 0.1 } : product.id === 'daily-gel' ? { ...product, price: 0.2 } : product);
  const before = JSON.stringify({ products, ids, buy });
  const first = compareProducts(products, ids, 'together', buy, '0.3');
  assert.equal(first.options[0].totalPence, 30);
  assert.equal(first.options[0].remainingPence, 0);
  assert.equal(JSON.stringify({ products, ids, buy }), before);
  const refreshed = products.map(product => product.id === 'cloud-cream' ? { ...product, price: 0.11, revision: product.revision + 1 } : product);
  assert.equal(compareProducts(refreshed, ids, 'together', buy, '0.3').options[0].remainingPence, -1);
  assert.equal(priceInPence(19.99), 1999);
});

test('allows only two or three distinct products and does not count duplicate selections twice', () => {
  assert.deepEqual(compareProducts(seedProducts(), [ids[0]], 'together', buy).options, []);
  assert.deepEqual(compareProducts(seedProducts(), [...ids, 'red-reset', 'night-serum'], 'together', buy).options, []);
  const two = compareProducts(seedProducts(), [...ids, ids[0]], 'together', buy);
  assert.deepEqual(two.ids, ids);
  assert.equal(two.options[0].totalPence, 6200);
  const three = compareProducts(seedProducts(), [...ids, 'red-reset'], 'together', { ...buy, 'red-reset': { role: 'buy' } });
  assert.equal(three.options[0].totalPence, 9400);
});
