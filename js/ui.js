// 화면 틀: 머리글의 단계 표시, 하단 고정 바, 다시 그리기 요청.

import { $, esc } from './util.js';
import { STAGES } from './content.js';
import { state, currentPhase } from './state.js';

let renderer = () => {};
export const setRenderer = fn => { renderer = fn; };
/** 화면을 다시 그린다. force=false면 입력 중일 때 미룬다. */
export const rerender = (force = true) => renderer(force);

export function renderHeader() {
  const name = $('#projectName'), steps = $('#steps');
  if (!state.room) { name.textContent = ''; steps.hidden = true; return; }
  name.textContent = state.room.name;
  const current = STAGES.findIndex(s => s.phase === currentPhase());
  steps.hidden = false;
  steps.innerHTML = STAGES.map((s, i) =>
    `<div class="step ${i === current ? 'current' : i < current ? 'done' : ''}" ${i === current ? 'aria-current="step"' : ''}>${s.label}</div>`).join('');
}

/** 화면 아래 고정 바. message는 왼쪽 안내, buttons는 오른쪽 버튼들의 HTML. */
export function bottomBar({ message = '', buttons = '', left = '' } = {}) {
  const bar = $('#bottomBar');
  if (!message && !buttons && !left) { bar.hidden = true; return; }
  bar.hidden = false;
  $('#bottomBarInner').innerHTML = `${left}<span class="message">${esc(message)}</span>${buttons}`;
}

/** 위험한 버튼은 두 번 눌러야 실행한다. 첫 번째 누름에서 문구를 바꿔 다시 확인을 받는다. */
export function confirmTwice(button, confirmLabel, action) {
  button.addEventListener('click', () => {
    if (button.dataset.armed) return action();
    button.dataset.armed = '1';
    button.textContent = confirmLabel;
  });
}
