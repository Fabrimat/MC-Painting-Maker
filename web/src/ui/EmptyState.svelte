<script lang="ts">
  export let title: string = 'Start by adding an image';
  export let body: string = 'Drop PNG or JPEG files into the sidebar, or click "Add images" to pick from your computer.';
</script>

<div class="empty" role="status">
  <div class="ill" aria-hidden="true">🖼</div>
  <h3>{title}</h3>
  <p>{body}</p>
</div>

<style>
  .empty { text-align: center; padding: 40px 24px; color: var(--text-muted); }
  .ill { font-size: 36px; margin-bottom: var(--space-3); }
  h3 { font-size: var(--fs-md); font-weight: 700; color: var(--text); margin: 0 0 var(--space-1) 0; }
  p  { font-size: var(--fs-sm); margin: 0; line-height: 1.5; }
</style>
