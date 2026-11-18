// 시작점: 저장소를 고르고, 프로젝트 문서를 구독하고, 단계에 맞는 화면을 그린다.

import { $ } from './util.js';
import { FIREBASE_CONFIG } from './config.js';
import { Local, connectFirebase } from './store.js';
import { state, resolveMe, loadUi, rememberProject, currentPhase } from './state.js';
import { setRenderer, renderHeader, bottomBar } from './ui.js';
import { homeView } from './views/home.js';
import { joinView, fitView } from './views/fit.js';
import { popView, statusCard, stopCountdown } from './views/pop.js';
import { mixView } from './views/mix.js';
import { runView } from './views/run.js';

const VIEWS = { fit: fitView, pop: popView, mix: mixView, run: runView };

let pending = false, lastScreen = '';
const typing = () => document.activeElement?.matches('input, textarea, select');
const screenKey = () => `${!!state.room}|${!!state.room?.members?.[state.me]}|${state.room ? currentPhase() : ''}`;

/** 입력 중이면 전체를 다시 그리지 않는다(글자가 날아가지 않도록). 포커스가 빠질 때 그린다.
 *  단, 단계가 바뀌는 등 화면 자체가 달라질 때는 바로 그린다. */
function render(force = false) {
  if (!force && typing() && state.room && screenKey() === lastScreen) {
    pending = true;
    const status = $('#popStatus');
    if (status && currentPhase() === 'pop') status.innerHTML = statusCard();
    return;
  }
  pending = false;
  lastScreen = screenKey();
  stopCountdown();
  renderHeader();
  if (!state.code) return homeView();
  if (!state.room) return missingView();
  if (!state.room.members?.[state.me]) return joinView();
  (VIEWS[currentPhase()] || fitView)();
}

function missingView() {
  bottomBar();
  $('#app').innerHTML = `<div class="empty"><h1>프로젝트를 찾을 수 없어요</h1>
    <p class="sub">초대 코드 ${state.code}를 다시 확인해 주세요.</p><a class="btn-primary" href="./">처음으로</a></div>`;
}

async function boot() {
  const params = new URLSearchParams(location.search);
  state.hasRemote = !!FIREBASE_CONFIG;
  state.isLocal = !state.hasRemote || params.has('local');
  state.store = state.isLocal ? Local : await connectFirebase(FIREBASE_CONFIG);
  state.me = resolveMe({ allowTestOverride: !state.hasRemote });
  loadUi();
  setRenderer(render);
  document.addEventListener('focusout', () => setTimeout(() => pending && !typing() && render(true), 0));

  if (!state.code) return render(true);
  $('#app').innerHTML = '<p class="sub" style="padding:40px 0;text-align:center">불러오는 중</p>';
  let first = true;
  state.store.subscribe(state.code, room => {
    state.room = room;
    rememberProject();
    render(first);
    first = false;
  });
}

boot().catch(err => {
  console.error(err);
  $('#app').innerHTML = '<div class="empty"><h1>앱을 시작하지 못했어요</h1><p class="sub">새로고침해 주세요.</p></div>';
});
