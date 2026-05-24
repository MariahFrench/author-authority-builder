import { useEffect, useState } from 'react';
import type { SessionData } from '../types';
import ColorSwatch from '../components/ColorSwatch';
import ApprovalButtons from '../components/ApprovalButtons';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { callClaude } from '../utils/claude';
import { extractHexColors } from '../utils/clipboard';
import { RefreshCw } from 'lucide-react';

interface Props {
  session: SessionData;
  updateSession: (u: Partial<SessionData>) => void;
  onComplete: () => void;
}

export default function Step4ColorPalette({ session, updateSession, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [generated, setGenerated] = useState(false);
  const s = session;

  const generate = async (feedbackNote = '') => {
    setError('');
    setLoading(true);
    setFeedback('');
    try {
      const favColorNote = s.favoriteColor.trim()
        ? `The author has a favorite color they want included or considered: "${s.favoriteColor}". Try to incorporate or complement this color in the palette.`
        : '';
      const styleNote = (s.typicalStyle || s.comfortWithColor)
        ? `Fashion/style context for palette compatibility: their typical style is "${s.typicalStyle || 'not specified'}", comfort with color: "${s.comfortWithColor || 'not specified'}"${s.dayToDay ? `, day-to-day wear: "${s.dayToDay}"` : ''}. The palette should translate naturally into wearable clothing colors.`
        : '';

      const prompt = `You are creating a brand color palette for ${s.fullName}, author of "${s.bookTitle}."

STEP 1 - MAP THE EMOTIONAL WORLD OF THIS TRANSFORMATION:
Before selecting any colors, fully articulate the emotional and psychological world of their specific work:
- Transformation: ${s.transformation}
- Book: "${s.bookTitle}" — ${s.bookDescription || s.transformation}
- Ideal audience: ${s.idealAudience}
- Unique approach: ${s.uniqueApproach}
- Voice/personality: ${s.additionalVoiceDescriptors || `Formal-Casual ${s.toneSpectrum.formalCasual}/5, Serious-Lighthearted ${s.toneSpectrum.seriousLighthearted}/5, Inspirational-Practical ${s.toneSpectrum.inspirationalPractical}/5`}
- Success goals: ${s.successGoals}

Ask yourself: What emotions, textures, environments, and sensations does this transformation evoke? A business author helping leaders cut through politics evokes something completely different from a grief counselor, a fitness coach, or a financial strategist. The colors must emerge from THAT specific emotional world.

STEP 2 - SELECT COLORS FROM THAT WORLD:
Choose three colors that a stranger could look at and immediately understand the author's transformation and audience — without knowing their name.

ABSOLUTE RULES — no exceptions:
- BANNED colors (too generic, overused for female authors): Dusty Rose, Warm Terracotta, Blush Pink, Rose Gold, Mauve, Salmon, Peach, Coral, Nude. Do not use these or any close variant.
- BANNED: Generic navy + gold, generic gray + white minimalism
- DO NOT choose colors based on the author's gender
- DO NOT choose "safe," "pleasant," or "universally appealing" colors — choose colors specific to THIS transformation
- Every color must be explainable by pointing to the author's specific work

${favColorNote}
${styleNote}
${feedbackNote.trim() ? `\nUSER REVISION REQUEST:\n${feedbackNote}\nIncorporate this feedback.` : ''}

PALETTE NAME:
[2-3 words capturing the emotional world of THIS specific brand — not a generic label]

PALETTE CONCEPT:
[Two sentences: (1) what emotional qualities these exact colors communicate and (2) why they fit this specific transformation and audience. Be concrete — no generic phrases like "warm and inviting."]

PRIMARY COLOR:
Name: [descriptive name tied to their brand world]
Hex: [exact hex code like #A3B4C5]
Purpose: [backgrounds, headers, main brand color]
What it says: [specific emotional/psychological message — reference their actual work]

SECONDARY COLOR:
Name: [descriptive name]
Hex: [exact hex code]
Purpose: [supporting backgrounds, cards, sections]
What it says: [one sentence, specific to their brand]

ACCENT COLOR:
Name: [descriptive name]
Hex: [exact hex code]
Purpose: [CTAs, highlights, links — use sparingly]
What it says: [one sentence, specific to their brand]

HOW TO USE THESE COLORS:
4-5 practical tips specific to this palette — website, social media, presentations, and print.`;
      const result = await callClaude(prompt);
      const hexes = extractHexColors(result);
      if (hexes.length >= 3) {
        updateSession({
          colorPaletteOutput: result,
          brandColors: { primary: hexes[0], secondary: hexes[1], accent: hexes[2] },
        });
      } else {
        updateSession({ colorPaletteOutput: result });
      }
      setGenerated(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate color palette.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session.colorPaletteOutput) {
      // Don't auto-generate — wait for user to optionally enter favorite color
      setGenerated(false);
    } else {
      setGenerated(true);
    }
  }, []);

  const bc = session.brandColors;

  const parseSection = (label: string): string => {
    const lines = session.colorPaletteOutput.split('\n');
    let capture = false;
    const out: string[] = [];
    for (const line of lines) {
      if (line.toUpperCase().includes(label.toUpperCase()) && line.includes(':')) {
        capture = true;
        continue;
      }
      if (capture) {
        if (line.match(/^[A-Z][A-Z\s]{4,}:/) && !line.toUpperCase().includes(label.toUpperCase())) break;
        out.push(line);
      }
    }
    return out.join('\n').trim();
  };

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Brand Color Palette</h1>
        <p className="text-[#3F3F3F]/60 text-sm">Colors that communicate your personality before you say a word. Built to complement your style guide.</p>
      </div>

      {/* Generate button shown before first generation */}
      {!generated && (
        <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5">
          <p className="text-sm text-[#3F3F3F]/70 mb-4">Your palette will be personalized to your transformation, audience, and brand voice — using the style preferences you shared, including your favorite color.</p>
          <button
            onClick={() => generate()}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#b4887a] text-white font-semibold hover:bg-[#a07368] transition-colors disabled:opacity-50"
          >
            Generate My Color Palette
          </button>
        </div>
      )}

      {loading && <LoadingSpinner message="Selecting your perfect brand colors..." />}
      {error && <ErrorMessage message={error} onRetry={() => generate()} />}

      {session.colorPaletteOutput && !loading && (
        <>
          {/* Color Swatches */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <ColorSwatch hex={bc.primary} label="Primary" description={parseSection('PRIMARY COLOR').split('\n').find(l => l.toLowerCase().includes('what it says'))?.replace(/what it says[:\s]*/i, '') || ''} />
            <ColorSwatch hex={bc.secondary} label="Secondary" description={parseSection('SECONDARY COLOR').split('\n').find(l => l.toLowerCase().includes('what it says'))?.replace(/what it says[:\s]*/i, '') || ''} />
            <ColorSwatch hex={bc.accent} label="Accent" description={parseSection('ACCENT COLOR').split('\n').find(l => l.toLowerCase().includes('what it says'))?.replace(/what it says[:\s]*/i, '') || ''} />
          </div>

          {/* Hex Codes */}
          <div className="rounded-xl border border-[#b4887a]/20 bg-white p-5 mb-5 flex flex-wrap gap-4 items-center">
            <span className="text-xs font-semibold text-[#3F3F3F]/50 uppercase tracking-wide">Hex Codes:</span>
            {[bc.primary, bc.secondary, bc.accent].map(hex => (
              <span key={hex} className="text-xs font-mono text-[#3F3F3F]/70 bg-[#faf7f5] px-3 py-1.5 rounded-lg border border-[#b4887a]/20">{hex}</span>
            ))}
          </div>

          {/* Full explanation */}
          <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5">
            <p className="text-sm text-[#3F3F3F]/80 leading-relaxed whitespace-pre-wrap">{session.colorPaletteOutput}</p>
          </div>

          <div className="mt-6 pt-5 border-t border-[#b4887a]/20">
            <p className="text-xs text-[#3F3F3F]/50 mb-2 font-medium">Want to adjust something?</p>
            <textarea
              className="w-full rounded-xl border border-[#b4887a]/25 bg-white px-4 py-3 text-sm text-[#3F3F3F] placeholder:text-[#3F3F3F]/30 focus:outline-none focus:ring-2 focus:ring-[#b4887a]/25 resize-none"
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. I want warmer tones, include more contrast, the secondary color feels too light..."
            />
            <button
              onClick={() => generate(feedback)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#b4887a]/40 text-[#3F3F3F] text-sm hover:bg-[#b4887a]/10 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate with Changes
            </button>
          </div>

          <ApprovalButtons
            question="Do these colors feel right for your brand?"
            onApprove={() => { updateSession({ colorPaletteApproved: true }); onComplete(); }}
          />
        </>
      )}
    </div>
  );
}
