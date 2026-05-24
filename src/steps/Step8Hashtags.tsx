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

interface HashtagItem {
  tag: string;
  count: string;
  reason?: string;
}

function parseHashtagItems(text: string, section: string): HashtagItem[] {
  const lines = text.split('\n');
  let capture = false;
  const items: HashtagItem[] = [];
  for (const line of lines) {
    if (line.toUpperCase().includes(section.toUpperCase()) && line.includes(':')) {
      capture = true;
      continue;
    }
    if (capture) {
      if (line.match(/^[A-Z][A-Z\s]{4,}:/) && !line.toUpperCase().includes(section.toUpperCase())) break;
      // Match lines like "#Hashtag - 2.5M posts" or "#Hashtag (500K posts)"
      const tagMatch = line.match(/(#[A-Za-z][A-Za-z0-9]*)/);
      const countMatch = line.match(/[\d.,]+\s*[KMBkmb]?\s*(?:posts?|uses?|million|thousand)?/i);
      if (tagMatch) {
        items.push({
          tag: tagMatch[1],
          count: countMatch ? countMatch[0].trim() : '',
          reason: line.replace(/#[A-Za-z][A-Za-z0-9]*/, '').replace(/[\d.,]+\s*[KMBkmb]?\s*(?:posts?|uses?|million|thousand)?/gi, '').replace(/[-–()|]/g, '').trim(),
        });
      }
    }
  }
  return items;
}

export default function Step8Hashtags({ session, updateSession, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const s = session;

  const generate = async (feedbackNote = '') => {
    setError('');
    setLoading(true);
    setFeedback('');
    try {
      const prompt = `Create a hashtag strategy for ${s.fullName}, author of "${s.bookTitle}."

AUTHOR CONTEXT:
- Book topic and transformation: ${s.transformation}
- Ideal audience: ${s.idealAudience}
- Audience problem: ${s.audienceProblem}
- Unique approach: ${s.uniqueApproach}
- Platforms they'll use: ${s.recommendedPlatforms.join(', ') || s.platforms.join(', ')}
${feedbackNote.trim() ? `\nUSER FEEDBACK FOR THIS REVISION:\n${feedbackNote}\nIncorporate this feedback.` : ''}

Generate using these ALL CAPS headers:

BRANDED HASHTAGS:
Create exactly 5 original hashtags that ${s.fullName} can OWN and use consistently. These should be unique to their brand, easy to remember, and related to their specific transformation or book. For each hashtag, show the approximate current post count and why it's a good fit:
Format each line as: #Hashtag - [approximate post count] - [one sentence on why this works for their brand]

SEARCHABLE HASHTAGS:
Create 10 popular, searchable hashtags in their niche. Mix of sizes:
- 3 high-volume tags (1M+ posts)
- 4 mid-volume tags (100K-1M posts)
- 3 niche-specific tags (under 100K posts, highly targeted)
For each hashtag, show the approximate post count:
Format each line as: #Hashtag - [approximate post count] - [volume category: High/Mid/Niche]

WHY POST COUNT MATTERS:
Write 3-4 sentences explaining to ${s.fullName} why mixing hashtag sizes is a smart strategy - covering visibility vs. competition trade-offs for each size tier.

HASHTAG STRATEGY TIPS:
3-4 specific tips on how ${s.fullName} should use hashtags on their specific platforms to maximize reach.`;
      const result = await callClaude(prompt);
      updateSession({ hashtagsOutput: result });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate hashtags.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session.hashtagsOutput) generate();
  }, []);

  const branded = parseHashtagItems(session.hashtagsOutput, 'BRANDED HASHTAGS');
  const searchable = parseHashtagItems(session.hashtagsOutput, 'SEARCHABLE HASHTAGS');

  const getSection = (label: string) => {
    const lines = session.hashtagsOutput.split('\n');
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

  const whyCountMatters = getSection('WHY POST COUNT MATTERS');
  const strategySection = getSection('HASHTAG STRATEGY TIPS');

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Hashtag Strategy</h1>
        <p className="text-[#3F3F3F]/60 text-sm">5 branded hashtags you'll own plus 10 searchable hashtags to grow your reach - each with post counts.</p>
      </div>

      {loading && <LoadingSpinner message="Building your hashtag strategy..." />}
      {error && <ErrorMessage message={error} onRetry={() => generate()} />}

      {session.hashtagsOutput && !loading && (
        <>
          {/* Branded */}
          <div className="rounded-xl border border-[#b4887a]/30 bg-[#b4887a]/10 p-6 mb-5 fade-in">
            <div className="mb-3">
              <h3 className="font-bold text-[#3F3F3F] text-sm tracking-widest uppercase">Branded Hashtags</h3>
              <p className="text-xs text-[#3F3F3F]/50 mt-0.5">Create and use consistently - these are YOURS</p>
            </div>
            {branded.length > 0 ? (
              <div className="space-y-2">
                {branded.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 bg-white/60 rounded-lg px-3 py-2">
                    <span className="text-[#b4887a] font-bold text-sm shrink-0">{item.tag}</span>
                    {item.count && <span className="text-xs text-[#3F3F3F]/50 shrink-0 mt-0.5">{item.count} posts</span>}
                    {item.reason && <span className="text-xs text-[#3F3F3F]/60">{item.reason}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#3F3F3F]/60 whitespace-pre-wrap">{session.hashtagsOutput.slice(0, 300)}</p>
            )}
          </div>

          {/* Searchable */}
          <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5">
            <div className="mb-3">
              <h3 className="font-bold text-[#3F3F3F] text-sm tracking-widest uppercase">Searchable Hashtags</h3>
              <p className="text-xs text-[#3F3F3F]/50 mt-0.5">Mix with branded hashtags to expand reach</p>
            </div>
            {searchable.length > 0 ? (
              <div className="space-y-2">
                {searchable.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 border border-[#b4887a]/15 rounded-lg px-3 py-2">
                    <span className="text-[#3F3F3F] font-medium text-sm shrink-0">{item.tag}</span>
                    {item.count && <span className="text-xs text-[#3F3F3F]/50 shrink-0 mt-0.5">{item.count} posts</span>}
                    {item.reason && <span className="text-xs text-[#3F3F3F]/50">{item.reason}</span>}
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Why post count matters */}
          {whyCountMatters && (
            <div className="rounded-xl border border-[#b4887a]/20 bg-[#faf7f5] p-5 mb-5">
              <p className="font-semibold text-xs uppercase tracking-wide text-[#3F3F3F]/50 mb-2">Why Post Count Matters</p>
              <p className="text-sm text-[#3F3F3F]/75 leading-relaxed">{whyCountMatters}</p>
            </div>
          )}

          {strategySection && (
            <div className="rounded-xl border border-[#b4887a]/20 bg-white p-5 mb-4">
              <p className="font-semibold text-xs uppercase tracking-wide text-[#3F3F3F]/50 mb-2">Strategy Tips</p>
              <p className="text-sm text-[#3F3F3F]/75 whitespace-pre-wrap">{strategySection}</p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-[#b4887a]/20">
            <p className="text-xs text-[#3F3F3F]/50 mb-2 font-medium">Want to adjust something?</p>
            <textarea
              className="w-full rounded-xl border border-[#b4887a]/25 bg-white px-4 py-3 text-sm text-[#3F3F3F] placeholder:text-[#3F3F3F]/30 focus:outline-none focus:ring-2 focus:ring-[#b4887a]/25 resize-none"
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Include more hashtags specific to my niche, the branded ones feel too generic..."
            />
            <button
              onClick={() => generate(feedback)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#b4887a]/40 text-[#3F3F3F] text-sm hover:bg-[#b4887a]/10 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate with Changes
            </button>
          </div>

          <ApprovalButtons
            question="Do these hashtags feel authentic to your brand?"
            onApprove={() => { updateSession({ hashtagsApproved: true }); onComplete(); }}
          />
        </>
      )}
    </div>
  );
}
