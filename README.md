# PayGateway Mobile — revisão de lógica e funcionamento

Esta versão contém os arquivos da plataforma enviada, com correções em autenticação, depósitos, saques, relatórios, modais e inicialização. O detalhamento dos fluxos e dos limites da revisão está em `REVISAO_SISTEMA.md`.

## Executar no Windows

Use Node.js 24 LTS para executar também a suíte de testes.

```bat
cd /d "CAMINHO\DA\PASTA\EXTRAIDA"
copy .env.example .env
npm install
npm run dev
```

Abra `http://localhost:3000`. Configure o `.env` antes de testar operações com banco e gateway.

## Configuração necessária

- `JWT_SECRET`: segredo forte e permanente. É obrigatório em produção. Não reutilize valores de exemplo.
- Firestore: o servidor agora usa `firebase-admin`, com credenciais de execução do ambiente ou `GOOGLE_APPLICATION_CREDENTIALS` apontando para o JSON de uma conta de serviço autorizada. Alternativamente, configure `FIREBASE_SERVICE_ACCOUNT_JSON` como segredo do ambiente. Nunca envie esse JSON ao navegador ou ao repositório.
- `FIREBASE_PROJECT_ID`: projeto autorizado. O banco nomeado continua sendo selecionado por `firestoreDatabaseId` em `firebase-applet-config.json`.
- Aplique `firestore.rules` ao banco correto. As regras negam acesso direto pelo navegador; o servidor usa sua identidade autorizada. **Trocar só as regras, mantendo o servidor antigo, interrompe seu acesso ao banco.** Faça a atualização do servidor e das regras como uma mudança coordenada.
- `DOTFY_API_KEY`: chave do seu gateway. Também pode ser mantida no cofre/configuração administrativa existente.
- `WEBHOOK_SECRET`: segredo acordado para autenticar eventos. Esta versão exige HMAC SHA-256 do corpo bruto em `x-dotfy-signature`, `x-hub-signature-256` ou `x-signature`. Confirme o formato efetivamente usado pelo fornecedor antes de ativar pagamentos reais. Eventos sem assinatura são recusados.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`: chaves próprias para push. Foram removidas as chaves privadas embutidas no código.
- Rotacione as chaves de integração que estavam expostas no arquivo original. Gere e configure as novas chaves fora do código.

As contas administrativas existentes no banco continuam sendo usadas. Os administradores com senha fixa em memória estão desativados por padrão e nunca são criados em produção. `ENABLE_DEMO_ADMIN=true` é destinado exclusivamente a demonstração local; esses usuários em memória não substituem contas persistidas autorizadas.

`ALLOW_PAYMENT_SIMULATION=false` é o padrão. A simulação não pode creditar pagamentos reais em produção, mesmo se a opção for alterada.

## Verificação e execução em produção

```bat
npm run lint
npm run test
npm run build
set NODE_ENV=production
npm start
```

`npm start` executa o servidor compilado em `dist/server.cjs`. Configure `PORT` quando necessário. O arquivo distribuído contém fontes e assets; a pasta `dist` é gerada pelo build.

## Limites importantes

Não houve transações reais, publicação ou alteração do banco de produção durante a revisão. Os testes financeiros usam um banco controlado em memória para validar os fluxos e rollback; não substituem testes com Firestore e o gateway homologados.

Alguns resultados de jogos ainda chegam do navegador. A validação autoritativa das partidas precisa de uma revisão dedicada do motor antes de operar dinheiro real. A revisão também não certifica todas as rotas legadas, o repasse de comissões em caso de falha intermediária, nem a contabilização fiscal do negócio. Consulte o relatório para detalhes.

## Painel administrativo atualizado

O painel usa uma navegação agrupada por área, layout responsivo e menu inferior no celular. `Ctrl+K` (ou `Cmd+K`) abre a busca de telas e usuários disponíveis ao administrador. O cabeçalho oferece densidade compacta, atualização manual, horário da última atualização e atualização automática opcional a cada 30 segundos.

A visão geral separa depósitos, resultado dos jogos, saques pendentes e obrigações em saldo. O gráfico oferece períodos, tabela acessível, exportação CSV com permissão e opção de ocultar valores.

A Central de pendências permite anotações de até 1.000 caracteres, prioridade e marcação de revisão. Os registros ficam na coleção `admin_operation_notes`, com autor, data e revisão transacional; um conflito de edição exige recarregar. As anotações não aprovam nem alteram a situação financeira de um saque.

A gestão de saques inclui busca, filtros por situação e período, ordenação, paginação, CSV, detalhes e confirmação antes de envio ou estorno. Um envio ao gateway continua pendente até confirmação bancária. Saques reservados ou já enviados não exibem novo envio/estorno.

A atividade do sistema consulta eventos reais da instância atual, limitados aos últimos 300 e reiniciados com o servidor. O tempo exibido mede somente a resposta deste endpoint. Não é um histórico durável nem uma certificação do banco ou gateway.

As capturas em `docs/admin-previews/` usam dados ilustrativos. O relatório `REVISAO_SISTEMA.md` descreve a validação e os limites.
