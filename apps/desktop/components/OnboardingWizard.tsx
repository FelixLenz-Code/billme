import React, { useState } from 'react';
import { ArrowRight, Building2, CreditCard, CheckCircle, X } from 'lucide-react';
import type { AppSettings } from '../types';
import { useSetSettingsMutation } from '../hooks/useSettings';

interface OnboardingWizardProps {
  settings: AppSettings;
  onComplete: () => void;
}

type Step = 'welcome' | 'company' | 'bank' | 'done';

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({ settings, onComplete }) => {
  const [step, setStep] = useState<Step>('welcome');
  const [company, setCompany] = useState({
    name: settings.company.name,
    owner: settings.company.owner,
    street: settings.company.street,
    zip: settings.company.zip,
    city: settings.company.city,
    email: settings.company.email,
    phone: settings.company.phone,
    website: settings.company.website,
  });
  const [finance, setFinance] = useState({
    iban: settings.finance.iban,
    taxId: settings.finance.taxId,
    vatId: settings.finance.vatId,
    bankName: settings.finance.bankName,
    bic: settings.finance.bic,
    registerCourt: settings.finance.registerCourt,
  });
  const [smallBusiness, setSmallBusiness] = useState(settings.legal.smallBusinessRule);
  const [vatRate, setVatRate] = useState(settings.legal.defaultVatRate);
  const setSettingsMutation = useSetSettingsMutation();

  const handleSkip = () => {
    const updated: AppSettings = {
      ...settings,
      onboardingCompleted: true,
    };
    setSettingsMutation.mutate(updated, { onSettled: onComplete });
  };

  const handleComplete = () => {
    const updated: AppSettings = {
      ...settings,
      company: { ...settings.company, ...company },
      finance: { ...settings.finance, ...finance },
      legal: { ...settings.legal, smallBusinessRule: smallBusiness, defaultVatRate: vatRate },
      onboardingCompleted: true,
    };
    setSettingsMutation.mutate(updated, { onSettled: onComplete });
  };

  const steps: Step[] = ['welcome', 'company', 'bank', 'done'];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-black transition-all duration-500"
            style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
          />
        </div>

        <div className="p-8">
          {/* Skip button */}
          {step !== 'done' && (
            <div className="flex justify-end mb-6">
              <button
                onClick={handleSkip}
                className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={12} /> Später einrichten
              </button>
            </div>
          )}

          {step === 'welcome' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Building2 size={28} className="text-white" />
              </div>
              <h1 className="text-3xl font-black text-gray-900 mb-3">Willkommen bei Billme</h1>
              <p className="text-gray-500 mb-8 leading-relaxed">
                In wenigen Schritten richten wir dein Konto ein, damit du direkt mit dem Erstellen
                von Rechnungen loslegen kannst.
              </p>
              <button
                onClick={() => setStep('company')}
                className="w-full bg-black text-white font-bold py-3.5 rounded-2xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                Loslegen <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 'company' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gray-900 mb-1">Unternehmensdaten</h2>
                <p className="text-sm text-gray-500">Diese Daten erscheinen auf deinen Rechnungen.</p>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Firmenname *</label>
                    <input
                      type="text"
                      value={company.name}
                      onChange={(e) => setCompany({ ...company, name: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                      placeholder="Muster GmbH"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Inhaber / Geschäftsführer</label>
                    <input
                      type="text"
                      value={company.owner}
                      onChange={(e) => setCompany({ ...company, owner: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                      placeholder="Max Muster"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">Straße & Hausnummer</label>
                  <input
                    type="text"
                    value={company.street}
                    onChange={(e) => setCompany({ ...company, street: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                    placeholder="Musterstraße 1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">PLZ</label>
                    <input
                      type="text"
                      value={company.zip}
                      onChange={(e) => setCompany({ ...company, zip: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                      placeholder="12345"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Stadt</label>
                    <input
                      type="text"
                      value={company.city}
                      onChange={(e) => setCompany({ ...company, city: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                      placeholder="Berlin"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 mb-1">E-Mail</label>
                  <input
                    type="email"
                    value={company.email}
                    onChange={(e) => setCompany({ ...company, email: e.target.value })}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                    placeholder="kontakt@muster-gmbh.de"
                  />
                </div>
              </div>
              <button
                onClick={() => setStep('bank')}
                disabled={!company.name.trim()}
                className="mt-6 w-full bg-black text-white font-bold py-3.5 rounded-2xl hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                Weiter <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 'bank' && (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gray-900 mb-1">Bank & Steuer</h2>
                <p className="text-sm text-gray-500">Für die Rechnungsstellung und den QR-Code.</p>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">IBAN</label>
                    <input
                      type="text"
                      value={finance.iban}
                      onChange={(e) => setFinance({ ...finance, iban: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                      placeholder="DE00 0000 0000 0000 0000 00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Bank</label>
                    <input
                      type="text"
                      value={finance.bankName}
                      onChange={(e) => setFinance({ ...finance, bankName: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                      placeholder="Musterbank"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">Steuernummer</label>
                    <input
                      type="text"
                      value={finance.taxId}
                      onChange={(e) => setFinance({ ...finance, taxId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                      placeholder="123/456/78900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 mb-1">USt-IdNr. (optional)</label>
                    <input
                      type="text"
                      value={finance.vatId}
                      onChange={(e) => setFinance({ ...finance, vatId: e.target.value })}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                      placeholder="DE123456789"
                    />
                  </div>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={smallBusiness}
                      onChange={(e) => setSmallBusiness(e.target.checked)}
                      className="w-4 h-4 rounded accent-black"
                    />
                    <div>
                      <p className="text-sm font-bold text-gray-900">Kleinunternehmer §19 UStG</p>
                      <p className="text-xs text-gray-500">Keine Mehrwertsteuer auf Rechnungen ausweisen</p>
                    </div>
                  </label>
                  {!smallBusiness && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <label className="block text-xs font-bold text-gray-500 mb-1">Mehrwertsteuersatz (%)</label>
                      <input
                        type="number"
                        value={vatRate}
                        onChange={(e) => setVatRate(Number(e.target.value))}
                        className="w-32 bg-white border border-gray-200 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-black outline-none"
                        min={0}
                        max={100}
                        step={1}
                      />
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => setStep('done')}
                className="mt-6 w-full bg-black text-white font-bold py-3.5 rounded-2xl hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
              >
                Weiter <ArrowRight size={18} />
              </button>
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <CheckCircle size={28} className="text-green-600" />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-3">Alles bereit!</h2>
              <p className="text-gray-500 mb-8 leading-relaxed">
                Dein Konto ist eingerichtet. Du kannst jetzt deine erste Rechnung erstellen.
              </p>
              <button
                onClick={handleComplete}
                disabled={setSettingsMutation.isPending}
                className="w-full bg-black text-white font-bold py-3.5 rounded-2xl hover:bg-gray-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {setSettingsMutation.isPending ? (
                  'Speichern...'
                ) : (
                  <>
                    <CreditCard size={18} /> Erste Rechnung erstellen
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
