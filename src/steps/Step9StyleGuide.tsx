import { useState, useRef, useEffect } from 'react'; // useRef kept for fetchedFor
import type { SessionData } from '../types';
import OutputCard from '../components/OutputCard';
import ApprovalButtons from '../components/ApprovalButtons';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage'; // used in output section
import { callClaude, callClaudeWithImage } from '../utils/claude';
import { searchOutfitPhotos } from '../utils/unsplash';
import type { UnsplashPhoto } from '../utils/unsplash';
import { RefreshCw, ExternalLink } from 'lucide-react';

interface Props {
  session: SessionData;
  updateSession: (u: Partial<SessionData>) => void;
  onComplete: () => void;
}

interface OutfitCard {
  name: string;
  occasion: string;
  outfit: string;
  why: string;
  shopAt: string;
}


function parseOutfits(text: string): OutfitCard[] {
  const outfits: OutfitCard[] = [];
  const blocks = text.split(/(?=OUTFIT NAME:)/i).filter(b => b.includes('OUTFIT NAME:'));
  for (const block of blocks) {
    const nameMatch = block.match(/OUTFIT NAME:\s*([^\n]+)/i);
    const occasionMatch = block.match(/OCCASION:\s*([^\n]+)/i);
    const outfitMatch = block.match(/THE OUTFIT:\s*([^\n]+(?:\n(?!OCCASION:|WHY THIS WORKS:|SHOP AT:)[^\n]+)*)/i);
    const whyMatch = block.match(/WHY THIS WORKS:\s*([^\n]+)/i);
    const shopMatch = block.match(/SHOP AT:\s*([^\n]+)/i);
    if (nameMatch) {
      outfits.push({
        name: nameMatch[1].trim().replace(/^["']|["']$/g, ''),
        occasion: occasionMatch ? occasionMatch[1].trim() : '',
        outfit: outfitMatch ? outfitMatch[1].trim() : '',
        why: whyMatch ? whyMatch[1].trim() : '',
        shopAt: shopMatch ? shopMatch[1].trim() : '',
      });
    }
  }
  return outfits.slice(0, 4);
}

function parseSection(text: string, label: string): string {
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
}

const hasUnsplashKey = !!import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

export default function Step9StyleGuide({ session, updateSession, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [outfitPhotos, setOutfitPhotos] = useState<Record<string, UnsplashPhoto[]>>({});
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const fetchedFor = useRef('');
  const s = session;

  const photos = s.stylePhotos || (s.stylePhotoBase64 ? [s.stylePhotoBase64] : []);

  const fetchPhotos = async (outputText: string) => {
    if (!hasUnsplashKey) return;
    const fingerprint = outputText.slice(0, 80);
    if (fingerprint === fetchedFor.current) return;
    fetchedFor.current = fingerprint;
    setLoadingPhotos(true);
    try {
      const outfitList = parseOutfits(outputText);
      if (!outfitList.length) return;
      const results = await Promise.allSettled(
        outfitList.map(o => searchOutfitPhotos(o, s.gender, 2))
      );
      const map: Record<string, UnsplashPhoto[]> = {};
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.length > 0) {
          map[outfitList[i].name] = r.value;
        }
      });
      setOutfitPhotos(map);
      // Persist first photo per outfit to session for PDF embedding
      updateSession({
        outfitPhotoData: outfitList.map(o => {
          const photos = map[o.name];
          if (photos && photos.length > 0) {
            return { url: photos[0].smallUrl, credit: photos[0].photographer };
          }
          return null;
        }),
      });
    } catch {
      // silently skip - photos are supplemental
    } finally {
      setLoadingPhotos(false);
    }
  };

  // Fetch photos on mount if output already exists (loaded from localStorage)
  useEffect(() => {
    if (session.styleGuideOutput) {
      fetchPhotos(session.styleGuideOutput);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const generate = async (feedbackNote = '') => {
    setError('');
    setLoading(true);
    setFeedback('');
    setOutfitPhotos({});
    fetchedFor.current = '';
    try {
      const styleContext = `
AUTHOR: ${s.fullName} (${s.gender})
BOOK AND BRAND: "${s.bookTitle}" - ${s.transformation}
AUDIENCE: ${s.idealAudience}

THEIR APPROVED BRAND COLOR PALETTE (these exact hex codes must be the foundation of ALL clothing color recommendations):
- Primary brand color: ${s.brandColors.primary}
- Secondary brand color: ${s.brandColors.secondary}
- Accent brand color: ${s.brandColors.accent}

THEIR STYLE PREFERENCES:
- Day-to-day wear: ${s.dayToDay}
- Feels most confident in: ${s.mostConfident}
- Typical style: ${s.typicalStyle}
- Avoids: ${s.avoidWearing}
- Comfort with color: ${s.comfortWithColor}
- Fit preference: ${s.fitPreference}
${s.favoriteColor.trim() ? `- Favorite color: ${s.favoriteColor}` : ''}`;

      const prompt = `Create a Personal Brand Style Guide for this non-fiction author. The style guide must be built on top of their approved brand color palette — the clothing colors must match and extend those exact colors.

${styleContext}

CRITICAL COLOR RULE: Every color recommendation in this style guide must come from or harmonize with their brand palette (${s.brandColors.primary}, ${s.brandColors.secondary}, ${s.brandColors.accent}). Do not invent colors from scratch. Translate their brand palette into wearable clothing colors. This ensures their visual brand is consistent from their website to what they wear in photos.

IMPORTANT RULES:
- No makeup, jewelry, or accessories recommendations. Clothing only.
- Do not include Pinterest search suggestions or shopping search terms.
- Every outfit description should be specific enough to visualize clearly.
- Keep all recommendations practical and immediately usable.
- At least one outfit formula must feature the primary brand color as a key clothing piece.
- At least one outfit formula must feature the secondary brand color.
- The accent color should appear as a statement piece in at least one outfit.
${feedbackNote.trim() ? `\nUSER FEEDBACK FOR THIS REVISION:\n${feedbackNote}\nIncorporate this feedback.\n` : ''}

Generate using ALL CAPS headers:

YOUR COLORS TO WEAR:
Translate their brand palette into wearable clothing colors. Start with the three brand colors, then add 2-3 compatible neutrals and harmonizing additions that work WITH those specific colors.

Use this EXACT two-line format for every color — color name and hex code on line 1, description on line 2, blank line between colors:

BRAND PALETTE COLORS TO WEAR:
[Descriptive color name for ${s.brandColors.primary}] (#${s.brandColors.primary.replace('#', '')})
[One sentence: how to wear this brand color in clothing and what it communicates]

[Descriptive color name for ${s.brandColors.secondary}] (#${s.brandColors.secondary.replace('#', '')})
[One sentence explanation]

[Descriptive color name for ${s.brandColors.accent}] (#${s.brandColors.accent.replace('#', '')})
[One sentence explanation]

COMPATIBLE ADDITIONS:
[Neutral or harmonizing color name] (#HEXCODE)
[One sentence explaining why this pairs with their brand palette]

[Neutral or harmonizing color name] (#HEXCODE)
[One sentence explanation]

COLORS TO AVOID:
[Colors that clash with their specific brand palette and why — no hex codes here]

OUTFIT FORMULAS:
Write exactly 4 outfit formulas. Each must incorporate at least one brand palette color in a key piece. For EACH outfit use this EXACT format:

OUTFIT NAME: [give it an evocative name like "The Speaking Stage Look"]
OCCASION: [when to wear this]
THE OUTFIT: [specific pieces with colors drawn from their brand palette - e.g., "tailored blazer in deep forest green (primary brand color), cream fitted top, slim-cut charcoal trousers"]
WHY THIS WORKS: [one sentence connecting it to their brand and the palette]
SHOP AT: [2-3 specific store names where they can find these pieces, e.g., "Banana Republic, J.Crew, ASOS"]

STYLING FOR KEY SITUATIONS:
Speaking engagements: [specific guidance incorporating their brand colors]
Video and Podcast appearances: [specific guidance]
Social media photos: [specific guidance]
Client meetings and Zoom calls: [specific guidance]

YOUR BRAND STYLE IN A NUTSHELL:
One paragraph capturing their overall brand style direction and how their clothing palette connects to their brand identity.`;

      let result: string;
      if (photos.length > 0) {
        const fullPrompt = `${prompt}\n\nPhoto(s) of the author have been provided for style reference. Use them to inform clothing silhouette and style recommendations. You may reference what you observe about their skin tone and natural coloring to make specific clothing color recommendations that are most flattering. Do not describe body shape or facial features beyond what directly informs clothing color choices.`;
        result = await callClaudeWithImage(fullPrompt, photos[0], 'image/jpeg');
      } else {
        result = await callClaude(prompt + '\n\nNo photo provided - base all recommendations only on their stated preferences and overall brand feel. Do not assume or name specific physical features.');
      }
      updateSession({ styleGuideOutput: result });
      fetchPhotos(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate style guide.');
    } finally {
      setLoading(false);
    }
  };

  const colorSection = parseSection(session.styleGuideOutput || '', 'YOUR COLORS TO WEAR');
  const situationsSection = parseSection(session.styleGuideOutput || '', 'STYLING FOR KEY SITUATIONS');
  const nutshellSection = parseSection(session.styleGuideOutput || '', 'YOUR BRAND STYLE IN A NUTSHELL');
  const outfits = session.styleGuideOutput ? parseOutfits(session.styleGuideOutput) : [];

  // Parse the two-line color format: "Color Name (#HEXCODE)" on one line, description on the next
  const parseWearableColors = (text: string): Array<{ name: string; hex: string; description: string }> => {
    const colors: Array<{ name: string; hex: string; description: string }> = [];
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const hexMatch = line.match(/^([A-Za-z][A-Za-z\s\-]+?)\s*\(#([0-9A-Fa-f]{6})\)\s*$/);
      if (hexMatch) {
        const name = hexMatch[1].trim().replace(/^[-,\s•]+|[-,\s]+$/g, '');
        const hex = '#' + hexMatch[2];
        const nextLine = lines[i + 1]?.trim() || '';
        const description = nextLine && !nextLine.match(/^[A-Z]/) ? nextLine : '';
        if (name.length > 1) colors.push({ name, hex, description });
      }
    }
    return colors;
  };
  const wearableColors = colorSection ? parseWearableColors(colorSection) : [];

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Personal Brand Style Guide</h1>
        <p className="text-[#3F3F3F]/60 text-sm">Outfit formulas built on your exact brand colors — so your wardrobe and visual brand work together.</p>
      </div>

      {/* Generate button shown before first generation */}
      {!session.styleGuideOutput && !loading && (
        <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5">
          <p className="text-sm text-[#3F3F3F]/70 mb-4">Your style guide will be built using your approved brand colors and the style preferences you shared. Each outfit formula will incorporate your brand palette colors.</p>
          <button
            onClick={() => generate()}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#b4887a] text-white font-semibold hover:bg-[#a07368] transition-colors disabled:opacity-50"
          >
            Create My Style Guide
          </button>
        </div>
      )}

      {loading && <LoadingSpinner message="Creating your personalized style guide..." />}
      {error && <ErrorMessage message={error} onRetry={() => generate()} />}

      {session.styleGuideOutput && !loading && (
        <>
          {/* Brand color reference */}
          {s.brandColors && (
            <div className="rounded-xl border border-[#b4887a]/20 bg-white p-5 mb-4">
              <p className="text-xs font-semibold text-[#3F3F3F]/50 uppercase tracking-wide mb-3">Your Brand Color Reference</p>
              <div className="flex gap-3">
                {[
                  { label: 'Primary', hex: s.brandColors.primary },
                  { label: 'Secondary', hex: s.brandColors.secondary },
                  { label: 'Accent', hex: s.brandColors.accent },
                ].map(({ label, hex }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg border border-[#b4887a]/20" style={{ backgroundColor: hex }} />
                    <div>
                      <p className="text-xs font-medium text-[#3F3F3F]">{label}</p>
                      <p className="text-xs text-[#3F3F3F]/40 font-mono">{hex}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Colors to wear — swatch + name + hex on one line, description below */}
          {colorSection && (
            <div className="rounded-xl border border-[#b4887a]/20 bg-[#fdf8f6] p-6 mb-4">
              <p className="font-bold text-[#3F3F3F] text-sm mb-4">Your Colors to Wear</p>
              {wearableColors.length > 0 ? (
                <div className="space-y-4 mb-4 pb-4 border-b border-[#b4887a]/15">
                  {wearableColors.map((c, i) => (
                    <div key={i}>
                      <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg border border-black/10 shadow-sm flex-shrink-0" style={{ backgroundColor: c.hex }} />
                        <span className="text-sm font-semibold text-[#3F3F3F]">{c.name}</span>
                        <span className="text-xs text-[#3F3F3F]/40 font-mono">{c.hex.toUpperCase()}</span>
                      </div>
                      {c.description && (
                        <p className="text-xs text-[#3F3F3F]/60 leading-relaxed pl-11">{c.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-[#3F3F3F]/70 leading-relaxed whitespace-pre-wrap">{colorSection}</p>
            </div>
          )}

          {/* Outfit formula cards */}
          {outfits.length > 0 ? (
            <div className="mb-4">
              <h3 className="font-bold text-[#3F3F3F] text-sm tracking-widest uppercase mb-3">Outfit Formulas</h3>
              <div className="space-y-5">
                {outfits.map((outfit, i) => {
                  const photos = outfitPhotos[outfit.name] || [];
                  const isLoadingThis = loadingPhotos && photos.length === 0;
                  return (
                    <div key={i} className="rounded-xl border border-[#b4887a]/20 bg-white overflow-hidden">
                      {/* Outfit text details */}
                      <div className="p-5">
                        <p className="font-bold text-[#b4887a] text-sm mb-1">{outfit.name}</p>
                        {outfit.occasion && (
                          <p className="text-xs text-[#3F3F3F]/50 mb-3 uppercase tracking-wide">{outfit.occasion}</p>
                        )}
                        {outfit.outfit && (
                          <p className="text-sm text-[#3F3F3F]/85 leading-relaxed mb-2">{outfit.outfit}</p>
                        )}
                        {outfit.why && (
                          <p className="text-xs text-[#3F3F3F]/60 italic mb-3">{outfit.why}</p>
                        )}
                        {outfit.shopAt && (
                          <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-[#b4887a]/10">
                            <span className="text-xs font-semibold text-[#3F3F3F]/40 uppercase tracking-wide">Shop at:</span>
                            <span className="text-xs text-[#b4887a]">{outfit.shopAt}</span>
                          </div>
                        )}
                      </div>

                      {/* Photo grid from Unsplash */}
                      {hasUnsplashKey && (
                        <>
                          {isLoadingThis ? (
                            <div className="border-t border-[#b4887a]/10 px-5 py-4">
                              <div className="grid grid-cols-2 gap-3">
                                {[0, 1].map(j => (
                                  <div key={j} className="h-44 rounded-lg bg-[#faf7f5] animate-pulse" />
                                ))}
                              </div>
                            </div>
                          ) : photos.length > 0 ? (
                            <div className="border-t border-[#b4887a]/10 px-5 pt-4 pb-5">
                              <p className="text-xs text-[#3F3F3F]/40 uppercase tracking-wide mb-2 font-medium">Style Inspiration</p>
                              <div className="grid grid-cols-2 gap-3">
                                {photos.map(photo => (
                                  <div key={photo.id} className="group relative">
                                    <a href={photo.pageUrl} target="_blank" rel="noopener noreferrer">
                                      <img
                                        src={photo.smallUrl}
                                        alt={photo.alt}
                                        className="w-full h-44 object-cover rounded-lg border border-[#b4887a]/10 group-hover:opacity-90 transition-opacity"
                                      />
                                    </a>
                                    <p className="mt-1 text-[10px] text-[#3F3F3F]/35 leading-snug">
                                      Photo by{' '}
                                      <a
                                        href={photo.photographerUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:text-[#b4887a] transition-colors"
                                      >
                                        {photo.photographer}
                                      </a>
                                      {' '}on{' '}
                                      <a
                                        href={`https://unsplash.com?${UTM}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline hover:text-[#b4887a] transition-colors"
                                      >
                                        Unsplash
                                      </a>
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Unsplash setup nudge - only shown when key is missing */}
              {!hasUnsplashKey && (
                <div className="mt-3 rounded-xl border border-[#b4887a]/15 bg-[#faf7f5] p-4 flex items-start gap-3">
                  <ExternalLink size={14} className="text-[#b4887a] mt-0.5 shrink-0" />
                  <p className="text-xs text-[#3F3F3F]/60 leading-relaxed">
                    Add a free{' '}
                    <a
                      href="https://unsplash.com/developers"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#b4887a] underline hover:text-[#a07368]"
                    >
                      Unsplash Access Key
                    </a>
                    {' '}to your <code className="bg-white border border-[#b4887a]/20 px-1 rounded text-[10px]">.env</code> file as{' '}
                    <code className="bg-white border border-[#b4887a]/20 px-1 rounded text-[10px]">VITE_UNSPLASH_ACCESS_KEY</code>
                    {' '}to show matching outfit photos for each formula.
                  </p>
                </div>
              )}
            </div>
          ) : (
            session.styleGuideOutput && <OutputCard title="Outfit Formulas" content={parseSection(session.styleGuideOutput, 'OUTFIT FORMULAS')} />
          )}

          {/* Styling for key situations */}
          {situationsSection && <OutputCard title="Styling for Key Situations" content={situationsSection} />}

          {/* Brand style in a nutshell */}
          {nutshellSection && <OutputCard title="Your Brand Style in a Nutshell" content={nutshellSection} highlight />}

          <div className="mt-6 pt-5 border-t border-[#b4887a]/20">
            <p className="text-xs text-[#3F3F3F]/50 mb-2 font-medium">Want to adjust something?</p>
            <textarea
              className="w-full rounded-xl border border-[#b4887a]/25 bg-white px-4 py-3 text-sm text-[#3F3F3F] placeholder:text-[#3F3F3F]/30 focus:outline-none focus:ring-2 focus:ring-[#b4887a]/25 resize-none"
              rows={2}
              value={feedback}
              onChange={e => setFeedback(e.target.value)}
              placeholder="e.g. I want more colorful options, the occasion descriptions don't fit my lifestyle..."
            />
            <button
              onClick={() => generate(feedback)}
              className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#b4887a]/40 text-[#3F3F3F] text-sm hover:bg-[#b4887a]/10 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate with Changes
            </button>
          </div>

          <ApprovalButtons
            question="Do these outfits feel like YOU?"
            onApprove={() => { updateSession({ styleGuideApproved: true }); onComplete(); }}
          />
        </>
      )}
    </div>
  );
}

const UTM = 'utm_source=author_authority_builder&utm_medium=referral';
