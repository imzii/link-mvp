<script>
  import { STAGES } from '../lib/content.js';
  import { app, currentPhase } from '../lib/app.svelte.js';
  const current = $derived(app.room ? STAGES.findIndex(s => s.phase === currentPhase()) : -1);
</script>

<header>
  <div class="header-row">
    <a class="logo" href="./"><img src="./favicon.svg" alt="" width="24" height="24">POPCORN</a>
    <span class="project-name">{app.room?.name ?? ''}</span>
  </div>
  {#if app.room}
    <nav class="steps" aria-label="진행 단계">
      {#each STAGES as stage, i}
        <div class="step" class:current={i === current} class:done={i < current} aria-current={i === current ? 'step' : undefined}>{stage.label}</div>
      {/each}
    </nav>
  {/if}
</header>
