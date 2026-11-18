// MIX: 의견 수렴. 소수 의견을 다수 의견보다 먼저 보여 주고, 평가 기준으로 후보를 평가한다.

import { $, on, esc, toast, today, addDays, newId } from '../util.js';
import { state, save, isLeader, criteriaOf, members } from '../state.js';
import { splitOpinions, teamComposition, questionForMinority, questionForMajority, buildPlan } from '../ai.js';
import { bottomBar } from '../ui.js';

const mixData = () => state.room.mix || {};

// 앵커링 방지: 전원이 '평가 완료'를 누르기 전에는 다른 사람의 선택 수와 평가 결과를 보여 주지 않는다.
const doneIds = () => members().filter(([id]) => mixData().done?.[id]).map(([id]) => id);
const revealed = () => !!mixData().final || doneIds().length === members().length;

/** '반영해 보자 / 보류' 선택 버튼. key는 소수 의견 카드 id 또는 다수 의견 묶음 'majority'. */
function reactionToggle(key) {
  const votes = mixData().reactions?.[key] || {};
  const count = v => Object.values(votes).filter(x => x === v).length;
  const mine = votes[state.me];
  return `<div class="toggle" role="group" aria-label="반영 여부">
    <button type="button" data-react="${key}" data-value="yes" aria-pressed="${mine === 'yes'}">반영해 보자${revealed() ? `<span class="count">${count('yes')}</span>` : ''}</button>
    <button type="button" data-react="${key}" data-value="hold" aria-pressed="${mine === 'hold'}">보류${revealed() ? `<span class="count">${count('hold')}</span>` : ''}</button>
  </div>`;
}

const ideaBlock = card => `<div class="idea-title">${esc(card.text)}</div>${card.why ? `<div class="idea-why">${esc(card.why)}</div>` : ''}`;

