/**
 * Utilitários de Validação e Formatação de Telefone para o Brasil
 * Especialmente projetado para exportação e integração de Influenciadores no WhatsApp.
 */

/**
 * Lista de DDDs oficiais e válidos no Brasil (Anatel)
 */
export const VALID_BRAZILIAN_DDDS = new Set([
  // Região 1 (SP)
  '11', '12', '13', '14', '15', '16', '17', '18', '19',
  // Região 2 (RJ, ES)
  '21', '22', '24', '27', '28',
  // Região 3 (MG)
  '31', '32', '33', '34', '35', '37', '38',
  // Região 4 (PR, SC)
  '41', '42', '43', '44', '45', '46', '47', '48', '49',
  // Região 5 (RS)
  '51', '53', '54', '55',
  // Região 6 (DF, GO, TO, MT, MS, AC, RO)
  '61', '62', '64', '63', '65', '66', '67', '68', '69',
  // Região 7 (BA, SE)
  '71', '73', '74', '75', '77', '79',
  // Região 8 (PE, AL, PB, RN, CE, PI)
  '81', '82', '83', '84', '85', '86', '87', '88', '89',
  // Região 9 (PA, AM, RR, AP, MA)
  '91', '92', '93', '94', '95', '96', '97', '98', '99'
]);

/**
 * Extrai apenas dígitos numéricos de qualquer string.
 */
export function extractDigits(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return '';
  return phone.replace(/\D/g, '');
}

/**
 * Limpa o prefixo internacional '55' caso presente, retornando apenas DDD + Número local.
 */
export function getLocalPhoneDigits(phone: string | null | undefined): string {
  let digits = extractDigits(phone);
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.substring(2);
  }
  return digits;
}

/**
 * Verifica estritamente se uma sequência de dígitos é um celular brasileiro com 11 dígitos (DDD + 9XXXX-XXXX).
 */
export function isCellPhone11Digits(digits: string): boolean {
  if (!digits || digits.length !== 11) return false;
  const ddd = digits.substring(0, 2);
  if (!VALID_BRAZILIAN_DDDS.has(ddd)) return false;
  if (digits.charAt(2) !== '9') return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

/**
 * Valida se um número de telefone é válido (celular de 11 dígitos ou fixo de 10 dígitos).
 */
export function isValidBrazilianPhone(phone: string | null | undefined): boolean {
  if (!phone || typeof phone !== 'string') return false;
  
  const lower = phone.toLowerCase().trim();
  if (
    lower.includes('não informado') || 
    lower.includes('nao informado') || 
    lower.includes('null') || 
    lower.includes('undefined') ||
    lower.includes('teste')
  ) {
    return false;
  }

  const digits = getLocalPhoneDigits(phone);

  // Celular padrão com 11 dígitos (DDD + 9 + 8 dígitos)
  if (isCellPhone11Digits(digits)) {
    return true;
  }

  // Fixo com 10 dígitos (DDD + 8 dígitos)
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2);
    if (!VALID_BRAZILIAN_DDDS.has(ddd)) return false;
    if (!['2', '3', '4', '5'].includes(digits.charAt(2))) return false;
    if (/^(\d)\1+$/.test(digits)) return false;
    return true;
  }

  return false;
}

export type PhoneRepairMethod =
  | 'original'
  | 'add_9'
  | 'remove_9'
  | 'remove_leading_9'
  | 'remove_trailing'
  | 'strip_prefix'
  | 'strip_carrier'
  | 'add_ddd_11'
  | 'add_ddd_and_9'
  | 'heuristics_repaired';

export interface HealedPhoneResult {
  isValid: boolean;
  wasRepaired: boolean;
  rawPhone: string;
  healedPhone: string;
  formattedPhone: string;
  whatsappNumber: string;
  whatsappLink: string;
  method: PhoneRepairMethod;
  label: string;
}

// Códigos de Seleção de Prestadora (CSP / operadoras do Brasil)
const BRAZILIAN_CARRIER_CODES = ['12', '14', '15', '21', '23', '25', '31', '41', '43'];

