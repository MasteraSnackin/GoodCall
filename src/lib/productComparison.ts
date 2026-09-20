import type { Product } from './types';

export type ComparisonMode = 'unknown' | 'together' | 'choose-one';
export type ComparisonRole = 'unknown' | 'owned' | 'buy';
export interface ComparisonChoice { role: ComparisonRole; quantity?: number }
export interface ComparisonOption {
  id: string;
  label: string;
  productIds: string[];
  purchaseProductIds: string[];
  totalPence: number;
  /** A negative remainder means the confirmed budget is exceeded. */
  remainingPence: number | null;
}
export interface ProductComparisonResult {
  ids: string[];
  products: (Product | undefined)[];
  problems: string[];
  options: ComparisonOption[];
  budget: { status: 'unknown' | 'invalid' | 'confirmed'; pence: number | null };
}

/** Reject fractional pennies and unsafe values instead of silently changing recorded prices. */
export function priceInPence(value: number): number | null {
  if (!Number.isFinite(value) || value < 0) return null;
  const pence = Math.round(value * 100);
  return Number.isSafeInteger(pence) && Math.abs(value * 100 - pence) < 0.000001 ? pence : null;
}

export function confirmedComparisonBudget(value: string): ProductComparisonResult['budget'] {
  const trimmed = value.trim();
  if (!trimmed) return { status: 'unknown', pence: null };
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return { status: 'invalid', pence: null };
  const pence = priceInPence(Number(trimmed));
  return pence === null ? { status: 'invalid', pence: null } : { status: 'confirmed', pence };
}

export const comparisonMoney = (pence: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(pence / 100);

/** Explicit local choices only. Linked/selected evidence never implies a purchase. */
export function compareProducts(
  catalogue: Product[],
  productIds: string[],
  mode: ComparisonMode,
  choices: Record<string, ComparisonChoice>,
  budgetText = '',
): ProductComparisonResult {
  const ids = [...new Set(productIds)];
  const products = ids.map(id => catalogue.find(product => product.id === id));
  const problems: string[] = [];
  const budget = confirmedComparisonBudget(budgetText);
  const result: ProductComparisonResult = { ids, products, problems, options: [], budget };
  if (ids.length < 2 || ids.length > 3) problems.push('Select two or three different products to compare.');
  ids.forEach((id, index) => {
    const product = products[index];
    if (!product) { problems.push(`Product record missing: ${id}. Restore its evidence before calculating.`); return; }
    if (priceInPence(product.price) === null) problems.push(`${product.name}: a valid recorded price is missing.`);
    const choice = choices[id];
    if (!choice || !['owned', 'buy'].includes(choice.role)) problems.push(`${product.name}: confirm whether it is already owned or a new purchase.`);
    if (choice?.role === 'buy' && choice.quantity !== undefined && choice.quantity !== 1) problems.push(`${product.name}: this comparison supports one unit per new purchase. Confirm other quantities separately.`);
  });
  if (!['together', 'choose-one'].includes(mode)) problems.push('Choose whether these products would be bought together or are alternatives.');
  if (budget.status === 'invalid') problems.push('Enter a confirmed budget in pounds, using no more than two decimal places.');
  if (problems.length) return result;

  const optionIds = mode === 'together' ? [ids] : ids.map(id => [id]);
  for (const option of optionIds) {
    const purchaseProductIds = option.filter(id => choices[id].role === 'buy');
    // Each price is converted before addition; options retain their identity even at equal prices.
    const totalPence = purchaseProductIds.reduce((sum, id) => sum + priceInPence(catalogue.find(product => product.id === id)!.price)!, 0);
    if (!Number.isSafeInteger(totalPence)) {
      problems.push('The total is too large to calculate reliably. Check the recorded prices.');
      result.options = [];
      return result;
    }
    result.options.push({
      id: mode === 'together' ? `together:${ids.join('|')}` : `option:${option[0]}`,
      label: mode === 'together' ? 'Selected products together' : products[ids.indexOf(option[0])]!.name,
      productIds: [...option], purchaseProductIds, totalPence,
      remainingPence: budget.pence === null ? null : budget.pence - totalPence,
    });
  }
  return result;
}
