<script>
  import { avatarOf } from '../lib/app.svelte.js';
  let { id } = $props();
  const a = $derived(avatarOf(id));
</script>

<span class="avatar" style:background={a.color} aria-hidden="true">{a.initial}</span>
