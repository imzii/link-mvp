<script>
  // 되돌리기 어려운 행동은 두 번 눌러야 실행한다. needConfirm이 false면 한 번에 실행한다.
  let { label, confirmLabel, onconfirm, needConfirm = true, class: className = '', disabled = false, ...rest } = $props();
  let armed = $state(false);

  function click() {
    if (needConfirm && !armed) { armed = true; return; }
    armed = false;
    onconfirm();
  }
</script>

<button {...rest} class={className} {disabled} onclick={click}>{armed ? confirmLabel : label}</button>
