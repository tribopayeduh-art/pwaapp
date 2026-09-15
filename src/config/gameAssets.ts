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
  zumbla: {
    cover: publicAsset('assets/games/zumbla/cover.webp'),
    app: publicAsset('zumbla/app/index.html?v=15'),
  },
  genDino: {
    cover: publicAsset('assets/games/gen-dino/cover.webp'),
    app: publicAsset('gen-dino/index.html?embedded=1&v=16'),
  },
  raspaFortuna: {
    cover: publicAsset('RASPAAFORTUNA.PNG'),
    app: publicAsset('raspafortuna/index.html?embedded=1&v=1'),
  },
} as const;

export function getGameCover(gameId: string): string {
  const id = String(gameId || '').toLowerCase();
  if (id.includes('raspa') || id.includes('fortuna')) return GAME_ASSETS.raspaFortuna.cover;
  if (id.includes('dino')) return GAME_ASSETS.genDino.cover;
  if (id.includes('zumbla')) return GAME_ASSETS.zumbla.cover;
  return GAME_ASSETS.blockWin.cover;
}
