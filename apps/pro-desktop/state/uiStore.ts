import type { Invoice } from '../types';
import { createUiStore, type BaseUiState } from '@billme/desktop-state/uiStore';

export type UiState = BaseUiState<Invoice>;
export const useUiStore = createUiStore<Invoice>();

