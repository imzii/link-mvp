// 시뮬레이션: 같은 주제를 동일 전공 팀과 융합 전공 팀으로 비교해 본다.
// 이 기기 안(로컬 저장소)에서만 돌고, '참여한 프로젝트' 목록에는 남지 않는다.

import { randomId, today, addDays } from '../util.js';
import { TYPES } from '../content.js';
import { state } from '../state.js';
import { Local } from '../store.js';
import { openProject } from './home.js';

const TOPIC = '무임승차를 줄이는 서비스, 무엇을 만들까?';

const TEAMS = {
  same: {
    name: '시뮬레이션: 동일 전공 팀',
    me: '경영학과',
    people: [
      ['김민지', '경영학과', '마케팅, 설문', '아이디어형', ['콘셉트 기획']],
      ['박서준', '경영학과', '엑셀, 자료조사', '정리형', ['타깃 리서치']],
      ['이하윤', '경영학과', '발표, PPT', '발표형', ['피칭·발표']],
    ],
    cards: [
      ['기여도를 점수로 매겨 성적에 반영한다', '점수가 있어야 움직인다'], ['팀원끼리 기여도 점수를 매기는 상호평가', '교수님이 다 볼 수 없다'], ['기여도 점수를 매주 공개한다', '늦게 알면 바로잡을 수 없다'],
      ['역할별 기여 점수를 자동 계산한다', '공정한 기준이 필요하다'], ['상호평가 점수를 익명으로 매긴다', '눈치 보지 않게'], ['무임승차한 팀원을 교수님께 신고하는 기능', '최후의 수단'],
      ['첫 회의에서 각자 하기 싫은 일을 먼저 말하게 한다', '싫은 일이 빈칸으로 남는다'], ['기여도 점수를 성적 일부로 반영한다', '동기 부여'], ['기여 점수가 낮으면 알림을 준다', ''],
    ],
  },
  mixed: {
    name: '시뮬레이션: 융합 전공 팀',
    me: 'AI융합학부',
    people: [
      ['김동현', '법학과', '자료조사, 글쓰기', '정리형', ['실행 전략']],
      ['정종엽', '사회복지상담학과', '인터뷰, 상담', '발표형', ['타깃 리서치', '피칭·발표']],
      ['남예원', '화학과', '실험설계, 디자인', '실행형', ['시각 자료 제작']],
    ],
    cards: [
      ['팀원이 서로 기여를 증언하는 상호평가 기록', '법적 분쟁도 증거가 핵심이다'], ['무임승차 원인을 면담으로 먼저 듣는 상담 단계', '게으름이 아니라 사정일 수 있다'], ['실험 노트처럼 작업 과정을 날짜별로 남긴다', '과정이 남아야 기여가 보인다'],
      ['역할별 기여를 점수화해 공개한다', '투명하면 줄어든다'], ['처음에 팀 규칙을 계약서처럼 서명한다', '약속이 있어야 책임이 생긴다'], ['참여가 적은 팀원에게 작은 일부터 맡긴다', '진입 장벽을 낮춘다'],
      ['기여 기록을 교수에게 제출하는 기능', '평가 근거가 된다'], ['팀원 상태를 체크하는 익명 기분 설문', '소진을 미리 알 수 있다'], ['작업 과정을 사진으로 기록해 공유', ''],
    ],
  },
};

export async function startSimulation(kind) {
  const team = TEAMS[kind], now = Date.now(), members = {}, cards = {};
  team.people.forEach(([name, major, skills, trait, wants], i) => {
    const id = 'sim' + i;
    members[id] = { name, major, skills, trait, wants, scores: { [trait]: 3 }, joinedAt: now + i };
    team.cards.slice(i * 3, i * 3 + 3).forEach(([text, why], j) => { cards[`c${i}${j}`] = { text, why, by: id, at: now + i * 10 + j }; });
  });
  // 나는 리더로 참여하고, 아직 카드를 쓰지 않은 상태로 POP에서 시작한다.
  members[state.me] = { name: '나', major: team.me, skills: '기획, 개발', trait: '아이디어형', wants: ['콘셉트 기획'], scores: {}, joinedAt: now + 9 };

  const code = 'S' + randomId(5);
  await Local.create(code, {
    v: 4, sim: true, name: team.name, topic: TOPIC, types: ['plan'], criteria: TYPES.plan.criteria.slice(),
    deadline: addDays(today(), 14), cardsPerPerson: 3, popMinutes: 30, popEnd: now + 30 * 60000,
    hostId: state.me, createdAt: now, phase: 'pop', phaseAt: now, members, cards,
  });
  openProject(code, { local: true });
}
