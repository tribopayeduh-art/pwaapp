# Diagnóstico de publicação no Cloud Run

## Conclusão
O erro `Failed to update Cloud Run service: user has exceeded quota` foi devolvido pelo serviço de publicação. Sem o identificador da cota excedida nos logs da operação, não é possível afirmar se foi limite de gravações da Cloud Run Admin API, capacidade regional, instâncias ou outra cota. O retorno HTTP 302 da URL compartilhada prova apenas que um endpoint respondeu com redirecionamento de autenticação; não prova que a nova revisão foi implantada.

## Problemas confirmados no ZIP original
- `npm ci` falhava por entradas opcionais ausentes no `package-lock.json`.
- Faltava `Dockerfile`, embora `DEPLOY_CORRIGIDO.md` afirmasse que existia.
- `npm start` executava `node server.ts`, enquanto o build entregava `dist/server.cjs`. O caminho direto em ESM falhou localmente em produção com `__dirname is not defined`.
- O health check anunciava `firebase: true` sem consultar o Firestore; HTTP 200 atesta apenas que o servidor iniciou.
- Segredos JWT e de criptografia não definidos são criados em arquivos locais. Em Cloud Run, o sistema de arquivos é efêmero; configure `JWT_SECRET` e `SYSTEM_ENCRYPTION_KEY` de forma estável antes de usar contas e transações reais. Também configure as chaves VAPID e credenciais de pagamentos por variáveis seguras.

## Alterações nesta cópia
- Regerado o lockfile e validado `npm ci`.
- `npm start` aponta para `dist/server.cjs`.
- Criado `Dockerfile` com build e execução em Node 22, porta via `PORT` já tratada pelo servidor.

## Testes locais
`npm ci`, `npm run lint`, `npm run build`, servidor com `NODE_ENV=production`, `/api/health` e `/`: passaram. Não houve deploy real nem teste de conexão ao Firestore/PIX. O Dockerfile não foi compilado por Docker neste ambiente; o mesmo fluxo npm foi testado fora do contêiner.

## Como identificar a cota
No projeto correto, abra Google Cloud Console > IAM e administrador > Cotas e limites do sistema e filtre Cloud Run. Confira uso e limite da cota apontada na falha. Em Cloud Run > serviço > Revisões, verifique o status da revisão; em Cloud Logging/Audit Logs, procure o erro da operação de update e os detalhes `quotaExceeded`. Só depois faça nova tentativa. A cota padrão de gravações da Cloud Run Admin API é de 180 por 60 segundos por região; aguardar ajuda apenas se esta tiver sido a cota excedida.
