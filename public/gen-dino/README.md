# GEN DINO — Arcade mobile

Experiência de arcade mobile-first construída sobre o runner enviado, com uma camada visual completa para celular.

## O que está pronto

- Login, cadastro e modo visitante salvos localmente no navegador.
- Página inicial com perfil, carteira de moedas virtuais e progresso.
- Tela interna sem cards: pista branca em tela cheia, botão Sair e saldo em R$ no topo, e Cashout fixo na parte inferior.
- Moedas virtuais pequenas atravessam a própria pista e são adicionadas à carteira quando o Dino as coleta.
- Layout responsivo, com uma moldura otimizada para celulares e suporte a área segura de telas modernas.
- Arte de capa e moeda incluídas no projeto.

> Este é um protótipo de arcade com moedas virtuais. Não há depósito, saque, pagamentos ou apostas com dinheiro real.

## Abrir o projeto

Não exige Node, build ou instalação de pacotes. Basta extrair o ZIP e abrir `index.html` no navegador.

No Windows, pelo Prompt de Comando:

```bat
cd /d "%USERPROFILE%\Downloads\gen-dino-mobile-igaming"
start index.html
```

No macOS, pelo Terminal:

```bash
cd ~/Downloads/gen-dino-mobile-igaming
open index.html
```

Para testar no celular na mesma rede, você pode hospedar a pasta com qualquer servidor estático simples.

## Controles

- Toque/click na pista: começa a correr e faz o Dino pular.
- Botão `CASHOUT`: encerra uma corrida após coletar moedas.
- No teclado: use espaço ou seta para cima para pular.

## Estrutura principal

```text
index.html          telas de acesso, início e jogo
css/app.css         interface mobile-first
js/app.js           contas locais, carteira e recompensas
js/script.js        motor original do runner
images/moeda.png    moeda usada na interface
images/gen-dino-cover.png  arte de destaque da página inicial
```
