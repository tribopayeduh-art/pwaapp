/**
 * Centralized SEO & Structured Metadata Engine for all Games
 * Supports Schema.org VideoGame / WebApplication, OpenGraph, Twitter Cards, Canonical URLs & Dynamic Meta Tags
 */

export interface GameSEOMetadata {
  id: string;
  name: string;
  shortName: string;
  title: string;
  description: string;
  keywords: string[];
  canonicalDomain: string;
  canonicalPath: string;
  image: string;
  favicon: string;
  category: string;
  genre: string[];
  multiplier: string;
  ratingValue: string;
  reviewCount: string;
  operatingSystem: string;
  applicationCategory: string;
}

export const GAMES_SEO_DATA: Record<string, GameSEOMetadata> = {
  blockwin: {
    id: 'blockwin',
    name: 'Block Win — Quebra-Cabeça de Blocos Online',
    shortName: 'Block Win',
    title: 'Block Win | Jogo dos Blocos com Prêmios e PIX Instantâneo',
    description: 'Jogue Block Win online! Encaixe os blocos coloridos na grade 8x8, limpe linhas e colunas completas e ative multiplicador de até x2.90 com PIX instantâneo.',
    keywords: [
      'block win',
      'block puzzle',
      'jogo dos blocos',
      'quebra cabeca de blocos',
      'jogo de puzzle que paga pix',
      'block winner',
      'jogar block win online',
      'block puzzle pix',
      'jogos de estrategia online',
      'puzzle mobile celular'
    ],
    canonicalDomain: 'https://blockwinner.site',
    canonicalPath: '/blockwin',
    image: '/blocklogo.png',
    favicon: '/faviconblock.png',
    category: 'Puzzle / Quebra-Cabeça',
    genre: ['PuzzleGame', 'StrategyGame'],
    multiplier: 'x2.90',
    ratingValue: '4.9',
    reviewCount: '3840',
    operatingSystem: 'Android, iOS, Web, Windows, macOS',
    applicationCategory: 'GameApplication',
  },
  zumbla: {
    id: 'zumbla',
    name: 'Zumbla Win — Marble Shooter & Aventura na Selva',
    shortName: 'Zumbla Win',
    title: 'Zumbla Win | Jogo da Bolinha Mágica com Multiplicador x5.00',
    description: 'Mire e dispare as esferas místicas na selva com Zumbla Win! Combine 3 ou mais bolinhas da mesma cor, faça combos épicos e multiplique em até 5x via PIX.',
    keywords: [
      'zumbla win',
      'zumbla pay',
      'jogo da bolinha',
      'zuma online',
      'marble shooter brasil',
      'jogo da ra selva',
      'jogar zumbla win',
      'zumbla win pix',
      'jogos de tiro de bolinha',
      'arcade mobile'
    ],
    canonicalDomain: 'https://zumblapay.site',
    canonicalPath: '/zumbla',
    image: '/zumbla/banner-zumbla-win.webp',
    favicon: '/zumbla/favicon.svg',
    category: 'Arcade / Ação',
    genre: ['ArcadeGame', 'ActionGame'],
    multiplier: 'x5.00',
    ratingValue: '4.8',
    reviewCount: '2910',
    operatingSystem: 'Android, iOS, Web, Windows, macOS',
    applicationCategory: 'GameApplication',
  },
  'gen-dino': {
    id: 'gen-dino',
    name: 'GEN DINO — Arcade Mobile Runner com Moedas Virtuais',
    shortName: 'GEN DINO',
    title: 'GEN DINO | Jogo do Dinossauro Arcade com Prêmios e PIX',
    description: 'Corra pelo deserto, pule sobre cactos e desvie de obstáculos com GEN DINO! Colete moedas valendo R$ 1 cada e converta seus pontos em PIX direto no celular.',
    keywords: [
      'gen dino',
      'dino pay',
      'jogo do dinossauro',
      'chrome dino arcade',
      'dinossauro corredor',
      'dino runner celular',
      'jogo do dinossauro pix',
      'arcade mobile dinossauro',
      'endless runner brasil'
    ],
    canonicalDomain: 'https://dinopay.site',
    canonicalPath: '/gen-dino',
    image: '/gen-dino/images/preview.png',
    favicon: '/gen-dino/images/fav_icon.png',
    category: 'Arcade / Runner',
    genre: ['EndlessRunner', 'ArcadeGame'],
    multiplier: 'R$ 1 por moeda',
    ratingValue: '4.9',
    reviewCount: '2150',
    operatingSystem: 'Android, iOS, Web, Windows, macOS',
    applicationCategory: 'GameApplication',
  },
  'raspa-fortuna': {
    id: 'raspa-fortuna',
    name: 'Raspa Fortuna — Raspadinha Digital com Prêmios na Hora',
    shortName: 'Raspa Fortuna',
    title: 'Raspa Fortuna | Raspadinha Digital com Prêmios e PIX Instantâneo',
    description: 'A maior raspadinha digital do Brasil! Raspe na tela do seu celular e concorra a prêmios em dinheiro, eletrônicos, carros e super PIX com multiplicador até x10.00.',
    keywords: [
      'raspa fortuna',
      'raspadinha da sorte',
      'raspadinha online',
      'raspadinha digital',
      'raspar e ganhar pix',
      'raspadinha que paga na hora',
      'raspadinha celular',
      'premios pix instantaneo',
      'jogos instantaneos brasil'
    ],
    canonicalDomain: 'https://raspadinhaadasorte.site',
    canonicalPath: '/raspa-fortuna',
    image: '/RASPAAFORTUNA.PNG',
    favicon: '/RASPAAFORTUNA.PNG',
    category: 'Instant Win / Raspadinha',
    genre: ['InstantWinGame', 'LotteryGame'],
    multiplier: 'x10.00',
    ratingValue: '4.9',
    reviewCount: '4380',
    operatingSystem: 'Android, iOS, Web, Windows, macOS',
    applicationCategory: 'GameApplication',
  },
  'subwaypay': {
    id: 'subwaypay',
    name: 'Subway Pay — Jogo Runner com Prêmios e PIX na Hora',
    shortName: 'Subway Pay',
    title: 'Subway Pay | Corra pelos Trilhos e Ganhe PIX Instantâneo',
    description: 'O novo jogo Subway Pay chegou! Corra pelos trilhos, recolha moedas e multiplique seus ganhos via PIX com multiplicador até x10.00.',
    keywords: [
      'subway pay',
      'joguesubway.surf',
      'joguesubway',
      'subway runner pix',
      'subway pay oficial',
      'jogar subway pay',
      'subway surfers pix',
      'subway pay apostas'
    ],
    canonicalDomain: 'https://joguesubway.surf',
    canonicalPath: '/subwaypay',
    image: '/subwaypay.png',
    favicon: '/subwaypay.png',
    category: 'Runner / Arcade',
    genre: ['ArcadeGame', 'RunnerGame'],
    multiplier: 'x10.00',
    ratingValue: '4.9',
    reviewCount: '3820',
    operatingSystem: 'Android, iOS, Web, Windows, macOS',
    applicationCategory: 'GameApplication',
  },
  'bubble-blast': {
    id: 'bubble-blast',
    name: 'Bubble Blast — Jogo de Estourar Bolhas',
    shortName: 'Bubble Blast',
    title: 'Bubble Blast | Jogo de Bolhas Online — Em Breve',
    description: 'Novo jogo Bubble Blast! Mire, atire e combine as bolhas coloridas para estourar sequências épicas. Lançamento em breve com prêmios e PIX instantâneo.',
    keywords: [
      'bubble blast',
      'bubble shooter',
      'jogo das bolhas',
      'estourar bolhas',
      'bubble blast pix',
      'jogar bubble blast online',
      'jogos de bolha celular'
    ],
    canonicalDomain: 'https://zumblapay.site',
    canonicalPath: '/bubbleblast',
    image: '/Bubbleblast.png',
    favicon: '/Bubbleblast.png',
    category: 'Casual / Bubble Shooter',
    genre: ['ArcadeGame', 'PuzzleGame'],
    multiplier: 'Em Breve',
    ratingValue: '5.0',
    reviewCount: '120',
    operatingSystem: 'Android, iOS, Web, Windows, macOS',
    applicationCategory: 'GameApplication',
  },
  'alliance-hub': {
    id: 'alliance-hub',
    name: 'Alliance Hub — Painel de Afiliados iGaming & Gateway PIX',
    shortName: 'Alliance Hub',
    title: 'Alliance Hub | iGAMING PAINEL — Afiliados & Gateway PIX',
    description: 'Painel oficial de afiliados e gateway iGaming Alliance Hub. Alta conversão, PIX instantâneo, comissões automáticas de até 80% RevShare e métricas em tempo real.',
    keywords: [
      'alliance hub',
      'igaming painel',
      'painel de afiliados igaming',
      'afiliados igaming',
      'gateway igaming pix',
      'comissoes afiliados 80%',
      'painel afiliados brasil',
      'goalliancehub',
      'goalliancehub.com',
      'revshare igaming',
      'afiliados cassino',
      'plataforma igaming pix'
    ],
    canonicalDomain: 'https://goalliancehub.com',
    canonicalPath: '/',
    image: '/allifavicon.png',
    favicon: '/allifavicon.png',
    category: 'iGaming Affiliate Panel & Gateway',
    genre: ['AffiliatePlatform', 'Fintech', 'GamingPlatform'],
    multiplier: 'Até 80% RevShare',
    ratingValue: '4.9',
    reviewCount: '16800',
    operatingSystem: 'Android, iOS, Web, Windows, macOS',
    applicationCategory: 'BusinessApplication',
  },
  'partner': {
    id: 'partner',
    name: 'Alliance Hub — Portal de Parceiros & Rede de Afiliados iGaming',
    shortName: 'Parceiro Alliance Hub',
    title: 'Alliance Hub | Portal Oficial de Parceiros & Rede iGaming',
    description: 'Portal executivo de Parceiros Alliance Hub. Gestão de rede de afiliados, comissões automáticas via PIX de até 80% RevShare e relatórios executivos em tempo real.',
    keywords: [
      'parceiro alliance hub',
      'portal parceiros igaming',
      'afiliados igaming brasil',
      'recrutamento afiliados igaming',
      'comissao parceiro pix'
    ],
    canonicalDomain: 'https://goalliancehub.com',
    canonicalPath: '/parceiro',
    image: '/allifavicon.png',
    favicon: '/allifavicon.png',
    category: 'iGaming Partner Network',
    genre: ['PartnerPlatform', 'Fintech'],
    multiplier: 'Até 80% RevShare',
    ratingValue: '4.9',
    reviewCount: '4920',
    operatingSystem: 'Android, iOS, Web, Windows, macOS',
    applicationCategory: 'BusinessApplication',
  }
};

