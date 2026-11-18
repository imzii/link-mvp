// FIT: 참여(프로필 · 협업 성향 진단)와 팀 구성 · 역할 추천.

import { $, $$, on, esc, toast, copyText } from '../util.js';
import { QUIZ, TRAITS } from '../content.js';
import { state, saveUi, save, members, memberName, avatar, isLeader, typeProfile, claimIdentity } from '../state.js';
import { teamComposition, recommendRoles, recommendReason } from '../ai.js';
import { bottomBar, rerender } from '../ui.js';

// ---------- 참여 (아직 팀원이 아닐 때) ----------

export function joinView() {
  const profile = state.ui.profile;
  if ((profile.step || 1) === 1) profileStep(profile);
  else quizStep(profile);
}

function profileStep(profile) {
  const room = state.room;
  $('#app').innerHTML = `
  <h1>${esc(room.name)}</h1><p class="sub">${esc(room.topic)}</p>
  <form class="card" novalidate>
    <h2 style="margin-top:0">나를 소개해 주세요 <span class="xs sub">1/2</span></h2>
    ${members().length ? `<details class="sm" style="margin:-4px 0 6px">
      <summary style="cursor:pointer;font-weight:600;padding:6px 0">이미 참여했어요 (다른 기기에서 이어하기)</summary>
      <div class="options" style="margin-top:6px">${members().map(([id, m]) => `<button type="button" data-claim="${id}">${esc(m.name)}</button>`).join('')}</div>
    </details>` : ''}
    <label for="memberName">이름</label><input id="memberName" value="${esc(profile.name || '')}" autocomplete="name" required>
    <label for="major">전공</label><input id="major" value="${esc(profile.major || '')}" placeholder="예: 경영학과" required>
    <label for="skills">자신 있는 분야나 경험</label><input id="skills" value="${esc(profile.skills || '')}" placeholder="예: PPT, 자료조사, 영상편집">
    <label>희망 역할 <span class="xs sub">(여러 개 선택)</span></label>
    <div class="options">${typeProfile().roles.map(([role]) => `<button type="button" data-want="${esc(role)}" aria-pressed="${profile.wants.includes(role)}">${esc(role)}</button>`).join('')}</div>
  </form>`;

  // 다른 기기에서 이어하기: 이름을 한 번 누르면 확인 문구, 한 번 더 누르면 그 사람으로 전환
  on('[data-claim]', 'click', e => {
    const button = e.currentTarget, id = button.dataset.claim;
    if (!button.dataset.armed) {
      $$('[data-claim]').forEach(b => { delete b.dataset.armed; b.setAttribute('aria-pressed', false); });
      button.dataset.armed = '1'; button.setAttribute('aria-pressed', true);
      button.textContent = `${memberName(id)}(으)로 이어하기`;
      return;
    }
    claimIdentity(id); location.reload();
  });

  on('[data-want]', 'click', e => {
    const role = e.currentTarget.dataset.want;
    profile.wants = profile.wants.includes(role) ? profile.wants.filter(r => r !== role) : [...profile.wants, role];
    e.currentTarget.setAttribute('aria-pressed', profile.wants.includes(role));
    saveUi();
  });
  for (const [id, field] of [['memberName', 'name'], ['major', 'major'], ['skills', 'skills']]) {
    $('#' + id).oninput = e => { profile[field] = e.target.value; saveUi(); };
  }

  bottomBar({ buttons: '<button class="btn-primary" id="next">다음</button>' });
  $('#next').onclick = () => {
    if (!profile.name?.trim() || !profile.major?.trim()) {
      toast('이름과 전공을 적어 주세요');
      (profile.name?.trim() ? $('#major') : $('#memberName')).focus();
      return;
    }
    profile.step = 2; saveUi(); rerender();
  };
}

function quizStep(profile) {
  const answers = state.ui.quiz;
  const allAnswered = () => QUIZ.every((_, i) => answers[i] != null);
  $('#app').innerHTML = `
  <h1>협업 성향 진단 <span class="xs sub">2/2</span></h1>
  ${QUIZ.map(([a, b], i) => `<div class="card"><h3>Q${i + 1}. 둘 중 더 편한 쪽은?</h3>
    <div class="choices" role="radiogroup" aria-label="질문 ${i + 1}">
      ${[a, b].map((text, v) => `<button type="button" role="radio" data-q="${i}" data-v="${v}" aria-pressed="${answers[i] === v}" aria-checked="${answers[i] === v}">${text}</button>`).join('')}
    </div></div>`).join('')}`;

  on('[data-q]', 'click', e => {
    const i = +e.currentTarget.dataset.q, v = +e.currentTarget.dataset.v;
    answers[i] = v; saveUi();
    $$(`[data-q="${i}"]`).forEach(b => { const picked = +b.dataset.v === v; b.setAttribute('aria-pressed', picked); b.setAttribute('aria-checked', picked); });
    $('#join').disabled = !allAnswered();
  });

  bottomBar({ left: '<button id="back">이전</button>', buttons: `<button class="btn-primary" id="join" ${allAnswered() ? '' : 'disabled'}>참여하기</button>` });
  $('#back').onclick = () => { profile.step = 1; saveUi(); rerender(); };
  $('#join').onclick = async () => {
    const scores = {};
    QUIZ.forEach((q, i) => { const trait = q[2 + answers[i]]; scores[trait] = (scores[trait] || 0) + 1; });
    const trait = Object.keys(TRAITS).sort((x, y) => (scores[y] || 0) - (scores[x] || 0))[0];
    await save({ [`members.${state.me}`]: {
      name: profile.name.trim(), major: profile.major.trim(), skills: (profile.skills || '').trim(),
      wants: profile.wants, trait, scores, joinedAt: Date.now(),
    } });
    toast(`${trait}: ${TRAITS[trait]}`);
  };
}

