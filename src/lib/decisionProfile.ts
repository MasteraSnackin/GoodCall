import type { Product } from './types';
import { DECISION_FIELD_LIMIT, type DecisionProfile } from './decisionTypes';

const money = (value: number) => `£${value.toFixed(value % 1 ? 2 : 0)}`;
const bounded = (text: string) => text.length <= DECISION_FIELD_LIMIT ? text : `${text.slice(0, DECISION_FIELD_LIMIT - 1).trimEnd()}…`;
const unknowns = 'The record provides catalogue descriptions and Maya’s notes. Personal fit and full product details have not been established.';

/** Suggested decision wording for Maya to review; catalogue labels are not personal recommendations. */
export function buildDecisionProfile(selected: Product[], holds: string[]): DecisionProfile {
  if (holds.length || selected.length === 0) {
    return {
      verdict: 'Need more context',
      suits: 'A decision can be made once the relevant product, preferences and evidence have been reviewed.',
      skipIf: 'Pause a purchase while a detail that could change the decision remains unresolved.',
      // Keep the detailed checks beside the draft. Repeating them here could turn a question or
      // an unsupported proposition into public recommendation wording.
      unknowns: holds.length
        ? `${holds.length === 1 ? 'One evidence or context gap remains' : `${holds.length} evidence or context gaps remain`}. Review the checks alongside this draft before deciding.`
        : 'The product or decision is not established yet. Clarify the goal, existing routine, preferences and budget.',
    };
  }

  const cloud = selected.find(product => product.id === 'cloud-cream');
  const glass = selected.find(product => product.id === 'glass-drop');
  // This value judgement belongs to the current recorded note and price, not to the product ID.
  const rejectedPrice = glass?.note.match(/\bnot\s+£\s*(\d+(?:\.\d{1,2})?)\s+good\b/i)?.[1];
  const glassValueConcern = selected.length === 1 && glass && rejectedPrice !== undefined && Number(rejectedPrice) === glass.price;
  const descriptions = selected.map(product => `${product.name}: ${product.finish.toLowerCase()} finish; catalogue skin category “${product.skin}”; ${money(product.price)}`).join('. ');
  const skips = [
    ...(cloud ? ['Your current moisturiser already does the job: keep it.'] : []),
    ...(glassValueConcern ? ['Maya’s recorded value judgement does not recommend paying this price.'] : []),
    'The purchase would stretch your budget, duplicate something that works, or miss the finish you want.',
  ];
  return {
    verdict: glassValueConcern ? 'Skip for now' : 'Consider',
    suits: bounded(`For someone comparing these recorded characteristics with a gap in their own routine: ${descriptions}. These are catalogue labels; Maya still needs to review the individual context.`),
    skipIf: bounded(skips.join(' ')),
    unknowns,
  };
}