/**
 * Normalizes any game ID or alias to canonical game key
 */
export function resolveGameSEOKey(rawKey: string | null | undefined): string {
  if (!rawKey) return 'alliance-hub';
  const clean = rawKey.trim().toLowerCase().replace(/_/g, '-');
  if (['partner', 'parceiro', 'p', 'portal-parceiro', 'painel-parceiro'].includes(clean)) return 'partner';
  if (['bubble-blast', 'bubbleblast', 'bubble_blast', 'g-bubble-blast', 'g_bubble_blast', 'bubble', 'zumbla', 'zumbla-win', 'zumblapay', 'g-zumbla'].includes(clean)) return 'bubble-blast';
  if (['gen-dino', 'gendino', 'dino', 'dinopay', 'dinoplay', 'dinipay', 'g-gen-dino'].includes(clean)) return 'gen-dino';
  if (['raspa-fortuna', 'raspafortuna', 'raspa', 'raspadinha', 'raspadinhaadasorte', 'g-raspa-fortuna'].includes(clean)) return 'raspa-fortuna';
  if (['subwaypay', 'subway-pay', 'subway_pay', 'subway', 'g-subway-pay', 'g_subway_pay', 'joguesubway', 'joguesubway.surf'].includes(clean)) return 'subwaypay';
  return 'alliance-hub';
}

