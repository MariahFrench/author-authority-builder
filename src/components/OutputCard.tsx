interface Props {
  title: string;
  content: string;
  subtitle?: string;
  highlight?: boolean;
}

function parseMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/^## (.+)$/gm, '<h3 class="text-base font-bold mt-4 mb-1 text-[#3F3F3F]">$1</h3>')
    .replace(/^### (.+)$/gm, '<h4 class="text-sm font-semibold mt-3 mb-1 text-[#3F3F3F]/80">$1</h4>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="mb-2 space-y-0.5">$&</ul>')
    .replace(/\n\n/g, '</p><p class="mb-2">')
    .replace(/\n/g, '<br/>');
}

export default function OutputCard({ title, content, subtitle, highlight }: Props) {
  return (
    <div className={`rounded-xl border p-5 mb-4 fade-in ${
      highlight
        ? 'bg-[#b4887a]/10 border-[#b4887a]/40'
        : 'bg-white border-[#b4887a]/20'
    }`}>
      <div className="mb-3">
        <h3 className="font-bold text-[#3F3F3F] text-sm tracking-widest uppercase">{title}</h3>
        {subtitle && <p className="text-xs text-[#3F3F3F]/50 mt-0.5">{subtitle}</p>}
      </div>
      <div
        className="text-[#3F3F3F]/90 text-sm leading-relaxed"
        dangerouslySetInnerHTML={{ __html: '<p class="mb-2">' + parseMarkdown(content) + '</p>' }}
      />
    </div>
  );
}
