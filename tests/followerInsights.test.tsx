import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import FollowerInsights from '../src/components/FollowerInsights';
import { FOLLOWER_ACTIVITY_STORAGE_KEY, recordFollowerEvent } from '../src/lib/followerActivity';
import { FEEDBACK_STORAGE_KEY, saveFollowerFeedback } from '../src/lib/feedback';
import type { PublishedAdvice } from '../src/lib/types';

const advice = (): PublishedAdvice => ({ version: 1, demo: true, id: 'published-cloud', title: 'Reviewed Cloud Cream answer', text: 'Public answer wording', products: [], sourceRefs: [], publishedAt: '2026-09-20T10:00:00.000Z' });
beforeEach(() => sessionStorage.clear());
const props = () => ({ onOpenAdvice: vi.fn(), onReviewFeedback: vi.fn() });

describe('local follower insights', () => {
  it('starts without seeded analytics and explains exactly which activity is observable', () => {
    render(<FollowerInsights {...props()}/>);
    expect(screen.getByText(/No follower activity recorded/)).toBeTruthy();
    expect(screen.getByText(/Activity recorded in this browser only/)).toBeTruthy();
    expect(screen.getByText(/Private shares, purchases and social engagement are not measured/)).toBeTruthy();
    expect(screen.getByText(/Reopening the same answer version/)).toBeTruthy();
  });

  it('refreshes counts after activity events, separates visits from actions and opens the published answer', () => {
    const callbacks = props(); render(<FollowerInsights {...callbacks}/>);
    act(() => { recordFollowerEvent(advice(), 'opened'); recordFollowerEvent(advice(), 'opened'); recordFollowerEvent(advice(), 'shared-opened'); recordFollowerEvent(advice(), 'saved'); recordFollowerEvent(advice(), 'share-copied'); });
    const article = screen.getByRole('heading', { name: advice().title }).closest('article')!;
    const count = (name: string) => within(article).getByText(name).nextElementSibling?.textContent;
    expect(count('Opens')).toBe('1'); expect(count('Shared link opens')).toBe('1'); expect(count('Return visits')).toBe('0'); expect(count('Saves')).toBe('1'); expect(count('Links copied')).toBe('1');
    fireEvent.click(within(article).getByRole('button', { name: `Open published answer: ${advice().title}` }));
    expect(callbacks.onOpenAdvice).toHaveBeenCalledWith(advice().id);
  });

  it('shows unavailable activity honestly while independent feedback and its review action still work', () => {
    localStorage.setItem(FOLLOWER_ACTIVITY_STORAGE_KEY, '{broken');
    saveFollowerFeedback(advice(), 'still-unsure', 'PRIVATE_FOLLOWER_CLARIFICATION');
    const callbacks = props(); render(<FollowerInsights {...callbacks}/>);
    expect(screen.getByRole('alert').textContent).toContain('could not be read');
    expect(screen.queryByText('Opens')).toBeNull(); expect(screen.queryByText(/No follower activity recorded/)).toBeNull();
    expect(screen.getByText(/response marked/).textContent).toContain('1');
    expect(screen.queryByText('PRIVATE_FOLLOWER_CLARIFICATION')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Review follower feedback' })); expect(callbacks.onReviewFeedback).toHaveBeenCalledOnce();
  });

  it('keeps genuine activity visible when unrelated feedback cannot be read', () => {
    recordFollowerEvent(advice(), 'opened'); localStorage.setItem(FEEDBACK_STORAGE_KEY, '{broken');
    render(<FollowerInsights {...props()}/>);
    expect(screen.getByRole('heading', { name: advice().title })).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('Still-unsure feedback count is unavailable');
    expect(screen.queryByText(/responses marked/)).toBeNull();
  });

  it('refreshes cross-tab activity and recovers from storage failure without showing stale zeroes', () => {
    const originalGet = Storage.prototype.getItem;
    const denied = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (key) { if (key === FOLLOWER_ACTIVITY_STORAGE_KEY) throw new Error('denied'); return originalGet.call(this, key); });
    render(<FollowerInsights {...props()}/>); expect(screen.queryByText('Opens')).toBeNull();
    denied.mockRestore();
    act(() => { recordFollowerEvent(advice(), 'shared-opened'); window.dispatchEvent(new StorageEvent('storage', { key: FOLLOWER_ACTIVITY_STORAGE_KEY })); });
    expect(screen.queryByRole('alert')).toBeNull(); expect(screen.getByRole('heading', { name: advice().title })).toBeTruthy();
  });
});
