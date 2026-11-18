// '규칙 기반 AI': 서버 없이 브라우저에서 돌아가는 분석 규칙.
// 실제 서비스에서는 이 파일의 함수들을 같은 입력·출력 모양의 LLM 호출로 바꾸면 된다.

import { TEAM_HINTS } from './content.js';
import { members, typeProfile, app } from './app.svelte.js';
import { today, addDays, daysBetween } from './util.js';

// ---------- 글 비교 ----------

const PARTICLES = /(으로|에서|에게|하고|이나|이랑|부터|까지|처럼|보다|을|를|이|가|은|는|의|에|로|와|과|도|만|한다|하기|하는|해서|하면|하여)$/;

/** 문장을 낱말로 나누고 조사를 뗀다. */
const words = text => (text || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).map(w => w.replace(PARTICLES, '')).filter(w => w.length >= 2);

/** 두 글자씩 묶은 조각 (띄어쓰기가 달라도 비슷한 문장을 잡기 위함) */
const bigrams = text => {
  const s = (text || '').replace(/[^\p{L}\p{N}]/gu, '');
  const set = new Set();
  for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2));
  return set;
};

/** 0~1 사이 유사도 (자카드 계수) */
function similarity(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  A.forEach(g => B.has(g) && shared++);
  return shared / (A.size + B.size - shared);
}

const shorten = (text, max = 24) => { const t = (text || '').trim(); return t.length > max ? t.slice(0, max) + '…' : t; };

// ---------- 팀 구성 ----------

/** 전공이 모두 같으면 'same', 하나라도 다르면 'mixed'. '경영학과'와 '경영학부'는 같은 전공으로 본다. */
export function teamComposition(room = app.room) {
  const majors = members(room).map(([, m]) => (m.major || '').trim()).filter(Boolean);
  const normalize = m => m.replace(/\s/g, '').replace(/(학부|전공|과)$/, '');
  return {
    kind: new Set(majors.map(normalize)).size <= 1 ? 'same' : 'mixed',
    majors: [...new Set(majors)],
  };
}

// ---------- POP: 질문 ----------

/** i번째 시즈닝 질문. 유형별 질문과 팀 구성별 질문을 번갈아 보여 준다. */
export function seasoningQuestion(room, i) {
  const team = teamComposition(room);
  const otherMajors = members(room).filter(([id]) => id !== app.me).map(([, m]) => m.major).filter(Boolean);
  const teamQuestions = TEAM_HINTS[team.kind].map(q => ({
    q: q.replace('{major}', otherMajors[i % Math.max(1, otherMajors.length)] || '다른 전공'),
    tag: team.kind === 'same' ? '동일 전공 팀' : '융합 전공 팀',
  }));
  const pool = [...typeProfile(room).hints, ...teamQuestions];
  return pool[i % pool.length];
}

/** 생각 파고들기(5 Whys): 지금까지의 답을 보고 다음 질문을 만든다. */
export function nextWhy(chain) {
  if (!chain.length) return '이 과제에서 가장 해결하고 싶은 문제는 무엇인가요?';
  const followUps = [
    `왜 「${shorten(chain.at(-1).a, 28)}」라고 생각하나요?`,
    '그 이유가 생긴 원인은 무엇일까요?',
    '그렇다면 그 원인은 왜 계속 남아 있을까요?',
    '결국 가장 바꾸고 싶은 한 가지는 무엇인가요?',
  ];
  return followUps[Math.min(chain.length - 1, followUps.length - 1)];
}

// ---------- MIX: 다수 의견 / 소수 의견 ----------

/**
 * 카드를 다수 의견(majority)과 소수 의견(minority)으로 나눈다.
 * 1) 카드마다 다른 카드들과의 평균 유사도와, 여러 카드에 나온 낱말 수로 '흔한 정도'를 계산
 * 2) 가장 흔한 카드(center)와 비슷하거나 낱말을 공유하는 카드 = 다수 의견 (전체의 60%를 넘지 않게)
 * 3) 나머지 중 가장 덜 흔한 카드 최대 3장 = 소수 의견
 */
