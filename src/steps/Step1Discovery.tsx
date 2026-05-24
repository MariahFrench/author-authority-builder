import { useState, useEffect, useRef } from 'react';
import type { SessionData } from '../types';
import ToneSlider from '../components/ToneSlider';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import { callClaude } from '../utils/claude';
import { CheckCircle, ArrowRight, RefreshCw, ChevronRight, X, Edit2 } from 'lucide-react';

interface Props {
  session: SessionData;
  updateSession: (updates: Partial<SessionData>) => void;
  onComplete: () => void;
}

type QuestionKey =
  | 'welcome'
  | 'fullName' | 'email' | 'bookTitle' | 'gender' | 'links'
  | 'transformation' | 'whyWroteBook' | 'idealAudience'
  | 'bookDescription' | 'toneSpectrum' | 'voiceDescriptors'
  | 'successGoals' | 'platforms' | 'summary';

const QUESTION_ORDER: QuestionKey[] = [
  'welcome', 'fullName', 'email', 'bookTitle', 'gender', 'links',
  'transformation', 'whyWroteBook', 'idealAudience',
  'bookDescription', 'toneSpectrum', 'voiceDescriptors',
  'successGoals', 'platforms', 'summary',
];

// Display key -> what question is actually shown (shifted by one, named for the previously-answered field)
// links -> shows Ideal Reader question
// transformation -> shows Transformation question
// whyWroteBook -> shows Why question
// idealAudience -> shows Book Description question
// voiceDescriptors -> shows Success Goals question

const PLATFORMS_LIST = ['LinkedIn', 'Facebook', 'Instagram', 'TikTok', 'YouTube', 'X', 'Pinterest', 'Substack'];

const inputCls = 'w-full rounded-xl border border-[#b4887a]/30 bg-white px-4 py-3 text-sm text-[#242e1c] focus:outline-none focus:ring-2 focus:ring-[#b4887a]/30 focus:border-[#b4887a] transition-colors placeholder:text-[#242e1c]/30';
const textareaCls = inputCls + ' resize-none';

const REPHRASE_KEYS: QuestionKey[] = [
  'links', 'transformation', 'whyWroteBook', 'idealAudience', 'voiceDescriptors'
];

const REVISE_OPTIONS = [
  { label: 'Your Ideal Reader', index: 5 },
  { label: 'Your Transformation', index: 6 },
  { label: 'Why You Wrote This Book', index: 7 },
  { label: 'Book Description and Unique Approach', index: 8 },
  { label: 'Your Voice and Tone', index: 10 },
  { label: 'Voice Descriptors', index: 11 },
  { label: 'Your Success Vision', index: 12 },
  { label: 'Social Media Platforms', index: 13 },
];

function AthenaBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 mb-5 fade-in">
      <div className="w-9 h-9 rounded-full bg-[#242e1c] flex items-center justify-center shrink-0 mt-0.5 shadow-sm overflow-hidden">
        <img src="/logo.png" alt="Athena" className="w-full h-full object-contain p-1" />
      </div>
      <div className="flex-1 bg-white rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm border border-[#b4887a]/15">
        <p className="text-[#242e1c]/80 text-sm leading-relaxed">{text}</p>
      </div>
    </div>
  );
}

function AuthorBubble({ text }: { text: string }) {
  return (
    <div className="flex items-start gap-3 mb-5 justify-end fade-in">
      <div className="flex-1 bg-[#242e1c] rounded-2xl rounded-tr-sm px-5 py-4 max-w-prose ml-12">
        <p className="text-white/90 text-sm leading-relaxed">{text}</p>
      </div>
      <div className="w-9 h-9 rounded-full bg-[#b4887a]/20 flex items-center justify-center shrink-0 mt-0.5 border border-[#b4887a]/30">
        <span className="text-[#b4887a] text-xs font-bold">You</span>
      </div>
    </div>
  );
}

