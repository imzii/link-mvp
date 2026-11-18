// 화면과 관계없는 작은 도구들

export const $ = sel => document.querySelector(sel);
export const $$ = sel => [...document.querySelectorAll(sel)];

/** 선택자에 맞는 모든 요소에 이벤트를 단다. */
export const on = (sel, event, handler) => $$(sel).forEach(el => el.addEventListener(event, handler));

/** HTML에 끼워 넣을 문자열을 안전하게 바꾼다. 사용자가 입력한 값은 반드시 거친다. */
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';     // 헷갈리는 0/O, 1/I 제외
const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';
/** 무작위 문자열. 초대 코드는 기본 문자 집합(대문자), 내부 id는 소문자를 쓴다. */
export const randomId = (length = 6, chars = CODE_CHARS) =>
  Array.from(crypto.getRandomValues(new Uint8Array(length)), b => chars[b % chars.length]).join('');
export const newId = (prefix, length = 8) => prefix + randomId(length, ID_CHARS);

/** localStorage는 막혀 있을 수 있으므로 항상 try로 감싼다. */
export const storage = {
  get(key, ...fallbackKeys) {
    for (const k of [key, ...fallbackKeys]) {
      try { const v = JSON.parse(localStorage.getItem(k)); if (v != null) return v; } catch (e) { /* 무시 */ }
    }
    return null;
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 무시 */ } },
};

export function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el.hideTimer);
  el.hideTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('복사했어요'); }
  catch (e) { toast('자동 복사가 막혀 있어요. 길게 눌러 복사해 주세요'); }
}

// ---------- 날짜 · 시간 ----------
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (isoDate, days) => {
  const d = new Date(isoDate + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};
export const daysBetween = (fromIso, toIso) => Math.round((new Date(toIso) - new Date(fromIso)) / 864e5);
/** '2026-11-24' → '11/24' */
export const shortDate = iso => { const [, m, d] = iso.split('-'); return `${+m}/${+d}`; };

/** 남은 시간을 읽기 좋게. 1시간 미만은 '9:41', 그 이상은 '2일 3시간', '5시간 20분'. */
export function formatRemaining(ms) {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const days = Math.floor(totalSec / 86400), hours = Math.floor(totalSec % 86400 / 3600), mins = Math.floor(totalSec % 3600 / 60);
  if (days) return `${days}일 ${hours}시간`;
  if (hours) return `${hours}시간 ${mins}분`;
  return `${mins}:${String(totalSec % 60).padStart(2, '0')}`;
}

/** 분 단위를 '10분', '12시간', '3일'로. */
export function formatMinutes(min) {
  if (min % 1440 === 0) return `${min / 1440}일`;
  if (min % 60 === 0) return `${min / 60}시간`;
  return `${min}분`;
}
