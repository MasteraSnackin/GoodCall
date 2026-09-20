import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { DecisionEditor, DecisionSummary } from '../src/components/DecisionProfile';
import { DECISION_FIELD_LIMIT, type DecisionProfile } from '../src/lib/decisionTypes';

const guidance: DecisionProfile = {
  verdict: 'Consider',
  suits: 'Someone looking for a moisturiser with a £38 budget.',
  skipIf: 'Your existing moisturiser already does the job.',
  unknowns: 'The ingredient list and individual suitability need checking.',
};

describe('Reusable decision guidance', () => {
  it('labels every public field and tells Maya to review the guidance and omit private details', () => {
    render(<DecisionEditor value={guidance} onChange={() => {}}/>);
    expect(screen.getByRole('combobox', { name: 'Maya’s call' })).toBeTruthy();
    for (const name of ['Who this is for', 'When to skip it', 'What still needs checking']) {
      const field = screen.getByRole('textbox', { name }) as HTMLTextAreaElement;
      expect(field.required).toBe(true);
      expect(field.maxLength).toBe(DECISION_FIELD_LIMIT);
      expect(field.getAttribute('aria-describedby')).toBeTruthy();
    }
    expect(screen.getByText(/Suggested guidance needs your review alongside the answer/).textContent).toContain('leave out follower handles and personal details');
  });
  it('updates the selected guidance field while preserving the other decision details', () => {
    const onChange = vi.fn();
    render(<DecisionEditor value={guidance} onChange={onChange}/>);
    fireEvent.change(screen.getByRole('textbox', { name: 'When to skip it' }), { target: { value: 'Skip if this would stretch your budget.' } });
    expect(onChange).toHaveBeenCalledWith({ ...guidance, skipIf: 'Skip if this would stretch your budget.' });
    fireEvent.change(screen.getByRole('combobox', { name: 'Maya’s call' }), { target: { value: 'Need more context' } });
    expect(onChange).toHaveBeenLastCalledWith({ ...guidance, verdict: 'Need more context' });
  });
  it('bounds pasted guidance at the public field limit without changing adjacent fields', () => {
    const onChange = vi.fn();
    render(<DecisionEditor value={guidance} onChange={onChange}/>);
    fireEvent.change(screen.getByRole('textbox', { name: 'What still needs checking' }), { target: { value: 'x'.repeat(DECISION_FIELD_LIMIT + 50) } });
    expect(onChange).toHaveBeenCalledWith({ ...guidance, unknowns: 'x'.repeat(DECISION_FIELD_LIMIT) });
  });
  it('shows the verdict and all three decision dimensions without edit controls', () => {
    render(<DecisionSummary value={guidance}/>);
    expect(screen.getByText('Consider')).toBeTruthy();
    for (const content of [guidance.suits, guidance.skipIf, guidance.unknowns]) expect(screen.getByText(content)).toBeTruthy();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
  it('keeps compact card previews brief while preserving the uncertainty and skip headings', () => {
    const detail = 'A carefully qualified explanation. '.repeat(15);
    render(<DecisionSummary value={{ ...guidance, suits: detail, skipIf: detail, unknowns: detail }} compact/>);
    const terms = screen.getAllByRole('definition');
    expect(terms).toHaveLength(3);
    for (const item of terms) {
      expect(item.textContent!.length).toBeLessThanOrEqual(115);
      expect(item.textContent).toMatch(/…$/);
    }
    expect(screen.getByText('When to skip it')).toBeTruthy();
    expect(screen.getByText('What still needs checking')).toBeTruthy();
  });
});
