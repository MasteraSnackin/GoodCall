import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Bookmark, Check, ChevronRight, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import type { PublishedAdvice } from '../lib/types';
import { findAdviceMatches, formatAdvicePrice, parseDecisionBudget, searchPublishedAdvice } from '../lib/followerDiscovery';
import type { AdviceMatch, DecisionContext } from '../lib/followerDiscovery';
import './FollowerHome.css';

export interface FollowerHomeProps {
  advice: PublishedAdvice[];
  onOpen: (advice: PublishedAdvice, context?: DecisionContext) => void;
  onWorkspace: () => void;
  savedAdvice?: PublishedAdvice[];
  savedContexts?: Record<string, DecisionContext>;
  onRemoveSaved?: (advice: PublishedAdvice) => void;
  storageNotice?: string;
  focusFinder?: boolean;
}
const emptyContext: DecisionContext = { goal: '', budget: '', owned: '', note: '' };
const publishedDate = (value: string) => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const excerpt = (text: string) => text.length > 180 ? `${text.slice(0, 177).trimEnd()}…` : text;

function MatchDetails({ match }: { match: AdviceMatch }) {
  return <div className="follower-match-details">
    <p><Search size={13} /><span>Mentions {match.matchedTerms.map(term => `“${term}”`).join(', ')} in the published answer or its sources.</span></p>
    {match.budget.status === 'valid' && <div className="follower-price-context">
      {match.pricesAtOrBelow.length + match.pricesAbove.length === 0 ? <p>No product prices are included in this answer.</p> : <>
        {match.pricesAtOrBelow.length > 0 && <p><span>At or below your {formatAdvicePrice(match.budget.amount)} limit:</span> {match.pricesAtOrBelow.map(product => `${product.name} ${formatAdvicePrice(product.price)}`).join(' · ')}</p>}
        {match.pricesAbove.length > 0 && <p><span>Above your {formatAdvicePrice(match.budget.amount)} limit:</span> {match.pricesAbove.map(product => `${product.name} ${formatAdvicePrice(product.price)}`).join(' · ')}</p>}
        <small>Individual published prices, not a basket total or a current price check.</small>
      </>}
    </div>}
    {match.ownedProducts.length > 0 && <p className="follower-owned-context"><Check size={14} /><span>Your already-owned list mentions {match.ownedProducts.join(' and ')}. Consider what you have before another purchase; check the full answer’s limits.</span></p>}
  </div>;
}

function AdviceCard({ advice, onOpen, match }: { advice: PublishedAdvice; onOpen: () => void; match?: AdviceMatch }) {
  return <article className="follower-advice-card">
    <div className="follower-card-meta"><span><ShieldCheck size={13} />Reviewed in this demo</span><time dateTime={advice.publishedAt}>{publishedDate(advice.publishedAt)}</time></div>
    <h3><button type="button" onClick={onOpen}>{advice.title}<ArrowUpRight size={18} /></button></h3>
    <p className="follower-card-excerpt">{excerpt(advice.text)}</p>
    {advice.decision && <p className="follower-card-verdict">Original conclusion <span>{advice.decision.verdict}</span></p>}
    {advice.products.length > 0 && <p className="follower-card-products">{advice.products.slice(0, 3).map(product => product.name).join(' · ')}{advice.products.length > 3 ? ` + ${advice.products.length - 3} more` : ''}</p>}
    {match && <MatchDetails match={match} />}
    <button type="button" className="follower-read-answer" onClick={onOpen} aria-label={`Read ${advice.title}`}>Read the full answer <ArrowRight size={15} /></button>
  </article>;
}