export function mixView() {
  const criteria = criteriaOf(), opinions = splitOpinions(state.room), team = teamComposition();
  const scores = mixData().scores || {}, final = mixData().final;

  // 후보: 소수 의견 카드들 → 다수 의견(대표 카드) 순서
  const candidates = [
    ...opinions.minority.map(c => ({ key: c.id, text: c.text, kind: '소수' })),
    ...(opinions.center ? [{ key: 'majority', text: opinions.center.text, kind: '다수' }] : []),
  ];
  const totalOf = key => Object.values(scores[key] || {}).reduce((sum, checks) => sum + checks.filter(Boolean).length, 0);

  $('#app').innerHTML = `
  <h1>의견 ${opinions.cards.length}장이 모였어요</h1><p class="sub">${esc(state.room.topic)}</p>

  <div class="card note"><div class="note-title">융합 협업 가이드</div>
    ${team.kind === 'same'
      ? `의견 유사도가 ${Math.round(opinions.similarityAvg * 100)}%예요. 같은 전공의 익숙한 틀에서 나왔을 수 있으니 소수 의견부터 이야기해 보세요.`
      : `${team.majors.map(esc).join(', ')} 전공이 모였어요. 낯선 용어가 있는 카드는 작성자가 한 줄로 풀어 설명하고, 전공 사이의 접점을 찾아보세요.`}
  </div>

  <section class="card">
    <div class="row between"><h3><span class="badge minority">B</span>소수 의견</h3><span class="sm sub">${opinions.minority.length}장</span></div>
    ${opinions.minority.length ? opinions.minority.map(card => `<div class="idea">${ideaBlock(card)}
      <div class="sm" style="margin-top:8px"><b>생각해 볼 질문</b> ${esc(questionForMinority(card))}</div>
      ${reactionToggle(card.id)}</div>`).join('') : '<p class="sub sm">모든 의견이 비슷한 방향이에요.</p>'}
  </section>

  <section class="card">
    <div class="row between"><h3><span class="badge">A</span>다수 의견</h3><span class="sm sub">${opinions.majority.length}장</span></div>
    ${opinions.majority.map(card => `<div class="idea">${ideaBlock(card)}</div>`).join('')}
    ${opinions.center ? `<div class="sm" style="margin-top:10px"><b>생각해 볼 질문</b> ${esc(questionForMajority(opinions.center))}</div>${reactionToggle('majority')}` : ''}
  </section>

  <section class="card">
    <div class="row between"><h3>후보 평가</h3><span class="sm sub">평가 완료 ${doneIds().length}/${members().length}명</span></div>
    ${revealed() ? '' : '<p class="sm sub" style="margin:4px 0 0">모두 평가를 마치면 결과가 공개돼요.</p>'}
    ${candidates.map(c => `<div class="idea">
      <div class="row between"><span class="chip ${c.kind === '소수' ? 'on' : ''}">${c.kind} 의견</span>${revealed() ? `<span class="xs sub">충족 ${totalOf(c.key)}표</span>` : ''}</div>
      <div class="idea-title" style="margin-top:6px">${esc(c.text)}</div>
      <div class="criteria">${criteria.map((name, i) => `<button type="button" data-score="${c.key}" data-index="${i}" aria-pressed="${!!scores[c.key]?.[state.me]?.[i]}">${esc(name)}</button>`).join('')}</div>
      ${isLeader() ? `<button class="btn-link" data-final="${c.key}" style="margin-top:6px">이 안으로 최종 확정</button>` : ''}
    </div>`).join('')}
  </section>

  ${final ? `<div class="card emphasis"><h3>최종안</h3><p style="font-weight:700;font-size:17px;margin-top:4px">${esc(final.text)}</p></div>` : ''}`;

  on('[data-react]', 'click', e => {
    const { react: key, value } = e.currentTarget.dataset;
    const current = mixData().reactions?.[key]?.[state.me];
    save({ [`mix.reactions.${key}.${state.me}`]: current === value ? null : value });
  });
  on('[data-score]', 'click', e => {
    const { score: key, index } = e.currentTarget.dataset;
    const checks = criteria.map((_, i) => !!scores[key]?.[state.me]?.[i]);
    checks[+index] = !checks[+index];
    save({ [`mix.scores.${key}.${state.me}`]: checks });
  });
  on('[data-final]', 'click', e => {
    const button = e.currentTarget;
    // 아직 평가 중인 사람이 있으면 한 번 더 확인한다.
    if (!revealed() && !button.dataset.armed) { button.dataset.armed = '1'; button.textContent = '평가 중인 사람이 있어요. 한 번 더 누르면 확정'; return; }
    const chosen = candidates.find(c => c.key === button.dataset.final);
    save({ 'mix.final': { key: chosen.key, text: chosen.text } });
    toast('최종안으로 확정했어요');
  });

  const iAmDone = !!mixData().done?.[state.me];
  const doneButton = iAmDone ? '' : '<button id="finishScoring">평가 완료</button>';
  const waiting = members().length - doneIds().length;
  const status = final ? '최종안이 확정됐어요' : waiting ? `${waiting}명이 평가 중이에요` : '모두 평가를 마쳤어요';
  if (!isLeader()) bottomBar({ message: status, buttons: doneButton });
  else bottomBar({ message: status, left: doneButton, buttons: `<button class="btn-primary" id="startRun" ${final ? '' : 'disabled'}>RUN 시작</button>` });
  $('#finishScoring') && ($('#finishScoring').onclick = () => save({ [`mix.done.${state.me}`]: true }));
  if (!isLeader()) return;
  $('#startRun').onclick = () => {
    // 첫 라운드는 실행 계획을 만들고, 이후 라운드는 기존 업무에 '반영' 업무 하나만 더한다.
    if (!state.room.tasks) return save({ phase: 'run', phaseAt: Date.now(), tasks: buildPlan(state.room) });
    const due = [addDays(today(), 3), state.room.deadline].filter(Boolean).sort()[0];
    save({ phase: 'run', phaseAt: Date.now(),
      [`tasks.${newId('t', 6)}`]: { title: `반영: ${mixData().final.text}`, role: '', who: '', due, status: 0, order: 99 } });
  };
}
