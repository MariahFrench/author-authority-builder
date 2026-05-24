interface Props {
  leftLabel: string;
  rightLabel: string;
  value: number;
  onChange: (v: number) => void;
}

export default function ToneSlider({ leftLabel, rightLabel, value, onChange }: Props) {
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs text-[#3F3F3F]/60 mb-1.5">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
      <div className="relative">
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-full accent-[#b4887a] h-2 cursor-pointer"
        />
        <div className="flex justify-between px-0.5 mt-1">
          {[1, 2, 3, 4, 5].map(n => (
            <div key={n} className={`w-1.5 h-1.5 rounded-full ${n === value ? 'bg-[#b4887a]' : 'bg-[#b4887a]/25'}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