// ---------- 팀 구성 · 역할 추천 (팀원이 된 뒤) ----------

export function teamCard() {
  const team = teamComposition();
  return `<div class="card">
    <div class="row between"><h3>팀원 ${members().length}명</h3><span class="chip on">${team.kind === 'same' ? '동일 전공 팀' : '융합 전공 팀'}</span></div>
    <div class="people" style="margin-top:8px">${members().map(([id, m]) => `<div class="person">${avatar(id)}<div>
      <b>${esc(m.name)}</b>${id === state.room.hostId ? ' <span class="xs sub">(리더)</span>' : ''}
      <div class="xs sub">${esc(m.major)}, ${esc(m.trait)}</div></div></div>`).join('')}</div>
  </div>`;
}

/**
 * 역할 조율표. 각자 낸 희망 역할을 먼저 보여 주고, 희망이 겹치거나 아무도 원하지 않는 역할에만
 * 성향 기반 추천을 '참고'로 붙인다. 추천이 먼저 보이면 그대로 따르게 되기 쉬워서다(앵커링).
 */
function roleRecommendationCard() {
  const roles = typeProfile().roles, owners = recommendRoles(state.room);
  const wantersOf = role => members().filter(([, m]) => (m.wants || []).includes(role)).map(([id]) => id);
  const person = id => `<span class="row" style="gap:6px">${avatar(id)}${esc(memberName(id))}</span>`;
  const rows = roles.map(role => {
    const wanters = wantersOf(role[0]), owner = owners[role[0]];
    const status = wanters.length === 1 ? '<span class="xs sub">희망 1명</span>'
      : wanters.length ? '<span class="chip on">조율 필요</span>' : '<span class="xs sub">희망자 없음</span>';
    const hint = wanters.length === 1 || !owner ? ''
      : `<div class="xs sub" style="margin-top:4px">참고: ${esc(memberName(owner))} (${recommendReason(state.room.members[owner], role)})</div>`;
    return `<tr><td><b>${esc(role[0])}</b><div class="xs sub">${role[1]}시간</div></td>
      <td><div class="people">${wanters.map(person).join('') || '-'}</div>${hint}</td><td>${status}</td></tr>`;
  });
  const conflicts = roles.filter(([r]) => wantersOf(r).length !== 1).length;
  return `<div class="card">
    <div class="row between"><h3>역할 조율</h3><span class="sm sub">${conflicts ? `이야기할 역할 ${conflicts}개` : '모두 희망대로 나뉘었어요'}</span></div>
    <table style="margin-top:6px"><thead><tr><th>역할</th><th>희망한 사람</th><th>상태</th></tr></thead><tbody>${rows.join('')}</tbody></table>
  </div>`;
}

export function fitView() {
  const room = state.room;
  const inviteLink = `${location.origin}${location.pathname}?r=${state.code}${state.isLocal && state.hasRemote ? '&local=1' : ''}`;
  $('#app').innerHTML = `
  <h1>${esc(room.name)}</h1><p class="sub">${esc(room.topic)}</p>
  <div class="card"><h3>팀원 초대</h3>
    <div class="row between" style="margin:10px 0"><span class="invite-code" aria-label="초대 코드">${state.code}</span><button id="copyLink">초대 링크 복사</button></div>
    ${navigator.share ? '<button class="btn-link" id="shareLink">공유하기…</button>' : ''}
  </div>
  ${teamCard()}
  ${members().length ? roleRecommendationCard() : ''}`;

  $('#copyLink').onclick = () => copyText(inviteLink);
  $('#shareLink') && ($('#shareLink').onclick = () => navigator.share({ title: 'POPCORN 초대', text: `${room.name} 팀 프로젝트에 참여해 주세요`, url: inviteLink }).catch(() => {}));

  if (!isLeader()) return bottomBar();
  const enough = members().length >= 2;
  bottomBar({ message: enough ? '' : '팀원이 2명 이상이면 시작할 수 있어요', buttons: `<button class="btn-primary" id="startPop" ${enough ? '' : 'disabled'}>POP 시작</button>` });
  $('#startPop').onclick = () => {
    const now = Date.now();
    save({ phase: 'pop', phaseAt: now, popEnd: now + (room.popMinutes || room.popMin || 1440) * 60000 });
  };
}
