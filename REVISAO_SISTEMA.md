# Revisão do sistema — 07/10/2026

## Estrutura e fluxos encontrados

A plataforma utiliza React/Vite na interface e Express em `server.ts`. A maior parte da API está concentrada nesse arquivo, com persistência em `server/db.ts`, autenticação em `server/security.ts` e rotas de parceiros em `server/partnerRoutes.ts`.

Os fluxos centrais são cadastro/login, carteira, cobrança PIX, confirmação do depósito, distribuição de comissões, jogos com aposta e prêmio, solicitação de saque, conferência administrativa ou pelo afiliado responsável, envio ao gateway e confirmação bancária. Também existem áreas de parceiros, influenciadores, campanhas, notificações PWA, WhatsApp, relatórios e jogos incorporados em páginas estáticas.

## Melhorias aplicadas

| Área | Problema identificado | Comportamento da revisão |
|---|---|---|
| Identidade | Reconstrução de identidade a partir de token sem validar assinatura, ID, telefone ou e-mail | Resolver principal aceita sessão assinada; resolvers de jogo deixam de autenticar por dados do usuário; API protege rotas privadas antes dos handlers legados |
| Logout | Token assinado podia voltar a funcionar depois de sair | Revogação gravada no banco e verificada pela autenticação, inclusive após reinício ou em outra instância |
| Banco | Regras permitiam leitura e escrita públicas | Acesso do servidor migrado para Admin SDK; regras entregues negam acesso direto do cliente |
| Segredos | Chaves privadas e administradores com senha fixa no código | Integrações usam ambiente/cofre; segredo de sessão é obrigatório em produção; bootstrap de demonstração não roda em produção |
| Depósito | Crédito marcado em memória antes da gravação; confirmação repetida podia duplicar saldo | Saldo, transação com ID determinístico e marcador da cobrança gravados em uma transação de banco |
| Persistência de cobrança | Cobranças dependiam de memória do processo | Cobranças gravadas no banco; consultas e webhook recuperam registros persistidos; gravação tardia não apaga marcador de crédito |
| Eventos de pagamento | Evento sem assinatura era aceito; assinatura usava JSON reserializado | Assinatura obrigatória verificada sobre os bytes originais; falhas de processamento retornam erro para permitir reenvio |
| Simulação | Rotas públicas podiam aprovar PIX de teste | Rotas de simulação exigem administrador e habilitação explícita local; crédito simulado é recusado em produção |
| Aprovação de saque | Falha no gateway ainda resultava em aprovação local | Reserva persistida antes do envio; envio confirmado permanece pendente de confirmação bancária; resultado incerto exige conciliação |
| Estorno de jogador | Rejeição permitia estornar operação já aprovada; saldo/status eram separados | Apenas saque pendente não enviado pode ser rejeitado; estorno e status gravados juntos, uma vez |
| Evento de falha no saque | Evento repetido podia repetir estorno e creditar carteira errada | Conciliação transacional com marcador persistente; diferencia carteira de jogo e cashout de comissões |
| Valor enviado | Aprovação podia enviar bruto em vez do líquido salvo | Aprovação utiliza `netAmount` quando registrado e aceita o `pixKeyId` salvo na solicitação |
| Block Puzzle / Gen Dino | Início e liquidação podiam concorrer ou separar saldo do estado da aposta | Débito e registro da aposta atômicos; crédito do prêmio, encerramento e entrada financeira atômicos |
| Relatórios gerais | Depósito contado como receita e somado ao GGR; valores fictícios de fallback | Depósitos reconhecidos pelo filtro de pagamentos; resultado usa rodadas encerradas de todos os jogos e desconta comissões registradas; fluxo de caixa separado |
| Rótulos financeiros | Painel chamava o cálculo incompleto de lucro líquido | Rótulos alterados para resultado dos jogos/após comissões; base do cálculo exposta na API |
| Falha de gravação | Atualização de saldo e criação de transação podiam informar sucesso sem persistência | Erros nessas operações financeiras propagados ao chamador |
| Comunicação | Requisições externas podiam ficar aguardando indefinidamente | Limite de 15 segundos nas integrações de servidor; sem repetição automática de transferência incerta |
| API | Erros e rotas inexistentes podiam devolver HTML ao cliente | Tratamento JSON para erros e fallback de API; limite de corpo de 256 KB |
| Modais | Foco saía da janela, botão pequeno e scroll podia ser liberado com outro modal aberto | Foco controlado, Escape, foco restaurado, semântica de diálogo, alvo de 44 px e bloqueio de scroll compartilhado |
| Build | `npm start` tentava executar TypeScript e lockfile não passava em `npm ci` | Inicialização usa servidor compilado; dependências/lockfile reconciliados; bibliotecas separadas em chunks |

## Como interpretar os números

- Depósito confirmado: entrada financeira, distinta do prêmio de jogo ou ajuste de saldo.
- GGR das rodadas encerradas: valor apostado menos prêmios.
- Resultado apresentado após comissões: GGR menos o total de comissões registrado pelos afiliados.
- Fluxo de caixa apresentado na API: depósitos reconhecidos menos saques aprovados.
- Saldo de jogadores e comissões ainda representa obrigação da plataforma.

Esse resultado não é lucro líquido contábil: ainda não deduz todas as taxas, tributos, despesas, estornos externos ou ajustes históricos. A separação de depósitos usa os metadados existentes; registros históricos sem classificação clara precisam de conciliação. Há leitura integral de coleções no painel geral: foi priorizada correção de lógica, e agregações persistidas/paginação ainda são necessárias para escala.

