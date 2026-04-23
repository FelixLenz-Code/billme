import { describe, expect, it } from 'vitest';
import { createMockInvoke } from './mockEngine';

describe('mockEngine customer numbering', () => {
  it('skips duplicate customer numbers when auto-assigning a blank Kundennummer', async () => {
    const invoke = createMockInvoke();
    const settings = await invoke('settings:get', undefined);
    expect(settings).not.toBeNull();
    if (!settings) {
      throw new Error('Expected mock settings');
    }

    await invoke('settings:set', {
      settings: {
        ...settings,
        numbers: {
          ...settings.numbers,
          nextCustomerNumber: 1,
        },
      },
    });

    const saved = await invoke('clients:upsert', {
      client: {
        id: 'client-stale-counter',
        customerNumber: undefined,
        company: 'Neue Kundin GmbH',
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        status: 'active',
        tags: [],
        notes: '',
        projects: [],
        activities: [],
        addresses: [],
        emails: [],
      },
    });

    expect(saved.customerNumber).toBe('KD-0004');
  });
});
