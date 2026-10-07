/**
 * Registro central dos recursos visuais dos jogos.
 *
 * `BASE_URL` mantém os caminhos válidos no localhost, no preview do AI Studio
 * e quando o build é publicado dentro de uma subpasta.
 */
export const publicAsset = (path: string): string => {
  const base = import.meta.env.BASE_URL || '/';
  return `${base}${path.replace(/^\/+/, '')}`;
};

export const GAME_ASSETS = {
  blockWin: {
    cover: publicAsset('assets/games/block-win/cover.webp'),
    logo: publicAsset('blocklogo.png'),
  },
  subwayPay: {
    cover: publicAsset('subwaypay.png'),
    app: publicAsset('subwaypay/index.html?v=1'),
    runner: publicAsset('subwaypay/jogar/index.html?v=1'),
  },
  genDino: {
    cover: publicAsset('assets/games/gen-dino/cover.webp'),
    app: publicAsset('gen-dino/index.html?embedded=1&v=16'),
  },
  raspaFortuna: {
    cover: publicAsset('raspa-fortuna.png'),
    app: publicAsset('raspafortuna/index.html?embedded=1&v=2'),
  },
  bubbleBlast: {
    domain: 'https://jogarbubble.online',
    cover: publicAsset('bubbleblast.png'),
    app: publicAsset('bubbleblast/index.html?v=1'),
    game: publicAsset('bubbleblast/demo-game.html?v=1'),
  },
} as const;

export function getGameCover(gameId: string): string {
  const id = String(gameId || '').toLowerCase();
  if (id.includes('bubble')) return GAME_ASSETS.bubbleBlast.cover;
  if (id.includes('subway')) return GAME_ASSETS.subwayPay.cover;
  if (id.includes('raspa') || id.includes('fortuna')) return GAME_ASSETS.raspaFortuna.cover;
  if (id.includes('dino')) return GAME_ASSETS.genDino.cover;
  return GAME_ASSETS.blockWin.cover;
}
