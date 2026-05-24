import { useState } from 'react';
import type { SessionData } from '../types';
import { Download, Star, CheckCircle } from 'lucide-react';

interface Props {
  session: SessionData;
  updateSession: (u: Partial<SessionData>) => void;
}

function extractHashtags(text: string): { branded: string[]; searchable: string[] } {
  const lines = text.split('\n');
  const branded: string[] = [];
  const searchable: string[] = [];
  let section = '';
  for (const line of lines) {
    if (line.toUpperCase().includes('BRANDED')) section = 'branded';
    else if (line.toUpperCase().includes('SEARCHABLE')) section = 'searchable';
    const tags = line.match(/#[A-Za-z][A-Za-z0-9]*/g);
    if (tags) {
      if (section === 'branded') branded.push(...tags);
      else if (section === 'searchable') searchable.push(...tags);
    }
  }
  return { branded: [...new Set(branded)], searchable: [...new Set(searchable)] };
}

interface ParsedPost { type: string; content: string; visual: string; }
interface PlatformPosts { name: string; posts: ParsedPost[]; }

function parsePosts(text: string, platforms: string[]): PlatformPosts[] {
  const result: PlatformPosts[] = [];
  for (const platform of platforms) {
    const escaped = platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const start = text.search(new RegExp(escaped, 'i'));
    if (start === -1) continue;
    const others = platforms.filter(p => p !== platform);
    let end = text.length;
    for (const other of others) {
      const esc2 = other.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const os = text.search(new RegExp(esc2, 'i'));
      if (os > start && os < end) end = os;
    }
    const section = text.slice(start, end);
    const blocks = section.split(/\bPOST\s*\d+/i).filter(b => b.trim().length > 30);
    const posts: ParsedPost[] = [];
    // Only keep blocks with actual post content (not platform headers)
    const contentBlocks = blocks.filter(b => b.match(/(?:POST TYPE|CAPTION TYPE|CAPTION|TIMEFRAME|SCRIPT OUTLINE)[:\s]/i));
    contentBlocks.forEach((block, idx) => {
      const typeMatch = block.match(/(?:TYPE|CAPTION TYPE|POST TYPE)[:\s]+([^\n]+)/i);
      const visualMatch = block.match(/(?:VISUAL IDEA|VISUAL|IMAGE)[:\s]+([^\n]+)/i);
      const timeframeMatch = block.match(/TIMEFRAME:\s*([^\n]+)/i);
      const scriptMatch = block.match(/SCRIPT OUTLINE:\s*([\s\S]*?)(?=\nVISUAL|\nTIMEFRAME:|$)/i);
      const captionMatch = block.match(/CAPTION:\s*\n?([\s\S]*?)(?=\nVISUAL|\nVIDEO SCRIPT|\nHOOK:|\nTALKING POINTS:|\nCLOSING CTA:|$)/i);
      let content = '';
      if (timeframeMatch && scriptMatch) {
        content = `Timeframe: ${timeframeMatch[1].trim()}\n\n${scriptMatch[1].trim()}`;
      } else if (captionMatch) {
        content = captionMatch[1].trim();
      } else {
        content = block.split('\n').filter(l => l.trim() && !l.match(/^(?:TYPE|POST TYPE|CAPTION TYPE|CAPTION|VISUAL IDEA|VISUAL|IMAGE|VIDEO SCRIPT|HOOK|TALKING POINTS|CLOSING CTA|TIMEFRAME|SCRIPT OUTLINE)[:\s]/i)).join('\n').replace(/^\s*[-:]\s*/, '').trim();
      }
      if (content.length > 10) {
        posts.push({
          type: typeMatch ? typeMatch[1].trim() : `Post ${idx + 1}`,
          content,
          visual: visualMatch ? visualMatch[1].trim() : '',
        });
      }
    });
    if (posts.length > 0) result.push({ name: platform, posts: posts.slice(0, 3) });
  }
  return result;
}

function parseThreeWords(text: string): string[] {
  if (!text) return [];
  const lines = text.split('\n');
  let capture = false;
  const words: string[] = [];
  for (const line of lines) {
    if (line.toUpperCase().includes('THREE WORDS') && line.includes(':')) { capture = true; continue; }
    if (capture) {
      if (line.match(/^[A-Z][A-Z\s]{4,}:/) && !line.toUpperCase().includes('THREE WORDS')) break;
      const trimmed = line.trim().replace(/^\d+\.\s*/, '');
      const m = trimmed.match(/^([A-Za-z]+)[\s:–\-]/);
      if (m && m[1] && m[1].length > 2) { words.push(m[1]); if (words.length >= 3) break; }
    }
  }
  return words;
}

export default function Step10Workbook({ session, updateSession }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const s = session;
  const bc = s.brandColors;

  const hashtags = s.hashtagsOutput ? extractHashtags(s.hashtagsOutput) : { branded: [], searchable: [] };

  const quickRef = `YOUR AUTHOR AUTHORITY AT A GLANCE

NAME: ${s.fullName}
BOOK: ${s.bookTitle}

TRANSFORMATION:
${s.transformation}

IDEAL READER:
${s.idealAudience}

WHEN SOMEONE ASKS "WHAT DO YOU DO?":
${s.soundbitesOutput ? s.soundbitesOutput.split('\n').filter(l => l.trim()).slice(0, 4).join('\n') : '(see Messaging section)'}

YOUR PLATFORMS: ${s.recommendedPlatforms.join(' and ') || s.platforms.slice(0, 2).join(' and ')}

BRAND COLORS: ${bc.primary} | ${bc.secondary} | ${bc.accent}

BRANDED HASHTAGS: ${hashtags.branded.slice(0, 5).join(' ')}`.trim();

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const margin = 18;
      const contentW = pageW - margin * 2;
      let y = margin;

      // ── UTILITIES ──────────────────────────────────────────────

      const hexToRgb = (hex: string) => {
        const clean = hex.replace('#', '');
        return {
          r: parseInt(clean.slice(0, 2), 16) || 0,
          g: parseInt(clean.slice(2, 4), 16) || 0,
          b: parseInt(clean.slice(4, 6), 16) || 0,
        };
      };

      const addPage = () => { doc.addPage(); y = margin; };
      const checkNewPage = (needed = 20) => { if (y + needed > 275) addPage(); };

      const setColor = (hex: string, type: 'fill' | 'draw' | 'text' = 'fill') => {
        const { r, g, b } = hexToRgb(hex);
        if (type === 'fill') doc.setFillColor(r, g, b);
        else if (type === 'draw') doc.setDrawColor(r, g, b);
        else doc.setTextColor(r, g, b);
      };

      const sanitize = (text: string) =>
        text
          .replace(/[^\x00-\x7F]/g, m => (({ '—': '-', '–': '-', '‘': "'", '’': "'", '“': '"', '”': '"', '•': '-', '…': '...' } as Record<string, string>)[m] || ''))
          .replace(/\*\*(.+?)\*\*/g, '$1')  // strip bold markdown **text**
          .replace(/\*/g, '')               // strip lone asterisks used as bullets
          .replace(/\s+\n/g, '\n')
          .trim();

      // Full-width colored section header bar
      const sectionHeader = (title: string) => {
        checkNewPage(18);
        setColor(bc.primary, 'fill');
        doc.rect(margin, y - 1, contentW, 10, 'F');
        // Accent right-end decoration block
        setColor(bc.accent, 'fill');
        doc.rect(margin + contentW - 14, y - 1, 14, 10, 'F');
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(title.toUpperCase(), margin + 4, y + 6);
        y += 15;
        doc.setTextColor(63, 63, 63);
      };

      // Left-accented sub-header within a section
      const subHeader = (title: string) => {
        checkNewPage(16);
        y += 7;
        setColor(bc.accent, 'fill');
        doc.rect(margin, y, 3, 9, 'F');
        doc.setFontSize(9.5);
        doc.setFont('helvetica', 'bold');
        setColor(bc.primary, 'text');
        doc.text(title.toUpperCase(), margin + 7, y + 6.5);
        y += 14;
        doc.setTextColor(63, 63, 63);
      };

      // Highlighted pop-out callout box
      const popoutBox = (text: string, size = 9.5) => {
        const clean = sanitize(text);
        if (!clean) return;
        const allLines = doc.splitTextToSize(clean, contentW - 20);
        const maxLines = Math.floor(170 / (size * 0.52));
        const lines = allLines.slice(0, maxLines);
        const boxH = lines.length * (size * 0.52) + 14;
        checkNewPage(boxH + 8);
        doc.setFillColor(245, 237, 233);
        doc.roundedRect(margin, y, contentW, boxH, 3, 3, 'F');
        setColor(bc.accent, 'draw');
        doc.setLineWidth(0.8);
        doc.roundedRect(margin, y, contentW, boxH, 3, 3, 'S');
        doc.setLineWidth(0.1);
        // Small accent indicator square
        setColor(bc.accent, 'fill');
        doc.roundedRect(margin + 5, y + 5, 4, 4, 1, 1, 'F');
        doc.setFontSize(size);
        doc.setFont('helvetica', 'bolditalic');
        setColor(bc.primary, 'text');
        lines.forEach((line: string, i: number) => {
          doc.text(line, margin + 12, y + 9 + i * (size * 0.52));
        });
        y += boxH + 8;
        doc.setTextColor(63, 63, 63);
      };

      // Smart body text: bolds ALL CAPS headers and label: text patterns, accent square bullets
      const bodyText = (text: string, size = 9) => {
        if (!text || text === '(not generated)') return;
        const rawLines = sanitize(text).split('\n');
        for (const rawLine of rawLines) {
          const line = rawLine.trimEnd();
          if (!line.trim()) { y += 5; continue; }
          const isAllCapsHdr = /^[A-Z][A-Z\s\-]{3,}:/.test(line.trim());
          const isBullet = /^\s*[-*]\s/.test(line);
          if (isAllCapsHdr) {
            checkNewPage(14);
            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(size + 0.5);
            setColor(bc.primary, 'text');
            const hdrWrapped = doc.splitTextToSize(line.trim(), contentW - 4);
            hdrWrapped.forEach((hl: string) => {
              doc.text(hl, margin + 2, y);
              y += (size + 0.5) * 0.60;
            });
            doc.setTextColor(63, 63, 63);
          } else {
            const indent = isBullet ? margin + 8 : margin + 2;
            const wrap = contentW - (isBullet ? 10 : 4);
            const stripped = line.trim().replace(/^[-*]\s*/, '');
            // Detect inline hex color code — render a swatch before the text
            const hexSwatchMatch = stripped.match(/#([0-9A-Fa-f]{6})/);
            const swatchHex = hexSwatchMatch ? '#' + hexSwatchMatch[1] : null;
            const swatchIndent = swatchHex ? indent + 7 : indent;
            // Add a small gap before inline-bold items to separate paragraphs
            if (!isBullet && !swatchHex && stripped.match(/^[A-Za-z][\w\s]{1,45}:\s+.+/)) { checkNewPage(4); y += 2; }
            const wrapped = doc.splitTextToSize(stripped, wrap - (swatchHex ? 7 : 0));
            wrapped.forEach((wl: string, wi: number) => {
              checkNewPage(size * 0.56 + 2);
              doc.setFontSize(size);
              if (isBullet && wi === 0) {
                setColor(bc.accent, 'fill');
                doc.roundedRect(margin + 3, y - 2.8, 2.5, 2.5, 0.5, 0.5, 'F');
              }
              if (swatchHex && wi === 0) {
                const { r, g, b } = hexToRgb(swatchHex);
                doc.setFillColor(r, g, b);
                doc.roundedRect(indent, y - 3.5, 5, 5, 0.5, 0.5, 'F');
                doc.setDrawColor(200, 200, 200);
                doc.setLineWidth(0.2);
                doc.roundedRect(indent, y - 3.5, 5, 5, 0.5, 0.5, 'S');
                doc.setLineWidth(0.1);
              }
              // Inline bold: detect "Label phrase: rest of text" on first sub-line
              const inlineBold = wi === 0 && wl.match(/^([A-Za-z][\w\s]{1,45}):\s+(.+)/);
              if (inlineBold) {
                const lbl = inlineBold[1] + ':';
                doc.setFont('helvetica', 'bold');
                setColor(bc.primary, 'text');
                const lw = doc.getTextWidth(lbl);
                doc.text(lbl, swatchIndent, y);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(63, 63, 63);
                doc.text(' ' + inlineBold[2], swatchIndent + lw, y);
              } else {
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(63, 63, 63);
                doc.text(wl, swatchIndent, y);
              }
              y += size * 0.54;
            });
          }
        }
        y += 6;
      };

      // Social media post card — renders full content with page-break support
      const renderPostCard = (platform: string, postNum: number, type: string, content: string, visual: string) => {
        const cc = sanitize(content); // no length cap — full post
        const vc = visual ? sanitize(visual) : '';
        const cLines = doc.splitTextToSize(cc, contentW - 14);
        const vLines = vc ? doc.splitTextToSize(vc, contentW - 18) : [];

        // Ensure at least header + a few lines fit before starting
        checkNewPage(24);

        // Header strip
        setColor(bc.primary, 'fill');
        doc.roundedRect(margin, y, contentW, 8.5, 3, 3, 'F');
        doc.rect(margin, y + 4.5, contentW, 4, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'bold');
        doc.text(`${platform.toUpperCase()} - POST ${postNum}`, margin + 4, y + 6);
        if (type) {
          const typeLabel = type.toUpperCase().slice(0, 42);
          doc.text(typeLabel, margin + contentW - 4, y + 6, { align: 'right' });
        }
        y += 11;

        // Caption — line by line with page-break support and light row background
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(45, 45, 45);
        cLines.forEach((line: string) => {
          if (y + 5 > 273) {
            // Page break mid-card — draw a "continued" mini-header on the new page
            addPage();
            setColor(bc.primary, 'fill');
            doc.rect(margin, y - 1, contentW, 6, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6.5);
            doc.setFont('helvetica', 'italic');
            doc.text(`${platform} - Post ${postNum} (continued)`, margin + 4, y + 3.5);
            y += 8;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8.5);
            doc.setTextColor(45, 45, 45);
          }
          doc.setFillColor(252, 249, 247);
          doc.rect(margin, y - 3.8, contentW, 5.2, 'F');
          doc.text(line, margin + 6, y);
          y += 4.8;
        });
        y += 4;

        // Visual idea strip
        if (vc) {
          const stripH = vLines.length * 4.5 + 10;
          checkNewPage(stripH + 6);
          doc.setFillColor(234, 222, 216);
          doc.roundedRect(margin + 4, y, contentW - 8, stripH, 2, 2, 'F');
          setColor(bc.accent, 'text');
          doc.setFontSize(6.5);
          doc.setFont('helvetica', 'bold');
          doc.text('VISUAL IDEA:', margin + 8, y + 5);
          doc.setTextColor(60, 40, 35);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          vLines.forEach((line: string, li: number) => { doc.text(line, margin + 8, y + 9.5 + li * 4.5); });
          y += stripH + 3;
        }

        // Bottom separator
        setColor(bc.primary, 'draw');
        doc.setLineWidth(0.2);
        doc.line(margin, y, margin + contentW, y);
        doc.setLineWidth(0.1);
        y += 8;
      };

      // Hashtag chips
      const renderHashtagChips = (tags: string[], light = false) => {
        if (!tags.length) return;
        let chipX = margin + 2;
        let lineY = y;
        tags.forEach(tag => {
          const tw = doc.getTextWidth(tag) + 10;
          if (chipX + tw > margin + contentW - 2) { chipX = margin + 2; lineY += 10; checkNewPage(12); }
          if (light) {
            doc.setFillColor(245, 237, 233);
            setColor(bc.primary, 'draw');
            doc.setLineWidth(0.4);
            doc.roundedRect(chipX, lineY, tw, 7, 2, 2, 'FD');
            doc.setLineWidth(0.1);
            setColor(bc.primary, 'text');
          } else {
            setColor(bc.primary, 'fill');
            doc.roundedRect(chipX, lineY, tw, 7, 2, 2, 'F');
            doc.setTextColor(255, 255, 255);
          }
          doc.setFontSize(7.5);
          doc.setFont('helvetica', 'bold');
          doc.text(tag, chipX + 5, lineY + 5);
          chipX += tw + 3;
        });
        y = lineY + 13;
        doc.setTextColor(63, 63, 63);
      };

      // Inline color thumbnail + label rows: [swatch] Name (#HEX)
      const renderColorSwatches = (swatches: Array<{ label: string; hex: string }>) => {
        for (const { label, hex } of swatches) {
          checkNewPage(12);
          const { r, g, b } = hexToRgb(hex);
          doc.setFillColor(r, g, b);
          doc.roundedRect(margin + 2, y - 4.5, 9, 9, 1, 1, 'F');
          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin + 2, y - 4.5, 9, 9, 1, 1, 'S');
          doc.setLineWidth(0.1);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          setColor(bc.primary, 'text');
          doc.text(label, margin + 14, y);
          const labelW = doc.getTextWidth(label);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(8.5);
          doc.setTextColor(120, 120, 120);
          doc.text(` (${hex.toUpperCase()})`, margin + 14 + labelW, y);
          y += 11;
        }
        y += 4;
      };

      // Extract a named section from AI output text
      const parseSectionText = (text: string, label: string): string => {
        const lines = text.split('\n');
        let capture = false;
        const out: string[] = [];
        for (const line of lines) {
          if (line.toUpperCase().includes(label.toUpperCase()) && line.includes(':')) { capture = true; continue; }
          if (capture) {
            if (line.match(/^[A-Z][A-Z\s]{4,}:/) && !line.toUpperCase().includes(label.toUpperCase())) break;
            out.push(line);
          }
        }
        return out.join('\n').trim();
      };

      // Split style guide text into pre-outfit section + individual outfit blocks
      // Each outfit block stops before the next outfit OR before post-outfit sections
      const parseOutfitsForPDF = (text: string): Array<{ name: string; block: string }> => {
        const chunks = text.split(/(?=OUTFIT NAME:)/i);
        return chunks.slice(1).map(chunk => {
          const m = chunk.match(/OUTFIT NAME:\s*([^\n]+)/i);
          // Stop at post-outfit sections so photos don't get pushed to the end
          const stopAt = chunk.search(/\n(?:STYLING FOR|YOUR BRAND STYLE)/i);
          const block = stopAt > 0 ? chunk.slice(0, stopAt).trim() : chunk.trim();
          return { name: m ? m[1].trim().replace(/^["']|["']$/g, '') : 'Outfit', block };
        });
      };

      // Fetch image URL and return base64 string for jsPDF
      const fetchImgBase64 = async (url: string): Promise<string | null> => {
        try {
          const resp = await fetch(url);
          if (!resp.ok) return null;
          const blob = await resp.blob();
          return await new Promise<string | null>(resolve => {
            const reader = new FileReader();
            reader.onload = () => {
              const res = reader.result as string;
              resolve(res.split(',')[1] || null);
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
          });
        } catch { return null; }
      };

      // Parse Do/Avoid pairs from brand personality output for PDF
      const parseDoAvoidForPDF = (text: string): Array<{ doThis: string; avoid: string }> => {
        const pairs: Array<{ doThis: string; avoid: string }> = [];
        const lines = text.split('\n');
        let inSection = false;
        let currentDo = '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.toUpperCase().includes('WHAT THIS SOUNDS LIKE')) { inSection = true; continue; }
          if (inSection) {
            // Check DO/AVOID before section-break so "DO THIS:" doesn't trigger a break
            const doMatch = trimmed.match(/^(?:\d+[.)]\s*)?DO(?:\s+THIS)?:\s*(.+)/i);
            if (doMatch) { currentDo = doMatch[1].trim().replace(/^["']|["']$/g, ''); continue; }
            const avoidMatch = trimmed.match(/^(?:\d+[.)]\s*)?AVOID(?:\s+THIS)?:\s*(.+)/i);
            if (avoidMatch && currentDo) {
              pairs.push({ doThis: currentDo, avoid: avoidMatch[1].trim().replace(/^["']|["']$/g, '') });
              currentDo = '';
              continue;
            }
            if (trimmed.match(/^[A-Z][A-Z\s]{4,}:/) && !trimmed.toUpperCase().includes('WHAT THIS SOUNDS LIKE')) break;
          }
        }
        // Fallback: search entire text
        if (pairs.length === 0) {
          let fb = '';
          for (const line of lines) {
            const t = line.trim();
            const dm = t.match(/^(?:\d+[.)]\s*)?DO(?:\s+THIS)?:\s*(.+)/i);
            if (dm) { fb = dm[1].trim().replace(/^["']|["']$/g, ''); continue; }
            const am = t.match(/^(?:\d+[.)]\s*)?AVOID(?:\s+THIS)?:\s*(.+)/i);
            if (am && fb) { pairs.push({ doThis: fb, avoid: am[1].trim().replace(/^["']|["']$/g, '') }); fb = ''; }
          }
        }
        return pairs;
      };

      // Two-column Do/Avoid table renderer
      const renderDoAvoidColumns = (pairs: Array<{ doThis: string; avoid: string }>) => {
        if (!pairs.length) return;
        const colW = (contentW - 6) / 2;
        const hdrH = 7;
        checkNewPage(hdrH + 10);
        doc.setFillColor(220, 237, 220);
        doc.roundedRect(margin, y, colW, hdrH, 2, 2, 'F');
        doc.setFillColor(253, 226, 224);
        doc.roundedRect(margin + colW + 6, y, colW, hdrH, 2, 2, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(40, 120, 40);
        doc.text('DO THIS', margin + colW / 2, y + 4.8, { align: 'center' });
        doc.setTextColor(180, 40, 40);
        doc.text('AVOID THIS', margin + colW + 6 + colW / 2, y + 4.8, { align: 'center' });
        y += hdrH + 3;
        for (const pair of pairs) {
          const doLines = doc.splitTextToSize(sanitize(`"${pair.doThis}"`), colW - 8);
          const avoidLines = doc.splitTextToSize(sanitize(`"${pair.avoid}"`), colW - 8);
          const rowH = Math.max(doLines.length, avoidLines.length) * 4.4 + 10;
          checkNewPage(rowH + 4);
          doc.setFillColor(240, 250, 240);
          doc.roundedRect(margin, y, colW, rowH, 2, 2, 'F');
          doc.setDrawColor(180, 220, 180);
          doc.setLineWidth(0.3);
          doc.roundedRect(margin, y, colW, rowH, 2, 2, 'S');
          doc.setFillColor(255, 245, 245);
          doc.roundedRect(margin + colW + 6, y, colW, rowH, 2, 2, 'F');
          doc.setDrawColor(240, 180, 180);
          doc.roundedRect(margin + colW + 6, y, colW, rowH, 2, 2, 'S');
          doc.setLineWidth(0.1);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8);
          doc.setTextColor(30, 100, 30);
          doLines.forEach((l: string, li: number) => doc.text(l, margin + 4, y + 5.5 + li * 4.4));
          doc.setTextColor(160, 30, 30);
          avoidLines.forEach((l: string, li: number) => doc.text(l, margin + colW + 10, y + 5.5 + li * 4.4));
          y += rowH + 3;
        }
        y += 5;
        doc.setTextColor(63, 63, 63);
      };

      // Outfit body text: only bolds OUTFIT NAME value; all other fields plain
      const outfitBodyText = (text: string, size = 9) => {
        if (!text || text === '(not generated)') return;
        const rawLines = sanitize(text).split('\n');
        for (const rawLine of rawLines) {
          const line = rawLine.trimEnd();
          if (!line.trim()) { y += size * 0.38; continue; }
          const outfitNameMatch = line.trim().match(/^OUTFIT NAME:\s*(.+)/i);
          if (outfitNameMatch) {
            checkNewPage(size * 0.70 + 6);
            y += 3;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(size + 1);
            setColor(bc.primary, 'text');
            const nameWrapped = doc.splitTextToSize(outfitNameMatch[1].trim(), contentW - 4);
            nameWrapped.forEach((nl: string) => { doc.text(nl, margin + 2, y); y += (size + 1) * 0.62; });
            doc.setTextColor(63, 63, 63);
            continue;
          }
          const isBullet = /^\s*[-*]\s/.test(line);
          const indent = isBullet ? margin + 8 : margin + 2;
          const wrap = contentW - (isBullet ? 10 : 4);
          const stripped = line.trim().replace(/^[-*]\s*/, '');
          const wrapped = doc.splitTextToSize(stripped, wrap);
          wrapped.forEach((wl: string, wi: number) => {
            checkNewPage(size * 0.56 + 2);
            doc.setFontSize(size);
            if (isBullet && wi === 0) {
              setColor(bc.accent, 'fill');
              doc.roundedRect(margin + 3, y - 2.8, 2.5, 2.5, 0.5, 0.5, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(63, 63, 63);
            doc.text(wl, indent, y);
            y += size * 0.54;
          });
        }
        y += 6;
      };

      // Pre-fetch outfit photos for PDF embedding
      const outfitImageData: (string | null)[] = await Promise.all(
        (s.outfitPhotoData || []).map(p => p ? fetchImgBase64(p.url) : Promise.resolve(null))
      );


      // ── COVER PAGE ─────────────────────────────────────────────
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      // Left accent stripe
      setColor(bc.accent, 'fill');
      doc.rect(0, 0, 5, 297, 'F');
      // Top-right decorative corner block
      setColor(bc.accent, 'fill');
      doc.roundedRect(pageW - 30, 0, 30, 30, 0, 0, 'F');

      // Small "Author Authority Builder" label at top
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.text('AUTHOR AUTHORITY BUILDER', pageW / 2, 44, { align: 'center' });
      // Thin white rule under label
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(0.4);
      doc.line(margin + 38, 50, pageW - margin - 38, 50);
      doc.setLineWidth(0.1);

      // [Author Name]'s — scale font to fit any name
      const nameForTitle = `${s.fullName}'s`;
      const titleFontSize = nameForTitle.length > 24 ? 22 : nameForTitle.length > 18 ? 25 : 28;
      doc.setFontSize(titleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text(nameForTitle, pageW / 2, 84, { align: 'center' });

      // BRAND BOOK — main title
      doc.setFontSize(36);
      doc.text('BRAND BOOK', pageW / 2, 108, { align: 'center' });

      // Bold white divider
      doc.setDrawColor(255, 255, 255);
      doc.setLineWidth(1.8);
      doc.line(margin + 22, 117, pageW - margin - 22, 117);
      doc.setLineWidth(0.1);

      // Three descriptor words as white chip badges
      const descriptors = parseThreeWords(s.brandPersonalityOutput);
      const chipBaseY = 128;
      if (descriptors.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        const chipH = 18;
        const chipPadX = 14;
        const chipGap = 10;
        const chipWidths = descriptors.map(w => doc.getTextWidth(w.toUpperCase()) + chipPadX * 2);
        const totalChipW = chipWidths.reduce((a, b) => a + b, 0) + chipGap * (descriptors.length - 1);
        let cx = pageW / 2 - totalChipW / 2;
        descriptors.forEach((word, i) => {
          const cw = chipWidths[i];
          doc.setFillColor(255, 255, 255);
          doc.roundedRect(cx, chipBaseY, cw, chipH, 4, 4, 'F');
          doc.setTextColor(63, 63, 63);
          doc.text(word.toUpperCase(), cx + cw / 2, chipBaseY + chipH / 2 + 2, { align: 'center' });
          cx += cw + chipGap;
        });
      }

      // Color swatches with labels
      const swatchY = 220;
      const swatchW = 30;
      const swatchGap = 6;
      const swatchStartX = pageW / 2 - (swatchW * 3 + swatchGap * 2) / 2;
      const swatchLabels = ['Primary', 'Secondary', 'Accent'];
      [bc.primary, bc.secondary, bc.accent].forEach((hex, i) => {
        const sx = swatchStartX + i * (swatchW + swatchGap);
        const { r, g, b } = hexToRgb(hex);
        doc.setFillColor(r, g, b);
        doc.roundedRect(sx, swatchY, swatchW, 12, 2, 2, 'F');
        if (i === 0) {
          // White outline on primary swatch so it's visible against primary bg
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(0.8);
          doc.roundedRect(sx, swatchY, swatchW, 12, 2, 2, 'S');
          doc.setLineWidth(0.1);
        }
        doc.setFontSize(5.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(255, 255, 255);
        doc.text(hex.toUpperCase(), sx + swatchW / 2, swatchY + 7.5, { align: 'center' });
        doc.setTextColor(200, 200, 200);
        doc.text(swatchLabels[i].toUpperCase(), sx + swatchW / 2, swatchY + 17, { align: 'center' });
      });

      doc.setFontSize(7);
      doc.setTextColor(200, 200, 200);
      doc.text('Created with The Published Life - Author Authority Builder', pageW / 2, 285, { align: 'center' });

      // ── QUICK REFERENCE PAGE ───────────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');

      sectionHeader('Your Author Authority at a Glance');

      // Render key fields as individual info cards
      const qrCards = [
        { label: 'AUTHOR NAME', value: s.fullName },
        { label: 'BOOK TITLE', value: `"${sanitize(s.bookTitle)}"` },
        { label: 'TRANSFORMATION', value: sanitize(s.transformation) },
        { label: 'IDEAL READER', value: sanitize(s.idealAudience) },
        { label: 'PLATFORMS', value: s.recommendedPlatforms.join(' & ') || s.platforms.slice(0, 2).join(' & ') },
        { label: 'BRANDED HASHTAGS', value: hashtags.branded.slice(0, 5).join('  ') || '(see Hashtag section)' },
      ];

      for (const card of qrCards) {
        const valLines = doc.splitTextToSize(card.value, contentW - 16);
        const cardH = valLines.length * 5.2 + 16;
        checkNewPage(cardH + 5);
        doc.setFillColor(248, 244, 242);
        doc.roundedRect(margin, y, contentW, cardH, 3, 3, 'F');
        setColor(bc.primary, 'fill');
        doc.rect(margin, y, 4, cardH, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        setColor(bc.primary, 'text');
        doc.text(card.label, margin + 9, y + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(63, 63, 63);
        valLines.forEach((vl: string, vi: number) => {
          doc.text(vl, margin + 9, y + 13 + vi * 5.2);
        });
        y += cardH + 4;
      }

      y += 4;
      checkNewPage(28);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      setColor(bc.primary, 'text');
      doc.text('BRAND COLORS:', margin + 2, y);
      y += 6;
      renderColorSwatches([
        { label: 'Primary', hex: bc.primary },
        { label: 'Secondary', hex: bc.secondary },
        { label: 'Accent', hex: bc.accent },
      ]);

      // ── MESSAGING & SOUNDBITES ─────────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');
      sectionHeader('Messaging and Soundbites');

      // Extract and pop-out transformation statement
      if (s.soundbitesOutput) {
        const lines = s.soundbitesOutput.split('\n');
        const transIdx = lines.findIndex(l => l.toUpperCase().includes('TRANSFORMATION STATEMENT'));
        if (transIdx !== -1) {
          const transLines: string[] = [];
          for (let i = transIdx + 1; i < lines.length && i < transIdx + 6; i++) {
            if (/^[A-Z][A-Z\s]{4,}:/.test(lines[i])) break;
            if (lines[i].trim()) transLines.push(lines[i].trim());
          }
          if (transLines.length > 0) {
            subHeader('Your Transformation Statement');
            popoutBox(transLines.join(' '));
          }
        }
        bodyText(s.soundbitesOutput);
      } else {
        bodyText('(not generated)');
      }

      // ── BRAND PERSONALITY ──────────────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');
      sectionHeader('Brand Personality Guide');

      if (s.brandPersonalityOutput) {
        const brandVoiceText = parseSectionText(s.brandPersonalityOutput, 'YOUR BRAND VOICE');
        if (brandVoiceText) {
          subHeader('Your Brand Voice');
          popoutBox(brandVoiceText);
        }
        const voiceSpectrumText = parseSectionText(s.brandPersonalityOutput, 'YOUR VOICE SPECTRUM');
        if (voiceSpectrumText) {
          subHeader('Your Voice Spectrum');
          bodyText(voiceSpectrumText);
        }
        const doAvoidPairs = parseDoAvoidForPDF(s.brandPersonalityOutput);
        if (doAvoidPairs.length > 0) {
          subHeader('What This Sounds Like in Practice');
          renderDoAvoidColumns(doAvoidPairs);
        }
        const bpWords = parseThreeWords(s.brandPersonalityOutput);
        if (bpWords.length > 0) {
          subHeader('Your Brand in Three Words');
          renderHashtagChips(bpWords.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()));
        }
        const threeWordsText = parseSectionText(s.brandPersonalityOutput, 'YOUR BRAND PERSONALITY IN THREE WORDS');
        if (threeWordsText) {
          bodyText(threeWordsText);
        }
      } else {
        bodyText('(not generated)');
      }

      // ── COLOR PALETTE ──────────────────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');
      sectionHeader('Brand Color Palette');

      subHeader('Your Colors');
      const parseColorDetailName = (section: string): string => {
        const cpLines = (s.colorPaletteOutput || '').split('\n');
        let cap = false;
        for (const cl of cpLines) {
          if (cl.toUpperCase().includes(section.toUpperCase()) && cl.includes(':')) { cap = true; continue; }
          if (cap) {
            if (cl.match(/^[A-Z][A-Z\s]{4,}:/) && !cl.toUpperCase().includes(section.toUpperCase())) break;
            const m = cl.match(/^NAME:\s*(.+)/i);
            if (m) return m[1].trim();
          }
        }
        return '';
      };
      renderColorSwatches([
        { label: parseColorDetailName('PRIMARY COLOR') || 'Primary', hex: bc.primary },
        { label: parseColorDetailName('SECONDARY COLOR') || 'Secondary', hex: bc.secondary },
        { label: parseColorDetailName('ACCENT COLOR') || 'Accent', hex: bc.accent },
      ]);
      bodyText(s.colorPaletteOutput || '(not generated)');

      // ── STYLE GUIDE ────────────────────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');
      sectionHeader('Personal Brand Style Guide');

      if (s.styleGuideOutput) {
        // Render pre-outfit content (colors, situations sections)
        const preOutfit = s.styleGuideOutput.split(/(?=OUTFIT NAME:)/i)[0] || '';
        if (preOutfit.trim()) bodyText(preOutfit);

        // Render each outfit with a divider and optional Unsplash photo
        const styleOutfits = parseOutfitsForPDF(s.styleGuideOutput);
        styleOutfits.forEach((outfit, i) => {
          // Divider between outfits
          if (i > 0) {
            checkNewPage(6);
            setColor(bc.accent, 'draw');
            doc.setLineWidth(0.6);
            doc.line(margin + 10, y, margin + contentW - 10, y);
            doc.setLineWidth(0.1);
            y += 5;
          }
          // Outfit text block — only outfit name bolded in color
          outfitBodyText(outfit.block);

          // Outfit photo — directly under this outfit's text, before next outfit
          const imgData = outfitImageData[i];
          const photoMeta = s.outfitPhotoData?.[i];
          if (imgData && photoMeta) {
            const imgW = 38;
            const imgH = 50;
            checkNewPage(imgH + 14);
            try {
              doc.addImage(imgData, 'JPEG', margin + 2, y, imgW, imgH);
              doc.setFontSize(6);
              doc.setFont('helvetica', 'italic');
              doc.setTextColor(140, 140, 140);
              doc.text(`Photo: ${photoMeta.credit} / Unsplash`, margin + 2, y + imgH + 4);
              y += imgH + 10;
              doc.setTextColor(63, 63, 63);
            } catch { /* skip if image fails */ }
          }
        });

        // Render post-outfit sections (Styling for Key Situations + Brand Style in a Nutshell)
        const postOutfitMatch = s.styleGuideOutput.match(/\n(STYLING FOR[\s\S]*)/i);
        if (postOutfitMatch) {
          checkNewPage(20);
          bodyText(postOutfitMatch[1]);
        }
      } else {
        bodyText('(not generated)');
      }

      // ── SOCIAL MEDIA PLATFORMS ─────────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');
      sectionHeader('Your Social Media Platforms');

      // Renderer: matches "PLATFORM N - NAME:" as main header, subsection labels as accent bars
      const subSectionLabels = /^(WHY THIS PLATFORM|PROFILE HEADER|PROFILE BIO|PROFILE TIPS)[:\s]/i;
      const platformHdrPattern = /^PLATFORM\s+\d+\s*[-–]\s*([A-Za-z]+)\s*:/i;
      const platformRawLines = sanitize(s.platformsOutput || '(not generated)').split('\n');
      const size9 = 9;
      let firstPlatform = true;
      for (const rawLine of platformRawLines) {
        const line = rawLine.trimEnd();
        const trimmed = line.trim();
        if (!trimmed) { y += 4; continue; }

        const isPlatformHdr = platformHdrPattern.test(trimmed);
        const isSubSection = subSectionLabels.test(trimmed);

        if (isPlatformHdr) {
          // Horizontal divider before every platform after the first
          if (!firstPlatform) {
            checkNewPage(24);
            y += 8;
            setColor(bc.primary, 'fill');
            doc.rect(margin, y, contentW, 0.4, 'F');
            y += 8;
          } else {
            firstPlatform = false;
          }
          checkNewPage(18);
          setColor(bc.primary, 'fill');
          doc.rect(margin, y, contentW, 10, 'F');
          setColor(bc.accent, 'fill');
          doc.rect(margin + contentW - 12, y, 12, 10, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10.5);
          doc.setFont('helvetica', 'bold');
          doc.text(trimmed.replace(/:$/, '').toUpperCase(), margin + 5, y + 6.8);
          y += 16;
          doc.setTextColor(63, 63, 63);
        } else if (isSubSection) {
          // Sub-section label: accent bar + bold label
          checkNewPage(16);
          y += 5;
          const colonIdx = trimmed.indexOf(':');
          const label = colonIdx > -1 ? trimmed.slice(0, colonIdx).trim() : trimmed;
          const rest = colonIdx > -1 ? trimmed.slice(colonIdx + 1).trim() : '';
          setColor(bc.accent, 'fill');
          doc.rect(margin, y, 3, 8, 'F');
          doc.setFontSize(8.5);
          doc.setFont('helvetica', 'bold');
          setColor(bc.primary, 'text');
          doc.text(label.toUpperCase(), margin + 6, y + 5.8);
          y += 12;
          doc.setTextColor(63, 63, 63);
          // If there's inline content after the colon, render it immediately
          if (rest) {
            const wrapped = doc.splitTextToSize(rest, contentW - 8);
            wrapped.forEach((wl: string) => {
              checkNewPage(size9 * 0.56 + 2);
              doc.setFontSize(size9);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(63, 63, 63);
              doc.text(wl, margin + 2, y);
              y += size9 * 0.54;
            });
            y += 2;
          }
        } else {
          const isBullet = /^\s*[-*•]\s/.test(line);
          const indent = isBullet ? margin + 8 : margin + 2;
          const wrapW = contentW - (isBullet ? 10 : 4);
          const stripped = trimmed.replace(/^[-*•]\s*/, '');
          const wrapped = doc.splitTextToSize(stripped, wrapW);
          wrapped.forEach((wl: string, wi: number) => {
            checkNewPage(size9 * 0.56 + 2);
            doc.setFontSize(size9);
            if (isBullet && wi === 0) {
              setColor(bc.accent, 'fill');
              doc.roundedRect(margin + 3, y - 2.8, 2.5, 2.5, 0.5, 0.5, 'F');
            }
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(63, 63, 63);
            doc.text(wl, indent, y);
            y += size9 * 0.54;
          });
          y += 1;
        }
      }
      y += 6;

      // ── LINKEDIN (conditional) ─────────────────────────────────
      if (s.recommendedPlatforms.includes('LinkedIn')) {
        addPage();
        setColor('#FFFFFF', 'fill');
        doc.rect(0, 0, pageW, 297, 'F');
        setColor(bc.primary, 'fill');
        doc.rect(0, 0, 4, 297, 'F');
        sectionHeader('LinkedIn Profile');
        if (s.linkedInOutput) {
          // Pop-out the headline
          const hlMatch = s.linkedInOutput.match(/LINKEDIN HEADLINE:\s*\n([^\n]+)/i);
          if (hlMatch) {
            subHeader('LinkedIn Headline');
            popoutBox(hlMatch[1].trim().replace(/\[.*?\]/g, '').trim());
          }
          bodyText(s.linkedInOutput);
        } else {
          bodyText('(not generated)');
        }
      }

      // ── SAMPLE SOCIAL MEDIA POSTS ──────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');
      sectionHeader('Sample Social Media Posts');

      const platforms = s.recommendedPlatforms.length > 0 ? s.recommendedPlatforms : ['LinkedIn', 'Instagram'];
      const parsedPosts = s.samplePostsOutput ? parsePosts(s.samplePostsOutput, platforms) : [];

      if (parsedPosts.length > 0) {
        for (const platform of parsedPosts) {
          checkNewPage(30);
          subHeader(platform.name);
          platform.posts.forEach((post, i) => {
            renderPostCard(platform.name, i + 1, post.type, post.content, post.visual);
          });
        }
      } else {
        bodyText(s.samplePostsOutput || '(not generated)');
      }

      // ── HASHTAG STRATEGY ───────────────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');
      sectionHeader('Hashtag Strategy');

      if (hashtags.branded.length > 0) {
        subHeader('Your Branded Hashtags - Own These');
        renderHashtagChips(hashtags.branded.slice(0, 5));
      }
      if (hashtags.searchable.length > 0) {
        subHeader('Searchable Hashtags - Grow Your Reach');
        renderHashtagChips(hashtags.searchable.slice(0, 10), true);
      }
      y += 4;
      bodyText(s.hashtagsOutput || '(not generated)');

      // ── CONCLUSION PAGE ────────────────────────────────────────
      addPage();
      setColor('#FFFFFF', 'fill');
      doc.rect(0, 0, pageW, 297, 'F');
      setColor(bc.primary, 'fill');
      doc.rect(0, 0, 4, 297, 'F');

      sectionHeader('A Note from Mariah French');

      const firstName = s.fullName.split(' ')[0];

      // Conclusion rendered as an italic letter — compact to fit one page
      const conclusionLetterLines = [
        `Hey ${firstName},`,
        '',
        `I am so grateful for the trust you've placed in the Author Authority Builder. Creating your author brand identity is no small thing - it's a declaration to the world that your message matters, that you have something valuable to share, and that you're ready to be seen as the expert you are.`,
        '',
        `This brand book represents more than color palettes and soundbites. It represents clarity and positioning yourself as someone who not only wrote a book, but as a thought leader in your industry. It represents speaking engagements, media mentions, and influence that goes far beyond book sales.`,
        '',
        `You've done the hard work of identifying your transformation, understanding your unique voice, and clarifying what makes you different. That's the foundation. Now comes the exciting part - actually using it!`,
        '',
        'YOUR NEXT STEPS',
        '',
        `Use this brand book consistently across your social media, website, email newsletters, speaking pitches, and every piece of content you create. The more consistently you show up as your authentic, branded self, the more doors will open. Speaking opportunities will come. Media will find you. Your industry will recognize you as a leader.`,
        '',
        `LET'S WORK TOGETHER`,
        '',
        `If you're ready to take your authority to the next level, visit www.thepublishedlife.com to explore how we can work together. I work directly with non-fiction authors to implement their brand, reach speaking opportunities, and position them for industry influence.`,
        '',
        `You have a message worth sharing. My job is to make sure the right people hear it.`,
        '',
        `Here's to your next chapter as a thought leader, speaker, and influential voice in your industry.`,
        '',
        '~Mariah French',
      ];

      const cSize = 9.5;
      const cLineH = cSize * 0.54;
      for (const rawLine of conclusionLetterLines) {
        if (!rawLine.trim()) { y += 3.5; continue; }
        const isHdr = /^[A-Z][A-Z\s'-]{3,}$/.test(rawLine.trim());
        if (isHdr) {
          checkNewPage(14);
          y += 5;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(cSize + 0.5);
          setColor(bc.primary, 'text');
          doc.text(rawLine.trim(), margin + 2, y);
          y += (cSize + 0.5) * 0.60;
          y += 2;
          doc.setTextColor(63, 63, 63);
        } else {
          const wrapped = doc.splitTextToSize(rawLine, contentW - 4);
          wrapped.forEach((wl: string) => {
            checkNewPage(cLineH + 2);
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(cSize);
            doc.setTextColor(63, 63, 63);
            doc.text(wl, margin + 2, y);
            y += cLineH;
          });
        }
      }

      // Clickable link to The Published Life
      checkNewPage(14);
      y += 6;
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      setColor(bc.accent, 'text');
      doc.textWithLink('www.thepublishedlife.com', margin + 2, y, { url: 'https://www.thepublishedlife.com' });
      y += 8;
      doc.setTextColor(63, 63, 63);

      doc.setFontSize(7);
      doc.setTextColor(150, 150, 150);
      doc.text('Author Authority Builder - Created with The Published Life', pageW / 2, 288, { align: 'center' });

      doc.save(`${s.fullName.replace(/\s+/g, '_')}_Author_Authority_Builder.pdf`);
      setDownloaded(true);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fade-in">
      <div className="mb-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#b4887a]/20 flex items-center justify-center mx-auto mb-4">
          <Star className="text-[#b4887a]" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Author Authority Builder is Ready!</h1>
        <p className="text-[#3F3F3F]/60 text-sm max-w-md mx-auto">Everything you need to show up consistently and confidently as a published author - all in one place.</p>
      </div>

      {/* Completion summary */}
      <div className="rounded-xl border border-[#b4887a]/30 bg-[#b4887a]/10 p-6 mb-6">
        <h2 className="font-bold text-[#3F3F3F] mb-4">What's in your brand book:</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            'Messaging and Soundbites',
            'Brand Personality Guide',
            'Personal Brand Style Guide',
            'Brand Color Palette',
            'Social Media Platform Profiles',
            ...(s.recommendedPlatforms.includes('LinkedIn') ? ['LinkedIn Profile (ready to paste)'] : []),
            'Sample Social Media Posts with Visual Ideas',
            'Hashtag Strategy with Post Counts',
            'Quick Reference Card',
            'Personal Note from Mariah French',
          ].map(item => (
            <div key={item} className="flex items-center gap-2 text-sm text-[#3F3F3F]/80">
              <CheckCircle size={14} className="text-[#b4887a] shrink-0" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Reference Preview */}
      <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-6">
        <div className="mb-3">
          <h2 className="font-bold text-[#3F3F3F] text-base">Quick Reference Card Preview</h2>
        </div>
        <div
          className="rounded-lg p-4 text-sm font-mono whitespace-pre-wrap leading-relaxed text-[#3F3F3F]/80"
          style={{ backgroundColor: bc.secondary + '40', borderLeft: `3px solid ${bc.primary}`, paddingLeft: '1rem' }}
        >
          {quickRef}
        </div>
      </div>

      {/* Color swatches preview */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Primary', hex: bc.primary },
          { label: 'Secondary', hex: bc.secondary },
          { label: 'Accent', hex: bc.accent },
        ].map(({ label, hex }) => (
          <div key={label} className="rounded-xl overflow-hidden border border-[#b4887a]/20">
            <div className="h-16" style={{ backgroundColor: hex }} />
            <div className="bg-white p-2 text-center">
              <p className="text-xs font-medium text-[#3F3F3F]">{label}</p>
              <p className="text-xs text-[#3F3F3F]/50 font-mono">{hex}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Email field */}
      <div className="rounded-xl border border-[#b4887a]/20 bg-white p-5 mb-6">
        <label className="block text-sm font-semibold text-[#3F3F3F] mb-1">Email for your records</label>
        <p className="text-xs text-[#3F3F3F]/50 mb-3">Pre-filled in your PDF. No emails are sent automatically.</p>
        <input
          type="email"
          className="w-full rounded-lg border border-[#b4887a]/40 bg-white px-4 py-2.5 text-sm text-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#b4887a]/40 focus:border-[#b4887a] transition-colors"
          value={s.finalEmail || s.email}
          onChange={e => updateSession({ finalEmail: e.target.value })}
          placeholder="your@email.com"
        />
      </div>

      {/* Download */}
      <button
        onClick={handleDownloadPDF}
        disabled={downloading}
        className="w-full py-4 rounded-xl bg-[#242e1c] text-white font-bold text-base hover:bg-[#1a2214] transition-colors disabled:opacity-60 flex items-center justify-center gap-3"
      >
        {downloading ? (
          <>
            <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white spin" />
            Generating your brand book...
          </>
        ) : (
          <>
            <Download size={20} />
            Download My Author Authority Builder (PDF)
          </>
        )}
      </button>

      {downloaded && (
        <div className="mt-4 rounded-xl bg-green-50 border border-green-200 p-4 text-center fade-in">
          <p className="text-green-700 font-semibold text-sm">Your brand book is downloading!</p>
          <p className="text-green-600 text-xs mt-1">Check your downloads folder for "{s.fullName.replace(/\s+/g, '_')}_Author_Authority_Builder.pdf"</p>
        </div>
      )}

      <div className="mt-8 pt-6 border-t border-[#b4887a]/20 text-center">
        <p className="text-xs text-[#3F3F3F]/40">Author Authority Builder - Created with The Published Life</p>
        <p className="text-xs text-[#3F3F3F]/30 mt-1">All content generated is yours to use freely.</p>
      </div>
    </div>
  );
}
