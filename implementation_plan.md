# Implementation Plan - Criptografia Total do Sistema e Ocultação de Chaves

Fortalecimento abrangente da segurança do sistema: criptografia de dados sensíveis em repouso (AES-256-GCM), eliminação completa de chaves e segredos expostos no código-fonte, mascaramento rigoroso de credenciais em endpoints administrativos e proteção de banco de dados.

## Security Threat Model

### 1. Component Purpose
- **Aplicação**: Plataforma de jogos, pagamentos e afiliados (PayGateway & Alliance Hub).
- **Consumidores**: Jogadores finais, afiliados, influenciadores, administradores e webhooks externos de gateway de pagamento (Dotfy).
- **Contexto**: Backend Node.js/Express com banco de dados Firestore e frontend React/Vite.

### 2. Entry Points & Untrusted Inputs
- **Autenticação & Registro**: `/api/auth/login`, `/api/auth/register` (credenciais de usuários).
- **Painel Administrativo**: `/api/admin/dotfy/config` (chaves de API, webhook secrets).
- **Webhooks**: `/api/webhooks/pix` (notificações de pagamento PIX externas).
- **APIs de Jogos & Saques**: `/api/withdrawals`, `/api/game/*` (solicitações financeiras).

### 3. Trust Boundaries & Auth Assumptions
- **Fronteira Cliente-Servidor**: Navegador do usuário/jogador e painel de afiliados comunicando via tokens de sessão assinados (`tok_sec_...`).
- **Fronteira Servidor-Gateway**: Comunicação autenticada de backend com Dotfy API via Bearer token.
- **Fronteira Servidor-Banco**: Firestore e memória local para persistência de dados.

### 4. Sensitive Data Paths & Privileged Actions
- **Chaves de API do Gateway**: Tokens Dotfy (`vk_live_...`), segredos de Webhook (`WEBHOOK_SECRET`), chave privada VAPID (`VAPID_PRIVATE_KEY`).
- **Senhas de Usuários**: Hashes scrypt armazenados no banco.
- **Transações e PIX**: Dados financeiros e chaves PIX de jogadores e afiliados.

### 5. Priority Review Areas
- Eliminar chaves live hardcoded nos arquivos de código (`server.ts`, `AdminVpsMigrationModal.tsx`).
- Criptografar chaves de gateway no banco de dados com AES-256-GCM.
- Impedir vazamento de chaves brutas (`rawKey`) em respostas de API JSON para o navegador.
- Proteger regras do Firestore para prevenir leitura não autorizada de coleções sensíveis (`settings/dotfy`).

---

## Proposed Changes

### 1. Cryptographic Engine (`server/security.ts`)
- Implementar criptografia autenticada simétrica AES-256-GCM (`encryptSensitiveData` e `decryptSensitiveData`) com IV dinâmico e tag de autenticação de 16 bytes.
- Derivar chave mestra de 256 bits via HKDF a partir de `SYSTEM_ENCRYPTION_KEY` ou `JWT_SECRET`.
- Criar cofre de segredos criptografado em disco (`.system_secrets.vault`) para persistir chaves de forma cifrada sem deixar texto puro no código.
- Implementar função de mascaramento universal `maskSecretKey(key, prefixLen, suffixLen)`.

### 2. Remoção de Chaves Hardcoded & Ocultação
- Substituir a constante estática `DEFAULT_API_KEY` por resolução segura: variável de ambiente `DOTFY_API_KEY` -> cofre criptografado -> banco cifrado.
- Remover a chave live `[CHAVE REMOVIDA — CONFIGURAR VIA AMBIENTE]` do arquivo `server.ts` e de `AdminVpsMigrationModal.tsx`.
- Gerar/proteger `VAPID_PRIVATE_KEY` sem chave estática hardcoded no repositório.

### 3. Criptografia em Repouso no Banco (`server/db.ts`)
- Em `saveDotfyConfig`: cifrar `activeApiKey`, `secondaryApiKey` e `webhookSecret` com `encryptSensitiveData` antes de gravar no Firestore ou na memória.
- Em `getDotfyConfig`: decifrar de forma transparente os dados ao carregar.
- No `exportCompleteDatabase`: sanitizar e nunca expor chaves em texto puro no dump de backup.

### 4. Mascaramento no Painel Admin (`server.ts` & `src/components/admin/AdminDotfyTab.tsx`)
- Remover o campo `rawKey` em `/api/admin/dotfy/overview`; retornar apenas `keyMasked`.
- Ajustar `AdminDotfyTab.tsx` para não depender de `rawKey` e informar ao usuário que as chaves estão criptografadas e protegidas contra ataques.

### 5. Regras do Firestore (`firestore.rules`)
- Restringir acesso direto à coleção `settings` e documentos de configuração, assegurando que o cliente não consiga ler segredos do Firestore diretamente.

---

## Verification Plan

### Security Verification
- **Security Scan**: Inspecionar todos os arquivos modificados e criados verificando ausência de chaves em texto puro, integridade criptográfica AES-256-GCM, proteção de variáveis de ambiente e sanitização de respostas.
- **Security Audit**: Auditar a implementação em conformidade com o Threat Model e documentar todos os achados, status e correções em `walkthrough.md` utilizando a habilidade `generate-security-audit-report`.
- **Build & Lint**: Executar `lint_applet` e `compile_applet` para assegurar compilação bem-sucedida e estabilidade da aplicação.
