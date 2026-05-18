import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import PackDrawer from './PackDrawer.svelte';
import { project } from '../stores/project';
import { packDrawerOpen } from '../stores/ui';
import { devMode } from '../stores/devMode';
import { createEmptyProject } from '../paintings/defaults';

describe('PackDrawer', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    devMode.set(false);
  });

  it('is hidden when packDrawerOpen is false', () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(false);
    const { queryByRole } = render(PackDrawer);
    expect(queryByRole('dialog')).toBeNull();
  });

  it('renders Identity and Advanced sections when open', () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByText } = render(PackDrawer);
    expect(getByText('Identity')).toBeTruthy();
    expect(getByText('Advanced')).toBeTruthy();
  });

  it('closes when Escape is pressed', async () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByRole } = render(PackDrawer);
    await fireEvent.keyDown(getByRole('dialog'), { key: 'Escape' });
    expect(get(packDrawerOpen)).toBe(false);
  });

  it('closes when the Close button is clicked', async () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByRole } = render(PackDrawer);
    await fireEvent.click(getByRole('button', { name: /Close pack settings/ }));
    expect(get(packDrawerOpen)).toBe(false);
  });

  it('clicking Import project calls onimport', async () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const onimport = vi.fn();
    const { getByRole } = render(PackDrawer, { props: { onimport } });
    await fireEvent.click(getByRole('button', { name: /Import project/ }));
    expect(onimport).toHaveBeenCalled();
  });

  it('clicking Export project calls onexport', async () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const onexport = vi.fn();
    const { getByRole } = render(PackDrawer, { props: { onexport } });
    await fireEvent.click(getByRole('button', { name: /Export project/ }));
    expect(onexport).toHaveBeenCalled();
  });

  it('hides the Debug mode description when debug mode is off', () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { queryByText } = render(PackDrawer);
    expect(queryByText(/intended for website development and debugging/i)).toBeNull();
  });

  it('shows the Debug mode description when debug mode is on', () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    devMode.set(true);
    const { getByText } = render(PackDrawer);
    expect(getByText(/intended for website development and debugging/i)).toBeTruthy();
  });

  it('does not show a .zip download button inside the drawer', () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    devMode.set(true);
    const { queryByRole } = render(PackDrawer);
    expect(queryByRole('button', { name: /Download as \.zip|Download \.zip/ })).toBeNull();
  });

  it('toggling the Debug mode checkbox in the footer flips the store', async () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByLabelText } = render(PackDrawer);
    const checkbox = getByLabelText(/Debug mode/) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    await fireEvent.click(checkbox);
    expect(get(devMode)).toBe(true);
    await fireEvent.click(checkbox);
    expect(get(devMode)).toBe(false);
  });

  it('renders the auto-bump checkbox checked by default', () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByLabelText } = render(PackDrawer);
    const checkbox = getByLabelText(/Auto-bump patch/) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
  });

  it('toggling the auto-bump checkbox writes to project.pack.autoBumpVersion', async () => {
    project.set(createEmptyProject());
    packDrawerOpen.set(true);
    const { getByLabelText } = render(PackDrawer);
    const checkbox = getByLabelText(/Auto-bump patch/) as HTMLInputElement;
    await fireEvent.click(checkbox);
    expect(get(project).pack.autoBumpVersion).toBe(false);
    await fireEvent.click(checkbox);
    expect(get(project).pack.autoBumpVersion).toBe(true);
  });
});
