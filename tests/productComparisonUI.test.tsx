import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { ProductComparison } from '../src/components/ProductComparison';
import { createWorkspace } from '../src/lib/seed';

const productIds = ['cloud-cream', 'daily-gel'];
function chooseBoth() {
  fireEvent.click(screen.getByRole('button', { name: 'Buy one or repurchase Cloud Cream' }));
  fireEvent.click(screen.getByRole('button', { name: 'Buy one or repurchase Daily Gel' }));
}

describe('Product comparison panel', () => {
  it('shows evidence and source attribution without assuming spending or changing the workspace', () => {
    const workspace = createWorkspace(), before = JSON.stringify(workspace), close = vi.fn();
    render(<ProductComparison workspace={workspace} productIds={productIds} onClose={close}/>);
    expect(screen.getByRole('region', { name: 'Product comparison' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    const cloud = screen.getByRole('article', { name: 'Cloud Cream' });
    expect(within(cloud).getByText('£38.00')).toBeTruthy();
    expect(within(cloud).getByText('Dry')).toBeTruthy();
    expect(within(cloud).getByText('Rich')).toBeTruthy();
    expect(within(cloud).getByText('My winter skin saviour.')).toBeTruthy();
    fireEvent.click(within(cloud).getByText('Source · page 8'));
    expect(within(cloud).getByText('E-04.1 · Product inventory')).toBeTruthy();
    expect(within(cloud).getByText('Cloud Cream 38 Moisturiser')).toBeTruthy();
    expect(screen.getByText('Confirm the details before calculating.')).toBeTruthy();
    expect(screen.queryByText(/£62.00 new spending/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Close product comparison' }));
    expect(close).toHaveBeenCalledOnce();
    expect(JSON.stringify(workspace)).toBe(before);
  });

  it('separates alternative prices and computes a confirmed basket only after choosing roles', () => {
    const workspace = createWorkspace(), before = JSON.stringify(workspace);
    render(<ProductComparison workspace={workspace} productIds={productIds} onClose={() => {}}/>);
    fireEvent.change(screen.getByLabelText('Purchase plan'), { target: { value: 'choose-one' } });
    chooseBoth();
    expect(screen.getByText('£38.00 new spending')).toBeTruthy();
    expect(screen.getByText('£24.00 new spending')).toBeTruthy();
    expect(screen.getAllByText('Budget unknown · remaining budget not calculated.')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Purchase plan'), { target: { value: 'together' } });
    fireEvent.change(screen.getByLabelText('Confirmed budget (£, optional)'), { target: { value: '60' } });
    expect(screen.getByText('£62.00 new spending')).toBeTruthy();
    expect(screen.getByText('£2.00 over the confirmed budget')).toBeTruthy();
    expect(JSON.stringify(workspace)).toBe(before);
  });

  it('counts owned products as no new spend and unchecking owned explicitly repurchases', () => {
    render(<ProductComparison workspace={createWorkspace()} productIds={productIds} onClose={() => {}}/>);
    fireEvent.change(screen.getByLabelText('Purchase plan'), { target: { value: 'together' } });
    fireEvent.click(screen.getByLabelText('Already owned: Cloud Cream'));
    fireEvent.click(screen.getByRole('button', { name: 'Buy one or repurchase Daily Gel' }));
    fireEvent.change(screen.getByLabelText('Confirmed budget (£, optional)'), { target: { value: '30' } });
    expect(screen.getByText('£24.00 new spending')).toBeTruthy();
    expect(screen.getByText('£6.00 remains within the confirmed budget')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Already owned: Cloud Cream'));
    expect(screen.getByText('£62.00 new spending')).toBeTruthy();
    expect(screen.getByText('£32.00 over the confirmed budget')).toBeTruthy();
  });

  it('updates changed recorded facts, preserves explicit choices and blocks a missing product', () => {
    const workspace = createWorkspace();
    const view = render(<ProductComparison workspace={workspace} productIds={productIds} onClose={() => {}}/>);
    fireEvent.change(screen.getByLabelText('Purchase plan'), { target: { value: 'together' } });
    chooseBoth();
    const changed = { ...workspace, products: workspace.products.map(product => product.id === 'cloud-cream' ? { ...product, price: 40, note: 'Revised note.', source: { ...product.source, page: 9, excerpt: 'Revised source.' } } : product) };
    view.rerender(<ProductComparison workspace={changed} productIds={productIds} onClose={() => {}}/>);
    expect(screen.getByText('£64.00 new spending')).toBeTruthy();
    expect(screen.getByText('Revised note.')).toBeTruthy();
    expect(screen.getByText('Source · page 9')).toBeTruthy();
    expect(screen.getByText('Revised source.')).toBeTruthy();
    view.rerender(<ProductComparison workspace={{ ...changed, products: changed.products.filter(product => product.id !== 'cloud-cream') }} productIds={productIds} onClose={() => {}}/>);
    expect(screen.getByText('Product record missing')).toBeTruthy();
    expect(screen.queryByText(/new spending$/)).toBeNull();
  });

  it('shows actionable errors for invalid budgets, unsupported units and invalid recorded prices', () => {
    const workspace = createWorkspace();
    const view = render(<ProductComparison workspace={workspace} productIds={productIds} onClose={() => {}}/>);
    fireEvent.change(screen.getByLabelText('Purchase plan'), { target: { value: 'together' } });
    chooseBoth();
    fireEvent.change(screen.getByLabelText('Units of Cloud Cream'), { target: { value: '2' } });
    expect(screen.getByText(/Cloud Cream: this comparison supports one unit/)).toBeTruthy();
    expect(screen.queryByText('£100.00 new spending')).toBeNull();
    fireEvent.change(screen.getByLabelText('Units of Cloud Cream'), { target: { value: '1' } });
    fireEvent.change(screen.getByLabelText('Confirmed budget (£, optional)'), { target: { value: '30.999' } });
    expect(screen.getByText('Enter a confirmed budget in pounds, using no more than two decimal places.')).toBeTruthy();
    expect(screen.getByLabelText('Confirmed budget (£, optional)').getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(screen.getByLabelText('Confirmed budget (£, optional)'), { target: { value: '' } });
    view.rerender(<ProductComparison workspace={{ ...workspace, products: workspace.products.map(product => product.id === 'cloud-cream' ? { ...product, price: NaN } : product) }} productIds={productIds} onClose={() => {}}/>);
    expect(screen.getByText('Not recorded or invalid')).toBeTruthy();
    expect(screen.getByText('Cloud Cream: a valid recorded price is missing.')).toBeTruthy();
    expect(screen.queryByText('£24.00 new spending')).toBeNull();
  });
});
