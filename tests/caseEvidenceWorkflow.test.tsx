import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import App from '../src/App';
import type { Workspace } from '../src/lib/types';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';
import { WORKSPACE_KEY } from '../src/lib/storage';

const graph = vi.hoisted(() => ({ connect: (_source: string, _target: string) => {} }));
// Integration adapter covers selection and connection callbacks, not pointer geometry.
vi.mock('../src/components/AnswerCanvas', () => ({ default: ({ workspace, onSelect, onConnect }: { workspace: Workspace; onSelect: (id: string) => void; onConnect: (source: string, target: string) => void }) => {
  graph.connect = onConnect;
  return <div>{workspace.cards.map(card => <button key={card.id} onClick={() => onSelect(card.id)}>Select {card.entityId}</button>)}</div>;
} }));
const read = (): Workspace => JSON.parse(localStorage.getItem(WORKSPACE_KEY)!);
const openLibrary = () => fireEvent.click(screen.getByRole('button', { name: 'Case evidence', exact: true }));

describe('Case-file evidence in the existing workspace', () => {
  it('adds a searched table with limitations and source pages, then reopens it without duplicates', () => {
    const original = createWorkspace();
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(original));
    const first = render(<App/>);
    openLibrary();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the case file evidence' }), { target: { value: 'Tara £122' } });
    expect(screen.getByText(/1 of 18 evidence cards/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add to canvas: The ten-person behavioural sample' }));
    expect(screen.queryByRole('dialog', { name: 'Case-file evidence' })).toBeNull();
    const panel = screen.getByRole('complementary', { name: 'Card details' });
    const table = within(panel).getByRole('table', { name: 'The ten-person behavioural sample' });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    expect(within(table).getByText('£122')).toBeTruthy();
    expect(within(panel).getByLabelText('Evidence limitation').textContent).toContain('not a zero-value order');
    expect(within(panel).getByRole('link', { name: /E-10.1–E-10.10/ }).getAttribute('href')).toBe('/operation-shade-case-file.pdf#page=15');
    expect(read().cards.slice(0, original.cards.length)).toEqual(original.cards);
    openLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Open on canvas: The ten-person behavioural sample' }));
    expect(read().cards.filter(card => card.entityId === 'case-hidden-audience-sample')).toHaveLength(1);
    first.unmount();
    render(<App/>);
    fireEvent.click(screen.getByRole('button', { name: 'Select case-hidden-audience-sample' }));
    expect(screen.getByRole('table', { name: 'The ten-person behavioural sample' })).toBeTruthy();
  });

  it('adds the three overview cards once and preserves the existing board positions', () => {
    render(<App/>);
    const before = read();
    openLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Add overview to canvas' }));
    const after = read();
    expect(after.cards.slice(0, before.cards.length)).toEqual(before.cards);
    expect(after.cards.filter(card => card.kind === 'evidence').map(card => card.entityId)).toEqual(['case-creator-constraints', 'case-content-log', 'case-quiet-audience-findings']);
    openLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Add overview to canvas' }));
    expect(read()).toEqual(after);
  });

  it('filters audience sources and recovers from a search with no results', () => {
    render(<App/>);
    openLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Audience', exact: true }));
    expect(screen.getByText('7 of 18 evidence cards · Audience')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search the case file evidence' }), { target: { value: 'no-such-evidence' } });
    expect(screen.getByText('No evidence matches those filters')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show all evidence' }));
    expect(screen.getByText('18 of 18 evidence cards')).toBeTruthy();
    expect((screen.getByRole('searchbox', { name: 'Search the case file evidence' }) as HTMLInputElement).value).toBe('');
  });

  it('keeps context links separate from approved answer sources and opens the related check', () => {
    const original = createWorkspace();
    const draft = { ...draftAnswer(original.questions.find(q => q.id === 'q-04')!, original.products), status: 'approved' as const, approvedAt: new Date().toISOString() };
    original.drafts.push(draft);
    original.cards.push({ id: 'approved-answer-card', kind: 'draft', entityId: draft.id, x: 800, y: 35 });
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(original));
    render(<App/>);
    openLibrary();
    fireEvent.click(screen.getByRole('button', { name: 'Add to canvas: Six posts: reach, saves and one conversion figure' }));
    const card = read().cards.find(item => item.entityId === 'case-content-log')!;
    act(() => graph.connect(card.id, 'approved-answer-card'));
    expect(read().drafts[0]).toEqual(draft);
    expect(read().links.some(link => link.source === card.id && link.target === 'approved-answer-card')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Comparable conversion figures are missing' }));
    expect(screen.getByRole('heading', { name: 'Comparable conversion figures are missing' })).toBeTruthy();
    expect(read().cards.some(item => item.kind === 'issue' && item.entityId === 'issue-conversions')).toBe(true);
  });
});
