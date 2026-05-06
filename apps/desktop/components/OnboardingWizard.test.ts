import { describe, expect, it } from 'vitest';
import { shouldShowBusinessOnboarding } from '@billme/ui';
import { MOCK_SETTINGS } from '../data/mockData';

describe('shouldShowBusinessOnboarding', () => {
  it('shows onboarding for a fresh workspace', () => {
    expect(
      shouldShowBusinessOnboarding({
        ...MOCK_SETTINGS,
        onboardingCompleted: false,
        company: {
          ...MOCK_SETTINGS.company,
          name: '',
        },
      }),
    ).toBe(true);
  });

  it('hides onboarding after completion', () => {
    expect(
      shouldShowBusinessOnboarding({
        ...MOCK_SETTINGS,
        onboardingCompleted: true,
      }),
    ).toBe(false);
  });

  it('hides onboarding for legacy workspaces with an existing company name', () => {
    expect(
      shouldShowBusinessOnboarding({
        ...MOCK_SETTINGS,
        onboardingCompleted: false,
        company: {
          ...MOCK_SETTINGS.company,
          name: 'Bestehende GmbH',
        },
      }),
    ).toBe(false);
  });
});
