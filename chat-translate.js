/**
 * Traducción del chat — idioma nativo por persona (pt / es / en).
 */

const STORAGE_KEY = 'ChocolateCerezaChatLang';

/** @type {Map<string, string>} */
const cache = new Map();

/** @type {Map<string, { showingTranslated: boolean, translated?: string, original?: string }>} */
const msgState = new Map();

const SUPPORTED = ['pt', 'es', 'en'];

const LANG_META = {
  pt: {
    name: 'Português (BR)',
    short: 'PT',
    translateBtn: {
      pt: 'Traduzir para português',
      es: 'Traducir al portugués',
      en: 'Translate to Portuguese',
    },
    sameMsg: {
      pt: 'Esta mensagem já está em português.',
      es: 'Este mensaje ya está en portugués.',
      en: 'This message is already in Portuguese.',
    },
    errorMsg: {
      pt: 'Não deu para traduzir — tenta de novo.',
      es: 'No se pudo traducir — prueba otra vez.',
      en: 'Could not translate — try again.',
    },
    chatPlaceholder: 'Escreva uma mensagem…',
    chatEmpty: 'Diga oi 👋',
  },
  es: {
    name: 'Español (MX)',
    short: 'ES',
    translateBtn: {
      pt: 'Traduzir para espanhol',
      es: 'Traducir al español',
      en: 'Translate to Spanish',
    },
    sameMsg: {
      pt: 'Esta mensagem já está em espanhol.',
      es: 'Este mensaje ya está en español.',
      en: 'This message is already in Spanish.',
    },
    errorMsg: {
      pt: 'Não deu para traduzir — tenta de novo.',
      es: 'No se pudo traducir — prueba otra vez.',
      en: 'Could not translate — try again.',
    },
    chatPlaceholder: 'Escribe un mensaje…',
    chatEmpty: 'Di hola 👋',
  },
  en: {
    name: 'English (US)',
    short: 'EN',
    translateBtn: {
      pt: 'Traduzir para inglês',
      es: 'Traducir al inglés',
      en: 'Translate to English',
    },
    sameMsg: {
      pt: 'Esta mensagem já está em inglês.',
      es: 'Este mensaje ya está en inglés.',
      en: 'This message is already in English.',
    },
    errorMsg: {
      pt: 'Não deu para traduzir — tenta de novo.',
      es: 'No se pudo traducir — prueba otra vez.',
      en: 'Could not translate — try again.',
    },
    chatPlaceholder: 'Write a message…',
    chatEmpty: 'Say hi 👋',
  },
};

function normalizeLangCode(input) {
  const raw = String(input || '').trim().toLowerCase();
  if (raw.startsWith('pt')) return 'pt';
  if (raw.startsWith('en')) return 'en';
  if (raw.startsWith('es')) return 'es';
  return '';
}

function detectBrowserChatLang() {
  const nav = (navigator.language || navigator.userLanguage || 'es').toLowerCase();
  return normalizeLangCode(nav) || 'es';
}

function readStoredChatLang() {
  try {
    const fromStorage = normalizeLangCode(localStorage.getItem(STORAGE_KEY));
    if (fromStorage) return fromStorage;
  } catch (_) { /* ignore */ }
  return '';
}

/**
 * @returns {'pt'|'es'|'en'}
 */
export function getTranslateTargetLang() {
  const saved = readStoredChatLang();
  if (saved) return saved;
  return detectBrowserChatLang();
}

export function getChatLanguageOptions() {
  return SUPPORTED.map((code) => ({ code, label: LANG_META[code].name }));
}

/**
 * @param {'pt'|'es'|'en'} lang
 */
export function setChatLanguage(lang) {
  const code = normalizeLangCode(lang) || detectBrowserChatLang();
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch (_) { /* ignore */ }
  return code;
}

export function getTranslateTargetLabel() {
  const lang = getTranslateTargetLang();
  return LANG_META[lang]?.name?.replace(/\s*\([^)]*\)/, '') || lang;
}

export function getTranslateButtonLabel(targetLang = getTranslateTargetLang()) {
  const uiLang = getTranslateTargetLang();
  const target = normalizeLangCode(targetLang) || uiLang;
  return LANG_META[target]?.translateBtn?.[uiLang]
    || LANG_META[uiLang]?.translateBtn?.[uiLang]
    || 'Translate';
}

export function getSameLanguageMessage() {
  const uiLang = getTranslateTargetLang();
  return LANG_META[uiLang]?.sameMsg?.[uiLang] || 'Already in your language.';
}

export function getTranslateErrorMessage() {
  const uiLang = getTranslateTargetLang();
  return LANG_META[uiLang]?.errorMsg?.[uiLang] || 'Could not translate.';
}

export function getChatPlaceholder() {
  const uiLang = getTranslateTargetLang();
  return LANG_META[uiLang]?.chatPlaceholder || LANG_META.es.chatPlaceholder;
}

