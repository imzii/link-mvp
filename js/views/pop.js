// POP: 각자 의견 내기. 다른 팀원의 카드는 보이지 않고, 제출 현황만 실시간으로 보인다.
// 전원이 최소 장수를 내거나 발산 기간이 끝나면 MIX로 자동으로 넘어간다.

import { $, on, esc, toast, newId, formatRemaining, formatMinutes } from '../util.js';
import { state, saveUi, save, members, cardsOf, isLeader, typeProfile, roundNumber } from '../state.js';
import { seasoningQuestion, nextWhy } from '../ai.js';
import { bottomBar, rerender } from '../ui.js';

const minCards = () => state.room.cardsPerPerson || state.room.per || 1;
const timeLeft = () => (state.room.popEnd ? state.room.popEnd - Date.now() : Infinity);
const allCards = () => Object.values(state.room.cards || {});
const countOf = id => allCards().filter(c => c.by === id).length;
const doneCount = () => members().filter(([id]) => countOf(id) >= minCards()).length;
const everyoneDone = () => members().length > 0 && doneCount() === members().length;

// 소금통 아이콘 (시즈닝 브랜딩)
const SHAKER = `<svg class="shaker" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
  <circle cx="7" cy="4" r="1.2"/><circle cx="12" cy="2.6" r="1.2"/><circle cx="17" cy="4" r="1.2"/>
  <path d="M8 8.5h8l1.5 3V21a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9.5z" fill="#fff" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M8 8.5c0-1.4 1.8-2.5 4-2.5s4 1.1 4 2.5" fill="none" stroke="currentColor" stroke-width="1.6"/>
  <circle cx="10.5" cy="15" r=".9"/><circle cx="13.5" cy="15" r=".9"/><circle cx="12" cy="17.6" r=".9"/></svg>`;

let countdown = null;
export const stopCountdown = () => clearInterval(countdown);

/** 모든 기기가 같은 조건을 확인하므로, 누가 먼저 넘기든 결과는 같다. */
export function autoAdvanceIfReady() {
  if (!allCards().length) return false;
  if (everyoneDone() || timeLeft() <= 0) { save({ phase: 'mix', phaseAt: Date.now() }); return true; }
  return false;
}

/** 입력 중에도 갱신되는 제출 현황 영역 */
export function statusCard() {
  const left = timeLeft(), over = left <= 0;
  return `
    <div class="row between"><b>제출 현황</b><span class="sm sub">카드 ${allCards().length}장, 다 쓴 사람 ${doneCount()}/${members().length}명</span></div>
    <div class="row between" style="margin:10px 0 6px">
      <span class="sm">${over ? '발산 기간이 끝났어요' : '남은 시간'}</span>
      <span class="timer" id="timer">${over ? '0:00' : Number.isFinite(left) ? formatRemaining(left) : '-'}</span>
    </div>
    <div class="people">${members().map(([id, m]) => `<span class="chip ${countOf(id) >= minCards() ? 'on' : ''}">${esc(m.name)} ${countOf(id)}장</span>`).join('')}</div>`;
}

