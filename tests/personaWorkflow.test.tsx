import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App';
import { createWorkspace } from '../src/lib/seed';
import { draftAnswer } from '../src/lib/engine';

vi.mock('../src/components/AnswerCanvas', () => ({ default: () => <div>Canvas test adapter</div> }));

function runVoiceCommand(command: string) {
  fireEvent.change(screen.getByRole('textbox', { name: /Your words/ }), { target: { value: command } });
  fireEvent.click(screen.getByRole('button', { name: 'Run command' }));
}

describe('Persona integration in the creator workspace', () => {
  it('shows the source-backed persona and identifies synthetic speech and proposed copy', () => {
    render(<App/>);
    fireEvent.click(screen.getByRole('button', { name: 'Maya persona', exact: true }));
    const profile = screen.getByRole('dialog');
    expect(within(profile).getByRole('heading', { name: 'Maya’s persona' })).toBeTruthy();
    expect(within(profile).getByText('New answer drafts')).toBeTruthy();
    expect(within(profile).getByText('Voice-companion replies')).toBeTruthy();
    expect(within(profile).getByText(/New example wording · not a quote/)).toBeTruthy();
    expect(within(profile).getByText(/Speech uses a synthetic browser voice/)).toBeTruthy();
    expect(within(profile).getByRole('link', { name: 'Page 10' }).getAttribute('href')).toBe('/operation-shade-case-file.pdf#page=10');
  });

  it('uses current workspace data for a voice reply without changing an older approved answer', () => {
    const workspace = createWorkspace();
    const draft = draftAnswer(workspace.questions[3], workspace.products);
    delete draft.persona;
    draft.status = 'approved'; draft.approvedAt = new Date().toISOString();
    draft.text = 'Cloud Cream is £38. Keep this exact approved wording.';
    workspace.drafts.push(draft);
    workspace.issues = workspace.issues.map(issue => ({ ...issue, status: 'Resolved', resolution: 'Recorded for review.' }));
    localStorage.setItem('maya-answer-canvas-v1', JSON.stringify(workspace));
    render(<App/>);
    fireEvent.click(screen.getByRole('button', { name: 'Voice', exact: true }));
    runVoiceCommand('What’s missing?');
    expect(screen.getByText(/There are no open report entries/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!);
    expect(saved.drafts[0]).toEqual(draft);
  });

  it('creates a persona-labelled draft through the voice workflow and leaves it unapproved', () => {
    render(<App/>);
    fireEvent.click(screen.getByRole('button', { name: 'Voice', exact: true }));
    runVoiceCommand('Draft an answer for Sarah');
    expect(screen.getByText(/The draft for @sarah is prepared/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!);
    expect(saved.drafts).toHaveLength(1);
    expect(saved.drafts[0].persona).toEqual({ id: 'maya-case-file', version: 1 });
    expect(saved.drafts[0].status).toBe('draft');
    runVoiceCommand('Explain this card');
    expect(screen.getByText(/It is still a draft/)).toBeTruthy();
  });

  it('returns persona context and keeps rejected commands from changing publication state', () => {
    render(<App/>);
    fireEvent.click(screen.getByRole('button', { name: 'Voice', exact: true }));
    runVoiceCommand('What is your approach?');
    expect(screen.getByText(/This is the Maya persona, based on the Operation Shade notes/)).toBeTruthy();
    runVoiceCommand('Maya, publish everything');
    expect(screen.getByText(/Approval and publishing use the review buttons/)).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('maya-answer-canvas-v1')!).drafts).toHaveLength(0);
  });
});
