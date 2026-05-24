import { CheckCircle, RefreshCw } from 'lucide-react';

interface Props {
  question?: string;
  onApprove: () => void;
  onAdjust?: () => void;
  approveLabel?: string;
  adjustLabel?: string;
  disabled?: boolean;
}

export default function ApprovalButtons({
  question,
  onApprove,
  onAdjust,
  approveLabel = 'This looks good — continue',
  adjustLabel = 'Let me adjust something',
  disabled = false,
}: Props) {
  return (
    <div className="mt-8 pt-6 border-t border-[#b4887a]/20">
      {question && (
        <p className="text-[#3F3F3F]/70 text-sm mb-4 italic">{question}</p>
      )}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={onApprove}
          disabled={disabled}
          className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#b4887a] text-white font-semibold hover:bg-[#a07368] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle size={18} />
          {approveLabel}
        </button>
        {onAdjust && (
          <button
            onClick={onAdjust}
            disabled={disabled}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#b4887a]/40 text-[#3F3F3F] font-medium hover:bg-[#b4887a]/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} />
            {adjustLabel}
          </button>
        )}
      </div>
    </div>
  );
}
