import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App';
import type { Workspace } from '../src/lib/types';

vi.mock('../src/components/AnswerCanvas', () => ({ default: ({ onDraft }: { onDraft: (id: string) => void }) =>
  <button onClick={() => onDraft('q-04')}>Prepare audit answer</button> }));
const stored = () => JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!) as Workspace;

describe('publication failure recovery', () => {
  it('returns keyboard focus to the control that opened a dialog', () => {
    render(<App />);
    const trigger = screen.getByRole('button', { name: 'Case evidence', exact: true });
    trigger.focus();
    fireEvent.click(trigger);
    const close = within(screen.getByRole('dialog', { name: 'Case-file evidence' })).getByRole('button', { name: 'Close dialog' });
    close.focus();
    fireEvent.click(close);
    expect(document.activeElement).toBe(trigger);
  });

  it('blocks an oversized Unicode snapshot, explains the limit and allows a shortened retry', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Prepare audit answer' }));
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: '雲'.repeat(5500) } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish advice card' }));
    const blocked = screen.getByRole('dialog', { name: 'Review before publishing' });
    expect(blocked.textContent).toContain('too long to share');
    expect(within(blocked).queryByRole('button', { name: 'Publish this version' })).toBeNull();
    expect(stored().drafts[0].status).toBe('approved');
    fireEvent.click(within(blocked).getByRole('button', { name: 'Back to editing' }));
    fireEvent.change(screen.getByLabelText('Your answer'), { target: { value: 'Cloud Cream is £38. Keep your current moisturiser if it works for you.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Approve answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish advice card' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish this version' }));
    expect(stored().drafts[0].status).toBe('published');
    expect(screen.getByRole('button', { name: 'Share approved answer' })).toBeTruthy();
  });

  it('keeps the approved answer and preview after a quota failure and permits an explicit retry', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Prepare audit answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Approve answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Publish advice card' }));
    const original = Storage.prototype.setItem;
    const failure = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === 'maya-answer-canvas-v1') throw new Error('Quota');
      original.call(this, key, value);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Publish this version' }));
    expect(screen.getByRole('dialog', { name: 'Preview your follower card' })).toBeTruthy();
    expect(screen.getByText(/Publication was not saved/)).toBeTruthy();
    expect(stored().drafts[0].status).toBe('approved');
    expect(screen.queryByRole('button', { name: 'Share approved answer' })).toBeNull();
    failure.mockRestore();
    fireEvent.click(screen.getByRole('button', { name: 'Publish this version' }));
    expect(stored().drafts[0].status).toBe('published');
    expect(screen.queryByRole('dialog', { name: 'Preview your follower card' })).toBeNull();
  });
});
