<script>
  // 화면 아래 고정 바. left: 왼쪽 보조 버튼, actions: 오른쪽 주요 버튼
  let { message = '', left, actions } = $props();
</script>

{#if message || left || actions}
  <div class="bottom-bar">
    <div class="inner">
      {@render left?.()}
      <span class="message">{message}</span>
      {@render actions?.()}
    </div>
  </div>
{/if}