export function getChatEmptyMessage() {
  const uiLang = getTranslateTargetLang();
  return LANG_META[uiLang]?.chatEmpty || LANG_META.es.chatEmpty;
}

export function clearTranslationCache() {
  cache.clear();
}

/**
 * Heurística simples para mensagens curtas de chat.
 * @param {string} text
 * @returns {'pt'|'es'|'en'|'auto'}
 */
export function detectMessageLang(text) {
  const t = String(text || '').toLowerCase();
  if (!t.trim()) return 'auto';

  const scores = { pt: 0, es: 0, en: 0 };

  const rules = {
    pt: /\b(você|voce|vc|tá|ta\b|tô|to\b|não|nao|obrigad|valeu|beleza|tudo bem|tudo bom|pra |pro |também|tambem|está|esta|como é|que tu|mensagem|português|portugues)\b/g,
    es: /\b(hola|qué|que tal|estás|estas|gracias|por favor|cómo|como est|cómo est|buenos|buenas|señor|señora|español|espanol|muy bien|todo bien)\b/g,
    en: /\b(the|you|are|how|what|where|thanks|thank|hello|please|don't|i'm|you're|english|message|good morning|good night|how are)\b/g,
  };

  Object.entries(rules).forEach(([lang, re]) => {
    const matches = t.match(re);
    scores[lang] = matches ? matches.length : 0;
  });

  if (/[ãõâêôç]/i.test(text)) scores.pt += 2;
  if (/[ñ¿¡]/i.test(text)) scores.es += 2;
  if (/\b(u|ur|ya|gonna|wanna)\b/i.test(text)) scores.en += 1;

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] <= 0) return 'auto';
  return /** @type {'pt'|'es'|'en'} */ (best[0]);
}

function stripAccents(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameTranslation(source, translated) {
  const a = stripAccents(source);
  const b = stripAccents(translated);
  if (!a || !b) return true;
  if (a === b) return true;
  if (a.length > 4 && (a.includes(b) || b.includes(a))) return true;
  return false;
}

function cleanupTranslation(text) {
  return String(text || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * @param {string} text
 * @param {string} [targetLang]
 */
export async function translateChatText(text, targetLang = getTranslateTargetLang()) {
  const source = (text || '').trim();
  if (!source) throw new Error('empty');
  if (source.length > 480) throw new Error('long');

  const tl = normalizeLangCode(targetLang) || getTranslateTargetLang();
  const detected = detectMessageLang(source);

  if (detected !== 'auto' && detected === tl) {
    throw new Error('same');
  }

  const cacheKey = `${tl}:${detected}:${source}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  let translated = '';
  const sourceLang = detected === 'auto' ? 'auto' : detected;

  try {
    translated = await fetchGoogleGtx(source, tl, sourceLang);
  } catch (_) {
    try {
      translated = await fetchMyMemory(source, tl, sourceLang);
    } catch (err) {
      throw err;
    }
  }

  translated = cleanupTranslation(translated);

  if (!translated || isSameTranslation(source, translated)) {
    throw new Error('same');
  }

  cache.set(cacheKey, translated);
  return translated;
}

async function fetchGoogleGtx(text, targetLang, sourceLang = 'auto') {
  const sl = sourceLang && sourceLang !== 'auto' ? sourceLang : 'auto';
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sl)}&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('http');
  const data = await res.json();
  const parts = Array.isArray(data?.[0]) ? data[0] : [];
  const out = parts.map((chunk) => chunk?.[0] || '').join('').trim();
  if (!out) throw new Error('empty');

  const detected = normalizeLangCode(data?.[2] || '');
  if (detected && detected === targetLang) throw new Error('same');

  return out;
}

async function fetchMyMemory(text, targetLang, sourceLang = 'auto') {
  const sl = sourceLang && sourceLang !== 'auto' ? sourceLang : 'auto';
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(`${sl}|${targetLang}`)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('http');
  const data = await res.json();
  if (data?.responseStatus && Number(data.responseStatus) !== 200) {
    throw new Error(String(data.responseStatus));
  }
  const out = cleanupTranslation(data?.responseData?.translatedText || '');
  if (!out || /^QUERY LENGTH LIMIT/i.test(out)) throw new Error('limit');
  return out;
}

/**
 * @param {string} msgId
 */
export function getMessageTranslationState(msgId) {
  return msgState.get(msgId) || null;
}

/**
 * @param {string} msgId
 * @param {{ showingTranslated: boolean, translated?: string, original?: string }} state
 */
export function setMessageTranslationState(msgId, state) {
  if (!msgId) return;
  msgState.set(msgId, state);
}

export function clearMessageTranslationStates() {
  msgState.clear();
}

export function getAllMessageTranslationStates() {
  return msgState;
}
