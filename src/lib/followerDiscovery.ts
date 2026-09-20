import type { PublishedAdvice } from './types';

/** Private follower context; it is never added to a published advice snapshot. */
export interface DecisionContext { goal: string; budget: string; owned: string; note: string }
export type ParsedBudget = { status: 'empty' } | { status: 'invalid' } | { status: 'valid'; amount: number };
export interface MentionedPrice { name: string; price: number }
export interface AdviceMatch {
  advice: PublishedAdvice;
  score: number;
  matchedTerms: string[];
  ownedProducts: string[];
  budget: ParsedBudget;
  pricesAtOrBelow: MentionedPrice[];
  pricesAbove: MentionedPrice[];
}

const stopWords = new Set(['a', 'an', 'and', 'are', 'as', 'at', 'be', 'can', 'could', 'for', 'from', 'get', 'help', 'how', 'i', 'in', 'is', 'it', 'like', 'looking', 'me', 'my', 'need', 'of', 'on', 'or', 'please', 'should', 'some', 'something', 'that', 'the', 'this', 'to', 'want', 'what', 'with', 'would']);
const normalise = (text: string) => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-GB').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
const words = (text: string) => [...new Set(normalise(text).split(' ').filter(word => word.length > 1 && !stopWords.has(word)))];
const publicText = (advice: PublishedAdvice) => [advice.title, advice.text, ...advice.products.flatMap(product => [product.name, product.note]), ...(advice.decision ? [advice.decision.suits, advice.decision.skipIf, advice.decision.unknowns] : []), ...advice.sourceRefs.flatMap(source => [source.label, source.excerpt])].join(' ');

/** A blank budget is distinct from £0; ambiguous formats never become a number. */
export function parseDecisionBudget(value: string): ParsedBudget {
  const trimmed = value.trim();
  if (!trimmed) return { status: 'empty' };
  const numeric = trimmed.replace(/^£\s*/, '');
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(numeric)) return { status: 'invalid' };
  const amount = Number(numeric.replaceAll(',', ''));
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000 ? { status: 'valid', amount } : { status: 'invalid' };
}

/** Browse searches literal public words, including the published source excerpts. */
export function searchPublishedAdvice(advice: PublishedAdvice[], query: string): PublishedAdvice[] {
  const terms = words(query);
  if (!query.trim()) return [...advice];
  if (!terms.length) return [];
  return advice.filter(item => {
    const text = new Set(normalise(publicText(item)).split(' '));
    return terms.every(term => text.has(term));
  });
}

/**
 * Rank lexical mentions only. A word in a caution or an unknown still counts as
 * a mention; the caller must never present the result as personal suitability.
 * Price annotations compare each published product price, never a basket total.
 */
export function findAdviceMatches(advice: PublishedAdvice[], context: DecisionContext): AdviceMatch[] {
  const terms = words(context.goal);
  if (!terms.length) return [];
  const budget = parseDecisionBudget(context.budget);
  const ownedText = ` ${normalise(context.owned)} `;
  return advice.flatMap((item, order) => {
    const text = new Set(normalise(publicText(item)).split(' '));
    const matchedTerms = terms.filter(term => text.has(term));
    if (!matchedTerms.length) return [];
    const titleWords = new Set(normalise(item.title).split(' '));
    const productWords = new Set(normalise(item.products.map(product => product.name).join(' ')).split(' '));
    const score = matchedTerms.length * 10 + matchedTerms.filter(term => titleWords.has(term)).length * 3 + matchedTerms.filter(term => productWords.has(term)).length * 2;
    const ownedProducts = [...new Set(item.products.filter(product => {
      const name = normalise(product.name);
      return name.length > 0 && ownedText.includes(` ${name} `);
    }).map(product => product.name))];
    const prices = item.products.filter(product => Number.isFinite(product.price) && product.price >= 0).map(({ name, price }) => ({ name, price }));
    return [{ advice: item, score, matchedTerms, ownedProducts, budget,
      pricesAtOrBelow: budget.status === 'valid' ? prices.filter(product => product.price <= budget.amount) : [],
      pricesAbove: budget.status === 'valid' ? prices.filter(product => product.price > budget.amount) : [], order }];
  }).sort((first, second) => second.score - first.score || first.order - second.order).map(({ order: _order, ...match }) => match);
}

export const formatAdvicePrice = (price: number) => new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP', minimumFractionDigits: price % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(price);
