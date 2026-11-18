# POPCORN

> 생각은 톡톡 자유롭게, 협업은 유기적으로.

대학생 팀 프로젝트를 위한 웹 협업 툴입니다. 역할 매칭(FIT), 각자 의견 내기(POP), 의견 수렴(MIX), 협업 실행(RUN)이 한 흐름으로 이어집니다. 팀원은 링크만 열면 로그인 없이 참여합니다.

창의적기획과문제해결 2조 팀 프로젝트의 시연용 구현입니다. Svelte 5 + Vite로 만들었고, main에 올리면 GitHub Actions가 빌드해서 GitHub Pages에 배포합니다.

## 주요 동작

- **프로젝트 유형 4종**(발표형, 연구·보고서형, 기획·창의형, 제작·실습형, 여러 개 선택 가능)에 따라 POP의 질문, MIX의 평가 기준, RUN의 실행 계획이 바뀝니다.
- **비동기 발산**: POP 기간을 10분~3일 중에 고릅니다. 전원이 최소 카드 수를 채우거나 기간이 끝나면 자동으로 MIX로 넘어갑니다.
- **여러 번 정하기**: 프로젝트 하나에서 '새로 정할 것'을 추가하면 같은 팀으로 POP→MIX를 다시 돌립니다. 정한 것은 RUN에 쌓이고 업무는 이어집니다.
- **결과 내보내기**: RUN에서 결과를 마크다운으로 복사(Notion·한글에 붙여 넣기)하거나 PDF로 저장합니다.
- **팀 구성**(동일 전공 / 융합 전공)은 팀원이 입력한 전공으로 판단하고, 질문과 팀 진단 문구가 바뀝니다.
- **역할 추천**은 성향 질문 5개, 희망 역할, 자신 있는 것을 보고 예상 소요 시간 기준으로 업무량을 맞춥니다.
- **시뮬레이션**: 첫 화면에서 동일 전공 팀과 융합 전공 팀을 같은 주제로 비교해 볼 수 있습니다.

## 개발

```
npm install
npm run dev                  # http://localhost:5173
VITE_LOCAL=1 npm run dev     # Firebase 없이 이 브라우저 안에서만 저장 (테스트용, ?as=이름 으로 여러 사용자 흉내)
npm run build                # dist/ 에 정적 파일 생성
```

## 파일 구조

```
index.html                 화면 틀
src/main.js                시작점
src/App.svelte             저장소 연결, 문서 구독, 단계별 화면 고르기
src/app.css                스타일
src/views/                 Home, Join, Fit, Pop, Mix, Run
src/components/            Header, BottomBar, Avatar, Reaction, TwoStepButton
src/lib/app.svelte.js      공용 상태(반응형)와 방 데이터 읽기 도우미
src/lib/store.js           저장소 (Firestore / 로컬)
src/lib/content.js         유형별 질문·기준·역할·업무 등 문구 데이터
src/lib/ai.js              규칙 기반 분석 (유사도, 다수·소수 분류, 역할 추천, 실행 계획)
src/lib/simulation.js      시뮬레이션 데이터
src/lib/config.js          Firebase 설정
public/                    파비콘
.github/workflows/         GitHub Pages 배포
```

## 서버 연결 (Firebase)

설정이 없으면 '로컬 시연 모드'로 동작합니다. 한 브라우저 안에서만 데이터가 공유되고, 탭을 여러 개 열어 시연할 수 있습니다.

1. https://console.firebase.google.com 에서 프로젝트를 만듭니다. Google 애널리틱스는 꺼도 됩니다.
2. **빌드 → Firestore Database → 데이터베이스 만들기**를 누르고, 위치는 `asia-northeast3 (서울)`로 고릅니다.
3. **규칙** 탭에 아래 내용을 붙여 넣고 게시합니다.

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /rooms/{room} {
         allow read, write: if room.size() == 6;
       }
     }
   }
   ```

4. **프로젝트 설정 → 일반 → 내 앱 → 웹(</>)**으로 앱을 등록하고, 나오는 `firebaseConfig` 객체를 `src/lib/config.js`에 넣습니다.

## 알려진 한계 (다음 개편 때 다룰 것)

- 인증이 없습니다. 초대 코드를 아는 사람은 누구나 읽고 쓸 수 있습니다.
- 카드 작성자가 같은 문서에 저장되어 있어서, 개발자 도구로 보면 공개 전에도 내용을 볼 수 있습니다. 화면에서만 숨깁니다.
- 'AI' 기능(질문, 다수·소수 분류, 융합 제안, 역할 추천, 실행 계획)은 규칙 기반입니다. 실제 LLM은 API 키를 보관할 서버(예: Cloud Functions, Cloudflare Workers)가 생기면 붙입니다.