/**
 * MOTOR INTELIGENTE DE AUTO-CORREÇÃO E VALIDAÇÃO DE TELEFONE (WhatsApp)
 * Aplica múltiplas heurísticas para validar e reparar números:
 * 1. Remove prefixos internacionais '55', '+55', '0055' e zeros à esquerda
 * 2. Remove códigos de operadora (CSP: 015, 021, 031, 041, etc.)
 * 3. ACRESCENTA O 9 (+9) em números com 10 dígitos (DDD + 8 dígitos) e em prefixados
 * 4. TIRA O 9 (-9) duplicado após o DDD (DD99... -> DD9...)
 * 5. TIRA O 9 (-9) digitado antes do DDD (9DD9... -> DD9...)
 * 6. TIRA dígitos acidentais excedentes no final (12 ou 13 dígitos)
 * 7. Adiciona DDD 11 caso o usuário tenha digitado apenas o celular local de 9 ou 8 dígitos
 */
export function healPhoneNumber(rawPhone: string | null | undefined): HealedPhoneResult | null {
  if (!rawPhone || typeof rawPhone !== 'string') return null;

  const trimmed = rawPhone.trim();
  const lower = trimmed.toLowerCase();
  if (
    lower === '' ||
    lower.includes('não informado') ||
    lower.includes('nao informado') ||
    lower === '0' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('teste')
  ) {
    return null;
  }

  // Extrai somente os dígitos
  let digits = rawPhone.replace(/\D/g, '');
  if (!digits || digits.length < 8) return null;

  // 1. Já é celular estritamente válido com 11 dígitos
  if (isCellPhone11Digits(digits)) {
    return {
      isValid: true,
      wasRepaired: false,
      rawPhone: trimmed,
      healedPhone: digits,
      formattedPhone: formatPhoneDisplay(digits),
      whatsappNumber: `55${digits}`,
      whatsappLink: `https://wa.me/55${digits}`,
      method: 'original',
      label: 'WhatsApp Válido ✅'
    };
  }

  // Lista de candidatos gerados por limpeza de prefixos (DDI 55, zeros, CSP)
  const candidateVariants: Array<{ digits: string; origin: PhoneRepairMethod; label: string }> = [];

  // Limpeza de DDI 55 / 0055 e zeros iniciais
  let cleaned = digits;
  if (cleaned.startsWith('0055')) cleaned = cleaned.substring(4);
  else if (cleaned.startsWith('55') && cleaned.length >= 12) cleaned = cleaned.substring(2);
  cleaned = cleaned.replace(/^0+/, '');

  if (cleaned !== digits) {
    candidateVariants.push({
      digits: cleaned,
      origin: 'strip_prefix',
      label: 'Prefixo 0/55 Removido ✂️'
    });
  }

  // Limpeza de Códigos de Operadora (CSP: 015, 021, etc. totalizando 13 ou 14 dígitos)
  for (const csp of BRAZILIAN_CARRIER_CODES) {
    if (cleaned.startsWith(csp) && cleaned.length >= 12) {
      const withoutCSP = cleaned.substring(csp.length);
      const possibleDDD = withoutCSP.substring(0, 2);
      if (VALID_BRAZILIAN_DDDS.has(possibleDDD)) {
        candidateVariants.push({
          digits: withoutCSP,
          origin: 'strip_carrier',
          label: `Código Operadora (${csp}) Removido ✂️`
        });
      }
    }
  }

  // Também inclui a versão original dos dígitos
  candidateVariants.push({
    digits,
    origin: 'strip_prefix',
    label: 'Prefixo 0/55 Removido ✂️'
  });

  // Teste 1: Alguma das versões limpas já é 11 dígitos válido?
  for (const cand of candidateVariants) {
    if (isCellPhone11Digits(cand.digits)) {
      return {
        isValid: true,
        wasRepaired: true,
        rawPhone: trimmed,
        healedPhone: cand.digits,
        formattedPhone: formatPhoneDisplay(cand.digits),
        whatsappNumber: `55${cand.digits}`,
        whatsappLink: `https://wa.me/55${cand.digits}`,
        method: cand.origin,
        label: cand.label
      };
    }
  }

  // Teste 2: ACRESCENTAR UM 9 (+9)
  // Formato: 10 dígitos (DDD + 8 dígitos) -> DDD + 9 + 8 dígitos
  // Ex: 1188887777 -> 11988887777 ou 8193838333 -> 81993838333
  for (const cand of candidateVariants) {
    if (cand.digits.length === 10) {
      const ddd = cand.digits.substring(0, 2);
      if (VALID_BRAZILIAN_DDDS.has(ddd)) {
        const with9 = ddd + '9' + cand.digits.substring(2);
        if (isCellPhone11Digits(with9)) {
          return {
            isValid: true,
            wasRepaired: true,
            rawPhone: trimmed,
            healedPhone: with9,
            formattedPhone: formatPhoneDisplay(with9),
            whatsappNumber: `55${with9}`,
            whatsappLink: `https://wa.me/55${with9}`,
            method: 'add_9',
            label: '9º Dígito Adicionado (+9) ⚡'
          };
        }
      }
    }
  }

  // Teste 3: TIRAR UM 9 (-9)
  // Formato A: 12 dígitos com 9 duplicado após o DDD (DD99... -> DD9...)
  // Ex: 819938383333 -> 81938383333 ou 119988887777 -> 11988887777
  for (const cand of candidateVariants) {
    if (cand.digits.length === 12) {
      const ddd = cand.digits.substring(0, 2);
      if (VALID_BRAZILIAN_DDDS.has(ddd)) {
        // 9 duplicado logo após o DDD (posições 2 e 3 são '99')
        if (cand.digits.substring(2, 4) === '99') {
          const withoutExtra9 = ddd + '9' + cand.digits.substring(4);
          if (isCellPhone11Digits(withoutExtra9)) {
            return {
              isValid: true,
              wasRepaired: true,
              rawPhone: trimmed,
              healedPhone: withoutExtra9,
              formattedPhone: formatPhoneDisplay(withoutExtra9),
              whatsappNumber: `55${withoutExtra9}`,
              whatsappLink: `https://wa.me/55${withoutExtra9}`,
              method: 'remove_9',
              label: '9 Duplicado Removido (-9) ✂️'
            };
          }
        }
        // Formato B: 9 acidental no final (termina com 9 e tamanho 12)
        if (cand.digits.endsWith('9')) {
          const trimmedTrailing9 = cand.digits.substring(0, 11);
          if (isCellPhone11Digits(trimmedTrailing9)) {
            return {
              isValid: true,
              wasRepaired: true,
              rawPhone: trimmed,
              healedPhone: trimmedTrailing9,
              formattedPhone: formatPhoneDisplay(trimmedTrailing9),
              whatsappNumber: `55${trimmedTrailing9}`,
              whatsappLink: `https://wa.me/55${trimmedTrailing9}`,
              method: 'remove_9',
              label: '9 Final Extra Removido (-9) ✂️'
            };
          }
        }
      }

      // Formato C: 9 digitado antes do DDD (ex: 911988887777 -> 11988887777)
      if (cand.digits.startsWith('9')) {
        const withoutLeading9 = cand.digits.substring(1);
        if (isCellPhone11Digits(withoutLeading9)) {
          return {
            isValid: true,
            wasRepaired: true,
            rawPhone: trimmed,
            healedPhone: withoutLeading9,
            formattedPhone: formatPhoneDisplay(withoutLeading9),
            whatsappNumber: `55${withoutLeading9}`,
            whatsappLink: `https://wa.me/55${withoutLeading9}`,
            method: 'remove_leading_9',
            label: '9 Inicial Removido (-9) ✂️'
          };
        }
      }
    }
  }

  // Teste 4: TIRAR DÍGITO EXTRA NO FINAL (12 ou 13 dígitos)
  // Ex: 119888877770 -> 11988887777 (usuário apertou 0 ou Enter acidental)
  for (const cand of candidateVariants) {
    if (cand.digits.length === 12) {
      const trimmed11 = cand.digits.substring(0, 11);
      if (isCellPhone11Digits(trimmed11)) {
        return {
          isValid: true,
          wasRepaired: true,
          rawPhone: trimmed,
          healedPhone: trimmed11,
          formattedPhone: formatPhoneDisplay(trimmed11),
          whatsappNumber: `55${trimmed11}`,
          whatsappLink: `https://wa.me/55${trimmed11}`,
          method: 'remove_trailing',
          label: 'Dígito Final Extra Removido ✂️'
        };
      }
    }
    if (cand.digits.length === 13) {
      const trimmed11 = cand.digits.substring(0, 11);
      if (isCellPhone11Digits(trimmed11)) {
        return {
          isValid: true,
          wasRepaired: true,
          rawPhone: trimmed,
          healedPhone: trimmed11,
          formattedPhone: formatPhoneDisplay(trimmed11),
          whatsappNumber: `55${trimmed11}`,
          whatsappLink: `https://wa.me/55${trimmed11}`,
          method: 'remove_trailing',
          label: 'Dígitos Extras Finais Removidos ✂️'
        };
      }
    }
  }

  // Teste 5: SE TEM 9 DÍGITOS COMEÇANDO COM 9 (usuário digitou só o celular sem DDD)
  // Adiciona DDD padrão 11
  for (const cand of candidateVariants) {
    if (cand.digits.length === 9 && cand.digits.charAt(0) === '9') {
      const withDDD11 = '11' + cand.digits;
      if (isCellPhone11Digits(withDDD11)) {
        return {
          isValid: true,
          wasRepaired: true,
          rawPhone: trimmed,
          healedPhone: withDDD11,
          formattedPhone: formatPhoneDisplay(withDDD11),
          whatsappNumber: `55${withDDD11}`,
          whatsappLink: `https://wa.me/55${withDDD11}`,
          method: 'add_ddd_11',
          label: 'DDD 11 Adicionado (+DDD) 📍'
        };
      }
    }
  }

  // Teste 6: SE TEM 8 DÍGITOS (digitou sem DDD e sem o 9)
  // Adiciona DDD 11 + 9
  for (const cand of candidateVariants) {
    if (cand.digits.length === 8) {
      const withDDD9 = '119' + cand.digits;
      if (isCellPhone11Digits(withDDD9)) {
        return {
          isValid: true,
          wasRepaired: true,
          rawPhone: trimmed,
          healedPhone: withDDD9,
          formattedPhone: formatPhoneDisplay(withDDD9),
          whatsappNumber: `55${withDDD9}`,
          whatsappLink: `https://wa.me/55${withDDD9}`,
          method: 'add_ddd_and_9',
          label: 'DDD 11 e 9º Adicionados 📍'
        };
      }
    }
  }

  // Teste 7: Se tem 10 dígitos e é um fixo válido
  if (digits.length === 10) {
    const ddd = digits.substring(0, 2);
    if (VALID_BRAZILIAN_DDDS.has(ddd)) {
      return {
        isValid: true,
        wasRepaired: false,
        rawPhone: trimmed,
        healedPhone: digits,
        formattedPhone: formatPhoneDisplay(digits),
        whatsappNumber: `55${digits}`,
        whatsappLink: `https://wa.me/55${digits}`,
        method: 'original',
        label: 'Telefone Fixo (10 Dígitos) ☎️'
      };
    }
  }

  return null;
}

