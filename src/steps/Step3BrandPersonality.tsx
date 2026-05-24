import { useEffect, useState } from 'react';
import type { SessionData } from '../types';
import OutputCard from '../components/OutputCard';
import ApprovalButtons from '../components/ApprovalButtons';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { callClaude } from '../utils/claude';
import { RefreshCw } from 'lucide-react';

interface Props {
  session: SessionData;
  updateSession: (u: Partial<SessionData>) => void;
  onComplete: () => void;
}

const toneLabel = (v: number, left: string, right: string) => {
  if (v <= 2) return `Leans strongly ${left}`;
  if (v === 3) return `Balanced - ${left} and ${right}`;
  return `Leans strongly ${right}`;
};

interface DoAvoidPair {
  doThis: string;
  avoid: string;
}

function parseDoAvoid(text: string): DoAvoidPair[] {
  const pairs: DoAvoidPair[] = [];
  const lines = text.split('\n');
  let inSection = false;
  let currentDo = '';

  for (const line of lines) {
    const trimmed = line.trim();
    // Accept section header with or without colon
    if (trimmed.toUpperCase().includes('WHAT THIS SOUNDS LIKE')) {
      inSection = true;
      continue;
    }
    if (inSection) {
      // Check DO/AVOID BEFORE section-break so "DO THIS:" doesn't trigger a break
      const doMatch = trimmed.match(/^(?:\d+[.)]\s*)?DO(?:\s+THIS)?:\s*(.+)/i);
      if (doMatch) {
        currentDo = doMatch[1].trim().replace(/^["']|["']$/g, '');
        continue;
      }
      const avoidMatch = trimmed.match(/^(?:\d+[.)]\s*)?AVOID(?:\s+THIS)?:\s*(.+)/i);
      if (avoidMatch && currentDo) {
        pairs.push({ doThis: currentDo, avoid: avoidMatch[1].trim().replace(/^["']|["']$/g, '') });
        currentDo = '';
        continue;
      }
      // Section break on a new ALL-CAPS header that is not DO/AVOID
      if (trimmed.match(/^[A-Z][A-Z\s]{4,}:/) && !trimmed.toUpperCase().includes('WHAT THIS SOUNDS LIKE')) break;
    }
  }

  // Fallback: search entire text for DO/AVOID pairs if section header not found
  if (pairs.length === 0) {
    let fallbackDo = '';
    for (const line of lines) {
      const trimmed = line.trim();
      const doMatch = trimmed.match(/^(?:\d+[.)]\s*)?DO(?:\s+THIS)?:\s*(.+)/i);
      if (doMatch) { fallbackDo = doMatch[1].trim().replace(/^["']|["']$/g, ''); continue; }
      const avoidMatch = trimmed.match(/^(?:\d+[.)]\s*)?AVOID(?:\s+THIS)?:\s*(.+)/i);
      if (avoidMatch && fallbackDo) {
        pairs.push({ doThis: fallbackDo, avoid: avoidMatch[1].trim().replace(/^["']|["']$/g, '') });
        fallbackDo = '';
      }
    }
  }
  return pairs;
}

function parseSection(text: string, label: string): string {
  const lines = text.split('\n');
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
}

export default function Step3BrandPersonality({ session, updateSession, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const s = session;

  const generate = async (feedbackNote = '') => {
    setError('');
    setLoading(true);
    setFeedback('');
    try {
      const prompt = `Create a Brand Personality Guide for ${s.fullName}, author of "${s.bookTitle}."

Their tone-of-voice ratings (1=left, 5=right):
- Formal to Casual: ${s.toneSpectrum.formalCasual}/5 (${toneLabel(s.toneSpectrum.formalCasual, 'Formal', 'Casual')})
- Educational to Conversational: ${s.toneSpectrum.educationalConversational}/5 (${toneLabel(s.toneSpectrum.educationalConversational, 'Educational', 'Conversational')})
- Serious to Lighthearted: ${s.toneSpectrum.seriousLighthearted}/5 (${toneLabel(s.toneSpectrum.seriousLighthearted, 'Serious', 'Lighthearted')})
- Direct to Gentle: ${s.toneSpectrum.directGentle}/5 (${toneLabel(s.toneSpectrum.directGentle, 'Direct', 'Gentle')})
- Inspirational to Practical: ${s.toneSpectrum.inspirationalPractical}/5 (${toneLabel(s.toneSpectrum.inspirationalPractical, 'Inspirational', 'Practical')})
Additional voice descriptors: ${s.additionalVoiceDescriptors || 'None given'}
Transformation they deliver: ${s.transformation}
Ideal reader: ${s.idealAudience}
Book: "${s.bookTitle}"

Write the guide with these ALL CAPS headers:

YOUR BRAND VOICE:
A 3-4 sentence description of how ${s.fullName} sounds across all platforms. Use second person ("Your brand voice is..."). Make it vivid and specific - not generic.

YOUR VOICE SPECTRUM:
For each of the 5 dimensions, write one sentence describing their position and what it means practically. Example: "You lean Casual (4/5): Your audience feels like they're talking to a trusted friend, not sitting in a lecture."

WHAT THIS SOUNDS LIKE IN PRACTICE:
Write EXACTLY 5 DO/AVOID pairs. No numbering. No extra labels or headers between pairs. No blank lines between a DO and its matching AVOID. Each pair is exactly two consecutive lines.

DO: [specific phrase ${s.fullName} would actually say to their audience - on social media, a stage, or a video]
AVOID: [contrasting phrase that clashes with their brand - obviously wrong for their voice]

DO: [different phrase]
AVOID: [contrasting phrase]

DO: [different phrase]
AVOID: [contrasting phrase]

DO: [different phrase]
AVOID: [contrasting phrase]

DO: [different phrase]
AVOID: [contrasting phrase]

YOUR BRAND PERSONALITY IN THREE WORDS:
Choose 3 power words that capture their brand personality. For each word, explain in one sentence what it means for how they show up.${feedbackNote.trim() ? `\n\nUSER FEEDBACK FOR THIS REVISION:\n${feedbackNote}\n\nPlease incorporate this feedback.` : ''}`;
      const result = await callClaude(prompt);
      updateSession({ brandPersonalityOutput: result });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate brand personality guide.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session.brandPersonalityOutput) generate();
  }, []);

  const brandVoice = parseSection(session.brandPersonalityOutput, 'YOUR BRAND VOICE');
  const voiceSpectrum = parseSection(session.brandPersonalityOutput, 'YOUR VOICE SPECTRUM');
  const doAvoidPairs = parseDoAvoid(session.brandPersonalityOutput);
  const threeWords = parseSection(session.brandPersonalityOutput, 'YOUR BRAND PERSONALITY IN THREE WORDS');

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Brand Personality Guide</h1>
        <p className="text-[#3F3F3F]/60 text-sm">Your compass for how you should sound everywhere - social media, speaking, interviews, your website.</p>
      </div>

      {loading && <LoadingSpinner message="Defining your brand personality..." />}
      {error && <ErrorMessage message={error} onRetry={() => generate()} />}

      {session.brandPersonalityOutput && !loading && (
        <>
          {brandVoice && <OutputCard title="Your Brand Voice" content={brandVoice} highlight />}
          {voiceSpectrum && <OutputCard title="Your Voice Spectrum" content={voiceSpectrum} />}

          {doAvoidPairs.length > 0 ? (
            <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-4">
              <p className="font-bold text-[#3F3F3F] text-sm mb-1">What This Sounds Like in Practice</p>
              <p className="text-xs text-[#3F3F3F]/50 mb-4">Written as if you're speaking directly to your ideal audience</p>
              <div className="grid grid-cols-2 gap-0 text-xs font-semibold uppercase tracking-wide text-[#3F3F3F]/50 mb-3">
                <span className="text-green-700">Do This</span>
                <span className="text-red-500">Avoid This</span>
              </div>
              <div className="space-y-3">
                {doAvoidPairs.map((pair, i) => (
                  <div key={i} className="grid grid-cols-2 gap-3">
                    <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5">
                      <p className="text-xs text-green-800 leading-relaxed">"{pair.doThis}"</p>
                    </div>
                    <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5">
                      <p className="text-xs text-red-700 leading-relaxed">"{pair.avoid}"</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <OutputCard title="What This Sounds Like in Practice" content={parseSection(session.brandPersonalityOutput, 'WHAT THIS SOUNDS LIKE')} />
          )}

          {threeWords && <OutputCard title="Your Brand Personality in Three Words" content={threeWords} />}

          <div className="mt-6 pt-5 border-t border-[#b4887a]/20">
            <p className="text-xs text-[#3F3F3F]/50 mb-2 font-medium">Want to adjust something?</p>
            <textarea
              className="w-full rounded-xl border border-[#b4887a]/25 bg-white px-4 py-3 text-sm text-[#3F3F3F] placeholder:text-[#3F3F3F]/30 focus:outline-none focus:ring-2 focus:ring-[#b4887a]/25 resize-none"
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Make the voice more casual, the do/avoid phrases feel off-brand..."
            />
            <button
              onClick={() => generate(feedback)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#b4887a]/40 text-[#3F3F3F] text-sm hover:bg-[#b4887a]/10 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate with Changes
            </button>
          </div>

          <ApprovalButtons
            question="Does this sound like you?"
            onApprove={() => { updateSession({ brandPersonalityApproved: true }); onComplete(); }}
          />
        </>
      )}
    </div>
  );
}
