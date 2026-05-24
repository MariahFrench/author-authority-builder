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

function buildPrompt(s: SessionData, feedback = ''): string {
  const base = `You are generating brand messaging for a non-fiction author. Create these four outputs, each clearly labeled with its header in ALL CAPS.

AUTHOR PROFILE:
- Name: ${s.fullName}
- Book: "${s.bookTitle}"
- Ideal reader: ${s.idealAudience} - Problem: ${s.audienceProblem}
- Transformation: ${s.transformation}
- Why they wrote the book: ${s.whyWroteBook}
- Unique approach: ${s.uniqueApproach}
- Voice tone (1=left, 5=right): Formal to Casual ${s.toneSpectrum.formalCasual}, Serious to Lighthearted ${s.toneSpectrum.seriousLighthearted}, Direct to Gentle ${s.toneSpectrum.directGentle}
- Voice descriptors: ${s.additionalVoiceDescriptors || 'not specified'}
- Success goals: ${s.successGoals}

Generate the following four sections. Each section header on its own line in ALL CAPS followed by a colon:

TRANSFORMATION STATEMENT:
A single, clear sentence following this exact formula: "I help [specific audience] go from [specific before state] to [specific after state]." No extra fluff, no extra sentences - just the one statement. Make it specific and memorable.

Example of the format: "I help non-fiction authors stop stressing about book sales and start being seen as an authority voice in their industry."

THE CORE MESSAGE:
What ${s.fullName} says when someone asks "What do you do?" 2-3 sentences max. Clear, confident, immediately understood. No jargon. Should feel natural to say out loud.

THE AUTHORITY BITE:
Blends personal story with how they help. Opens with a relatable moment from their journey, then pivots to how they now help others avoid the same struggle. 3-4 sentences.

THE UNIQUE ANGLE:
Starts with "Most people think..." and challenges a common belief in their niche. Positions ${s.fullName} as someone with a refreshing, different perspective. 3-4 sentences.

HOW TO USE THESE:
Give 4 brief, specific notes - one for each piece of messaging above - explaining exactly when and where to use each one (podcast intros, speaking bios, social media, networking events, etc.). Write each note as a separate line starting with the section name.`;

  if (feedback.trim()) {
    return base + `\n\nUSER FEEDBACK FOR THIS REVISION:\n${feedback}\n\nPlease incorporate this feedback in the new version.`;
  }
  return base;
}

export default function Step2Soundbites({ session, updateSession, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const generate = async (feedbackNote = '') => {
    setError('');
    setLoading(true);
    setFeedback('');
    try {
      const result = await callClaude(buildPrompt(session, feedbackNote));
      updateSession({ soundbitesOutput: result });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate messaging.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session.soundbitesOutput) generate();
  }, []);

  const parseSection = (label: string): string => {
    const lines = session.soundbitesOutput.split('\n');
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

  const transformation = parseSection('TRANSFORMATION STATEMENT');
  const core = parseSection('THE CORE MESSAGE');
  const authority = parseSection('THE AUTHORITY BITE');
  const unique = parseSection('THE UNIQUE ANGLE');
  const howTo = parseSection('HOW TO USE THESE');

  // Render purpose notes as separate lines
  const renderHowTo = () => {
    if (!howTo) return null;
    const lines = howTo.split('\n').filter(l => l.trim());
    return (
      <div className="rounded-xl border border-[#b4887a]/20 bg-[#faf7f5] p-5 mb-4">
        <p className="font-semibold text-[#3F3F3F] mb-3 text-xs uppercase tracking-wide">How to use these</p>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <p key={i} className="text-sm text-[#3F3F3F]/70 leading-relaxed border-l-2 border-[#b4887a]/30 pl-3">{line}</p>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Messaging and Soundbites</h1>
        <p className="text-[#3F3F3F]/60 text-sm">The core phrases you'll use to introduce yourself - in podcasts, speaking engagements, social media, and everywhere else.</p>
      </div>

      {loading && <LoadingSpinner message="Crafting your messaging..." />}
      {error && <ErrorMessage message={error} onRetry={() => generate()} />}

      {session.soundbitesOutput && !loading && (
        <>
          <OutputCard
            title="Transformation Statement"
            subtitle="Your north-star statement - the core of everything"
            content={transformation || session.soundbitesOutput}
            highlight
          />
          {core && <OutputCard title="The Core Message" subtitle="Use when someone asks 'What do you do?'" content={core} />}
          {authority && <OutputCard title="The Authority Bite" subtitle="Your story + how you help others" content={authority} />}
          {unique && <OutputCard title="The Unique Angle" subtitle="Challenge a common belief in your niche" content={unique} />}
          {renderHowTo()}

          <div className="mt-6 pt-5 border-t border-[#b4887a]/20">
            <p className="text-xs text-[#3F3F3F]/50 mb-2 font-medium">Want to adjust something?</p>
            <textarea
              className="w-full rounded-xl border border-[#b4887a]/25 bg-white px-4 py-3 text-sm text-[#3F3F3F] placeholder:text-[#3F3F3F]/30 focus:outline-none focus:ring-2 focus:ring-[#b4887a]/25 resize-none"
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Make the transformation statement more specific, change the tone to be more casual..."
            />
            <button
              onClick={() => generate(feedback)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#b4887a]/40 text-[#3F3F3F] text-sm hover:bg-[#b4887a]/10 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate with Changes
            </button>
          </div>

          <ApprovalButtons
            question="Do these feel authentic to you?"
            onApprove={() => { updateSession({ soundbitesApproved: true }); onComplete(); }}
          />
        </>
      )}
    </div>
  );
}
