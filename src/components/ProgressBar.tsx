interface Props {
  currentStep: number;
  totalSteps: number;
  completedSteps: number[];
}

const STEP_LABELS = [
  'Discovery',
  'Soundbites',
  'Brand Voice',
  'Style & Photos',
  'Color Palette',
  'Style Guide',
  'Platforms',
  'Sample Posts',
  'Hashtags',
  'Workbook',
];

export default function ProgressBar({ currentStep, totalSteps, completedSteps }: Props) {
  const pct = ((currentStep - 1) / (totalSteps - 1)) * 100;

  return (
    <div className="w-full bg-white border-b border-[#b4887a]/30 px-4 py-4 sticky top-0 z-10">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-[#b4887a] tracking-wide uppercase">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-sm text-[#3F3F3F]/60">{STEP_LABELS[currentStep - 1]}</span>
        </div>
        <div className="relative h-2 bg-[#b4887a]/20 rounded-full overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full bg-[#b4887a] rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          {STEP_LABELS.map((_, i) => {
            const n = i + 1;
            const done = completedSteps.includes(n);
            const active = n === currentStep;
            return (
              <div
                key={n}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  done ? 'bg-[#b4887a]' : active ? 'bg-[#b4887a]/60 ring-2 ring-[#b4887a] ring-offset-1' : 'bg-[#b4887a]/20'
                }`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
