import { useId, useMemo, useRef, useState } from 'react';
import { ArrowUpRight, BookOpen, Check, FileText, Layers3, Plus, Search, X } from 'lucide-react';
import { CASE_EVIDENCE, CASE_EVIDENCE_CATEGORIES, caseEvidenceText, type CaseEvidence } from '../lib/caseEvidence';
import './CaseEvidenceLibrary.css';

type CaseEvidenceLibraryProps = {
  /** IDs of evidence records that already have a card on the canvas. */
  placedIds: string[];
  onOpen: (id: string) => void;
  onAddOverview: () => void;
};

const sourcePages = (evidence: CaseEvidence) => [...new Set(evidence.sourceRefs.map(source => source.page))].sort((a, b) => a - b);

export default function CaseEvidenceLibrary({ placedIds, onOpen, onAddOverview }: CaseEvidenceLibraryProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('All');
  const searchRef = useRef<HTMLInputElement>(null);
  const searchId = useId();
  const resultsId = useId();
  const placed = useMemo(() => new Set(placedIds), [placedIds]);
  const matchingEvidence = useMemo(() => {
    const terms = query.trim().toLocaleLowerCase('en-GB').split(/\s+/).filter(Boolean);
    return CASE_EVIDENCE.filter(evidence => {
      if (category !== 'All' && evidence.category !== category) return false;
      const haystack = [evidence.category, evidence.title, evidence.summary, caseEvidenceText(evidence), evidence.table?.columns.join(' '), evidence.table?.rows.flat().join(' ')].join(' ').toLocaleLowerCase('en-GB');
      return terms.every(term => haystack.includes(term));
    });
  }, [query, category]);

  function resetFilters() {
    setQuery('');
    setCategory('All');
    searchRef.current?.focus();
  }

  return <div className="case-evidence-library">
    <div className="case-evidence-library__intro">
      <div className="case-evidence-library__intro-copy">
        <span className="case-evidence-library__eyebrow"><BookOpen size={13} aria-hidden="true"/> Operation Shade · evidence library</span>
        <h3>A fuller picture of Maya and her audience.</h3>
        <p>Bring the case file’s context, reported figures and open questions onto your canvas. Each card keeps its source pages close by.</p>
      </div>
      <button type="button" className="case-evidence-library__overview" onClick={onAddOverview}><Layers3 size={17} aria-hidden="true"/><span>Add overview to canvas</span></button>
    </div>

    <div className="case-evidence-library__filters">
      <label htmlFor={searchId} className="case-evidence-library__search-label">Search the case file evidence</label>
      <div className="case-evidence-library__search">
        <Search size={17} aria-hidden="true"/>
        <input ref={searchRef} id={searchId} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search a topic, figure or source…" aria-controls={resultsId}/>
        {query && <button type="button" aria-label="Clear evidence search" onClick={() => { setQuery(''); searchRef.current?.focus(); }}><X size={16} aria-hidden="true"/></button>}
      </div>
      <div className="case-evidence-library__categories" role="group" aria-label="Filter evidence by category">
        {['All', ...CASE_EVIDENCE_CATEGORIES].map(item => <button type="button" key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}<span aria-hidden="true">{item === 'All' ? CASE_EVIDENCE.length : CASE_EVIDENCE.filter(evidence => evidence.category === item).length}</span></button>)}
      </div>
    </div>

    <div className="case-evidence-library__results-heading">
      <p role="status" aria-live="polite" aria-atomic="true">{matchingEvidence.length} of {CASE_EVIDENCE.length} evidence cards{category !== 'All' ? ` · ${category}` : ''}{query.trim() ? ` matching “${query.trim()}”` : ''}</p>
      {(query || category !== 'All') && <button type="button" onClick={resetFilters}>Reset filters</button>}
    </div>

    <div id={resultsId} className="case-evidence-library__grid">
      {matchingEvidence.map(evidence => {
        const isPlaced = placed.has(evidence.id);
        const pages = sourcePages(evidence);
        return <article key={evidence.id} className="case-evidence-library__card">
          <div className="case-evidence-library__card-top"><span>{evidence.category}</span>{isPlaced && <span className="case-evidence-library__placed"><Check size={12} aria-hidden="true"/>On canvas</span>}</div>
          <h4>{evidence.title}</h4>
          <p>{evidence.summary}</p>
          {evidence.caveat && <span className="case-evidence-library__caution">Includes a limitation to review</span>}
          <div className="case-evidence-library__card-footer">
            <span className="case-evidence-library__pages"><FileText size={13} aria-hidden="true"/>{pages.length === 1 ? 'Page' : 'Pages'} {pages.join(', ')}</span>
            <button type="button" aria-label={`${isPlaced ? 'Open on canvas' : 'Add to canvas'}: ${evidence.title}`} onClick={() => onOpen(evidence.id)}>{isPlaced ? <ArrowUpRight size={14} aria-hidden="true"/> : <Plus size={14} aria-hidden="true"/>}{isPlaced ? 'Open on canvas' : 'Add to canvas'}</button>
          </div>
        </article>;
      })}
    </div>

    {!matchingEvidence.length && <div className="case-evidence-library__empty">
      <Search size={24} aria-hidden="true"/>
      <h4>No evidence matches those filters</h4>
      <p>Try a broader phrase or show every category.</p>
      <button type="button" onClick={resetFilters}>Show all evidence</button>
    </div>}
    <p className="case-evidence-library__footnote">The case file contains fictional exercise data. These cards describe its contents; a reported claim is not independent verification.</p>
  </div>;
}

