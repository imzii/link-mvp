<script>
  // 시작점: 저장소를 고르고, 프로젝트 문서를 구독하고, 단계에 맞는 화면을 고른다.
  // 문서가 바뀌면 app.room만 바꾸면 되고, 화면은 Svelte가 바뀐 부분만 갱신한다.
  import { FIREBASE_CONFIG } from './lib/config.js';
  import { Local, connectFirebase } from './lib/store.js';
  import { app, backend, resolveMe, loadUi, rememberProject, currentPhase } from './lib/app.svelte.js';
  import { toastState } from './lib/toast.svelte.js';
  import Header from './components/Header.svelte';
  import Home from './views/Home.svelte';
  import Join from './views/Join.svelte';
  import Fit from './views/Fit.svelte';
  import Pop from './views/Pop.svelte';
  import Mix from './views/Mix.svelte';
  import Run from './views/Run.svelte';

  const VIEWS = { fit: Fit, pop: Pop, mix: Mix, run: Run };
  let status = $state('loading');   // loading | ready | failed

  async function boot() {
    const params = new URLSearchParams(location.search);
    app.hasRemote = !!FIREBASE_CONFIG;
    app.isLocal = !app.hasRemote || params.has('local');
    backend.store = app.isLocal ? Local : await connectFirebase(FIREBASE_CONFIG);
    app.me = resolveMe({ allowTestOverride: !app.hasRemote });
    loadUi();
    if (!app.code) { status = 'ready'; return; }
    backend.store.subscribe(app.code, room => {
      app.room = room;
      rememberProject();
      status = 'ready';
    });
  }
  boot().catch(err => { console.error(err); status = 'failed'; });

  const isMember = $derived(!!app.room?.members?.[app.me]);
  const View = $derived(app.room && isMember ? (VIEWS[currentPhase()] || Fit) : null);
</script>

<Header />

<main>
  {#if status === 'failed'}
    <div class="empty"><h1>앱을 시작하지 못했어요</h1><p class="sub">새로고침해 주세요.</p></div>
  {:else if status === 'loading'}
    <p class="sub" style="padding:40px 0;text-align:center">불러오는 중</p>
  {:else if !app.code}
    <Home />
  {:else if !app.room}
    <div class="empty">
      <h1>프로젝트를 찾을 수 없어요</h1>
      <p class="sub">초대 코드 {app.code}를 다시 확인해 주세요.</p>
      <a class="btn-primary" href="./">처음으로</a>
    </div>
  {:else if !isMember}
    <Join />
  {:else}
    {#key `${currentPhase()}-${app.room.round || 1}`}
      <View />
    {/key}
  {/if}
</main>

<div class="toast" class:show={toastState.visible} role="status" aria-live="polite">{toastState.message}</div>
