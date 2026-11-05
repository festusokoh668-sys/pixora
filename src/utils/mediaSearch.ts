import { DrawingTemplate } from '../types';

interface WikiPage {
  pageid: number;
  title: string;
  description?: string;
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
  original?: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikiResponse {
  query?: {
    pages?: Record<string, WikiPage>;
  };
}

interface CommonsPage {
  pageid: number;
  title: string;
  imageinfo?: Array<{
    url: string;
    thumburl?: string;
    descriptionurl?: string;
  }>;
}

interface CommonsResponse {
  query?: {
    pages?: Record<string, CommonsPage>;
  };
}

/**
 * Searches the web for high-resolution paint book references, tracing guides,
 * and live photography for ANY query.
 */
export async function searchRealPhotoTemplates(query: string): Promise<DrawingTemplate[]> {
  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) return [];

  const results: DrawingTemplate[] = [];
  const queryCapitalized = cleanQuery.charAt(0).toUpperCase() + cleanQuery.slice(1);
  const cat = inferCategory(cleanQuery, cleanQuery);

  // 1. Guaranteed Web Live Reference Books (Photo, Stencil, Digital Art)
  results.push(
    {
      id: `web_stencil_${encodeURIComponent(cleanQuery)}_${Date.now()}`,
      name: `${queryCapitalized} (Outline Trace)`,
      category: cat,
      difficulty: 'Easy',
      type: 'photo',
      mediaUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(
        'clean black and white line art coloring book outline trace page of ' + cleanQuery + ', sharp black vector contours, pure white background, no color fill, high contrast stencil'
      )}?width=800&height=800&nologo=true`,
      description: `Clean black and white contour line art trace guide of ${cleanQuery}`,
    },
    {
      id: `web_photo_${encodeURIComponent(cleanQuery)}_${Date.now()}`,
      name: `${queryCapitalized} (Real Photo)`,
      category: cat,
      difficulty: 'Medium',
      type: 'photo',
      mediaUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(
        cleanQuery + ', ultra realistic photographic portrait, crisp details, studio lighting, high resolution'
      )}?width=800&height=800&nologo=true`,
      description: `High-definition real web photograph of ${cleanQuery} for drawing and tracing`,
    },
    {
      id: `web_art_${encodeURIComponent(cleanQuery)}_${Date.now()}`,
      name: `${queryCapitalized} (Masterpiece Art)`,
      category: cat,
      difficulty: 'Pro',
      type: 'photo',
      mediaUrl: `https://image.pollinations.ai/prompt/${encodeURIComponent(
        'vibrant detailed illustration artwork of ' + cleanQuery + ', expressive studio paint strokes, epic composition'
      )}?width=800&height=800&nologo=true`,
      description: `Detailed artistic digital paint reference for ${cleanQuery}`,
    }
  );

  // 2. Fetch live real photography from Wikimedia Commons & Wikipedia
  try {
    const commonsUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
      cleanQuery
    )}&gsrlimit=6&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json&origin=*`;

    const commonsPromise = fetch(commonsUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((cData: CommonsResponse | null) => {
        if (!cData?.query?.pages) return;
        const cPages = cData.query.pages;
        for (const k of Object.keys(cPages)) {
          const page = cPages[k];
          const info = page.imageinfo?.[0];
          const imgUrl = info?.thumburl || info?.url;
          if (imgUrl && !imgUrl.endsWith('.svg') && !imgUrl.endsWith('.tif') && !imgUrl.endsWith('.ogg')) {
            const cleanTitle = page.title
              .replace(/^File:/i, '')
              .replace(/\.[^/.]+$/, '')
              .replace(/_/g, ' ')
              .slice(0, 30);
            results.push({
              id: `commons_${page.pageid}_${Date.now()}`,
              name: cleanTitle,
              category: inferCategory(cleanTitle, cleanQuery),
              difficulty: 'Medium',
              type: 'photo',
              mediaUrl: imgUrl,
              description: `Real photo paint book reference of ${cleanTitle} from the web`,
            });
          }
        }
      })
      .catch(() => {});

    const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages|description&piprop=original|thumbnail&pithumbsize=900&generator=prefixsearch&gpssearch=${encodeURIComponent(
      cleanQuery
    )}&gpslimit=6&format=json&origin=*`;

    const wikiPromise = fetch(wikiUrl)
      .then((r) => (r.ok ? r.json() : null))
      .then((wData: WikiResponse | null) => {
        if (!wData?.query?.pages) return;
        const wPages = wData.query.pages;
        for (const wk of Object.keys(wPages)) {
          const wPage = wPages[wk];
          const wImg = wPage.original?.source || wPage.thumbnail?.source;
          if (wImg && !wImg.endsWith('.svg') && !wImg.endsWith('.svg.png')) {
            results.push({
              id: `wiki_${wPage.pageid}_${Date.now()}`,
              name: wPage.title,
              category: inferCategory(wPage.title, cleanQuery),
              difficulty: 'Medium',
              type: 'photo',
              mediaUrl: wImg,
              description: wPage.description || `Real photo of ${wPage.title} from the web`,
            });
          }
        }
      })
      .catch(() => {});

    // Wait for both live web lookups with a fast timeout
    await Promise.race([
      Promise.all([commonsPromise, wikiPromise]),
      new Promise((res) => setTimeout(res, 1800)),
    ]);
  } catch (err) {
    console.warn('Live web search warning:', err);
  }

  return results;
}

/**
 * Infers appropriate category based on title or query keywords
 */
function inferCategory(title: string, query: string): any {
  const text = `${title} ${query}`.toLowerCase();
  if (/dog|cat|lion|tiger|puppy|bear|wolf|fox|elephant|bird|toucan|dolphin|whale|fish|horse|monkey|deer|eagle|owl|panda|rabbit|leopard|cheetah|snake|turtle|frog|dinosaur|peacock|shark|spider/.test(text)) {
    return 'animals';
  }
  if (/flower|rose|tree|forest|mountain|leaf|plant|garden|sunset|landscape|river|lake|nature|sunflower|orchid|cactus|ocean|waterfall|beach/.test(text)) {
    return 'nature';
  }
  if (/car|vehicle|supercar|truck|train|plane|airplane|motorcycle|ship|boat|bicycle|ferrari|porsche|bus|lamborghini|motor|speed/.test(text)) {
    return 'vehicles';
  }
  if (/strawberry|fruit|apple|banana|orange|mango|grape|pineapple|watermelon|peach|cherry|lemon|pizza|burger|cake|coffee|ice cream|food/.test(text)) {
    return 'fruits';
  }
  if (/spiderman|astronaut|character|hero|man|woman|child|portrait|warrior|robot|samurai|ninja|alien|face|batman|goku|naruto|anime/.test(text)) {
    return 'characters';
  }
  if (/mandala|shape|pattern|spiral|geometry|circle|star|diamond|triangle|cube/.test(text)) {
    return 'shapes';
  }
  return 'nature';
}
