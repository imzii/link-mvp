// MIX: 의견 수렴. 소수 의견을 다수 의견보다 먼저 보여 주고, 평가 기준으로 후보를 평가한다.

import { $, on, esc, toast } from '../util.js';
import { state, save, isLeader, criteriaOf } from '../state.js';
import { splitOpinions, teamComposition, questionForMinority, questionForMajority, buildPlan } from '../ai.js';
import { bottomBar } from '../ui.js';

const mixData = () => state.room.mix || {};

/** '반영해 보자 / 보류' 선택 버튼. key는 소수 의견 카드 id 또는 다수 의견 묶음 'majority'. */
function reactionToggle(key) {
  const votes = mixData().reactions?.[key] || {};
  const count = v => Object.values(votes).filter(x => x === v).length;
  const mine = votes[state.me];
  return `<div class="toggle" role="group" aria-label="반영 여부">
    <button type="button" data-react="${key}" data-value="yes" aria-pressed="${mine === 'yes'}">반영해 보자<span class="count">${count('yes')}</span></button>
    <button type="button" data-react="${key}" data-value="hold" aria-pressed="${mine === 'hold'}">보류<span class="count">${count('hold')}</span></button>
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
  <h1>아이디어 ${opinions.cards.length}장이 모였어요</h1>

  <div class="card note"><div class="note-title">융합 협업 가이드</div>
    ${team.kind === 'same'
      ? `아이디어 유사도가 ${Math.round(opinions.similarityAvg * 100)}%예요. 같은 전공의 익숙한 틀에서 나왔을 수 있으니 소수 의견부터 이야기해 보세요.`
      : `${team.majors.map(esc).join(', ')} 전공이 모였어요. 낯선 용어가 있는 카드는 작성자가 한 줄로 풀어 설명하고, 전공 사이의 접점을 찾아보세요.`}
  </div>

  <section class="card">
    <div class="row between"><h3><span class="badge minority">B</span>소수 의견</h3><span class="sm sub">${opinions.minority.length}장</span></div>
    ${opinions.minority.length ? opinions.minority.map(card => `<div class="idea">${ideaBlock(card)}
      <div class="sm" style="margin-top:8px"><b>생각해 볼 질문</b> ${esc(questionForMinority(card))}</div>
      ${reactionToggle(card.id)}</div>`).join('') : '<p class="sub sm">모든 아이디어가 비슷한 방향이에요.</p>'}
  </section>

  <section class="card">
    <div class="row between"><h3><span class="badge">A</span>다수 의견</h3><span class="sm sub">${opinions.majority.length}장</span></div>
    ${opinions.majority.map(card => `<div class="idea">${ideaBlock(card)}</div>`).join('')}
    ${opinions.center ? `<div class="sm" style="margin-top:10px"><b>생각해 볼 질문</b> ${esc(questionForMajority(opinions.center))}</div>${reactionToggle('majority')}` : ''}
  </section>

  <section class="card">
    <h3>후보 평가</h3>
    ${candidates.map(c => `<div class="idea">
      <div class="row between"><span class="chip ${c.kind === '소수' ? 'on' : ''}">${c.kind} 의견</span><span class="xs sub">충족 ${totalOf(c.key)}표</span></div>
      <div class="idea-title" style="margin-top:6px">${esc(c.text)}</div>
      <div class="criteria">${criteria.map((name, i) => `<button type="button" data-score="${c.key}" data-index="${i}" aria-pressed="${!!scores[c.key]?.[state.me]?.[i]}">${esc(name)}</button>`).join('')}</div>
      ${isLeader() ? `<button class="btn-link" data-final="${c.key}" style="margin-top:6px">이 안으로 최종 확정</button>` : ''}
    </div>`).join('')}
  </section>

  ${final ? `<div class="card emphasis"><h3>최종 아이디어</h3><p style="font-weight:700;font-size:17px;margin-top:4px">${esc(final.text)}</p></div>` : ''}`;

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
    const chosen = candidates.find(c => c.key === e.currentTarget.dataset.final);
    save({ 'mix.final': { key: chosen.key, text: chosen.text } });
    toast('최종 아이디어로 확정했어요');
  });

  if (!isLeader()) return bottomBar({ message: final ? '최종 아이디어가 확정됐어요' : '' });
  const best = candidates.slice().sort((a, b) => totalOf(b.key) - totalOf(a.key))[0];
  bottomBar({
    message: final ? '최종 아이디어를 정했어요' : best && totalOf(best.key) ? `지금 가장 높은 후보는 ${best.kind} 의견이에요` : '',
    buttons: `<button class="btn-primary" id="startRun" ${final ? '' : 'disabled'}>RUN 시작</button>`,
  });
  $('#startRun').onclick = () => save({ phase: 'run', phaseAt: Date.now(), tasks: buildPlan(state.room) });
}
