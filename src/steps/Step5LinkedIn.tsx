import { useEffect, useState } from 'react';
import type { SessionData } from '../types';
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

export default function Step5LinkedIn({ session, updateSession, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const s = session;

  const generate = async (feedbackNote = '') => {
    setError('');
    setLoading(true);
    setFeedback('');
    try {
      const prompt = `Create a complete, ready-to-use LinkedIn profile for ${s.fullName}, author of "${s.bookTitle}."

AUTHOR PROFILE:
- Transformation: ${s.transformation}
- Audience: ${s.idealAudience}
- Audience problem: ${s.audienceProblem}
- Unique approach: ${s.uniqueApproach}
- Why wrote book: ${s.whyWroteBook}
- Success goals: ${s.successGoals}
- Brand voice: Formal to Casual ${s.toneSpectrum.formalCasual}/5, Direct to Gentle ${s.toneSpectrum.directGentle}/5
- Voice descriptors: ${s.additionalVoiceDescriptors || 'not specified'}
${feedbackNote.trim() ? `\nUSER FEEDBACK FOR THIS REVISION:\n${feedbackNote}\nIncorporate this feedback.` : ''}

REQUIREMENTS:
- Headline MUST include the word "Speaker"
- About section should be 260-300 words, written in first person
- About section must open with a hook (pain point or bold statement)
- About section must end with a clear CTA
- Do not repeat content between sections

Generate using these ALL CAPS headers. Each section should be self-contained:

LINKEDIN HEADLINE:
Write the 120-character max headline only. Include "Speaker", their core transformation, and who they serve. Show character count in brackets at the end.

LINKEDIN ABOUT:
The full About section only, ready to paste. 260-300 words. First person. Open with a hook, tell the transformation story, explain how they help, end with a CTA.

FEATURED SECTION IDEAS:
List 5-6 specific ideas for what to put in the Featured section. Make them specific to their situation and goals.

LINKEDIN TIPS:
3 quick, specific tips for ${s.fullName} to optimize their LinkedIn presence based on their goals. Keep each tip to 1-2 sentences.`;
      const result = await callClaude(prompt);
      updateSession({ linkedInOutput: result });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate LinkedIn profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session.linkedInOutput) generate();
  }, []);

  const headline = parseSection(session.linkedInOutput, 'LINKEDIN HEADLINE');
  const about = parseSection(session.linkedInOutput, 'LINKEDIN ABOUT');
  const featured = parseSection(session.linkedInOutput, 'FEATURED SECTION IDEAS');
  const tips = parseSection(session.linkedInOutput, 'LINKEDIN TIPS');

  // Clean headline of character count note
  const headlineText = headline.replace(/\[.*?\]/g, '').trim();
  const headlineLen = headlineText.length;

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your LinkedIn Profile</h1>
        <p className="text-[#3F3F3F]/60 text-sm">Ready-to-paste copy for your LinkedIn profile. Open LinkedIn and replace your existing content with these.</p>
      </div>

      {loading && <LoadingSpinner message="Writing your LinkedIn profile..." />}
      {error && <ErrorMessage message={error} onRetry={() => generate()} />}

      {session.linkedInOutput && !loading && (
        <>
          {/* Headline section */}
          {headlineText && (
            <div className="rounded-xl border border-[#b4887a]/30 bg-[#b4887a]/10 p-5 mb-4 fade-in">
              <h3 className="font-bold text-[#3F3F3F] text-sm tracking-widest uppercase mb-1">LinkedIn Headline</h3>
              <p className="text-xs text-[#3F3F3F]/50 mb-3">
                {headlineLen} / 120 characters
                {headlineLen > 120 ? ' - Too long, trim it' : headlineLen > 100 ? ' - Good length' : ''}
              </p>
              <p className="text-[#3F3F3F] font-medium text-sm mb-3">{headlineText}</p>
              <div className="flex gap-2">
                <span className={`text-xs px-2 py-1 rounded-full ${headlineLen <= 120 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                  {headlineLen} chars
                </span>
                <span className="text-xs px-2 py-1 rounded-full bg-[#b4887a]/20 text-[#3F3F3F]">Includes "Speaker"</span>
              </div>
            </div>
          )}

          {/* About section */}
          {about && (
            <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-4">
              <div className="mb-3">
                <h3 className="font-bold text-[#3F3F3F] text-sm">LinkedIn About Section</h3>
                <p className="text-xs text-[#3F3F3F]/50 mt-0.5">Copy and paste directly into LinkedIn</p>
              </div>
              <p className="text-sm text-[#3F3F3F]/80 leading-relaxed whitespace-pre-wrap">{about}</p>
            </div>
          )}

          {/* Featured ideas */}
          {featured && (
            <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-4">
              <h3 className="font-bold text-[#3F3F3F] text-sm mb-1">Featured Section Ideas</h3>
              <p className="text-xs text-[#3F3F3F]/50 mb-3">Pin these to the top of your profile</p>
              <p className="text-sm text-[#3F3F3F]/80 leading-relaxed whitespace-pre-wrap">{featured}</p>
            </div>
          )}

          {/* Tips */}
          {tips && (
            <div className="rounded-xl border border-[#b4887a]/20 bg-[#faf7f5] p-5 mb-4">
              <p className="font-semibold text-[#3F3F3F] mb-2 text-xs uppercase tracking-wide">LinkedIn Tips for You</p>
              <p className="text-sm text-[#3F3F3F]/70 whitespace-pre-wrap">{tips}</p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-[#b4887a]/20">
            <p className="text-xs text-[#3F3F3F]/50 mb-2 font-medium">Want to adjust something?</p>
            <textarea
              className="w-full rounded-xl border border-[#b4887a]/25 bg-white px-4 py-3 text-sm text-[#3F3F3F] placeholder:text-[#3F3F3F]/30 focus:outline-none focus:ring-2 focus:ring-[#b4887a]/25 resize-none"
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. The headline is too long, the About section needs to sound more casual..."
            />
            <button
              onClick={() => generate(feedback)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#b4887a]/40 text-[#3F3F3F] text-sm hover:bg-[#b4887a]/10 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate with Changes
            </button>
          </div>

          <ApprovalButtons
            question="Does this LinkedIn profile feel authentic to you?"
            onApprove={() => { updateSession({ linkedInApproved: true }); onComplete(); }}
          />
        </>
      )}
    </div>
  );
}
