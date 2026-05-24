import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  message: string;
  onRetry?: () => void;
}

export default function ErrorMessage({ message, onRetry }: Props) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5 my-4 fade-in">
      <div className="flex items-start gap-3">
        <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-700 mb-1">Something went wrong</p>
          <p className="text-sm text-red-600">{message}</p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 inline-flex items-center gap-2 text-sm px-4 py-2 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
    </div>
  );
}