type CaseEvidenceDetailsProps = {
  evidence: CaseEvidence;
  onOpenIssue?: (id: string) => void;
  onOpenProduct?: (id: string) => void;
};

export function CaseEvidenceDetails({ evidence }: CaseEvidenceDetailsProps) {
  const tableHelpId = useId();
  return <div className="case-evidence-details">
    <span className="case-evidence-details__category"><BookOpen size={13} aria-hidden="true"/>{evidence.category}</span>
    <h3>{evidence.title}</h3>
    <p className="case-evidence-details__summary">{evidence.summary}</p>
    {evidence.caveat && <aside className="case-evidence-details__caveat" aria-label="Evidence limitation"><strong>Read with this limitation</strong><p>{evidence.caveat}</p></aside>}
    {!!evidence.details.length && <ul className="case-evidence-details__facts">{evidence.details.map((detail, index) => <li key={`${evidence.id}-detail-${index}`}>{detail}</li>)}</ul>}
    {evidence.table && <section className="case-evidence-details__table-section" aria-label={`${evidence.title} data`}>
      <p id={tableHelpId} className="case-evidence-details__table-help">Scroll across to see every column.</p>
      <div className="case-evidence-details__table-scroll" tabIndex={0} role="region" aria-label={`${evidence.title} table`} aria-describedby={tableHelpId}>
        <table><caption>{evidence.title}</caption><thead><tr>{evidence.table.columns.map((column, index) => <th scope="col" key={`${column}-${index}`}>{column}</th>)}</tr></thead><tbody>{evidence.table.rows.map((row, rowIndex) => <tr key={`${evidence.id}-row-${rowIndex}`}>{row.map((cell, cellIndex) => cellIndex === 0 ? <th scope="row" key={cellIndex}>{cell}</th> : <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody></table>
      </div>
    </section>}
    <section className="case-evidence-details__sources" aria-label="Case file sources">
      <h4><FileText size={15} aria-hidden="true"/>From the case file</h4>
      {evidence.sourceRefs.map((source, index) => <article key={`${source.page}-${source.label}-${index}`}>
        <a href={`/operation-shade-case-file.pdf#page=${source.page}`} target="_blank" rel="noreferrer"><span>{source.label}<small>Page {source.page} · opens PDF</small></span><ArrowUpRight size={14} aria-hidden="true"/></a>
        <blockquote>{source.excerpt}</blockquote>
      </article>)}
    </section>
  </div>;
}
