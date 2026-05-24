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

export default function Step6Platforms({ session, updateSession, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const s = session;

  const generate = async (feedbackNote = '') => {
    setError('');
    setLoading(true);
    setFeedback('');
    try {
      const availablePlatforms = s.platforms.length > 0 ? s.platforms : ['LinkedIn', 'Instagram', 'Facebook', 'YouTube', 'Substack'];
      const prompt = `You are helping ${s.fullName}, author of "${s.bookTitle}", choose the best social media platforms and create profile copy.

AUTHOR PROFILE:
- Transformation: ${s.transformation}
- Ideal audience: ${s.idealAudience}
- Audience problem: ${s.audienceProblem}
- Success goals: ${s.successGoals}
- Brand voice: Formal to Casual ${s.toneSpectrum.formalCasual}/5, Educational to Conversational ${s.toneSpectrum.educationalConversational}/5
- Voice descriptors: ${s.additionalVoiceDescriptors || 'not specified'}
- Platforms they mentioned interest in: ${availablePlatforms.join(', ')}
${feedbackNote.trim() ? `\nUSER FEEDBACK FOR THIS REVISION:\n${feedbackNote}\nIncorporate this feedback.` : ''}

Select the TOP 2 platforms that will be most effective for their specific goals and audience. Then generate profile copy for each.

Format using these headers for each platform. Use "PLATFORM 1 - [NAME]:" and "PLATFORM 2 - [NAME]:" (with a simple hyphen, not a dash):

PLATFORM 1 - [PLATFORM NAME]:
WHY THIS PLATFORM: [1-2 sentences explaining why this is their best platform]
PROFILE HEADER: [platform-specific headline, ready to paste]
PROFILE BIO: [platform-specific bio, concise, ready to paste]
PROFILE TIPS: [2-3 tips for succeeding on this specific platform]

PLATFORM 2 - [PLATFORM NAME]:
WHY THIS PLATFORM: [1-2 sentences]
PROFILE HEADER: [platform-specific headline]
PROFILE BIO: [platform-specific bio]
PROFILE TIPS: [2-3 tips]

Make all copy ready to paste. Match ${s.fullName}'s brand voice. Each platform's bio should be written for that platform's norms and character limits.`;
      const result = await callClaude(prompt);

      // Extract recommended platform names
      const platformMatches = result.match(/PLATFORM \d+ - ([A-Za-z]+):/g);
      const recommended = platformMatches
        ? platformMatches.map(m => m.replace(/PLATFORM \d+ - /, '').replace(':', '').trim())
        : [];
      updateSession({ platformsOutput: result, recommendedPlatforms: recommended });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate platform recommendations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session.platformsOutput) generate();
  }, []);

  const parsePlatformSection = (num: number): { name: string; why: string; header: string; bio: string; tips: string } => {
    const text = session.platformsOutput;
    const startPattern = new RegExp(`PLATFORM ${num} - ([A-Za-z]+):`, 'i');
    const startMatch = text.match(startPattern);
    if (!startMatch) return { name: '', why: '', header: '', bio: '', tips: '' };

    const name = startMatch[1];
    const startIdx = text.indexOf(startMatch[0]);
    const nextPlatformIdx = text.indexOf(`PLATFORM ${num + 1}`, startIdx + 1);
    const section = nextPlatformIdx > -1 ? text.slice(startIdx, nextPlatformIdx) : text.slice(startIdx);

    const extractField = (label: string): string => {
      const lines = section.split('\n');
      let capture = false;
      const out: string[] = [];
      for (const line of lines) {
        if (line.toUpperCase().includes(label.toUpperCase()) && line.includes(':')) {
          capture = true;
          const rest = line.slice(line.indexOf(':') + 1).trim();
          if (rest) out.push(rest);
          continue;
        }
        if (capture) {
          if (/^(WHY|PROFILE|PLATFORM)\s/i.test(line) && !line.toUpperCase().includes(label.toUpperCase())) break;
          out.push(line);
        }
      }
      return out.join('\n').trim();
    };

    return {
      name,
      why: extractField('WHY THIS PLATFORM'),
      header: extractField('PROFILE HEADER'),
      bio: extractField('PROFILE BIO'),
      tips: extractField('PROFILE TIPS'),
    };
  };

  const p1 = parsePlatformSection(1);
  const p2 = parsePlatformSection(2);

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Top 2 Social Media Platforms</h1>
        <p className="text-[#3F3F3F]/60 text-sm">Focused effort on 2 platforms beats scattered presence on 8. Here's where you'll make the most impact.</p>
      </div>

      {loading && <LoadingSpinner message="Analyzing the best platforms for your audience..." />}
      {error && <ErrorMessage message={error} onRetry={() => generate()} />}

      {session.platformsOutput && !loading && (
        <>
          {[p1, p2].filter(p => p.name).map((p, i) => (
            <div key={i} className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5 fade-in">
              <div className="flex items-center gap-3 mb-4">
                <div>
                  <h2 className="font-bold text-[#3F3F3F] text-lg">{p.name}</h2>
                  <p className="text-xs text-[#b4887a] font-medium">Platform {i + 1} of 2</p>
                </div>
              </div>
              {p.why && (
                <div className="rounded-lg bg-[#b4887a]/10 border border-[#b4887a]/25 p-3 mb-4 text-sm text-[#3F3F3F]/80 italic">{p.why}</div>
              )}
              {p.header && <OutputCard title="Profile Header / Headline" content={p.header} />}
              {p.bio && <OutputCard title="Profile Bio / About" content={p.bio} />}
              {p.tips && (
                <div className="rounded-lg bg-[#faf7f5] p-4 text-sm text-[#3F3F3F]/70">
                  <p className="font-semibold text-xs uppercase tracking-wide mb-1">Platform Tips</p>
                  <p className="whitespace-pre-wrap">{p.tips}</p>
                </div>
              )}
            </div>
          ))}

          {!p1.name && !p2.name && (
            <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5">
              <p className="text-sm text-[#3F3F3F]/70 whitespace-pre-wrap">{session.platformsOutput}</p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-[#b4887a]/20">
            <p className="text-xs text-[#3F3F3F]/50 mb-2 font-medium">Want to adjust something?</p>
            <textarea
              className="w-full rounded-xl border border-[#b4887a]/25 bg-white px-4 py-3 text-sm text-[#3F3F3F] placeholder:text-[#3F3F3F]/30 focus:outline-none focus:ring-2 focus:ring-[#b4887a]/25 resize-none"
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. I'd prefer Instagram over LinkedIn, the bio is too long..."
            />
            <button
              onClick={() => generate(feedback)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#b4887a]/40 text-[#3F3F3F] text-sm hover:bg-[#b4887a]/10 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate with Changes
            </button>
          </div>

          <ApprovalButtons
            question="Do these 2 platforms feel right for your goals?"
            onApprove={() => { updateSession({ platformsApproved: true }); onComplete(); }}
          />
        </>
      )}
    </div>
  );
}
