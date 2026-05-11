import { writable } from 'svelte/store';
import { createEmptyProject } from '../paintings/defaults';
import type { ProjectState } from '../paintings/types';

export function createProjectStore(initial?: ProjectState) {
  return writable<ProjectState>(initial ?? createEmptyProject());
}

export const project = createProjectStore();
