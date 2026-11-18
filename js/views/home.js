// 첫 화면: 새 프로젝트 만들기, 초대 코드로 참여, 시뮬레이션.

import { $, $$, on, esc, toast, today, addDays, randomId, formatMinutes } from '../util.js';
import { TYPES, POP_DURATIONS, DEFAULT_POP_MINUTES } from '../content.js';
import { state, recentProjects, typeProfile } from '../state.js';
import { bottomBar } from '../ui.js';
import { startSimulation } from './simulation.js';

export function openProject(code, { local = state.isLocal } = {}) {
  const testUser = new URLSearchParams(location.search).get('as');
  location.search = `?r=${code}${local && state.hasRemote ? '&local=1' : ''}${testUser ? '&as=' + testUser : ''}`;
}

export function homeView() {
  bottomBar();
  const recent = recentProjects();
  $('#app').innerHTML = `
  <section class="hero"><h1>생각은 톡톡 자유롭게,<br>협업은 유기적으로.</h1></section>

  ${recent.length ? `<section class="card"><h3>이 기기에서 참여한 프로젝트</h3>
    ${recent.map(p => `<div class="row between" style="padding:8px 0;border-top:1px solid var(--line)">
      <span class="grow"><b>${esc(p.name)}</b> <span class="sm sub">${esc(p.code)}</span></span>
      <a href="?r=${esc(p.code)}"><button>열기</button></a></div>`).join('')}</section>` : ''}

  <form class="card" id="newProject" novalidate>
    <h2 style="margin-top:0">새 프로젝트 만들기</h2>
    <label for="name">프로젝트 이름</label>
    <input id="name" required placeholder="예: 창의적기획과문제해결 2조" autocomplete="off">
    <label for="topic">주제</label>
    <input id="topic" required placeholder="예: 대학생 팀플 무임승차를 줄이는 서비스 기획" autocomplete="off">

    <label id="typeLabel">프로젝트 유형 <span class="xs sub">(여러 개 선택)</span></label>
    <div class="choices" role="group" aria-labelledby="typeLabel">
      ${Object.entries(TYPES).map(([key, t]) => `<button type="button" data-type="${key}" aria-pressed="${key === 'plan'}"><b>${t.name}</b></button>`).join('')}
    </div>

    <label>평가 기준</label>
    <div id="criteriaEditor"></div>

    <div class="grid-2">
      <div><label for="deadline">최종 마감일</label><input id="deadline" type="date" value="${addDays(today(), 14)}"></div>
      <div><label for="cardsPerPerson">1인 아이디어 카드 수 <span class="xs sub">(최소)</span></label>
        <select id="cardsPerPerson">${[1, 2, 3, 4, 5].map(n => `<option ${n === 3 ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label for="popMinutes">아이디어 발산 기간</label>
        <select id="popMinutes">${POP_DURATIONS.map(m => `<option value="${m}" ${m === DEFAULT_POP_MINUTES ? 'selected' : ''}>${formatMinutes(m)}</option>`).join('')}</select></div>
    </div>
    <button class="btn-primary wide" style="margin-top:16px" type="submit">프로젝트 만들고 팀원 초대하기</button>
  </form>

  <form class="card" id="joinByCode" novalidate>
    <h3>초대 코드로 참여</h3>
    <div class="row">
      <label for="code" class="sr-only">초대 코드</label>
      <input id="code" class="grow" placeholder="6자리 코드" maxlength="6" autocapitalize="characters" autocomplete="off" style="text-transform:uppercase">
      <button type="submit">참여</button>
    </div>
  </form>

  <section class="card">
    <h3>시뮬레이션으로 둘러보기</h3>
    <div class="grid-2" style="margin-top:8px">
      <button id="simSame">동일 전공 팀 (경영 4명)</button>
      <button id="simMixed">융합 전공 팀 (4개 전공)</button>
    </div>
  </section>
  ${!state.hasRemote ? '<p class="foot">서버 설정이 없어 이 브라우저 안에서만 저장돼요.</p>' : ''}`;

  // 유형을 바꾸면, 리더가 기준을 직접 고치기 전까지는 유형 기준으로 다시 채운다.
  let types = ['plan'];
  let criteria = typeProfile({ types }).criteria.slice(0, 6);
  let criteriaEdited = false;
  const drawCriteria = () => criteriaEditor($('#criteriaEditor'), criteria, list => { criteria = list; criteriaEdited = true; });
  drawCriteria();

  on('[data-type]', 'click', e => {
    const key = e.currentTarget.dataset.type;
    if (types.includes(key)) {
      if (types.length === 1) return toast('유형을 1개 이상 골라 주세요');
      types = types.filter(t => t !== key);
    } else types = [...types, key];
    $$('[data-type]').forEach(b => b.setAttribute('aria-pressed', types.includes(b.dataset.type)));
    if (!criteriaEdited) { criteria = typeProfile({ types }).criteria.slice(0, 6); drawCriteria(); }
  });

  $('#newProject').onsubmit = async e => {
    e.preventDefault();
    const name = $('#name').value.trim(), topic = $('#topic').value.trim();
    if (!name || !topic) { toast('프로젝트 이름과 주제를 적어 주세요'); (name ? $('#topic') : $('#name')).focus(); return; }
    const code = randomId();
    await state.store.create(code, {
      v: 4, name, topic, types, criteria,
      deadline: $('#deadline').value,
      cardsPerPerson: +$('#cardsPerPerson').value,
      popMinutes: +$('#popMinutes').value,
      hostId: state.me, createdAt: Date.now(), phase: 'fit', members: {}, cards: {},
    });
    openProject(code);
  };

  $('#joinByCode').onsubmit = e => {
    e.preventDefault();
    const code = $('#code').value.trim().toUpperCase();
    if (code.length !== 6) return toast('6자리 코드를 입력해 주세요');
    openProject(code, { local: false });
  };

  $('#simSame').onclick = () => startSimulation('same');
  $('#simMixed').onclick = () => startSimulation('mixed');
}

/** 평가 기준 칩 편집기. 1~6개, 중복 불가. */
function criteriaEditor(container, list, onChange) {
  const draw = () => {
    container.innerHTML = `
      <div class="options">${list.map((c, i) => `<span class="chip on" style="font-size:13px;padding:5px 6px 5px 10px">${esc(c)}<button type="button" class="remove" data-remove="${i}" aria-label="${esc(c)} 삭제">×</button></span>`).join('')}</div>
      <div class="row" style="margin-top:8px">
        <label for="newCriterion" class="sr-only">평가 기준 추가</label>
        <input id="newCriterion" class="grow" maxlength="20" placeholder="기준 추가 (예: 근거의 구체성)" autocomplete="off">
        <button type="button" id="addCriterion">추가</button>
      </div>`;
    container.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => {
      if (list.length <= 1) return toast('평가 기준은 1개 이상 필요해요');
      list.splice(+b.dataset.remove, 1); onChange(list); draw();
    });
    const add = () => {
      const value = $('#newCriterion').value.trim();
      if (!value) return;
      if (list.includes(value)) return toast('이미 있는 기준이에요');
      if (list.length >= 6) return toast('평가 기준은 6개까지 둘 수 있어요');
      list.push(value); onChange(list); draw(); $('#newCriterion').focus();
    };
    $('#addCriterion').onclick = add;
    $('#newCriterion').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
  };
  draw();
}
