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

interface Post {
  type: string;
  content: string;
  visual: string;
}

interface PlatformPosts {
  name: string;
  posts: Post[];
}

function parseAllPosts(text: string, platforms: string[]): PlatformPosts[] {
  const result: PlatformPosts[] = [];
  for (const platform of platforms) {
    const pPosts: Post[] = [];
    const escapedPlatform = platform.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const platformStart = text.search(new RegExp(escapedPlatform, 'i'));
    if (platformStart === -1) continue;

    const otherPlatforms = platforms.filter(p => p !== platform);
    let sectionEnd = text.length;
    for (const other of otherPlatforms) {
      const escapedOther = other.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const otherStart = text.search(new RegExp(escapedOther, 'i'));
      if (otherStart > platformStart && otherStart < sectionEnd) sectionEnd = otherStart;
    }

    const section = text.slice(platformStart, sectionEnd);
    // Split on POST 1/2/3 markers — keep only blocks that contain actual post content
    const postBlocks = section
      .split(/\bPOST\s*\d+/i)
      .filter(b => b.match(/(?:POST TYPE|CAPTION TYPE|CAPTION|TIMEFRAME|SCRIPT OUTLINE)[:\s]/i));

    postBlocks.forEach((block, idx) => {
      const typeMatch = block.match(/(?:TYPE|CAPTION TYPE|POST TYPE)[:\s]+([^\n]+)/i);
      const type = typeMatch ? typeMatch[1].trim() : `Post ${idx + 1}`;
      const visualMatch = block.match(/(?:VISUAL IDEA|VISUAL|IMAGE)[:\s]+([^\n]+)/i);
      const visual = visualMatch ? visualMatch[1].trim() : '';
      // For YouTube posts: capture timeframe + script outline as content
      const timeframeMatch = block.match(/TIMEFRAME:\s*([^\n]+)/i);
      const scriptMatch = block.match(/SCRIPT OUTLINE:\s*([\s\S]*?)(?=\nVISUAL|\nTIMEFRAME:|$)/i);
      const captionMatch = block.match(/CAPTION:\s*\n?([\s\S]*?)(?=\nVISUAL|\nVIDEO SCRIPT|\nHOOK:|\nTALKING POINTS:|\nCLOSING CTA:|$)/i);
      let content = '';
      if (timeframeMatch && scriptMatch) {
        content = `Timeframe: ${timeframeMatch[1].trim()}\n\n${scriptMatch[1].trim()}`;
      } else if (captionMatch) {
        content = captionMatch[1].trim();
      } else {
        content = block.split('\n')
          .filter(l => l.trim() && !l.match(/^(?:TYPE|POST TYPE|CAPTION TYPE|CAPTION|VISUAL IDEA|VISUAL|IMAGE|VIDEO SCRIPT|HOOK|TALKING POINTS|CLOSING CTA|TIMEFRAME|SCRIPT OUTLINE)[:\s]/i))
          .join('\n').replace(/^\s*[-:]\s*/, '').trim();
      }
      if (content.length > 10) pPosts.push({ type, content, visual });
    });

    if (pPosts.length > 0) result.push({ name: platform, posts: pPosts.slice(0, 3) });
  }
  return result;
}

