import type { PublishedAdvice } from './types';

/** Bounded hints for the human preview, never a complete privacy classification. */
export function publicationContactDetails(advice: PublishedAdvice): string[] {
  const text = [advice.title, advice.text, ...advice.products.map(p => p.note),
    ...(advice.decision ? [advice.decision.suits, advice.decision.skipIf, advice.decision.unknowns] : [])].join('\n');
  const emails = text.match(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi) || [];
  const phones = text.match(/(?:\+\d{1,3}[\s.-]?)?(?:\(?\d{2,5}\)?[\s.-]?){2,5}\d{3,4}/g) || [];
  return [...new Set([...emails, ...phones.filter(value => {
    const digits = value.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 15;
  })])].slice(0, 12);
}
