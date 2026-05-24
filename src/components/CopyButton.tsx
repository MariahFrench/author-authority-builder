import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface Props {
  text: string;
  label?: string;
  className?: string;
}

export default function CopyButton({ text, label = 'Copy', className = '' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(text);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border transition-all duration-200 ${
        copied
          ? 'bg-[#b4887a] text-white border-[#b4887a]'
          : 'bg-white text-[#3F3F3F] border-[#b4887a]/40 hover:border-[#b4887a] hover:bg-[#b4887a]/10'
      } ${className}`}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? 'Copied!' : label}
    </button>
  );
}