export default function Step7SamplePosts({ session, updateSession, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const s = session;

  const platforms = s.recommendedPlatforms.length > 0
    ? s.recommendedPlatforms
    : ['LinkedIn', 'Instagram'];

  const isYouTube = (p: string) => /youtube/i.test(p);
  const isShortVideo = (p: string) => /tiktok|instagram/i.test(p);

  const generate = async (feedbackNote = '') => {
    setError('');
    setLoading(true);
    setFeedback('');
    try {
      const youtubeFormat = `
POST TYPE: [Video Type - e.g., Tutorial, Story, Myth-Buster]
TIMEFRAME: [e.g., "8-12 minute video"]
SCRIPT OUTLINE: Hook (first 30 seconds to earn the click and establish credibility), Main Points (3-4 numbered teaching points or story beats), Closing CTA (specific action for viewers to take)
VISUAL IDEA: [Thumbnail concept — what text overlay and visual would make someone stop scrolling]`;

      const shortVideoFormat = `
POST TYPE: [Video type]
CAPTION: [Short caption for the video post]
VIDEO SCRIPT OUTLINE:
HOOK: [First 3-5 seconds — the one line that stops the scroll]
TALKING POINTS: [3-4 numbered bullet points]
CLOSING CTA: [Specific call to action]
VISUAL IDEA: [Visual/thumbnail concept]`;

      const standardFormat = `
POST TYPE: [Post type]
CAPTION: [Full post text, adapted for this platform's length and culture. Written in ${s.fullName}'s voice speaking directly to their ideal reader.]
VISUAL IDEA: [Specific image description]`;

      const buildPlatformSection = (platform: string) => {
        if (isYouTube(platform)) return youtubeFormat;
        if (isShortVideo(platform)) return shortVideoFormat;
        return standardFormat;
      };

      const platformInstructions = platforms.map(p => `
${p.toUpperCase()} POSTS:

POST 1
POST TYPE: [Transformation Story Post]
${isYouTube(p) ? `TIMEFRAME: [e.g., "8-12 minute video"]
SCRIPT OUTLINE: Hook (first 30 seconds), Main Points (3-4 numbered points about the transformation), Closing CTA (call to action)
VISUAL IDEA: [Thumbnail concept]` : isShortVideo(p) ? `CAPTION: [Short punchy caption]
VIDEO SCRIPT OUTLINE:
HOOK: [First 3-5 seconds]
TALKING POINTS: [3-4 numbered points]
CLOSING CTA: [Call to action]
VISUAL IDEA: [Visual concept]` : `CAPTION: [Full transformation story post in ${s.fullName}'s authentic voice]
VISUAL IDEA: [Image description]`}

POST 2
POST TYPE: [Teaching / Value Post]
${isYouTube(p) ? `TIMEFRAME: [e.g., "10-15 minute video"]
SCRIPT OUTLINE: Hook (problem they're facing), Main Points (3-4 actionable teaching points), Closing CTA (next step)
VISUAL IDEA: [Thumbnail concept]` : isShortVideo(p) ? `CAPTION: [Short teaching caption]
VIDEO SCRIPT OUTLINE:
HOOK: [First 3-5 seconds]
TALKING POINTS: [3-4 numbered points]
CLOSING CTA: [Call to action]
VISUAL IDEA: [Visual concept]` : `CAPTION: [List, steps, or lesson format — different structure from Post 1]
VISUAL IDEA: [Image description]`}

POST 3
POST TYPE: [Perspective / Myth-Busting Post]
${isYouTube(p) ? `TIMEFRAME: [e.g., "6-10 minute video"]
SCRIPT OUTLINE: Hook (challenge the myth), Main Points (3-4 points reframing the belief), Closing CTA (invitation to rethink)
VISUAL IDEA: [Thumbnail concept]` : isShortVideo(p) ? `CAPTION: [Short myth-busting caption]
VIDEO SCRIPT OUTLINE:
HOOK: [First 3-5 seconds]
TALKING POINTS: [3-4 numbered points]
CLOSING CTA: [Call to action]
VISUAL IDEA: [Visual concept]` : `CAPTION: [Challenge a common belief in their space — different angle from Posts 1 and 2]
VISUAL IDEA: [Image description]`}
`).join('\n---\n');
      // suppress unused variable warning
      void buildPlatformSection;

      const prompt = `Write EXACTLY 3 unique social media posts for EACH of these ${platforms.length} platform(s) for ${s.fullName}, author of "${s.bookTitle}."

PLATFORMS: ${platforms.join(', ')}

AUTHOR VOICE AND CONTEXT:
- Ideal reader: ${s.idealAudience} — Problem: ${s.audienceProblem}
- Transformation: ${s.transformation}
- Voice: Formal to Casual ${s.toneSpectrum.formalCasual}/5, Serious to Lighthearted ${s.toneSpectrum.seriousLighthearted}/5, Direct to Gentle ${s.toneSpectrum.directGentle}/5
- Voice descriptors: ${s.additionalVoiceDescriptors || 'not specified'}
- Transformation statement: ${s.soundbitesOutput.slice(0, 200)}

CRITICAL RULES:
- Write EXACTLY 3 posts per platform — no more, no fewer.
- Each post must be completely different in topic, angle, and structure. No repetition.
- Write all posts in ${s.fullName}'s authentic voice.
- Each post must be ready to use with zero editing.
- Spell the author's name exactly as written: ${s.fullName}
- YouTube posts get TIMEFRAME + SCRIPT OUTLINE format (not a caption). Other platforms get CAPTION format.
${feedbackNote.trim() ? `\nUSER FEEDBACK FOR THIS REVISION:\n${feedbackNote}\nIncorporate this feedback.` : ''}

${platformInstructions}`;
      const result = await callClaude(prompt);
      updateSession({ samplePostsOutput: result });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate sample posts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session.samplePostsOutput) generate();
  }, []);

  const parsed = session.samplePostsOutput ? parseAllPosts(session.samplePostsOutput, platforms) : [];

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Sample Social Media Posts</h1>
        <p className="text-[#3F3F3F]/60 text-sm">6 ready-to-post pieces of content - 3 for each of your top platforms. Each one includes a visual idea.</p>
      </div>

      {loading && <LoadingSpinner message="Writing posts in your authentic voice..." />}
      {error && <ErrorMessage message={error} onRetry={() => generate()} />}

      {session.samplePostsOutput && !loading && (
        <>
          {parsed.length > 0 ? (
            parsed.map((platform, pi) => (
              <div key={pi} className="mb-6">
                <h2 className="font-bold text-[#3F3F3F] text-lg mb-3 flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-[#b4887a] text-white text-xs flex items-center justify-center font-bold">{pi + 1}</span>
                  {platform.name}
                </h2>
                <div className="space-y-4">
                  {platform.posts.map((post, i) => (
                    <div key={i} className="rounded-xl border border-[#b4887a]/20 bg-white p-5">
                      <div className="mb-3">
                        <span className="text-xs font-semibold text-[#b4887a] uppercase tracking-wide">{post.type}</span>
                      </div>
                      <p className="text-sm text-[#3F3F3F]/85 leading-relaxed whitespace-pre-wrap mb-3">{post.content}</p>
                      {post.visual && (
                        <div className="rounded-lg bg-[#faf7f5] border border-[#b4887a]/15 px-3 py-2">
                          <p className="text-xs font-semibold text-[#3F3F3F]/50 uppercase tracking-wide mb-0.5">Visual Idea</p>
                          <p className="text-xs text-[#3F3F3F]/70">{post.visual}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5">
              <p className="text-sm text-[#3F3F3F]/80 whitespace-pre-wrap">{session.samplePostsOutput}</p>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-[#b4887a]/20">
            <p className="text-xs text-[#3F3F3F]/50 mb-2 font-medium">Want to adjust something?</p>
            <textarea
              className="w-full rounded-xl border border-[#b4887a]/25 bg-white px-4 py-3 text-sm text-[#3F3F3F] placeholder:text-[#3F3F3F]/30 focus:outline-none focus:ring-2 focus:ring-[#b4887a]/25 resize-none"
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. Make the Instagram posts shorter, the LinkedIn posts need to sound more professional..."
            />
            <button
              onClick={() => generate(feedback)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#b4887a]/40 text-[#3F3F3F] text-sm hover:bg-[#b4887a]/10 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate with Changes
            </button>
          </div>

          <ApprovalButtons
            question="Do these posts feel like you? Would you use these?"
            onApprove={() => { updateSession({ samplePostsApproved: true }); onComplete(); }}
          />
        </>
      )}
    </div>
  );
}