/**
 * Helper to update or create meta tags dynamically
 */
function setMetaTag(selector: string, attrName: string, attrVal: string, content: string) {
  let element = document.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attrName, attrVal);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
}

/**
 * Generates Schema.org JSON-LD for a given game
 */
export function generateGameSchema(data: GameSEOMetadata, origin: string): object {
  const isHub = data.id === 'alliance-hub' || data.id === 'partner';
  const fullUrl = `${origin}${data.canonicalPath}`;
  const imageUrl = data.image.startsWith('http') ? data.image : `${origin}${data.image.startsWith('/') ? data.image : '/' + data.image}`;

  if (isHub) {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${origin}/#website`,
          url: origin,
          name: 'Alliance Hub',
          description: data.description,
          inLanguage: 'pt-BR',
          publisher: {
            '@type': 'Organization',
            name: 'Alliance Hub',
            url: origin,
            logo: {
              '@type': 'ImageObject',
              url: `${origin}/allifavicon.png`,
            },
          },
        },
        {
          '@type': 'SoftwareApplication',
          name: data.name,
          alternateName: data.shortName,
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Android, iOS, Web, Windows, macOS',
          description: data.description,
          url: fullUrl,
          image: imageUrl,
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'BRL',
            category: 'AffiliateNetwork',
          },
        },
        {
          '@type': 'ItemList',
          name: 'Catálogo de Jogos Oficiais Alliance Hub',
          description: 'Lista de jogos exclusivos disponíveis com suporte a PIX instantâneo e comissões de afiliados.',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Block Win',
              url: 'https://blockwinner.site/blockwin',
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'Subway Pay',
              url: 'https://joguesubway.surf/subwaypay',
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: 'GEN DINO',
              url: 'https://dinopay.site/gen-dino',
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: 'Raspa Fortuna',
              url: 'https://raspadinhaadasorte.site/raspa-fortuna',
            },
          ],
        },
      ],
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': ['VideoGame', 'WebApplication', 'SoftwareApplication'],
    name: data.name,
    alternateName: data.shortName,
    description: data.description,
    url: fullUrl,
    image: imageUrl,
    inLanguage: 'pt-BR',
    applicationCategory: 'GameApplication',
    operatingSystem: data.operatingSystem,
    genre: data.genre,
    playMode: 'SinglePlayer',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      category: 'FreeToPlay',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: data.ratingValue,
      bestRating: '5',
      worstRating: '1',
      ratingCount: data.reviewCount,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Alliance Hub',
      url: origin,
      logo: {
        '@type': 'ImageObject',
        url: `${origin}/allifavicon.png`,
      },
    },
  };
}

