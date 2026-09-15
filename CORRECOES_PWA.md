# Correções do PWA e das notificações

## Problemas encontrados

- As inscrições Web Push eram guardadas apenas em um `Map` na memória do servidor. Reinícios, escalonamento e novas instâncias apagavam todos os dispositivos.
- O endpoint de inscrição aceitava `userId` enviado pelo navegador e podia associar o dispositivo à conta errada.
- O dispositivo não renovava o vínculo Push depois que o usuário fazia login.
- O cadastro de uma pessoa indicada não disparava Push pelo backend; dependia de polling com a tela aberta.
- A criação de PIX pendente não avisava o afiliado responsável.
- O envio do administrador consultava apenas a memória da instância atual.
- O listener `message` do service worker não usava `event.waitUntil`, permitindo que o navegador encerrasse o worker antes de mostrar a notificação.
- Os tamanhos declarados dos ícones no manifesto não correspondiam aos arquivos e o `apple-touch-icon.png` estava inválido.

## O que foi corrigido

- Inscrições persistidas na coleção Firestore `pushSubscriptions`.
- Associação da inscrição exclusivamente ao usuário autenticado pelo token.
- Reinscrição automática depois da restauração/login da sessão.
- Remoção automática de endpoints expirados (HTTP 404/410).
- Push de alta prioridade com TTL de 24 horas.
- Notificação de novo cadastro enviada ao dono correto da rede.
- Notificação de PIX pendente enviada ao afiliado da pessoa que gerou a cobrança.
- Notificações de depósito aprovado e comissão mantidas no backend, inclusive com o app fechado.
- Disparos do administrador usam a base persistente e contam afiliados/dispositivos corretamente.
- Service worker corrigido com `event.waitUntil` e navegação absoluta ao clicar.
- Ícones PWA reais em 192×192, 512×512 e Apple Touch 180×180.

## Configuração obrigatória no deploy

Defina `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` no ambiente de produção e mantenha o mesmo par de chaves entre deploys. O site precisa estar em HTTPS. No iPhone, Web Push exige iOS 16.4 ou superior e o site instalado na Tela de Início.

Após publicar esta versão, cada afiliado deve abrir o PWA já logado e tocar em **Ativar notificações** uma vez. Isso cria a inscrição persistente vinculada à conta correta.

## Validação executada

- `npm run lint`: aprovado, sem erros TypeScript.
- `npm run build`: aprovado, frontend e servidor compilados.
