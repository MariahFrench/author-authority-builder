import { useState, useEffect, useCallback } from 'react';
import type { SessionData } from './types';
import { defaultSession } from './types';
import { loadSession, saveSession, clearSession } from './utils/session';
import ProgressBar from './components/ProgressBar';
import Step1Discovery from './steps/Step1Discovery';
import Step2Soundbites from './steps/Step2Soundbites';
import Step3BrandPersonality from './steps/Step3BrandPersonality';
import Step4FashionQuestions from './steps/Step4FashionQuestions';
import Step4ColorPalette from './steps/Step4ColorPalette';
import Step6Platforms from './steps/Step6Platforms';
import Step7SamplePosts from './steps/Step7SamplePosts';
import Step8Hashtags from './steps/Step8Hashtags';
import Step9StyleGuide from './steps/Step9StyleGuide';
import Step10Workbook from './steps/Step10Workbook';
import { ChevronLeft, RefreshCw } from 'lucide-react';

const TOTAL_STEPS = 10;

function ApiKeyWarning() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#faf7f5] p-4">
      <div className="max-w-lg w-full rounded-2xl border border-red-200 bg-white p-8 shadow-lg text-center">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔒</span>
        </div>
        <h2 className="text-xl font-bold text-[#3F3F3F] mb-3">API Key Required</h2>
        <p className="text-sm text-[#3F3F3F]/60 mb-4">
          This application requires an Anthropic API key to generate personalized brand content.
        </p>
        <div className="rounded-lg bg-[#faf7f5] p-4 text-left mb-5">
          <p className="text-xs font-semibold text-[#3F3F3F] mb-2">Setup Instructions:</p>
          <ol className="text-xs text-[#3F3F3F]/70 space-y-1 list-decimal list-inside">
            <li>Create a <code className="bg-white px-1 py-0.5 rounded">.env</code> file in the project root</li>
            <li>Add: <code className="bg-white px-1 py-0.5 rounded">VITE_ANTHROPIC_API_KEY=your_key_here</code></li>
            <li>Get your API key from console.anthropic.com</li>
            <li>Restart the dev server</li>
          </ol>
        </div>
        <p className="text-xs text-[#3F3F3F]/40">Then refresh this page to get started.</p>
      </div>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<SessionData>(() => loadSession());
  const [showStartOver, setShowStartOver] = useState(false);
  const hasApiKey = !!import.meta.env.VITE_ANTHROPIC_API_KEY;

  const updateSession = useCallback((updates: Partial<SessionData>) => {
    setSession(prev => {
      const next = { ...prev, ...updates };
      saveSession(next);
      return next;
    });
  }, []);

  const goToStep = (step: number) => {
    updateSession({ currentStep: step });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setSession(prev => {
      const prevStep = Math.max(1, prev.currentStep - 1);
      const next = { ...prev, currentStep: prevStep };
      saveSession(next);
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const completeStep = useCallback((step: number) => {
    setSession(prev => {
      const completedSteps = prev.completedSteps.includes(step)
        ? prev.completedSteps
        : [...prev.completedSteps, step];
      const nextStep = step + 1;
      const next = { ...prev, completedSteps, currentStep: nextStep };
      saveSession(next);
      return next;
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleStartOver = () => {
    clearSession();
    setSession({ ...defaultSession });
    setShowStartOver(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Apply brand colors as CSS variables when they're set
  useEffect(() => {
    const bc = session.brandColors;
    if (bc.primary !== '#b4887a') {
      document.documentElement.style.setProperty('--brand-primary', bc.primary);
    }
  }, [session.brandColors]);

  const step = session.currentStep;

  const stepProps = {
    session,
    updateSession,
  };

  const renderStep = () => {
    switch (step) {
      case 1:  return <Step1Discovery {...stepProps} onComplete={() => completeStep(1)} />;
      case 2:  return <Step2Soundbites {...stepProps} onComplete={() => completeStep(2)} />;
      case 3:  return <Step3BrandPersonality {...stepProps} onComplete={() => completeStep(3)} />;
      case 4:  return <Step4FashionQuestions {...stepProps} onComplete={() => completeStep(4)} />;
      case 5:  return <Step4ColorPalette {...stepProps} onComplete={() => completeStep(5)} />;
      case 6:  return <Step9StyleGuide {...stepProps} onComplete={() => completeStep(6)} />;
      case 7:  return <Step6Platforms {...stepProps} onComplete={() => completeStep(7)} />;
      case 8:  return <Step7SamplePosts {...stepProps} onComplete={() => completeStep(8)} />;
      case 9:  return <Step8Hashtags {...stepProps} onComplete={() => completeStep(9)} />;
      case 10: return <Step10Workbook {...stepProps} />;
      default: return <Step1Discovery {...stepProps} onComplete={() => completeStep(1)} />;
    }
  };

  return (
    <div className="min-h-screen bg-[#faf7f5]">
      {!hasApiKey && <ApiKeyWarning />}

      {/* Header */}
      <header className="bg-[#242e1c] px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.png" alt="The Published Life" className="w-10 h-10 object-contain" />
            <div>
              <h1 className="text-sm font-bold text-white leading-none tracking-wide">The Published Life</h1>
              <p className="text-xs text-white/50 mt-0.5 tracking-wider uppercase" style={{ fontSize: '0.6rem' }}>Author Authority Builder</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={goBack}
                className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-white/10"
              >
                <ChevronLeft size={14} />
                Go Back
              </button>
            )}
            <button
              onClick={() => setShowStartOver(true)}
              className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors px-2 py-1.5 rounded-lg hover:bg-white/10"
              title="Start over from the beginning"
            >
              <RefreshCw size={11} />
            </button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <ProgressBar
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        completedSteps={session.completedSteps}
      />

      {/* Step Navigation (for already completed steps) */}
      {session.completedSteps.length > 0 && (
        <div className="bg-white border-b border-[#b4887a]/10 overflow-x-auto">
          <div className="max-w-3xl mx-auto px-4 flex gap-1 py-2">
            {Array.from({ length: Math.min(step, TOTAL_STEPS) }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                onClick={() => goToStep(n)}
                className={`text-xs px-2.5 py-1 rounded-md whitespace-nowrap transition-all ${
                  n === step
                    ? 'bg-[#b4887a] text-white'
                    : session.completedSteps.includes(n)
                    ? 'text-[#3F3F3F]/60 hover:bg-[#b4887a]/10'
                    : 'text-[#3F3F3F]/30 cursor-default'
                }`}
                disabled={!session.completedSteps.includes(n) && n !== step}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <main className="max-w-3xl mx-auto px-4 py-8 pb-16">
        {renderStep()}
      </main>

      {/* Start Over Confirmation Modal */}
      {showStartOver && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#3F3F3F]/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="font-bold text-[#3F3F3F] text-lg mb-2">Start over?</h3>
            <p className="text-sm text-[#3F3F3F]/60 mb-5">This will clear all your answers and generated content. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={handleStartOver}
                className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-semibold hover:bg-red-600 transition-colors text-sm"
              >
                Yes, start over
              </button>
              <button
                onClick={() => setShowStartOver(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#b4887a]/40 text-[#3F3F3F] font-medium hover:bg-[#b4887a]/10 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
