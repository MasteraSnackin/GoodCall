import type { Product } from './types';

export interface PurchaseContext {
  mode: 'basket' | 'alternatives' | 'owned' | 'unclear';
  ownedProductIds: string[];
  /** Each entry is a separate possible new purchase, never a list of evidence links. */
  purchaseOptions: string[][];
  hasExplicitPurchase: boolean;
  clarification?: string;
}

const unique = <T>(items: T[]) => [...new Set(items)];
const normalise = (value: string) => value.toLowerCase().replace(/[’']/g, '');
const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const TOKEN = '@p\\d+@';
const ARTICLE = '(?:(?:the|a|an)\\s+)?';
const LIST = `${TOKEN}(?:\\s*(?:,|and|&|\\+)\\s*${ARTICLE}${TOKEN})*`;
const MULTIPLE_COUNT = '(?:[2-9]\\d*|1\\d+|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|dozen)';
const QUANTITY = `(?:${MULTIPLE_COUNT}|[x×]\\s*${MULTIPLE_COUNT})\\s+(?:(?:(?:units?|copies|jars?|bottles?|tubes?)(?:\\s+of)?|of)\\s+)?`;
const PURCHASE_ITEM = `${ARTICLE}(?:${QUANTITY})?${TOKEN}`;
const PURCHASE_LIST = `${PURCHASE_ITEM}(?:\\s*(?:,|and|&|\\+)\\s*${PURCHASE_ITEM})*`;
const clarification = 'Clarify which products are already owned, which would be bought together, and which are alternatives before calculating new spending.';
const quantityClarification = 'Clarify the number of units to buy before calculating new spending. This check currently supports one unit of each selected product.';
const negatedIntent = (before: string) => /\b(?:do not|dont|never|not|no|without|avoid)\s+(?:\w+\s+){0,2}$/.test(before);

/** Negated instructions such as "do not compare" are not requests for a comparison. */
export function hasPositiveComparisonIntent(text: string): boolean {
  return normalise(text).split(/[.!?;\n]|\bbut\b/).some(clause =>
    [...clause.matchAll(/\b(?:compar(?:e|es|ed|ing|ison)|versus|vs|better than|cheaper than|(?:choose|choosing) (?:one )?between)\b/g)]
      .some(match => !negatedIntent(clause.slice(0, match.index))),
  );
}

/** Small, explicit language patterns. Unclear product roles require clarification. */
export function resolvePurchaseContext(text: string, products: Product[], referenceOnlyUnassigned = false): PurchaseContext {
  const selected = products.filter((product, index) => products.findIndex(p => p.id === product.id) === index);
  const ids = selected.map(product => product.id);
  let marked = normalise(text);
  // Long names first so a shorter name cannot consume part of another product name.
  const names = selected.map((product, index) => ({ name: normalise(product.name), index }));
  if (selected.some(product => product.id === 'spf-50')) names.push({ name: 'spf', index: selected.findIndex(product => product.id === 'spf-50') });
  names.sort((a, b) => b.name.length - a.name.length);
  for (const { name, index } of names) marked = marked.replace(new RegExp(`\\b${escape(name)}s?\\b`, 'g'), `@p${index}@`);
  const tokens = (value: string) => unique([...value.matchAll(/@p(\d+)@/g)].map(match => ids[Number(match[1])]).filter((id): id is string => !!id));
  const mentioned = tokens(marked);
  const owned = new Set<string>(), buying = new Set<string>();
  const comparisons: string[][] = [];
  let unclear = false, multipleUnits = false, hasExplicitPurchase = false, buyingAlternatives = false;
  for (const clause of marked.split(/[.!?;\n]|\bbut\b/)) {
    const alternatives = new RegExp(`${TOKEN}(?:\\s*(?:or|versus|vs)\\s*${ARTICLE}${TOKEN})+`, 'g');
    const compare = new RegExp(`\\b(?:compare|comparing|choosing between|choose between|choose one between)\\s+(?:the\\s+)?(${LIST})`, 'g');
    const clauseComparisons = [...clause.matchAll(alternatives), ...clause.matchAll(compare)].filter(match => tokens(match[0]).length > 1 && !negatedIntent(clause.slice(0, match.index)));
    clauseComparisons.forEach(match => comparisons.push(tokens(match[0])));
    const ownership = new RegExp(`\\b(?:i\\s+(?:(?:already|currently)\\s+)?(?:own|have|use)|ive\\s+(?:already\\s+)?got)\\s+(?:the\\s+)?(${LIST})`, 'g');
    for (const match of clause.matchAll(ownership)) {
      if (/\bif\b/.test(clause.slice(0, match.index)) || clauseComparisons.some(group => tokens(group[0]).some(id => tokens(match[1]).includes(id)))) { unclear = true; continue; }
      tokens(match[1]).forEach(id => owned.add(id));
    }
    const purchases = new RegExp(`\\b(?:buy|purchase|repurchase|rebuy|replace|reorder|choose|pick|recommend(?:\\s+(?:buying|purchasing))?|go\\s+for)\\s+(?:(?:both|another)\\s+)?(${PURCHASE_LIST}|it|them|both)`, 'g');
    for (const match of clause.matchAll(purchases)) {
      const before = clause.slice(0, match.index);
      if (/\b(?:dont|do not|not|never|if)\b/.test(before)) { unclear = true; continue; }
      const target = tokens(match[1]);
      hasExplicitPurchase = true;
      const after = clause.slice(match.index! + match[0].length);
      if (new RegExp(QUANTITY).test(match[1]) || new RegExp(`^\\s*(?:twice\\b|thrice\\b|[x×]\\s*${MULTIPLE_COUNT}\\b|${MULTIPLE_COUNT}\\s+(?:times|units?|copies|jars?|bottles?|tubes?)\\b)`).test(after)) multipleUnits = true;
      if (target.length && clauseComparisons.some(group => group.index! >= match.index! && group.index! < match.index! + match[0].length)) buyingAlternatives = true;
      else if (target.length) target.forEach(id => buying.add(id));
      else if (ids.length === 1 && match[1] === 'it') buying.add(ids[0]);
      else unclear = true;
    }
  }
  const groups = unique(comparisons.map(group => JSON.stringify([...group].sort())));
  if (groups.length > 1) unclear = true;
  const options = comparisons[0] ?? [];
  // A purchase verb before "A or B" introduces alternatives, not a purchase of both.
  const fixedPurchases = [...buying].filter(id => !options.includes(id));
  const resolved = new Set([...owned, ...buying, ...options]);
  if (options.length && /\bboth\b/.test(marked)) unclear = true;
  if (ids.some(id => !resolved.has(id))) {
    if (referenceOnlyUnassigned && hasExplicitPurchase) { /* Other linked products remain evidence. */ }
    else if (resolved.size > 0 || /\b(?:own|owned|already have|already use|repurchase|rebuy)\b/.test(marked) || hasPositiveComparisonIntent(marked)) unclear = true;
    else if (ids.length > 1 && mentioned.length > 0) unclear = true;
    else ids.forEach(id => buying.add(id)); // Existing single-product and inferred-routine checks.
  }
  if (unclear || multipleUnits) return { mode: 'unclear', ownedProductIds: [...owned], purchaseOptions: [], hasExplicitPurchase, clarification: multipleUnits ? quantityClarification : clarification };
  // A separately stated purchase selects an option; merely listing comparison evidence does not.
  if (options.length && buying.size && !buyingAlternatives && [...buying].some(id => options.includes(id))) return {
    mode: 'basket', ownedProductIds: [...owned], hasExplicitPurchase, purchaseOptions: [[...buying]],
  };
  if (options.length) return {
    mode: 'alternatives', ownedProductIds: [...owned], hasExplicitPurchase,
    purchaseOptions: options.map(id => unique([...fixedPurchases, ...(!owned.has(id) || buyingAlternatives ? [id] : [])])),
  };
  const purchases = [...buying];
  return { mode: purchases.length ? 'basket' : 'owned', ownedProductIds: [...owned], purchaseOptions: [purchases], hasExplicitPurchase };
}

export function purchaseTotals(context: PurchaseContext, products: Product[]): number[] {
  return unique(context.purchaseOptions.map(option => Math.round(option.reduce((sum, id) => sum + (products.find(product => product.id === id)?.price ?? 0), 0) * 100) / 100));
}