/**
 * Injects/Updates the JSON-LD script element in document.head
 */
export function injectJsonLd(schema: object) {
  let script = document.getElementById('seo-json-ld') as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement('script');
    script.id = 'seo-json-ld';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(schema, null, 2);
}

/**
 * Injects or updates Canonical URL link tag
 */
export function setCanonicalUrl(canonicalUrl: string) {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = canonicalUrl;
}

/**
 * Injects or updates favicon icon tags
 */
export function setFavicons(faviconUrl: string) {
  const isSvg = faviconUrl.endsWith('.svg');
  const mimeType = isSvg ? 'image/svg+xml' : 'image/png';

  const rels = ['icon', 'shortcut icon', 'apple-touch-icon'];
  rels.forEach((rel) => {
    let link = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
    if (!link) {
      link = document.createElement('link');
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.type = mimeType;
    link.href = faviconUrl;
  });
}

/**
 * Core function to apply full SEO metadata for any game or platform context
 */
export function applyGameSEO(rawIdOrContext: string) {
  if (typeof document === 'undefined') return;

  const key = resolveGameSEOKey(rawIdOrContext);
  const data = GAMES_SEO_DATA[key] || GAMES_SEO_DATA['alliance-hub'];
  const origin = window.location.origin;
  const currentUrl = `${origin}${window.location.pathname}${window.location.search}`;
  const fullImageUrl = data.image.startsWith('http')
    ? data.image
    : `${origin}${data.image.startsWith('/') ? data.image : '/' + data.image}`;

  const isHubOrPartner = key === 'alliance-hub' || key === 'partner';

  // 1. Page Title
  document.title = data.title;

  // 2. Meta Description & Keywords
  setMetaTag('meta[name="description"]', 'name', 'description', data.description);
  setMetaTag('meta[name="keywords"]', 'name', 'keywords', data.keywords.join(', '));
  setMetaTag('meta[name="author"]', 'name', 'author', 'Alliance Hub');
  setMetaTag('meta[name="robots"]', 'name', 'robots', 'index, follow, max-image-preview:large');

  // 3. OpenGraph Social Cards
  setMetaTag('meta[property="og:type"]', 'property', 'og:type', isHubOrPartner ? 'website' : 'game');
  setMetaTag('meta[property="og:title"]', 'property', 'og:title', data.title);
  setMetaTag('meta[property="og:description"]', 'property', 'og:description', data.description);
  setMetaTag('meta[property="og:image"]', 'property', 'og:image', fullImageUrl);
  setMetaTag('meta[property="og:url"]', 'property', 'og:url', currentUrl);
  setMetaTag('meta[property="og:site_name"]', 'property', 'og:site_name', isHubOrPartner ? 'Alliance Hub' : data.name);
  setMetaTag('meta[property="og:locale"]', 'property', 'og:locale', 'pt_BR');

  // 4. Twitter Cards
  setMetaTag('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
  setMetaTag('meta[name="twitter:title"]', 'name', 'twitter:title', data.title);
  setMetaTag('meta[name="twitter:description"]', 'name', 'twitter:description', data.description);
  setMetaTag('meta[name="twitter:image"]', 'name', 'twitter:image', fullImageUrl);

  // 5. Canonical URL
  const canonicalUrl = `${data.canonicalDomain}${data.canonicalPath === '/' ? '' : data.canonicalPath}`;
  setCanonicalUrl(canonicalUrl);

  // 6. Dynamic Favicon
  setFavicons(data.favicon);

  // 7. Schema.org JSON-LD Structured Data
  const schema = generateGameSchema(data, origin);
  injectJsonLd(schema);
}