export function popView() {
  if (autoAdvanceIfReady()) return;
  const ui = state.ui;
  if (ui.round !== roundNumber()) Object.assign(ui, { round: roundNumber(), draft: '', why: '', hintIndex: 0, whyChain: [] }), saveUi();
  const mine = cardsOf(state.me), over = timeLeft() <= 0;
  const hint = seasoningQuestion(state.room, ui.hintIndex);

  $('#app').innerHTML = `
  <h1>${esc(state.room.topic)}</h1>
  <div class="card" id="popStatus">${statusCard()}</div>

  <form class="card" id="cardForm" novalidate>
    <h3>내 의견 카드 <span class="sub">${mine.length}장 (최소 ${minCards()}장)</span></h3>
    <fieldset ${over ? 'disabled' : ''}>
      <label for="ideaText">의견 한 줄</label>
      <input id="ideaText" maxlength="120" value="${esc(ui.draft)}" placeholder="예: ${esc(typeProfile().opinion)}" autocomplete="off">
      <label for="ideaWhy">이유 한 줄 <span class="xs sub">(선택)</span></label>
      <input id="ideaWhy" maxlength="120" value="${esc(ui.why)}" placeholder="왜 그렇게 생각했나요?" autocomplete="off">
      <button class="btn-primary wide" style="margin-top:12px" type="submit">카드 추가</button>
    </fieldset>
    ${mine.map(([id, c]) => `<div class="idea row between"><div class="grow"><div class="idea-title">${esc(c.text)}</div>${c.why ? `<div class="idea-why">${esc(c.why)}</div>` : ''}</div>
      ${over ? '' : `<button type="button" class="btn-link" data-delete="${id}" aria-label="카드 삭제">삭제</button>`}</div>`).join('')}
  </form>

  ${over ? '' : `
  <section class="card seasoning" aria-labelledby="seasoningTitle">
    <div class="seasoning-head">
      ${SHAKER}<h3 id="seasoningTitle">시즈닝</h3><span class="seasoning-tag">${esc(hint.tag)}</span>
    </div>
    <p class="seasoning-question" id="seasoningQuestion">${esc(hint.q)}</p>
    <button type="button" id="nextHint">한 번 더 뿌리기</button>
  </section>

  <section class="card dig" aria-labelledby="digTitle">
    <div class="row between">
      <h3 id="digTitle">생각 파고들기 <span class="sub" style="font-weight:500">5 Whys</span></h3>
      <span class="dig-steps" aria-label="${ui.whyChain.length}/5단계">${[0, 1, 2, 3, 4].map(i => `<i class="${i < ui.whyChain.length ? 'on' : ''}"></i>`).join('')}</span>
    </div>
    ${ui.whyChain.length ? `<ol class="dig-chain">${ui.whyChain.map(step => `<li><span class="sub">${esc(step.q)}</span><br>${esc(step.a)}</li>`).join('')}</ol>` : ''}
    ${ui.whyChain.length < 5 ? `<form id="whyForm" novalidate>
      <label for="whyAnswer" class="dig-question">${esc(nextWhy(ui.whyChain))}</label>
      <div class="row"><input id="whyAnswer" class="grow" autocomplete="off" placeholder="떠오르는 대로 답해 보세요"><button type="submit">답하기</button></div>
    </form>` : '<p class="sm" style="margin-top:8px">다섯 번 파고들었어요. 마지막 답을 의견 카드로 옮겨 보세요.</p>'}
    ${ui.whyChain.length ? '<button type="button" class="btn-link" id="resetWhy">처음부터 다시</button>' : ''}
  </section>`}`;

  // 카드 작성
  $('#ideaText').oninput = e => { ui.draft = e.target.value; saveUi(); };
  $('#ideaWhy').oninput = e => { ui.why = e.target.value; saveUi(); };
  $('#cardForm').onsubmit = async e => {
    e.preventDefault();
    if (timeLeft() <= 0) return toast('발산 기간이 끝났어요');
    const text = ui.draft.trim();
    if (!text) { toast('의견을 한 줄 적어 주세요'); $('#ideaText').focus(); return; }
    const why = $('#ideaWhy').value.trim();
    ui.draft = ''; ui.why = ''; saveUi();
    await save({ [`cards.${newId('c')}`]: { text, why, by: state.me, at: Date.now() } });
    rerender(); $('#ideaText')?.focus();
  };
  on('[data-delete]', 'click', e => save({ [`cards.${e.currentTarget.dataset.delete}`]: null }));

  // 질문 도구
  $('#nextHint') && ($('#nextHint').onclick = () => {
    ui.hintIndex++; saveUi(); rerender();
    $('#seasoningQuestion')?.classList.add('popped');
  });
  $('#whyForm') && ($('#whyForm').onsubmit = e => {
    e.preventDefault();
    const answer = $('#whyAnswer').value.trim();
    if (!answer) return;
    ui.whyChain.push({ q: nextWhy(ui.whyChain), a: answer }); saveUi(); rerender(); $('#whyAnswer')?.focus();
  });
  $('#resetWhy') && ($('#resetWhy').onclick = () => { ui.whyChain = []; saveUi(); rerender(); });

  // 남은 시간: 1초마다 숫자만 바꾸고, 끝나면 다시 그린다(자동 전환 포함)
  stopCountdown();
  if (!over && state.room.popEnd) {
    countdown = setInterval(() => {
      if (timeLeft() <= 0) { stopCountdown(); rerender(); return; }
      const el = $('#timer'); if (el) el.textContent = formatRemaining(timeLeft());
    }, 1000);
  }

  const waiting = members().length - doneCount();
  if (isLeader()) {
    const minutes = state.room.popMinutes || 1440, extendBy = minutes >= 720 ? 1440 : 10;
    bottomBar({
      left: `<button id="extend">${formatMinutes(extendBy)} 연장</button>`,
      message: waiting ? `${waiting}명이 아직 작성 중이에요` : '',
      buttons: `<button class="btn-primary" id="revealNow" ${allCards().length ? '' : 'disabled'}>지금 공개</button>`,
    });
    $('#extend').onclick = () => { save({ popEnd: Math.max(Date.now(), state.room.popEnd || 0) + extendBy * 60000 }); toast(`${formatMinutes(extendBy)} 연장했어요`); };
    const reveal = $('#revealNow');
    reveal.addEventListener('click', () => {
      if (waiting && !reveal.dataset.armed) { reveal.dataset.armed = '1'; reveal.textContent = '한 번 더 누르면 공개'; return; }
      save({ phase: 'mix', phaseAt: Date.now() });
    });
  } else {
    const remaining = minCards() - mine.length;
    bottomBar({ message: over ? '곧 다음 단계로 넘어가요' : remaining > 0 ? `의견을 ${remaining}장 더 써 주세요` : '다 썼어요' });
  }
}