/**
 * Retorna o telefone efetivo corrigido ou o original.
 */
export function getEffectivePhone(phone: string | null | undefined): string {
  const healed = healPhoneNumber(phone);
  return healed ? healed.healedPhone : (phone || '');
}

/**
 * Retorna o número formatado no padrão visual brasileiro (XX) XXXXX-XXXX ou (XX) XXXX-XXXX.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return 'Não informado';
  const digits = getLocalPhoneDigits(phone);

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  
  // Se for internacional ou tamanho diferente, retorna dígitos limpos
  return extractDigits(phone) || phone;
}

/**
 * Retorna o número pronto para WhatsApp com DDI 55 (ex: 5511987654321).
 */
export function getWhatsAppNumber(phone: string | null | undefined): string {
  const digits = getLocalPhoneDigits(phone);
  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }
  const raw = extractDigits(phone);
  if (raw.startsWith('55')) return raw;
  return `55${raw}`;
}

/**
 * Gera um link direto wa.me para abrir o chat no WhatsApp.
 */
export function getWhatsAppLink(phone: string | null | undefined, text?: string): string {
  const num = getWhatsAppNumber(phone);
  const base = `https://wa.me/${num}`;
  if (text) {
    return `${base}?text=${encodeURIComponent(text)}`;
  }
  return base;
}
