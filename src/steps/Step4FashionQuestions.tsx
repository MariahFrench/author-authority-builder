import { useRef, useState } from 'react';
import type { SessionData } from '../types';
import ErrorMessage from '../components/ErrorMessage';
import { Upload, X } from 'lucide-react';

interface Props {
  session: SessionData;
  updateSession: (u: Partial<SessionData>) => void;
  onComplete: () => void;
}

const inputCls = 'w-full rounded-lg border border-[#b4887a]/40 bg-white px-4 py-2.5 text-sm text-[#3F3F3F] focus:outline-none focus:ring-2 focus:ring-[#b4887a]/40 focus:border-[#b4887a] transition-colors placeholder:text-[#3F3F3F]/30';
const textareaCls = inputCls + ' resize-none';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-semibold text-[#3F3F3F] mb-1">{label}</label>
      {hint && <p className="text-xs text-[#3F3F3F]/50 mb-1.5">{hint}</p>}
      {children}
    </div>
  );
}

function compressImage(file: File, maxPx = 1568, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let w = img.naturalWidth;
      let h = img.naturalHeight;
      if (w > maxPx || h > maxPx) {
        const scale = Math.min(maxPx / w, maxPx / h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas unavailable')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image')); };
    img.src = url;
  });
}

export default function Step4FashionQuestions({ session, updateSession, onComplete }: Props) {
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const s = session;
  const photos = s.stylePhotos || [];

  const isReady = () => s.dayToDay.trim() && s.mostConfident.trim() && s.typicalStyle.trim() && s.fitPreference;

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (photos.length + files.length > 4) {
      setError('You can upload up to 4 photos.');
      e.target.value = '';
      return;
    }

    const oversized = files.find(f => f.size > 25 * 1024 * 1024);
    if (oversized) {
      setError(`"${oversized.name}" is too large — please use an image under 25 MB.`);
      e.target.value = '';
      return;
    }

    setError('');
    e.target.value = '';

    const compressed: string[] = [];
    for (const file of files) {
      try {
        const b64 = await compressImage(file);
        compressed.push(b64);
      } catch {
        setError(`Could not process "${file.name}". Try a different image format (JPG or PNG).`);
      }
    }
    if (compressed.length > 0) {
      updateSession({ stylePhotos: [...photos, ...compressed] });
    }
  };

  const removePhoto = (idx: number) => {
    const updated = [...photos];
    updated.splice(idx, 1);
    updateSession({ stylePhotos: updated });
  };

  return (
    <div className="fade-in">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#3F3F3F] mb-2">Your Style & Fashion Preferences</h1>
        <p className="text-[#3F3F3F]/60 text-sm">This information shapes your brand color palette and personal style guide — so your visual brand and wardrobe work together.</p>
      </div>

      <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5">
        <h2 className="font-bold text-[#3F3F3F] mb-1 text-base">Optional: Upload Photos (up to 4)</h2>
        <p className="text-xs text-[#3F3F3F]/50 mb-4">Photos of yourself help personalize color recommendations to your natural coloring and existing aesthetic. JPG or PNG, images are automatically resized.</p>

        {photos.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-4">
            {photos.map((p, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={`data:image/jpeg;base64,${p}`} alt={`Photo ${i + 1}`} className="w-20 h-20 rounded-lg object-cover border border-[#b4887a]/30" />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {photos.length < 4 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center gap-2 w-full border-2 border-dashed border-[#b4887a]/40 rounded-xl p-6 hover:border-[#b4887a] hover:bg-[#b4887a]/5 transition-all text-[#3F3F3F]/50"
          >
            <Upload size={22} />
            <span className="text-sm">{photos.length > 0 ? 'Add another photo' : 'Click to upload a photo (optional)'}</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoUpload} />
      </div>

      <div className="rounded-xl border border-[#b4887a]/20 bg-white p-6 mb-5">
        <h2 className="font-bold text-[#3F3F3F] mb-4 text-base">Your Style Preferences</h2>

        <Field label="What do you normally wear day-to-day? *" hint="e.g. jeans and a blazer, yoga pants, business casual...">
          <input className={inputCls} value={s.dayToDay} onChange={e => updateSession({ dayToDay: e.target.value })} placeholder="Describe your typical everyday outfit..." />
        </Field>

        <Field label="What makes you feel most confident? *">
          <input className={inputCls} value={s.mostConfident} onChange={e => updateSession({ mostConfident: e.target.value })} placeholder="e.g. A crisp blazer, comfortable flats, a great pair of trousers..." />
        </Field>

        <Field label="How would you describe your typical style? *">
          <textarea className={textareaCls} rows={2} value={s.typicalStyle} onChange={e => updateSession({ typicalStyle: e.target.value })} placeholder="e.g. Smart casual, minimalist, classic..." />
        </Field>

        <Field label="What do you avoid wearing?">
          <input className={inputCls} value={s.avoidWearing} onChange={e => updateSession({ avoidWearing: e.target.value })} placeholder="e.g. Bright prints, high heels, overly formal suits..." />
        </Field>

        <Field label="Do you have a favorite color?">
          <input className={inputCls} value={s.favoriteColor} onChange={e => updateSession({ favoriteColor: e.target.value })} placeholder="e.g. forest green, navy, burgundy... (optional)" />
        </Field>

        <Field label="How do you feel about wearing color?">
          <input className={inputCls} value={s.comfortWithColor} onChange={e => updateSession({ comfortWithColor: e.target.value })} placeholder="e.g. Love it, prefer neutrals, occasionally bold..." />
        </Field>

        <Field label="Fit preference *">
          <div className="flex gap-3">
            {['Fitted', 'Relaxed', 'In-between'].map(opt => (
              <label key={opt} className={`flex-1 text-center py-2.5 px-3 rounded-lg border cursor-pointer text-sm transition-all ${
                s.fitPreference === opt
                  ? 'bg-[#b4887a]/15 border-[#b4887a] font-medium'
                  : 'border-[#b4887a]/25 text-[#3F3F3F]/60 hover:border-[#b4887a]/50'
              }`}>
                <input type="radio" className="sr-only" checked={s.fitPreference === opt} onChange={() => updateSession({ fitPreference: opt })} />
                {opt}
              </label>
            ))}
          </div>
        </Field>
      </div>

      {error && <ErrorMessage message={error} />}

      <button
        onClick={onComplete}
        disabled={!isReady()}
        className="w-full py-3.5 rounded-xl bg-[#b4887a] text-white font-semibold hover:bg-[#a07368] transition-colors disabled:opacity-50"
      >
        Continue to Brand Color Palette
      </button>
      {!isReady() && <p className="text-xs text-[#3F3F3F]/40 text-center mt-2">Fill in all required fields (*) to continue</p>}
    </div>
  );
}
