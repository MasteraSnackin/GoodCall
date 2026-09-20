import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import FollowerHome from '../src/components/FollowerHome';
import type { PublishedAdvice } from '../src/lib/types';
import type { DecisionContext } from '../src/lib/followerDiscovery';

const published: PublishedAdvice = { version: 1, demo: true, id: 'published-one', title: 'A lighter daytime routine', text: 'Hydration notes for comparing Cloud Cream and Daily Gel, with limits to review.', products: [{ name: 'Cloud Cream', price: 38, note: 'A rich finish.' }, { name: 'Daily Gel', price: 24, note: 'A lighter finish.' }], sourceRefs: [{ page: 2, label: 'Notebook', excerpt: 'Published hydration notes.' }], publishedAt: '2026-09-20T10:00:00.000Z' };
const fillGoal = (value = 'hydration') => fireEvent.change(screen.getByLabelText(/What would you like to achieve/), { target: { value } });

describe('Follower discovery', () => {
  it('shows an honest empty collection and cannot invent a finder result', () => {
    const onOpen = vi.fn(), onWorkspace = vi.fn(); render(<FollowerHome advice={[]} onOpen={onOpen} onWorkspace={onWorkspace} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Maya’s advice.' })).toBeTruthy();
    expect(screen.getByText('The first answer is still to come.')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Find published answers' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Open creator workspace' })); expect(onWorkspace).toHaveBeenCalledOnce(); expect(onOpen).not.toHaveBeenCalled();
  });
  it('searches supplied published snapshots and opens the exact original', () => {
    const onOpen = vi.fn(); render(<FollowerHome advice={[published]} onOpen={onOpen} onWorkspace={() => {}} />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search published advice' }), { target: { value: 'zebra' } });
    expect(screen.getByText('No published answer matches that search.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Clear search', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: `Read ${published.title}` })); expect(onOpen).toHaveBeenCalledExactlyOnceWith(published);
  });
  it('explains zero-budget prices and owned overlap without claiming personal suitability', () => {
    const onOpen = vi.fn(); const before = JSON.stringify(published); render(<FollowerHome advice={[published]} onOpen={onOpen} onWorkspace={() => {}} />);
    fillGoal(); fireEvent.change(screen.getByLabelText(/Your spending limit/), { target: { value: '0' } }); fireEvent.change(screen.getByLabelText(/What do you already own/), { target: { value: 'Cloud Cream' } });
    fireEvent.click(screen.getByRole('button', { name: 'Find published answers' }));
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Answers that mention your goal' }));
    expect(screen.getByText('Above your £0 limit:')).toBeTruthy(); expect(screen.getByText('Individual published prices, not a basket total or a current price check.')).toBeTruthy();
    expect(screen.getByText(/Your already-owned list mentions Cloud Cream/)).toBeTruthy();
    expect(screen.getByText(/Mentions “hydration”/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `Read ${published.title}` }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(published, { goal: 'hydration', budget: '0', owned: 'Cloud Cream', note: '' }); expect(JSON.stringify(published)).toBe(before);
  });
  it('rejects malformed budgets and reports no match without making another answer', () => {
    render(<FollowerHome advice={[published]} onOpen={() => {}} onWorkspace={() => {}} />); fillGoal();
    fireEvent.change(screen.getByLabelText(/Your spending limit/), { target: { value: '-20' } }); fireEvent.click(screen.getByRole('button', { name: 'Find published answers' }));
    expect(screen.getByRole('alert').textContent).toContain('Enter a non-negative amount');
    fireEvent.change(screen.getByLabelText(/Your spending limit/), { target: { value: '' } }); fillGoal('unmentioned zebra'); fireEvent.click(screen.getByRole('button', { name: 'Find published answers' }));
    expect(screen.getByRole('heading', { name: 'No matching answer yet' })).toBeTruthy(); expect(screen.queryByRole('button', { name: `Read ${published.title}` })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'See all published answers' })); expect(screen.getByRole('button', { name: `Read ${published.title}` })).toBeTruthy();
  });
  it('opens saved copies with their private context and exposes storage failures', () => {
    const context: DecisionContext = { goal: 'Less duplication', budget: '0', owned: 'Cloud Cream', note: 'Wait until the current pot is finished.' };
    const onOpen = vi.fn(), onRemoveSaved = vi.fn(); render(<FollowerHome advice={[]} savedAdvice={[published]} savedContexts={{ [published.id]: context }} storageNotice="This browser could not save your changes." onOpen={onOpen} onWorkspace={() => {}} onRemoveSaved={onRemoveSaved} />);
    const saved = screen.getByRole('region', { name: 'Saved for later.' }); expect(within(saved).getByText(context.note)).toBeTruthy(); expect(within(saved).getByText('0')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('could not save');
    fireEvent.click(screen.getByRole('button', { name: `Return to ${published.title}` })); expect(onOpen).toHaveBeenCalledExactlyOnceWith(published, context);
    fireEvent.click(screen.getByRole('button', { name: `Remove saved ${published.title}` })); expect(onRemoveSaved).toHaveBeenCalledExactlyOnceWith(published);
  });
  it('keeps saved and wordmark navigation on the follower route and focuses the finder when requested', () => {
    window.location.hash = '#/discover/find'; render(<FollowerHome advice={[published]} savedAdvice={[published]} focusFinder onOpen={() => {}} onWorkspace={() => {}} />);
    expect(document.activeElement).toBe(screen.getByLabelText(/What would you like to achieve/));
    fireEvent.click(screen.getByRole('button', { name: 'View saved answers (1)' })); expect(window.location.hash).toBe('#/discover/find'); expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Saved for later.' }));
    fireEvent.click(screen.getByRole('button', { name: 'GoodCall', exact: true })); expect(window.location.hash).toBe('#/discover/find');
  });
});
