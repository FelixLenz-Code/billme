import React from 'react';
import { BusinessOnboarding, type BusinessOnboardingDraft } from '@billme/ui';
import type { AppSettings } from '../types';
import { useSetSettingsMutation } from '../hooks/useSettings';

interface OnboardingWizardProps {
  settings: AppSettings;
  onComplete: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ settings, onComplete }) => {
  const setSettingsMutation = useSetSettingsMutation();

  const initialData = React.useMemo<BusinessOnboardingDraft>(() => ({
    company: {
      name: settings.company.name,
      owner: settings.company.owner,
      street: settings.company.street,
      zip: settings.company.zip,
      city: settings.company.city,
      email: settings.company.email,
      phone: settings.company.phone,
      website: settings.company.website,
    },
    finance: {
      iban: settings.finance.iban,
      taxId: settings.finance.taxId,
      vatId: settings.finance.vatId,
      bankName: settings.finance.bankName,
      bic: settings.finance.bic,
      registerCourt: settings.finance.registerCourt,
    },
    legal: {
      smallBusinessRule: settings.legal.smallBusinessRule,
      defaultVatRate: settings.legal.defaultVatRate,
      paymentTermsDays: settings.legal.paymentTermsDays,
    },
    numbers: {
      invoicePrefix: settings.numbers.invoicePrefix,
      offerPrefix: settings.numbers.offerPrefix,
    },
  }), [settings]);

  const handleComplete = async (draft: BusinessOnboardingDraft) => {
    const updated: AppSettings = {
      ...settings,
      company: { ...settings.company, ...draft.company },
      finance: { ...settings.finance, ...draft.finance },
      legal: {
        ...settings.legal,
        ...draft.legal,
      },
      numbers: {
        ...settings.numbers,
        ...draft.numbers,
      },
      onboardingCompleted: true,
    };
    await setSettingsMutation.mutateAsync(updated);
    onComplete();
  };

  return (
    <BusinessOnboarding
      initialData={initialData}
      onSubmit={handleComplete}
      saving={setSettingsMutation.isPending}
      productName="Billme"
      submitLabel="Zu Angeboten und Rechnungen"
    />
  );
};