export default function FollowerHome({ advice, onOpen, onWorkspace, savedAdvice = [], savedContexts = {}, onRemoveSaved, storageNotice, focusFinder = false }: FollowerHomeProps) {
  const goalRef = useRef<HTMLTextAreaElement>(null);
  const finderRef = useRef<HTMLElement>(null);
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null);
  const budgetRef = useRef<HTMLInputElement>(null);
  const savedHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!focusFinder) return;
    finderRef.current?.scrollIntoView?.({ block: 'start' });
    goalRef.current?.focus({ preventScroll: true });
  }, [focusFinder]);
  const [query, setQuery] = useState('');
  const [context, setContext] = useState<DecisionContext>(emptyContext);
  const [submitted, setSubmitted] = useState<DecisionContext | null>(null);
  const [error, setError] = useState<'goal' | 'budget' | null>(null);
  useEffect(() => {
    if (!submitted) return;
    resultsHeadingRef.current?.scrollIntoView?.({ block: 'start' });
    resultsHeadingRef.current?.focus({ preventScroll: true });
  }, [submitted]);
  const browse = useMemo(() => searchPublishedAdvice(advice, query), [advice, query]);
  const matches = useMemo(() => submitted ? findAdviceMatches(advice, submitted) : [], [advice, submitted]);
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!context.goal.trim()) { setError('goal'); setSubmitted(null); goalRef.current?.focus(); return; }
    if (parseDecisionBudget(context.budget).status === 'invalid') { setError('budget'); setSubmitted(null); budgetRef.current?.focus(); return; }
    setError(null);
    setSubmitted({ goal: context.goal.trim(), budget: context.budget.trim(), owned: context.owned.trim(), note: '' });
  }
  return <div className="follower-home">
    <nav className="follower-nav" aria-label="Advice navigation"><button type="button" className="follower-wordmark" onClick={() => window.scrollTo({ top: 0 })}>GoodCall</button><div>{savedAdvice.length > 0 && <button type="button" className="follower-saved-link" aria-label={`View saved answers (${savedAdvice.length})`} onClick={() => { savedHeadingRef.current?.scrollIntoView?.({ block: 'start' }); savedHeadingRef.current?.focus({ preventScroll: true }); }}><Bookmark size={15} /><span>Saved ({savedAdvice.length})</span></button>}<button type="button" onClick={onWorkspace}>Creator workspace <ArrowUpRight size={14} /></button></div></nav>
    <main>
      <header className="follower-hero">
        <div className="follower-hero-copy"><span className="follower-eyebrow">A NOTE BEFORE YOUR NEXT PURCHASE</span><h1>Maya’s advice<span>.</span></h1><p>Reviewed answers to help you decide what to keep, what to consider and what to ask next.</p><div className="follower-hero-byline"><span className="follower-avatar" aria-hidden="true">m.</span><span>From Maya’s published notes<small>Read the reasoning. Keep the useful bits.</small></span></div></div>
        <aside className="follower-studio-note"><span className="follower-eyebrow">A LITTLE PERSPECTIVE</span><p>A considered choice can be<br /><em>what you already have.</em></p><span className="follower-note-rule" /><small>Start with the answer.<br />Then decide what it means for you.</small></aside>
      </header>
      {storageNotice && <p className="follower-storage-notice" role="alert">{storageNotice}</p>}
      <div className="follower-discovery-layout">
        <section ref={finderRef} className="follower-finder" aria-labelledby="decision-finder-title">
          <div className="follower-section-kicker"><SlidersHorizontal size={15} /><span>YOUR NEXT STEP</span></div>
          <h2 id="decision-finder-title">Find a starting point.</h2><p className="follower-finder-intro">Add a little context to find published answers that mention your goal.</p>
          <form onSubmit={submit} noValidate>
            <label htmlFor="follower-goal">What would you like to achieve?<span>Goal or outcome</span></label>
            <textarea ref={goalRef} id="follower-goal" rows={2} value={context.goal} maxLength={400} placeholder="For example, a lighter moisturiser for daytime" aria-invalid={error === 'goal'} aria-describedby={error === 'goal' ? 'follower-goal-error' : undefined} onChange={event => setContext(value => ({ ...value, goal: event.target.value }))} />
            {error === 'goal' && <p className="follower-field-error" id="follower-goal-error" role="alert">Add a goal or topic to look for.</p>}
            <label htmlFor="follower-budget">Your spending limit<span>Optional · in pounds</span></label>
            <div className={`follower-budget-input${error === 'budget' ? ' has-error' : ''}`}><span aria-hidden="true">£</span><input ref={budgetRef} id="follower-budget" type="text" inputMode="decimal" value={context.budget} maxLength={30} placeholder="For example, 40" aria-invalid={error === 'budget'} aria-describedby={error === 'budget' ? 'follower-budget-error' : 'follower-budget-help'} onChange={event => setContext(value => ({ ...value, budget: event.target.value }))} /></div>
            <p className="follower-field-help" id="follower-budget-help">Compares individual mentioned prices. £0 is a valid limit.</p>
            {error === 'budget' && <p className="follower-field-error" id="follower-budget-error" role="alert">Enter a non-negative amount such as 0, 40 or 40.50, or leave this blank.</p>}
            <label htmlFor="follower-owned">What do you already own?<span>Optional · product names</span></label>
            <input id="follower-owned" type="text" value={context.owned} maxLength={600} placeholder="Product names, separated by commas" onChange={event => setContext(value => ({ ...value, owned: event.target.value }))} />
            <button type="submit" className="follower-primary" disabled={!advice.length}>Find published answers <ArrowRight size={16} /></button>
          </form>
          <p className="follower-finder-boundary">Matches use words in published answers and their sources. They do not create new advice or assess what will suit you.</p>
          {!advice.length && <p className="follower-finder-waiting">The finder will be available when Maya publishes a reviewed answer.</p>}
        </section>
        <section className="follower-library" aria-labelledby="follower-library-title">
          {submitted ? <>
            <div className="follower-library-heading"><div><span className="follower-eyebrow">A PLACE TO BEGIN</span><h2 ref={resultsHeadingRef} tabIndex={-1} id="follower-library-title">{matches.length ? 'Answers that mention your goal' : 'No matching answer yet'}</h2></div><button type="button" className="follower-text-button" onClick={() => setSubmitted(null)}>Browse all <ChevronRight size={14} /></button></div>
            <p className="follower-results-count" role="status">{matches.length} {matches.length === 1 ? 'answer mentions' : 'answers mention'} words from “{submitted.goal}”.</p>
            {matches.length ? <div className="follower-advice-grid">{matches.map(match => <AdviceCard key={match.advice.id} advice={match.advice} match={match} onOpen={() => onOpen(match.advice, submitted)} />)}</div> : <div className="follower-empty"><Search size={23} /><h3>This collection doesn’t cover that wording.</h3><p>Try a specific product name or a shorter topic. You can also browse every reviewed answer below.</p><button type="button" onClick={() => { setSubmitted(null); setQuery(''); }}>See all published answers <ArrowRight size={15} /></button></div>}
          </> : <>
            <div className="follower-library-heading"><div><span className="follower-eyebrow">THE PUBLISHED COLLECTION</span><h2 id="follower-library-title">A few good answers.</h2></div><span className="follower-count">{advice.length}</span></div>
            {advice.length > 0 && <div className="follower-search"><Search size={16} /><label className="follower-sr-only" htmlFor="follower-search">Search published advice</label><input id="follower-search" type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a topic or product…" />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear advice search"><X size={15} /></button>}</div>}
            {advice.length === 0 ? <div className="follower-empty follower-first-publish"><ShieldCheck size={24} /><h3>The first answer is still to come.</h3><p>Only published, reviewed answers appear here. Maya can review and publish an answer from the creator workspace.</p><button type="button" onClick={onWorkspace}>Open creator workspace <ArrowUpRight size={15} /></button></div> : <>
              <p className="follower-results-count" role="status">{browse.length} {browse.length === 1 ? 'answer' : 'answers'}{query ? ` matching “${query}”` : ' to explore'}</p>
              {browse.length ? <div className="follower-advice-grid">{browse.map(item => <AdviceCard key={item.id} advice={item} onOpen={() => onOpen(item)} />)}</div> : <div className="follower-empty"><Search size={23} /><h3>No published answer matches that search.</h3><p>Try a product name or fewer words, or return to the full collection.</p><button type="button" onClick={() => setQuery('')}>Clear search <ArrowRight size={15} /></button></div>}
            </>}
          </>}
        </section>
      </div>
      <section className="follower-saved" id="saved-answers" aria-labelledby="follower-saved-title"><div className="follower-library-heading"><div><span className="follower-eyebrow">SOMETHING TO COME BACK TO</span><h2 ref={savedHeadingRef} tabIndex={-1} id="follower-saved-title">Saved for later.</h2></div><Bookmark size={21} /></div>
        {savedAdvice.length ? <><p className="follower-saved-intro">Your saved copies and private decision notes stay in this browser. Published answers do not update these copies.</p><div className="follower-saved-grid">{savedAdvice.map(item => { const savedContext = savedContexts[item.id]; return <article key={item.id} className="follower-saved-card"><div><span className="follower-eyebrow">PUBLISHED {publishedDate(item.publishedAt)}</span>{onRemoveSaved && <button type="button" className="follower-remove-saved" onClick={() => onRemoveSaved(item)} aria-label={`Remove saved ${item.title}`}><X size={15} /></button>}</div><h3><button type="button" onClick={() => onOpen(item, savedContext)}>{item.title}<ArrowUpRight size={17} /></button></h3>{savedContext && [savedContext.goal, savedContext.budget, savedContext.owned, savedContext.note].some(Boolean) && <dl className="follower-saved-context">{savedContext.goal && <><dt>Your goal</dt><dd>{savedContext.goal}</dd></>}{savedContext.budget && <><dt>Budget (GBP)</dt><dd>{savedContext.budget}</dd></>}{savedContext.owned && <><dt>Already owned</dt><dd>{savedContext.owned}</dd></>}{savedContext.note && <><dt>Your note</dt><dd>{savedContext.note}</dd></>}</dl>}<button type="button" className="follower-read-answer" onClick={() => onOpen(item, savedContext)} aria-label={`Return to ${item.title}`}>Return to this answer <ArrowRight size={15} /></button></article>; })}</div></> : <p className="follower-saved-empty">Open an answer and choose “Save for later” to keep a copy here.</p>}
      </section>
    </main>
    <footer className="follower-footer"><span>GoodCall</span><p>Exercise prototype with fictional case-file material.<br />Published snapshots, with their reasoning and limits intact.</p></footer>
  </div>;
}