export function splitOpinions(room) {
  const cards = Object.entries(room.cards || {}).map(([id, c]) => ({ id, ...c })).sort((a, b) => a.at - b.at);
  if (!cards.length) return { cards, majority: [], minority: [], center: null, similarityAvg: 0 };

  const n = cards.length;
  cards.forEach(c => {
    c.avgSim = n > 1 ? cards.reduce((sum, o) => sum + (o === c ? 0 : similarity(c.text, o.text)), 0) / (n - 1) : 0;
  });
  const docFreq = {};
  cards.forEach(c => new Set(words(c.text)).forEach(w => (docFreq[w] = (docFreq[w] || 0) + 1)));
  const sharedWords = new Set(Object.keys(docFreq).filter(w => docFreq[w] >= 2));
  cards.forEach(c => {
    c.sharedCount = words(c.text).filter(w => sharedWords.has(w)).length;
    c.commonness = c.avgSim + c.sharedCount * 0.08;
  });

  const byCommonness = cards.slice().sort((a, b) => b.commonness - a.commonness);
  const center = byCommonness[0];
  const centerWords = new Set(words(center.text));
  let majority = cards.filter(c => c === center || similarity(c.text, center.text) >= 0.16 || words(c.text).some(w => sharedWords.has(w) && centerWords.has(w)));
  if (majority.length > Math.ceil(n * 0.7)) majority = byCommonness.filter(c => majority.includes(c)).slice(0, Math.ceil(n * 0.6));
  const minority = cards.filter(c => !majority.includes(c)).sort((a, b) => a.commonness - b.commonness).slice(0, 3);

  return { cards, majority, minority, center, similarityAvg: cards.reduce((s, c) => s + c.avgSim, 0) / n };
}

export const questionForMinority = card => `「${shorten(card.text)}」 의견을 기존 방향에 반영하면 무엇이 달라질까요? 반영하지 않으면 무엇을 놓칠까요?`;
export const questionForMajority = card => `「${shorten(card.text)}」 쪽으로 의견이 모였어요. 모두가 쉽게 동의한 이유는 무엇이고, 빠진 관점은 없을까요?`;

// ---------- FIT: 역할 추천 ----------

const matchesSkill = (member, roleName) => (member.skills || '').split(/[,\s]+/).some(s => s && roleName.includes(s.slice(0, 2)));

function roleScore(member, [roleName, , trait]) {
  return (member.trait === trait ? 3 : 0) + ((member.wants || []).includes(roleName) ? 3 : 0) + (matchesSkill(member, roleName) ? 2 : 0);
}

/**
 * 역할마다 가장 잘 맞는 팀원을 고른다. 시간이 많이 드는 역할부터 정하고,
 * 이미 맡은 시간이 많은 사람은 점수를 깎아 업무량이 고르게 한다. 결과: { 역할: 팀원 id }
 */
export function recommendRoles(room) {
  const people = members(room);
  const load = Object.fromEntries(people.map(([id]) => [id, 0]));
  const result = {};
  typeProfile(room).roles.slice().sort((a, b) => b[1] - a[1]).forEach(role => {
    const best = people
      .map(([id, m]) => ({ id, score: roleScore(m, role) - load[id] * 0.6 }))
      .sort((a, b) => b.score - a.score)[0];
    if (!best) return;
    result[role[0]] = best.id;
    load[best.id] += role[1];
  });
  return result;
}

export function recommendReason(member, [roleName, , trait]) {
  const reasons = [];
  if (member.trait === trait) reasons.push(`${trait} 성향`);
  if ((member.wants || []).includes(roleName)) reasons.push('희망 역할');
  if (matchesSkill(member, roleName)) reasons.push('보유 역량');
  return reasons.join(', ') || '업무량 균형';
}

// ---------- RUN: 실행 계획 ----------

/**
 * 고른 유형들의 업무를 단계(조사 → 구상 → 제작 → 마무리) 순으로 합치고,
 * 단계별 마감일을 오늘부터 최종 마감일까지 4등분해 정한다.
 * 담당은 비워 둔다. 팀원이 직접 맡고, 추천은 화면에서 참고로만 보여 준다(앵커링 방지).
 */
export function buildPlan(room) {
  const start = today();
  const end = room.deadline && room.deadline > start ? room.deadline : addDays(start, 14);
  const span = Math.max(4, daysBetween(start, end));
  const tasks = typeProfile(room).tasks.slice().sort((a, b) => a[2] - b[2]);
  const plan = {};
  tasks.forEach(([title, role, step], i) => {
    plan['t' + i] = { title, role, who: '', due: addDays(start, Math.round(span * step / 4)), status: 0, order: i };
  });
  return plan;
}
