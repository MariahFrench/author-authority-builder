import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { copyToClipboard } from '../utils/clipboard';

interface Props {
  hex: string;
  label: string;
  description?: string;
}

export default function ColorSwatch({ hex, label, description }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await copyToClipboard(hex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isLight = (h: string) => {
    const c = h.replace('#', '');
    const r = parseInt(c.slice(0, 2), 16);
    const g = parseInt(c.slice(2, 4), 16);
    const b = parseInt(c.slice(4, 6), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  };

  const textColor = isLight(hex) ? '#3F3F3F' : '#FFFFFF';

  return (
    <div className="rounded-xl overflow-hidden border border-[#b4887a]/20 shadow-sm">
      <div
        className="h-24 flex items-end p-3 cursor-pointer group"
        style={{ backgroundColor: hex }}
        onClick={handleCopy}
      >
        <button
          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md"
          style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: textColor }}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied!' : hex}
        </button>
      </div>
      <div className="bg-white p-3">
        <p className="text-xs font-semibold text-[#3F3F3F] mb-0.5">{label}</p>
        <p className="text-xs text-[#3F3F3F]/50 font-mono">{hex}</p>
        {description && <p className="text-xs text-[#3F3F3F]/60 mt-1">{description}</p>}
      </div>
    </div>
  );
}