## Validação executada

- TypeScript: `npm run lint`.
- Build do cliente e servidor: `npm run build`.
- Servidor compilado: página inicial e health HTTP 200; sessão falsificada HTTP 401; simulação em produção HTTP 403; webhook sem assinatura HTTP 401; JSON inválido HTTP 400. Testes executados com projeto fictício e sem credenciais reais.
- Consistência do lockfile: `npm ci --dry-run --ignore-scripts --offline`.
- 16 testes de regressão: concorrência de confirmação de depósito, retry após falha de commit, estorno único, proibição de estornar saque aprovado, reserva concorrente de saque, eventos repetidos e fora de ordem, carteira correta no estorno de afiliado, valores inválidos, assinatura de sessão, logout, assinatura ausente de webhook, proteção contra gravação tardia de cobrança, concorrência de início e liquidação de jogo, rollback do prêmio e revogação persistente, conflito de revisão das anotações e rollback de anotação.

A suíte usa um adaptador controlado que serializa transações e simula falha de commit. Ela testa os métodos reais de negócio sem movimentar dinheiro e sem acessar dados de produção. Não comprova o contrato do gateway, as permissões de uma conta de serviço ou os retries internos do Firestore real.

## Pendências identificadas e limite do escopo entregue

1. **Resultados de jogos:** Block Puzzle/Gen Dino ainda aceitam dados de resultado vindos do cliente dentro dos limites legados. Transações atômicas evitam pagar a mesma aposta duas vezes, mas não comprovam a legitimidade de um resultado. O motor deve validar movimentos/eventos e calcular resultados no servidor.
2. **Outras rotas de jogo e carteira:** existem muitas rotas legadas, de diferentes versões e jogos incorporados. Não foi aplicada uma migração atômica universal a cada operação; todos os fluxos restantes precisam de revisão por jogo.
3. **Comissões:** o depósito fica protegido contra duplicação. A distribuição de comissões ocorre depois do commit do depósito; uma falha nesse trecho ainda exige reconciliação. Um outbox persistente com processamento idempotente é o próximo passo apropriado.
4. **Saque incerto:** o marcador de processamento permanece reservado quando o banco não confirma o envio. Isso evita uma segunda transferência, mas ainda falta uma tela completa de conciliação para o administrador resolver casos sem ID retornado pelo gateway.
5. **Histórico e migração:** nenhum registro real foi alterado. Aplicar regras, credenciais de servidor e versão nova exige preparação e teste de homologação. Eventos históricos e saldos inconsistentes não são corrigidos automaticamente.
6. **Integrações:** Dotfy, push, WhatsApp, pixels e fornecedores não foram testados com credenciais reais. O formato HMAC precisa ser confirmado com o gateway; callbacks incompatíveis serão recusados deliberadamente.
7. **Escala e interface:** a API continua concentrada em um arquivo grande, com consultas integrais e diversas interfaces legadas. A divisão de domínio, agregações e paginação de consultas no servidor ainda precisam de trabalho. O painel administrativo foi redesenhado com componentes e estilos compartilhados; as telas administrativas de configuração mantêm seus formulários legados com a nova apresentação. A UI dos jogos e a área do jogador não foram redesenhadas nesta etapa.

Não houve publicação do site ou operações financeiras reais. Os assets existentes dos jogos foram mantidos no pacote; dependências instaladas, builds reproduzíveis, segredos locais e dados de sessão/notificação de execução não fazem parte do ZIP.

## Redesign do painel administrativo

- Layout claro em azul e branco, tipografia e cartões consistentes, menu por área, estados de carregamento/erro e navegação conforme permissões.
- Visão geral com números financeiros separados, gráfico por período, tabela dos valores, fila de atenção, atividade recente e aquisição de usuários.
- Busca rápida de telas e usuários por Ctrl/Cmd+K, densidade compacta e atualização automática opcional.
- Central de pendências com anotações persistidas, prioridade, responsável, data e proteção transacional contra sobrescrita concorrente.
- Saques com busca, filtros, ordenação, detalhes, exportação CSV autorizada e confirmação contextual. Foi removida a aprovação em lote; o resultado exibido vem da atualização do servidor. A janela também acompanha mudanças de estado para bloquear reenvio após uma reserva ou resposta incerta.
- Atividade real da instância no lugar de logs de exemplo e indicadores fictícios de disponibilidade. Retenção em memória: até 300 eventos, sem persistência após reinício.
- Modais com controle de foco, Escape e scroll; tabelas convertidas em cartões no celular e menu inferior com área segura.

### Verificação desta etapa

TypeScript, os 16 testes e o build cliente/servidor passaram. O build mantém aviso de chunk principal acima de 500 KB; o painel é carregado separadamente.

No navegador Chromium, com APIs simuladas apenas para QA, foram verificados: renderização desktop (1440 × 1080), período do gráfico e tabela, busca de usuário, salvamento de prioridade/revisão, manutenção do saque pendente após envio, esquema dos eventos, navegação móvel (390 × 844), cartões e modais. Não houve erros não tratados do React/navegador nem overflow horizontal da página móvel verificada. As capturas ilustrativas estão em `docs/admin-previews/`.

Esta validação não usa contas, banco ou gateway reais. As permissões e integrações precisam ser conferidas no ambiente de homologação; a central auxilia a revisão, mas não resolve automaticamente conciliações bancárias.
