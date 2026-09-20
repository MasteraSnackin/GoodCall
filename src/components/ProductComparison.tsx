import { useId, useState } from 'react';
import type { Workspace } from '../lib/types';
import { compareProducts, comparisonMoney, priceInPence } from '../lib/productComparison';
import type { ComparisonChoice, ComparisonMode, ComparisonRole } from '../lib/productComparison';
import './ProductComparison.css';

export interface ProductComparisonProps { workspace: Workspace; productIds: string[]; onClose: () => void }

export function ProductComparison({ workspace, productIds, onClose }: ProductComparisonProps) {
  const id = useId();
  const [mode, setMode] = useState<ComparisonMode>('unknown');
  const [choices, setChoices] = useState<Record<string, ComparisonChoice>>({});
  const [budget, setBudget] = useState('');
  const result = compareProducts(workspace.products, productIds, mode, choices, budget);
  const setRole = (productId: string, role: ComparisonRole) => setChoices(previous => ({ ...previous, [productId]: { role, quantity: 1 } }));
  return <section className="product-comparison" aria-labelledby={`${id}-heading`}>
    <header className="product-comparison-header">
      <div><p className="product-comparison-eyebrow">Maya’s decision desk</p><h3 id={`${id}-heading`}>Product comparison</h3></div>
      <button type="button" className="product-comparison-close" onClick={onClose} aria-label="Close product comparison">Close</button>
    </header>
    <p className="product-comparison-intro">Compare the recorded evidence, then confirm what would actually be bought. These choices stay in this panel and do not change an answer or create a basket.</p>
    <div className="product-comparison-controls">
      <label htmlFor={`${id}-mode`}>Purchase plan<select id={`${id}-mode`} value={mode} onChange={event => setMode(event.target.value as ComparisonMode)}>
        <option value="unknown">Choose a plan…</option><option value="together">Buy together</option><option value="choose-one">Choose one alternative</option>
      </select></label>
      <label htmlFor={`${id}-budget`}>Confirmed budget (£, optional)<input id={`${id}-budget`} inputMode="decimal" value={budget} onChange={event => setBudget(event.target.value)} placeholder="Not yet known" aria-invalid={result.budget.status === 'invalid'} aria-describedby={`${id}-budget-help`}/></label>
    </div>
    <p id={`${id}-budget-help`} className="product-comparison-help">Enter only a budget the follower has confirmed. A blank budget stays unknown.</p>
    <div className="product-comparison-grid">
      {result.ids.map((productId, index) => {
        const product = result.products[index], choice = choices[productId], role = choice?.role ?? 'unknown';
        if (!product) return <article className="product-comparison-card product-comparison-missing" key={productId}><h4>Product record missing</h4><p>{productId}</p><p>Restore the product and its source before calculating.</p></article>;
        const pence = priceInPence(product.price);
        return <article className="product-comparison-card" key={productId} aria-labelledby={`${id}-product-${index}`}>
          <h4 id={`${id}-product-${index}`}>{product.name}</h4>
          <dl className="product-comparison-facts">
            <div><dt>Recorded price</dt><dd>{pence === null ? 'Not recorded or invalid' : comparisonMoney(pence)}</dd></div>
            <div><dt>Type</dt><dd>{product.type || 'Not recorded'}</dd></div>
            <div><dt>Skin category</dt><dd>{product.skin || 'Not recorded'}</dd></div>
            <div><dt>Finish</dt><dd>{product.finish || 'Not recorded'}</dd></div>
          </dl>
          <div className="product-comparison-note"><h5>Maya’s recorded note</h5><p>{product.note || 'No note recorded.'}</p></div>
          <details className="product-comparison-source"><summary>Source · {Number.isInteger(product.source?.page) && product.source.page > 0 ? `page ${product.source.page}` : 'page not recorded'}</summary><p>{product.source?.label || 'Source label not recorded.'}</p><blockquote>{product.source?.excerpt || 'Source excerpt not recorded.'}</blockquote></details>
          <fieldset className="product-comparison-role"><legend>Purchase role for {product.name}</legend>
            <label><input type="checkbox" checked={role === 'owned'} onChange={event => setRole(productId, event.target.checked ? 'owned' : 'buy')}/>Already owned: {product.name}</label>
            <button type="button" aria-label={`Buy one or repurchase ${product.name}`} aria-pressed={role === 'buy'} onClick={() => setRole(productId, 'buy')}>Buy one / repurchase</button>
            <p>{role === 'unknown' ? 'Role not confirmed. Choose owned or buy.' : role === 'owned' ? 'Use what is already owned. No new spend.' : 'One new purchase, including a repurchase.'}</p>
            {role === 'buy' && <label htmlFor={`${id}-quantity-${index}`}>Units of {product.name}<input id={`${id}-quantity-${index}`} type="number" min="1" step="1" value={Number.isNaN(choice?.quantity) ? '' : choice?.quantity ?? 1} onChange={event => setChoices(previous => ({ ...previous, [productId]: { role: 'buy', quantity: event.target.value === '' ? NaN : Number(event.target.value) } }))}/></label>}
          </fieldset>
        </article>;
      })}
    </div>
    <div className="product-comparison-results" aria-live="polite" aria-atomic="true">
      <h4>New spending</h4>
      {result.problems.length > 0 ? <><p>Confirm the details before calculating.</p><ul>{result.problems.map(problem => <li key={problem}>{problem}</li>)}</ul></> : <>
        <p>{mode === 'choose-one' ? 'Each row is a separate choice. These amounts are not added together.' : 'Only confirmed new purchases are included. Already-owned products add no new spending.'}</p>
        <ul className="product-comparison-options">{result.options.map(option => <li key={option.id}><strong>{option.label}</strong><span>{comparisonMoney(option.totalPence)} new spending</span>{option.remainingPence === null ? <small>Budget unknown · remaining budget not calculated.</small> : <small className={option.remainingPence < 0 ? 'product-comparison-over' : ''}>{option.remainingPence < 0 ? `${comparisonMoney(-option.remainingPence)} over the confirmed budget` : `${comparisonMoney(option.remainingPence)} remains within the confirmed budget`}</small>}</li>)}</ul>
      </>}
    </div>
    <p className="product-comparison-help">Keeping an existing product or buying nothing is still an option. Recorded categories do not establish personal suitability or compatibility. Review the evidence with the follower’s circumstances.</p>
  </section>;
}

export default ProductComparison;
