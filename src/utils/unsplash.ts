export interface UnsplashPhoto {
  id: string;
  smallUrl: string;
  pageUrl: string;
  alt: string;
  photographer: string;
  photographerUrl: string;
}

const UTM = 'utm_source=author_authority_builder&utm_medium=referral';

function buildQuery(
  outfit: { name: string; occasion: string; outfit: string },
  gender: string
): string {
  const isFemale =
    /female|woman|she\/her/i.test(gender) ||
    (!gender.toLowerCase().includes('male') && !gender.toLowerCase().includes('man'));
  const genderTerm = isFemale ? 'woman' : 'man';

  const context = (outfit.name + ' ' + outfit.occasion).toLowerCase();
  let style: string;
  if (/speak|stage|keynote|present/i.test(context)) style = 'professional speaker';
  else if (/video|podcast|media|studio/i.test(context)) style = 'professional outfit';
  else if (/casual|everyday|daily|weekend/i.test(context)) style = 'smart casual';
  else if (/meet|client|business|zoom/i.test(context)) style = 'business professional';
  else style = 'professional fashion';

  // Up to 2 colors from outfit description
  const colors = outfit.outfit.match(
    /\b(navy|sage|cream|white|black|gray|grey|beige|tan|camel|blush|burgundy|olive|teal|rust|charcoal|khaki|lavender|mauve|brown|blue|green|pink|red|purple)\b/gi
  ) || [];
  const uniqueColors = [...new Set(colors.map(c => c.toLowerCase()))].slice(0, 2);

  // Primary clothing item
  const clothing = outfit.outfit.match(
    /\b(blazer|dress|trousers|jeans|skirt|blouse|sweater|cardigan|jacket|coat|suit|pants|shirt|turtleneck)\b/gi
  ) || [];
  const topItem = clothing.length > 0 ? (clothing[0] ?? '').toLowerCase() : '';

  return [genderTerm, style, ...uniqueColors, topItem].filter(Boolean).slice(0, 5).join(' ');
}

export async function searchOutfitPhotos(
  outfit: { name: string; occasion: string; outfit: string },
  gender: string,
  count = 2
): Promise<UnsplashPhoto[]> {
  const accessKey = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
  if (!accessKey) return [];

  const query = buildQuery(outfit, gender);
  const params = new URLSearchParams({
    query,
    per_page: String(count),
    orientation: 'portrait',
    content_filter: 'high',
  });

  try {
    const res = await fetch(`https://api.unsplash.com/search/photos?${params}`, {
      headers: { Authorization: `Client-ID ${accessKey}` },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.results ?? []) as Array<{
      id: string;
      urls: { small: string };
      links: { html: string };
      alt_description: string | null;
      user: { name: string; links: { html: string } };
    }>).slice(0, count).map(p => ({
      id: p.id,
      smallUrl: p.urls.small,
      pageUrl: `${p.links.html}?${UTM}`,
      alt: p.alt_description || 'outfit inspiration',
      photographer: p.user.name,
      photographerUrl: `${p.user.links.html}?${UTM}`,
    }));
  } catch {
    return [];
  }
}
