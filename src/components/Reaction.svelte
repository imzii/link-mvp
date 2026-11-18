<script>
  // '반영해 보자 / 보류' 선택. key는 소수 의견 카드 id 또는 다수 의견 묶음 'majority'.
  // 전원이 평가를 마치기 전에는 다른 사람의 선택 수를 숨긴다(앵커링 방지).
  import { app, save } from '../lib/app.svelte.js';
  let { key, revealed } = $props();

  const votes = $derived(app.room.mix?.reactions?.[key] || {});
  const mine = $derived(votes[app.me]);
  const count = v => Object.values(votes).filter(x => x === v).length;
  const pick = v => save({ [`mix.reactions.${key}.${app.me}`]: mine === v ? null : v });
</script>

<div class="toggle" role="group" aria-label="반영 여부">
  <button type="button" data-react={key} data-value="yes" aria-pressed={mine === 'yes'} onclick={() => pick('yes')}>반영해 보자{#if revealed}<span class="count">{count('yes')}</span>{/if}</button>
  <button type="button" data-react={key} data-value="hold" aria-pressed={mine === 'hold'} onclick={() => pick('hold')}>보류{#if revealed}<span class="count">{count('hold')}</span>{/if}</button>
</div>
