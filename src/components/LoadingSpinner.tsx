interface Props {
  message?: string;
}

export default function LoadingSpinner({ message = 'Generating your personalized content...' }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4 fade-in">
      <div className="relative">
        <div className="w-14 h-14 rounded-full border-4 border-[#b4887a]/20" />
        <div className="w-14 h-14 rounded-full border-4 border-transparent border-t-[#b4887a] absolute inset-0 spin" />
      </div>
      <p className="text-[#3F3F3F]/60 text-sm text-center max-w-xs">{message}</p>
      <p className="text-[#b4887a] text-xs">This may take 20–30 seconds</p>
    </div>
  );
}
