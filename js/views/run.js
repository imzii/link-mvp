// RUN: 협업 실행. 업무 표, 내 할 일, 팀원별 진행, 결과 내보내기.

import { $, on, esc, today, shortDate, daysBetween, newId, copyText } from '../util.js';
import { TASK_STATUS } from '../content.js';
import { state, save, members, memberName, avatar, isLeader, typeProfile, criteriaOf } from '../state.js';
import { recommendRoles } from '../ai.js';
import { bottomBar, confirmTwice } from '../ui.js';

const sortedTasks = () => Object.entries(state.room.tasks || {})
  .sort((a, b) => (a[1].due || '').localeCompare(b[1].due || '') || (a[1].order ?? a[1].i ?? 0) - (b[1].order ?? b[1].i ?? 0));

const finalIdea = () => (state.room.mix?.final || state.room.sync?.final)?.text;

export function runView() {
  const room = state.room, tasks = sortedTasks();
  const done = tasks.filter(([, t]) => t.status === 2).length;
  const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  const myOpen = tasks.filter(([, t]) => t.who === state.me && t.status !== 2);
  const daysLeft = room.deadline ? daysBetween(today(), room.deadline) : null;

  $('#app').innerHTML = `
  <h1>${esc(finalIdea() || room.topic)}</h1>

  <div class="card">
    <div class="row between"><b>전체 진행률 ${percent}%</b>
      <span class="sm sub">${done}/${tasks.length}개 완료${daysLeft != null ? `, 마감까지 ${daysLeft >= 0 ? daysLeft + '일' : '지남'}` : ''}</span></div>
    <div class="gauge" style="margin-top:8px" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i style="width:${percent}%"></i></div>
  </div>

  ${myOpen.length ? `<div class="card emphasis no-print"><h3>내 할 일 ${myOpen.length}개</h3>
    ${myOpen.map(([, t]) => `<div class="sm" style="margin-top:6px">${esc(t.title)} <span class="sub">${shortDate(t.due)}까지</span></div>`).join('')}</div>` : ''}

  <div class="card" style="padding:8px 12px">
    <table><thead><tr><th>업무</th><th>담당</th><th>마감</th><th>상태</th></tr></thead><tbody>
    ${tasks.map(([id, t]) => `<tr>
      <td><b class="sm">${esc(t.title)}</b>${t.role ? `<div class="xs sub">${esc(t.role)}</div>` : ''}</td>
      <td><label class="sr-only" for="owner-${id}">담당</label>
        <select id="owner-${id}" class="compact-select" data-owner="${id}"><option value="">미배정</option>
        ${members().map(([mid, m]) => `<option value="${mid}" ${t.who === mid ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></td>
      <td class="sm" style="white-space:nowrap">${t.due ? shortDate(t.due) : '-'}</td>
      <td><button class="status status-${t.status}" data-status="${id}" aria-label="${esc(t.title)} 상태: ${TASK_STATUS[t.status]}. 눌러서 변경">${TASK_STATUS[t.status]}</button></td>
    </tr>`).join('')}
    </tbody></table>
    <form id="addTask" class="row no-print" style="margin:10px 0 4px" novalidate>
      <label for="taskTitle" class="sr-only">업무 추가</label><input id="taskTitle" class="grow" placeholder="업무 추가" autocomplete="off">
      <input id="taskDue" type="date" style="width:auto" value="${room.deadline || today()}" aria-label="마감일"><button type="submit">추가</button>
    </form>
  </div>

  <div class="card"><h3>팀원별 진행</h3>
    ${members().map(([id, m]) => {
      const own = tasks.filter(([, t]) => t.who === id), finished = own.filter(([, t]) => t.status === 2).length;
      return `<div class="row" style="margin:8px 0">${avatar(id)}<span class="sm" style="width:64px">${esc(m.name)}</span>
        <div class="gauge grow"><i style="width:${own.length ? finished / own.length * 100 : 0}%"></i></div>
        <span class="sm sub" style="width:44px;text-align:right">${finished}/${own.length}</span></div>`;
    }).join('')}
  </div>

  <div class="card no-print"><h3>결과 내보내기</h3>
    <div class="row" style="margin-top:8px"><button id="copyResult">결과 복사 (Notion·한글)</button><button id="printResult">PDF로 저장</button></div>
  </div>`;

  on('[data-status]', 'click', e => {
    const id = e.currentTarget.dataset.status;
    save({ [`tasks.${id}.status`]: ((room.tasks[id].status || 0) + 1) % TASK_STATUS.length });
  });
  on('[data-owner]', 'change', e => save({ [`tasks.${e.target.dataset.owner}.who`]: e.target.value }));
  $('#addTask').onsubmit = e => {
    e.preventDefault();
    const title = $('#taskTitle').value.trim();
    if (!title) return $('#taskTitle').focus();
    save({ [`tasks.${newId('t', 6)}`]: { title, role: '', who: '', due: $('#taskDue').value, status: 0, order: 99 } });
    $('#taskTitle').value = ''; $('#taskTitle').blur();
  };
  $('#copyResult').onclick = () => copyText(resultText());
  $('#printResult').onclick = () => window.print();

  bottomBar({
    message: percent === 100 ? '모든 업무를 마쳤어요' : '',
    buttons: isLeader() ? '<button id="backToMix">아이디어 다시 보기</button>' : '',
  });
  if ($('#backToMix')) confirmTwice($('#backToMix'), '한 번 더 누르면 이동', () => save({ phase: 'mix' }));
}

/** 보고서에 붙일 수 있는 결과 정리 (마크다운: Notion은 표로, 한글에는 글로 붙는다) */
function resultText() {
  const room = state.room, owners = recommendRoles(room);
  const lines = [
    `# ${room.name}`, '',
    `- 주제: ${room.topic}`,
    `- 유형: ${typeProfile().names.join(', ')}`,
    `- 평가 기준: ${criteriaOf().join(', ')}`,
    `- 최종 마감일: ${room.deadline || '-'}`, '',
    '## 최종 아이디어', finalIdea() || '-', '',
    '## 팀원과 추천 역할',
    ...members().map(([id, m]) => `- ${m.name} (${m.major}, ${m.trait}): ${typeProfile().roles.filter(([r]) => owners[r] === id).map(([r]) => r).join(', ') || '-'}`), '',
    '## 업무',
    '| 업무 | 담당 | 마감 | 상태 |', '| --- | --- | --- | --- |',
    ...sortedTasks().map(([, t]) => `| ${t.title} | ${t.who ? memberName(t.who) : '미배정'} | ${t.due || '-'} | ${TASK_STATUS[t.status]} |`),
  ];
  return lines.join('\n');
}
