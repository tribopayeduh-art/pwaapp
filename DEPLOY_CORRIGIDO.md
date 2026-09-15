# Deploy corrigido

O pacote foi reconstruido e validado para publicacao.

Correcoes aplicadas:

- `package-lock.json` sincronizado com `package.json`;
- build de producao validado com `npm ci`, `npm run lint` e `npm run build`;
- `Dockerfile` Node.js 20 com build em duas etapas;
- exclusao de cache, dependencias locais, build anterior e dados temporarios do arquivo enviado ao Cloud Run;
- ZIP recriado com compressao padrao e teste de integridade.

No AI Studio, importe este ZIP como um projeto novo e publique novamente. Nao compacte a pasta que contem o projeto: os arquivos `package.json`, `Dockerfile` e `src` devem aparecer diretamente na raiz do ZIP.
