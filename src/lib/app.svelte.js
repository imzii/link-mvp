// 앱 전체가 함께 보는 상태와, 방(room) 데이터를 읽는 도우미들.

import { storage, toast } from './util.js';
import { TYPES, AVATAR_COLORS } from './content.js';

const params = new URLSearchParams(location.search);

export const app = $state({
  code: (params.get('r') || '').toUpperCase(),  // 지금 연 프로젝트의 초대 코드 ('' = 첫 화면)
  room: null,        // 서버에서 받은 프로젝트 문서
  me: null,          // 이 기기 사용자의 id
  hasRemote: false,  // Firebase 설정이 있는지
  isLocal: false,    // 이 프로젝트를 로컬 저장소로 여는지 (시뮬레이션 등)
  ui: null,          // 이 기기에만 남기는 입력 중 상태 (작성 중인 카드 등)
});

/** 이 기기의 사용자 id. 프로젝트별로 '다른 기기에서 이어하기'를 하면 그 id를 쓴다. */
export function resolveMe({ allowTestOverride }) {
  const test = allowTestOverride && params.get('as');           // 로컬 테스트 전용
  const perRoom = storage.get('popcorn.uid.' + app.code, 'link.uid.' + app.code);
  let device = storage.get('popcorn.uid', 'link.uid');
  if (!device) { device = 'u' + Math.random().toString(36).slice(2, 12); storage.set('popcorn.uid', device); }
  return test || perRoom || device;
}

export function claimIdentity(memberId) { storage.set('popcorn.uid.' + app.code, memberId); }

const uiKey = () => `popcorn.ui.${app.code}.${app.me}`;
export function loadUi() {
  app.ui = storage.get(uiKey()) || { draft: '', why: '', hintIndex: 0, whyChain: [], quiz: [], profile: { wants: [] } };
}
export const saveUi = () => storage.set(uiKey(), $state.snapshot(app.ui));

/** 저장소(Local 또는 Firebase). 반응형으로 감쌀 필요가 없어 app 밖에 둔다. */
export const backend = { store: null };

/** 방 데이터 일부를 저장한다. 실패해도 화면은 다음 갱신 때 서버 상태로 돌아간다. */
export const save = patch => backend.store.update(app.code, patch).catch(err => {
  console.error(err);
  toast('저장하지 못했어요. 연결을 확인해 주세요');
});

// ---------- 방 데이터 읽기 ----------

/** 예전 단계 이름(LINK 시절)을 지금 이름으로 바꿔 읽는다. */
const LEGACY_PHASE = { lobby: 'fit', in: 'pop', sync: 'mix', up: 'run', match: 'fit' };
export const currentPhase = () => LEGACY_PHASE[app.room.phase] || app.room.phase;

export const isLeader = () => app.room?.hostId === app.me;

/** 참여한 순서대로 정렬한 [id, 팀원] 목록. 순서가 기기마다 같아야 화면이 흔들리지 않는다. */
export const members = (room = app.room) =>
  Object.entries(room?.members || {}).sort((a, b) => (a[1].joinedAt || 0) - (b[1].joinedAt || 0));

export const memberName = id => app.room?.members?.[id]?.name || '미배정';

/** 팀원 아바타의 글자와 색. 참여 순서로 색을 정해 기기마다 같게 보인다. */
export function avatarOf(id) {
  const index = Math.max(0, members().findIndex(([m]) => m === id));
  return { initial: (memberName(id) || '?')[0], color: AVATAR_COLORS[index % AVATAR_COLORS.length] };
}

export const cardsOf = memberId => Object.entries(app.room.cards || {}).filter(([, c]) => c.by === memberId);

// ---------- 프로젝트 유형 ----------

export const typeKeys = (room = app.room) => {
  const keys = room.types?.length ? room.types : [room.type || 'plan'];
  return keys.filter(k => TYPES[k]);
};

const unique = (items, keyOf = x => x) => {
  const seen = new Set();
  return items.filter(item => { const k = keyOf(item); if (seen.has(k)) return false; seen.add(k); return true; });
};

/** 고른 유형들을 합친 결과. 여러 유형을 고르면 질문·역할·업무가 합쳐진다. */
export function typeProfile(room = app.room) {
  const keys = typeKeys(room);
  return {
    names: keys.map(k => TYPES[k].name),
    question: TYPES[keys[0]].question,
    opinion: TYPES[keys[0]].opinion,
    criteria: unique(keys.flatMap(k => TYPES[k].criteria)),
    hints: keys.flatMap(k => TYPES[k].hints.map(q => ({ q, tag: TYPES[k].name }))),
    roles: unique(keys.flatMap(k => TYPES[k].roles), r => r[0]),
    tasks: unique(keys.flatMap(k => TYPES[k].tasks), t => t[0]),
  };
}

// ---------- 정할 것 (라운드) ----------
// 지금 정하는 것은 문서 맨 위(topic, cards, mix)에 있고, 끝난 라운드는 rounds.{번호}에 보관한다.

export const roundNumber = (room = app.room) => room.round || 1;
const finalOf = r => (r.mix?.final || r.sync?.final)?.text || '';

/** 지금까지 정한 것들. 오래된 순서. */
export function decisions(room = app.room) {
  const past = Object.entries(room.rounds || {}).sort((a, b) => a[0] - b[0]).map(([, r]) => ({ question: r.topic, final: finalOf(r) }));
  return [...past, { question: room.topic, final: finalOf(room), current: true }];
}

export const criteriaOf = (room = app.room) => room.criteria?.length ? room.criteria : (room.crit?.length ? room.crit : typeProfile(room).criteria);

// ---------- 최근 프로젝트 (이 기기) ----------

export const recentProjects = () => (storage.get('popcorn.recent', 'link.recent') || []).filter(p => !p.sim && !p.local);

export function rememberProject() {
  const room = app.room;
  if (!room?.members?.[app.me] || room.sim) return;
  const list = recentProjects().filter(p => p.code !== app.code);
  list.unshift({ code: app.code, name: room.name, at: Date.now() });
  storage.set('popcorn.recent', list.slice(0, 8));
}
