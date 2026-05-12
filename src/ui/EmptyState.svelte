<script lang="ts">
  export let title: string = 'Start by adding an image';
  export let body: string = 'Drop PNG or JPEG files into the sidebar, or click "Add images" to pick from your computer.';
</script>

<div class="empty" role="status">
  <svg class="ill" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect width="18" height="18" x="3" y="3" rx="2" ry="2"/>
    <circle cx="9" cy="9" r="2"/>
    <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>
  </svg>
  <h3>{title}</h3>
  <p>{body}</p>
</div>

<style>
  .empty { text-align: center; padding: 40px 24px; color: var(--text-muted); }
  .ill { display: block; margin: 0 auto var(--space-3); color: var(--text-faint); }
  h3 { font-size: var(--fs-md); font-weight: 700; color: var(--text); margin: 0 0 var(--space-1) 0; }
  p  { font-size: var(--fs-sm); margin: 0; line-height: 1.5; }
</style>