function RephrasedBubble({
  rephrased, onApprove, onAdjust, authorName
}: {
  rephrased: string; onApprove: () => void; onAdjust: () => void; authorName: string;
}) {
  const first = authorName.split(' ')[0] || 'friend';
  return (
    <div className="fade-in">
      <AthenaBubble text={`I love that. Here's how I'd articulate it - does this capture what you meant, ${first}?`} />
      <div className="ml-12 mb-5">
        <div className="bg-[#b4887a]/10 border border-[#b4887a]/30 rounded-2xl px-5 py-4">
          <p className="text-[#242e1c] text-sm leading-relaxed font-medium italic">"{rephrased}"</p>
        </div>
      </div>
      <div className="ml-12 flex gap-3 mb-5">
        <button
          onClick={onApprove}
          className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#242e1c] text-white text-sm font-semibold hover:bg-[#1a2214] transition-colors"
        >
          <CheckCircle size={15} />
          Yes, that's it!
        </button>
        <button
          onClick={onAdjust}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#b4887a]/40 text-[#242e1c] text-sm font-medium hover:bg-[#b4887a]/10 transition-colors"
        >
          <RefreshCw size={14} />
          Let me rephrase
        </button>
      </div>
    </div>
  );
}

export default function Step1Discovery({ session, updateSession, onComplete }: Props) {
  const s = session;
  const firstName = s.fullName.split(' ')[0] || '';

  const [questionIndex, setQuestionIndex] = useState(() => {
    if (s.discoveryApproved) return QUESTION_ORDER.length - 1;
    if (!s.fullName) return 0;
    if (!s.email) return 1;
    if (!s.bookTitle) return 2;
    if (!s.gender) return 3;
    if (!s.idealAudience) return 5;   // links = ideal reader
    if (!s.transformation) return 6;  // transformation = transformation Q
    if (!s.whyWroteBook) return 7;
    if (!s.bookDescription) return 9;
    if (!s.successGoals) return 12;
    return 14;
  });

  const currentKey = QUESTION_ORDER[questionIndex];

  const [inputVal, setInputVal] = useState('');
  const [inputVal2, setInputVal2] = useState('');
  const [rephrased, setRephrased] = useState('');
  const [nudgeMessage, setNudgeMessage] = useState('');
  const [rephrasePhase, setRephrasePhase] = useState<'input' | 'checking' | 'nudge' | 'rephrasing' | 'review'>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [summaryText, setSummaryText] = useState('');
  const [showRevise, setShowRevise] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [questionIndex, rephrasePhase, loading, summaryText]);

  useEffect(() => {
    setInputVal('');
    setInputVal2('');
    setRephrased('');
    setRephrasePhase('input');
    setError('');
    setTimeout(() => inputRef.current?.focus(), 120);
  }, [questionIndex]);

  const advance = () => setQuestionIndex(i => Math.min(i + 1, QUESTION_ORDER.length - 1));

  const checkTransformationSpecificity = async (raw: string) => {
    setError('');
    setRephrasePhase('checking');
    setLoading(true);
    const fn = s.fullName.split(' ')[0] || 'friend';
    try {
      const checkPrompt = `An author answered this question: "What specific transformation do you create in your reader's life?"

Their answer: "${raw}"

Does this answer clearly name BOTH:
1. WHERE the audience starts (a specific pain, struggle, or situation)
2. WHERE they end up (a specific outcome or result)

Example of SPECIFIC enough: "going from super stressed and overwhelmed to calm, focused, and in control of their time"
Example of NOT specific enough: "I help people feel better" or "I help entrepreneurs grow" or "I provide tools for success"

Reply with ONLY "SPECIFIC" if it meets the bar.
Reply with "NUDGE" if it is too vague or missing a clear before/after. On the next line, write a warm 1-2 sentence message to ${fn} asking them to go deeper - include a short tailored example based on their book topic. Be conversational, like Athena talking to them directly — warm, wise, and genuinely encouraging. Do not use a header or label.`;

      const result = await callClaude(checkPrompt);
      const firstLine = result.trim().split('\n')[0].trim().toUpperCase();
      if (firstLine === 'SPECIFIC') {
        await handleRephrase(raw);
      } else {
        const lines = result.trim().split('\n');
        const nudge = lines.slice(1).join('\n').trim() ||
          `Can you be more specific about the before AND after, ${fn}? For example: "going from [their specific struggle] to [their specific result]." What does life really look like for someone before and after reading your book?`;
        setNudgeMessage(nudge);
        setRephrasePhase('nudge');
        setLoading(false);
      }
    } catch {
      await handleRephrase(raw);
    }
  };

  const handleRephrase = async (raw: string, raw2?: string) => {
    setError('');
    setRephrasePhase('rephrasing');
    setLoading(true);
    const fn = s.fullName.split(' ')[0] || 'the author';
    try {
      // currentKey is the DISPLAY key - see mapping above
      let prompt = '';
      if (currentKey === 'links') {
        // Ideal reader question is shown at the 'links' step
        prompt = `${fn} described their ideal reader in detail:

Person: "${raw}"
Their problem: "${raw2 || ''}"

Take the best specific details and rephrase into 2-3 vivid sentences that paint a crystal-clear picture of this exact person and what they're struggling with. Be so specific they'd see themselves immediately. No label or header, just the rephrased version.`;
      } else if (currentKey === 'transformation') {
        // Transformation question is shown at the 'transformation' step
        prompt = `${fn} just described the transformation they create:

"${raw}"

Rephrase this as a powerful 2-3 sentence statement in THEIR voice. Lead with where the audience starts (the before), end with where they arrive (the after). Make it vivid and emotionally resonant. No label or header, just the rephrased version.`;
      } else if (currentKey === 'whyWroteBook') {
        // "Why did you write this book?" is shown at the 'whyWroteBook' step
        prompt = `${fn} shared why they wrote their book:

"${raw}"

Pull out the most compelling part. Rephrase in 2-3 sentences that feel personal and real - like they're telling it on a stage. Their voice, just sharper. No label or header, just the rephrased version.`;
      } else if (currentKey === 'idealAudience') {
        // Book description question is shown at the 'idealAudience' step
        prompt = `${fn} described their book:

Book: "${raw}"
Unique angle: "${raw2 || ''}"

Rephrase into 2-3 punchy sentences: what the book does AND why it's the only one like it. Compelling enough to make someone buy it today. No label or header, just the rephrased version.`;
      } else if (currentKey === 'voiceDescriptors') {
        // Success goals question is shown at the 'voiceDescriptors' step
        prompt = `${fn} described their vision of success:

"${raw}"

Rephrase into 1-2 bold, specific sentences naming their real goal. Ambitious and clear. No label or header, just the rephrased version.`;
      }
      if (!prompt) throw new Error(`No prompt matched for key: ${currentKey}`);
      const result = await callClaude(prompt);
      setRephrased(result.trim());
      setRephrasePhase('review');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
      setRephrasePhase('input');
    } finally {
      setLoading(false);
    }
  };

  const approveRephrase = () => {
    // Key = what's currently displayed; save to the field that matches the question shown
    if (currentKey === 'links') updateSession({ idealAudience: rephrased, audienceProblem: inputVal2 });
    else if (currentKey === 'transformation') updateSession({ transformation: rephrased });
    else if (currentKey === 'whyWroteBook') updateSession({ whyWroteBook: rephrased });
    else if (currentKey === 'idealAudience') updateSession({ bookDescription: inputVal, uniqueApproach: inputVal2 });
    else if (currentKey === 'voiceDescriptors') updateSession({ successGoals: rephrased });
    advance();
  };

  const submitAnswer = () => {
    if (!inputVal.trim()) return;
    if (REPHRASE_KEYS.includes(currentKey)) {
      if ((currentKey === 'links' || currentKey === 'idealAudience') && !inputVal2.trim()) return;
      if (currentKey === 'transformation') {
        // Transformation question - check specificity first
        updateSession({ transformation: inputVal });
        checkTransformationSpecificity(inputVal);
        return;
      }
      if (currentKey === 'links') updateSession({ idealAudience: inputVal, audienceProblem: inputVal2 });
      else if (currentKey === 'whyWroteBook') updateSession({ whyWroteBook: inputVal });
      else if (currentKey === 'idealAudience') updateSession({ bookDescription: inputVal, uniqueApproach: inputVal2 });
      else if (currentKey === 'voiceDescriptors') updateSession({ successGoals: inputVal });
      handleRephrase(inputVal, inputVal2 || undefined);
    } else {
      if (currentKey === 'fullName') updateSession({ fullName: inputVal });
      else if (currentKey === 'email') updateSession({ email: inputVal });
      else if (currentKey === 'bookTitle') updateSession({ bookTitle: inputVal });
      advance();
    }
  };

  const generateSummary = async () => {
    setLoading(true);
    setError('');
    try {
      const prompt = `Write a warm, personal 2-3 paragraph message directly to ${s.fullName.split(' ')[0]}, summarizing what you've learned about them. Speak as Athena, the Author Authority AI Advocate at The Published Life — wise, warm, genuinely excited. Celebrate what makes them and their work powerful. Be specific to their actual details. End with "Are you ready to build something incredible together?"

What you know:
- Name: ${s.fullName}, Book: "${s.bookTitle}"
- Ideal reader: ${s.idealAudience} - problem: ${s.audienceProblem}
- Transformation: ${s.transformation}
- Why they wrote it: ${s.whyWroteBook}
- Unique approach: ${s.uniqueApproach}
- Voice: Formal to Casual ${s.toneSpectrum.formalCasual}/5, Serious to Lighthearted ${s.toneSpectrum.seriousLighthearted}/5
- Voice words: ${s.additionalVoiceDescriptors || 'not specified'}
- Success vision: ${s.successGoals}
- Platforms: ${s.platforms.join(', ') || 'not selected'}`;
      const result = await callClaude(prompt);
      setSummaryText(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate summary.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if ((currentKey === 'platforms' || currentKey === 'summary') && !summaryText) generateSummary();
  }, [currentKey]);

  const btnPrimary = "w-full py-2.5 rounded-xl bg-[#b4887a] text-white text-sm font-semibold hover:bg-[#a07368] transition-colors disabled:opacity-40 flex items-center justify-center gap-2";

  const renderQuestion = () => {
    switch (currentKey) {

      case 'welcome':
        return <>
          <AthenaBubble text="Hi! I'm Athena, the Author Authority AI Advocate here at The Published Life. I work alongside Mariah French to help non-fiction authors discover their complete personal brand identity." />
          <AthenaBubble text="While I guide you through this discovery process, Mariah is here to implement everything we create together and help you position yourself as the thought leader you're meant to be." />
          <AthenaBubble text="Let's build your brand! First - what's your full name?" />
          <div className="ml-12">
            <input ref={inputRef} type="text" className={inputCls} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && inputVal.trim()) { updateSession({ fullName: inputVal }); advance(); } }} placeholder="Your full name..." />
            <button onClick={() => { if (!inputVal.trim()) return; updateSession({ fullName: inputVal }); advance(); }} disabled={!inputVal.trim()} className={btnPrimary + ' mt-3'}>
              <ArrowRight size={15} /> Continue
            </button>
          </div>
        </>;

      case 'fullName':
        return <>
          <AthenaBubble text={`${firstName || 'Wonderful'} - I love that name! What's your email address? I'll use this for your brand workbook.`} />
          <div className="ml-12">
            <input ref={inputRef} type="email" className={inputCls} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && inputVal.trim()) { updateSession({ email: inputVal }); advance(); } }} placeholder="your@email.com" />
            <button onClick={() => { if (!inputVal.trim()) return; updateSession({ email: inputVal }); advance(); }} disabled={!inputVal.trim()} className={btnPrimary + ' mt-3'}>
              <ArrowRight size={15} /> Continue
            </button>
          </div>
        </>;

      case 'email':
        return <>
          <AthenaBubble text={`Got it! I'm already excited to see where this goes. What's the title of your book, ${firstName}?`} />
          <div className="ml-12">
            <input ref={inputRef} type="text" className={inputCls} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && inputVal.trim()) { updateSession({ bookTitle: inputVal }); advance(); } }} placeholder="Your book's full title..." />
            <button onClick={() => { if (!inputVal.trim()) return; updateSession({ bookTitle: inputVal }); advance(); }} disabled={!inputVal.trim()} className={btnPrimary + ' mt-3'}>
              <ArrowRight size={15} /> Continue
            </button>
          </div>
        </>;

      case 'bookTitle':
        return <>
          <AthenaBubble text={`"${s.bookTitle}" — I love it! One quick question before we dive in: how do you identify?`} />
          <div className="ml-12 grid grid-cols-2 gap-3">
            {['Female', 'Male'].map(opt => (
              <button key={opt} onClick={() => { updateSession({ gender: opt }); advance(); }}
                className="py-3 rounded-xl border border-[#b4887a]/30 bg-white text-sm text-[#242e1c] font-medium hover:bg-[#b4887a]/10 hover:border-[#b4887a] transition-all">
                {opt}
              </button>
            ))}
          </div>
        </>;

      case 'gender':
        return <>
          <AthenaBubble text="Optional but really helpful - do you have an Amazon listing or website? Sharing links lets me see your existing presence and tailor everything more precisely. Skip if you don't have these yet - no pressure!" />
          <div className="ml-12 space-y-3">
            <input type="text" className={inputCls} value={s.amazonLink} onChange={e => updateSession({ amazonLink: e.target.value })} placeholder="Amazon book link (optional)" />
            <input type="text" className={inputCls} value={s.websiteUrl} onChange={e => updateSession({ websiteUrl: e.target.value })} placeholder="Your website URL (optional)" />
            <button onClick={advance} className={btnPrimary}>
              <ChevronRight size={15} /> {s.amazonLink || s.websiteUrl ? "Got it, let's continue" : "Skip for now"}
            </button>
          </div>
        </>;

      case 'links':
        return <>
          <AthenaBubble text={`${firstName}, before we talk about your book - let's start with WHO needs it most. This is the most important question in branding, so I want you to really sit with it.`} />
          <AthenaBubble text="Think of one specific, real person in your life who desperately needs what you teach. Picture them completely - almost like you're watching a movie of their day." />
          <AthenaBubble text="Describe them in detail: How old are they? Where do they live? What does their daily life look like? What keeps them up at 2am? What are they secretly dreaming about but afraid to pursue?" />
          {rephrasePhase === 'input' && <>
            <div className="ml-12 mb-4">
              <label className="block text-xs font-semibold text-[#242e1c]/50 uppercase tracking-wide mb-2">Describe this specific person</label>
              <textarea className={textareaCls} rows={3} value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="e.g. A woman in her 40s living in the suburbs, two kids, stuck in a corporate job she hates, secretly dreaming of starting her own business but paralyzed by fear and self-doubt..." autoFocus />
            </div>
            <AthenaBubble text="Good. Now - what is their single biggest struggle or pain point that your book directly addresses? Be specific." />
            <div className="ml-12">
              <textarea className={textareaCls} rows={2} value={inputVal2} onChange={e => setInputVal2(e.target.value)} placeholder="Their biggest struggle or what keeps them stuck..." />
              <button onClick={submitAnswer} disabled={!inputVal.trim() || !inputVal2.trim()} className={btnPrimary + ' mt-3'}><ArrowRight size={15} /> That's my reader</button>
            </div>
          </>}
          {rephrasePhase === 'rephrasing' && loading && <div className="ml-12"><LoadingSpinner message="Clarifying your ideal reader..." /></div>}
          {rephrasePhase === 'review' && rephrased && <>
            <AuthorBubble text={`${inputVal} / Struggle: ${inputVal2}`} />
            <RephrasedBubble rephrased={rephrased} onApprove={approveRephrase} onAdjust={() => setRephrasePhase('input')} authorName={s.fullName} />
          </>}
        </>;

      case 'transformation':
        return <>
          <AthenaBubble text={`This is such an important question, ${firstName} - the one that becomes the heartbeat of your entire brand.`} />
          <AthenaBubble text="What transformation do you create in your reader's life? I want the BEFORE and the AFTER. Where do they start, and where do they end up because of your book?" />
          <AthenaBubble text={`Think deeply about the specific pain they're in before your book - and the specific outcome or feeling they have after. For example: "They go from overwhelmed and stuck in their career to confident, clear, and making bold moves." That level of specificity is what makes brands unforgettable.`} />
          {rephrasePhase === 'input' && <div className="ml-12">
            <textarea className={textareaCls} rows={4} value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="They go from [specific struggle / where they are before] to [specific result / where they end up after]..." autoFocus />
            <button onClick={submitAnswer} disabled={!inputVal.trim()} className={btnPrimary + ' mt-3'}><ArrowRight size={15} /> That's my transformation</button>
          </div>}
          {(rephrasePhase === 'checking' || rephrasePhase === 'rephrasing') && loading && <div className="ml-12"><LoadingSpinner message={rephrasePhase === 'checking' ? 'Checking your answer...' : 'Athena is listening and reflecting back...'} /></div>}
          {rephrasePhase === 'nudge' && nudgeMessage && <>
            <AuthorBubble text={inputVal} />
            <AthenaBubble text={nudgeMessage} />
            <div className="ml-12">
              <textarea className={textareaCls} rows={4} value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="They go from [specific struggle] to [specific result]..." autoFocus />
              <button onClick={() => { updateSession({ transformation: inputVal }); checkTransformationSpecificity(inputVal); }} disabled={!inputVal.trim()} className={btnPrimary + ' mt-3'}><ArrowRight size={15} /> That's my transformation</button>
            </div>
          </>}
          {rephrasePhase === 'review' && rephrased && <>
            <AuthorBubble text={inputVal} />
            <RephrasedBubble rephrased={rephrased} onApprove={approveRephrase} onAdjust={() => setRephrasePhase('input')} authorName={s.fullName} />
          </>}
        </>;

      case 'whyWroteBook':
        return <>
          <AthenaBubble text={`That's powerful, ${firstName}. Honestly, I love your clarity - you know exactly what you do. Now I want to go a layer deeper.`} />
          <AthenaBubble text="Why did YOU write this book? What personal experience, frustration, or turning point led you to put this into the world? The WHY is what makes readers feel connected to you as a person." />
          {rephrasePhase === 'input' && <div className="ml-12">
            <textarea className={textareaCls} rows={4} value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="Tell me your story..." autoFocus />
            <button onClick={submitAnswer} disabled={!inputVal.trim()} className={btnPrimary + ' mt-3'}><ArrowRight size={15} /> That's my story</button>
          </div>}
          {rephrasePhase === 'rephrasing' && loading && <div className="ml-12"><LoadingSpinner message="Finding the gold in your story..." /></div>}
          {rephrasePhase === 'review' && rephrased && <>
            <AuthorBubble text={inputVal} />
            <RephrasedBubble rephrased={rephrased} onApprove={approveRephrase} onAdjust={() => setRephrasePhase('input')} authorName={s.fullName} />
          </>}
        </>;

      case 'idealAudience':
        return <>
          <AthenaBubble text={`I absolutely love where you're going with this. Your reader is going to be so grateful this book exists. Now tell me about "${s.bookTitle}" itself.`} />
          <AthenaBubble text="Give me a quick description - genre, main topics, what it actually walks people through." />
          {rephrasePhase === 'input' && <>
            <div className="ml-12 mb-4">
              <textarea className={textareaCls} rows={3} value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="About the book..." autoFocus />
            </div>
            <AthenaBubble text="Now the part I get most excited about - what makes YOUR approach different? There are thousands of books. What's your unique angle, framework, or perspective that nobody else brings to this?" />
            <div className="ml-12">
              <textarea className={textareaCls} rows={3} value={inputVal2} onChange={e => setInputVal2(e.target.value)} placeholder="My unique angle is..." />
              <button onClick={submitAnswer} disabled={!inputVal.trim() || !inputVal2.trim()} className={btnPrimary + ' mt-3'}><ArrowRight size={15} /> That's what makes me different</button>
            </div>
          </>}
          {rephrasePhase === 'rephrasing' && loading && <div className="ml-12"><LoadingSpinner message="Positioning your book..." /></div>}
          {rephrasePhase === 'review' && rephrased && <>
            <AuthorBubble text={`Book: ${inputVal} / Unique: ${inputVal2}`} />
            <RephrasedBubble rephrased={rephrased} onApprove={approveRephrase} onAdjust={() => setRephrasePhase('input')} authorName={s.fullName} />
          </>}
        </>;

      case 'bookDescription':
        return <>
          <AthenaBubble text="I love that you know exactly what sets you apart - that clarity is going to make your brand so strong. Now I want to capture how you sound." />
          <AthenaBubble text="How do you naturally show up when you're talking to people? There's no right or wrong answer here - just be honest and move each slider to where you feel most YOU." />
          <div className="ml-12 bg-white rounded-2xl border border-[#b4887a]/20 p-5 mb-4">
            <ToneSlider leftLabel="Formal" rightLabel="Casual" value={s.toneSpectrum.formalCasual} onChange={v => updateSession({ toneSpectrum: { ...s.toneSpectrum, formalCasual: v } })} />
            <ToneSlider leftLabel="Educational" rightLabel="Conversational" value={s.toneSpectrum.educationalConversational} onChange={v => updateSession({ toneSpectrum: { ...s.toneSpectrum, educationalConversational: v } })} />
            <ToneSlider leftLabel="Serious" rightLabel="Lighthearted" value={s.toneSpectrum.seriousLighthearted} onChange={v => updateSession({ toneSpectrum: { ...s.toneSpectrum, seriousLighthearted: v } })} />
            <ToneSlider leftLabel="Direct" rightLabel="Gentle" value={s.toneSpectrum.directGentle} onChange={v => updateSession({ toneSpectrum: { ...s.toneSpectrum, directGentle: v } })} />
            <ToneSlider leftLabel="Inspirational" rightLabel="Practical" value={s.toneSpectrum.inspirationalPractical} onChange={v => updateSession({ toneSpectrum: { ...s.toneSpectrum, inspirationalPractical: v } })} />
          </div>
          <div className="ml-12">
            <button onClick={advance} className={btnPrimary}><ArrowRight size={15} /> That's my natural voice</button>
          </div>
        </>;

      case 'toneSpectrum':
        return <>
          <AthenaBubble text="I love it - your voice is already coming through so clearly! Are there any specific words you'd use to describe how you communicate? Things like 'warm', 'no-nonsense', 'vulnerable', 'data-driven', 'storytelling', 'academic but human'..." />
          <AthenaBubble text="This is optional - skip if nothing comes to mind right now. But if a word lands, I want to hear it!" />
          <div className="ml-12">
            <input ref={inputRef} type="text" className={inputCls} value={inputVal} onChange={e => setInputVal(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { updateSession({ additionalVoiceDescriptors: inputVal }); advance(); } }} placeholder="e.g. warm, direct, storytelling..." />
            <button onClick={() => { updateSession({ additionalVoiceDescriptors: inputVal }); advance(); }} className={btnPrimary + ' mt-3'}>
              <ChevronRight size={15} /> {inputVal.trim() ? 'Got it, continue' : 'Skip'}
            </button>
          </div>
        </>;

      case 'voiceDescriptors':
        return <>
          <AthenaBubble text={`${firstName}, we're almost there - and this question is one I really want you to sit with. What does success actually look like for you? Not just "sell books" - I mean the real vision. Speaking on big stages? A flood of media inquiries? A full coaching practice? Building a movement? Tell me exactly what you're building toward.`} />
          {rephrasePhase === 'input' && <div className="ml-12">
            <textarea className={textareaCls} rows={3} value={inputVal} onChange={e => setInputVal(e.target.value)} placeholder="My vision of success is..." autoFocus />
            <button onClick={submitAnswer} disabled={!inputVal.trim()} className={btnPrimary + ' mt-3'}><ArrowRight size={15} /> That's my vision</button>
          </div>}
          {rephrasePhase === 'rephrasing' && loading && <div className="ml-12"><LoadingSpinner message="Crystalizing your vision..." /></div>}
          {rephrasePhase === 'review' && rephrased && <>
            <AuthorBubble text={inputVal} />
            <RephrasedBubble rephrased={rephrased} onApprove={approveRephrase} onAdjust={() => setRephrasePhase('input')} authorName={s.fullName} />
          </>}
        </>;

      case 'successGoals':
        return <>
          <AthenaBubble text="Almost there - and you've given me so much incredible material to work with! Last thing: where do you want to build your audience? Select the platforms you're already on or interested in. We'll narrow it down to your best two in the next step." />
          <div className="ml-12">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {PLATFORMS_LIST.map(p => (
                <label key={p} className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border cursor-pointer transition-all text-sm font-medium ${
                  s.platforms.includes(p)
                    ? 'bg-[#242e1c] border-[#242e1c] text-white'
                    : 'border-[#b4887a]/25 text-[#242e1c]/70 hover:border-[#b4887a]/60 bg-white'
                }`}>
                  <input type="checkbox" className="sr-only" checked={s.platforms.includes(p)} onChange={e => {
                    const updated = e.target.checked ? [...s.platforms, p] : s.platforms.filter(x => x !== p);
                    updateSession({ platforms: updated });
                  }} />
                  {p}
                </label>
              ))}
            </div>
            <button onClick={advance} className={btnPrimary}>
              <ChevronRight size={15} /> {s.platforms.length > 0 ? `I'm on ${s.platforms.length} platform${s.platforms.length > 1 ? 's' : ''}` : "I'll decide later"}
            </button>
          </div>
        </>;

      case 'platforms':
      case 'summary':
        return <>
          {loading && <LoadingSpinner message="Athena is putting together your brand picture..." />}
          {error && <ErrorMessage message={error} onRetry={generateSummary} />}
          {summaryText && !loading && <>
            <AthenaBubble text={summaryText} />
            <div className="ml-12 flex flex-col gap-3">
              <button onClick={() => { updateSession({ discoveryApproved: true }); onComplete(); }}
                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-[#242e1c] text-white text-sm font-bold hover:bg-[#1a2214] transition-colors">
                <CheckCircle size={16} /> Yes, let's build my brand!
              </button>
              <button onClick={() => setShowRevise(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-[#b4887a]/40 text-[#242e1c] text-sm font-medium hover:bg-[#b4887a]/10 transition-colors">
                <Edit2 size={14} /> Revise an Answer
              </button>
            </div>
          </>}

          {showRevise && (
            <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#3F3F3F]/40 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#3F3F3F] text-base">Which answer would you like to revise?</h3>
                  <button onClick={() => setShowRevise(false)} className="text-[#3F3F3F]/40 hover:text-[#3F3F3F]"><X size={18} /></button>
                </div>
                <div className="space-y-2">
                  {REVISE_OPTIONS.map(opt => (
                    <button
                      key={opt.index}
                      onClick={() => { setQuestionIndex(opt.index); setSummaryText(''); setShowRevise(false); }}
                      className="w-full text-left px-4 py-3 rounded-xl border border-[#b4887a]/25 text-sm text-[#3F3F3F] hover:bg-[#b4887a]/10 hover:border-[#b4887a] transition-all"
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>;

      default:
        return null;
    }
  };

  return (
    <div className="fade-in pb-4">
      {questionIndex > 1 && (
        <div className="mb-6 space-y-1.5">
          {QUESTION_ORDER.slice(1, questionIndex).map((key, i) => {
            let preview = '';
            if (key === 'fullName' && s.fullName) preview = `Name: ${s.fullName}`;
            else if (key === 'email' && s.email) preview = `Email: ${s.email}`;
            else if (key === 'bookTitle' && s.bookTitle) preview = `Book: "${s.bookTitle}"`;
            else if (key === 'gender' && s.gender) preview = `Gender: ${s.gender}${s.amazonLink || s.websiteUrl ? ' - Links added' : ''}`;
            else if (key === 'links' && s.idealAudience) preview = `Ideal Reader: ${s.idealAudience.slice(0, 60)}...`;
            else if (key === 'transformation' && s.transformation) preview = `Transformation: ${s.transformation.slice(0, 60)}...`;
            else if (key === 'whyWroteBook' && s.whyWroteBook) preview = `Why: ${s.whyWroteBook.slice(0, 60)}...`;
            else if (key === 'idealAudience' && s.bookDescription) preview = `Book: ${s.bookDescription.slice(0, 60)}...`;
            else if (key === 'bookDescription') preview = 'Voice spectrum set';
            else if (key === 'toneSpectrum' && s.additionalVoiceDescriptors) preview = `Voice: "${s.additionalVoiceDescriptors}"`;
            else if (key === 'voiceDescriptors' && s.successGoals) preview = `Vision: ${s.successGoals.slice(0, 60)}...`;
            else if (key === 'successGoals' && s.platforms.length > 0) preview = `Platforms: ${s.platforms.join(', ')}`;
            if (!preview) return null;
            return (
              <div key={key} className="flex items-center gap-2 text-xs text-[#242e1c]/40 px-1">
                <span className="flex-1 truncate">{preview}</span>
                <button onClick={() => setQuestionIndex(i + 1)} className="text-[#b4887a] hover:text-[#a07368] ml-2 whitespace-nowrap">edit</button>
              </div>
            );
          })}
          <div className="border-t border-[#b4887a]/10 my-3" />
        </div>
      )}

      {renderQuestion()}

      {error && rephrasePhase !== 'review' && (
        <div className="ml-12"><ErrorMessage message={error} /></div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
