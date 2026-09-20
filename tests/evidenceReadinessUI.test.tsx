import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EvidenceReadinessBadge, EvidenceReadinessPanel } from '../src/components/EvidenceReadiness';
import { draftAnswer, validateDraft } from '../src/lib/engine';
import { createWorkspace } from '../src/lib/seed';

describe('Evidence readiness controls', () => {
  it('opens by keyboard and does not trigger the enclosing card action', async () => {
    const user = userEvent.setup(), workspace = createWorkspace(), draft = draftAnswer(workspace.questions[3], workspace.products);
    const onOpen = vi.fn(), onCardClick = vi.fn();
    render(<div onClick={onCardClick}><EvidenceReadinessBadge draft={draft} workspace={workspace} onOpen={onOpen} /></div>);
    const button = screen.getByRole('button', { name: `Ready for review for ${draft.title}` });
    await user.tab(); expect(document.activeElement).toBe(button);
    await user.keyboard('{Enter}');
    expect(onOpen).toHaveBeenCalledExactlyOnceWith();
    expect(onCardClick).not.toHaveBeenCalled();
    expect(draft.status).toBe('draft');
  });

  it('updates a published badge and panel when the workspace evidence changes', () => {
    const workspace = createWorkspace(), draft = { ...draftAnswer(workspace.questions[3], workspace.products), status: 'published' as const };
    const props = { draft, workspace, onOpen: vi.fn(), onClose: vi.fn() };
    const view = render(<><EvidenceReadinessBadge {...props} /><EvidenceReadinessPanel {...props} /></>);
    expect(screen.getByRole('button', { name: `Checks passed for ${draft.title}` })).toBeTruthy();
    workspace.products[0].revision = 2;
    workspace.products[0].source = { page: 0, label: 'Updated product source', excerpt: 'A newly supplied complete reference.' };
    view.rerender(<><EvidenceReadinessBadge {...props} /><EvidenceReadinessPanel {...props} /></>);
    expect(screen.getByRole('button', { name: `Evidence changed for ${draft.title}` })).toBeTruthy();
    expect(screen.getByText('Published', { exact: true })).toBeTruthy();
    expect(screen.getByText('Draft used revision 1 · Current revision 2')).toBeTruthy();
    expect(screen.getByText('A newly supplied complete reference.')).toBeTruthy();
    expect(screen.getByText('Workspace reference')).toBeTruthy();
    validateDraft(draft, workspace).forEach(blocker => expect(screen.getByText(blocker, { exact: true })).toBeTruthy());
    expect(draft.status).toBe('published');
  });

  it('shows complete evidence, a separate missing record and all blockers without approval actions', () => {
    const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[3], workspace.products);
    draft.productIds.push('absent-record');
    workspace.products[0].revision++;
    const onOpenSource = vi.fn(), onClose = vi.fn(), before = JSON.stringify({ draft, workspace });
    render(<EvidenceReadinessPanel draft={draft} workspace={workspace} onClose={onClose} onOpenSource={onOpenSource} />);
    expect(screen.getByRole('region', { name: 'Evidence review' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Missing product records' })).toBeTruthy();
    expect(screen.getByText('absent-record', { exact: true })).toBeTruthy();
    draft.sourceRefs.forEach(source => {
      expect(screen.getAllByText(source.label, { exact: true }).length).toBeGreaterThan(0);
      expect(screen.getAllByText(source.excerpt, { exact: true, normalizer: value => value }).length).toBeGreaterThan(0);
      if (source.page > 0) expect(screen.getAllByText(`Page ${source.page}`).length).toBeGreaterThan(0);
    });
    fireEvent.click(screen.getByRole('button', { name: `Open source: ${draft.sourceRefs[0].label}` }));
    expect(onOpenSource).toHaveBeenCalledExactlyOnceWith(draft.sourceRefs[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Close evidence review' }));
    expect(onClose).toHaveBeenCalledExactlyOnceWith();
    expect(screen.queryByRole('button', { name: /approve|publish|rewrite/i })).toBeNull();
    expect(JSON.stringify({ draft, workspace })).toBe(before);
  });

  it('refreshes the badge after question changes and after unsupported answer edits', () => {
    const workspace = createWorkspace(), draft = draftAnswer(workspace.questions[3], workspace.products), onOpen = vi.fn();
    const view = render(<EvidenceReadinessBadge draft={draft} workspace={workspace} onOpen={onOpen} />);
    workspace.questions[3].text = 'Cloud Cream costs £38, but my budget is £30.';
    view.rerender(<EvidenceReadinessBadge draft={draft} workspace={workspace} onOpen={onOpen} />);
    expect(screen.getByRole('button', { name: /^Checks needed/ })).toBeTruthy();
    workspace.questions[3].text = 'Is Cloud Cream worth £38?';
    view.rerender(<EvidenceReadinessBadge draft={draft} workspace={workspace} onOpen={onOpen} />);
    expect(screen.getByRole('button', { name: /^Ready for review/ })).toBeTruthy();
    draft.text = 'Cloud Cream cures eczema.';
    view.rerender(<EvidenceReadinessBadge draft={draft} workspace={workspace} onOpen={onOpen} />);
    expect(screen.getByRole('button', { name: /^Checks needed/ })).toBeTruthy();
  });
});
