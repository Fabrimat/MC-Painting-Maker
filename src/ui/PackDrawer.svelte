<script lang="ts">
  import { project } from '../stores/project';
  import { packDrawerOpen } from '../stores/ui';
  import { z } from 'zod';

  const NamespaceTest = z.string()
    .regex(/^[a-z][a-z0-9_]{0,15}$/)
    .refine((v) => v !== 'minecraft');
  let namespaceError: string | null = null;
  function validateNamespace() {
    const r = NamespaceTest.safeParse($project.pack.namespace);
    namespaceError = r.success ? null : 'Use lowercase a-z, 0-9, _ (max 16 chars), not "minecraft".';
  }

  function close() { packDrawerOpen.set(false); }
  function onKeyDown(e: KeyboardEvent) { if (e.key === 'Escape') close(); }

  async function onPackIconPicked(e: Event) {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const b64 = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const v = String(fr.result);
        const idx = v.indexOf(',');
        resolve(idx >= 0 ? v.slice(idx + 1) : v);
      };
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(f);
    });
    project.update((s) => ({ ...s, pack: { ...s.pack, iconPngBase64: b64 } }));
  }
  function clearPackIcon() {
    project.update((s) => ({ ...s, pack: { ...s.pack, iconPngBase64: null } }));
  }
</script>

{#if $packDrawerOpen}
  <div
    class="shade"
    on:click={close}
    on:keydown={onKeyDown}
    role="presentation"
  ></div>
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <div
    class="drawer"
    role="dialog" aria-modal="true" aria-labelledby="pack-drawer-title"
    on:keydown={onKeyDown}
    tabindex="-1"
  >
    <header class="head">
      <h2 id="pack-drawer-title">Pack settings</h2>
      <button type="button" class="close" aria-label="Close pack settings" on:click={close}>✕</button>
    </header>

    <section>
      <h4 class="section-title">Identity</h4>
      <label class="stack">
        <span class="field-label">Pack name</span>
        <span class="field-hint">Shown in the in-game pack list.</span>
        <input class="field" bind:value={$project.pack.name} />
      </label>
      <label class="stack">
        <span class="field-label">Description</span>
        <input class="field" bind:value={$project.pack.description} />
      </label>
      <span class="field-label">Pack icon</span>
      <div class="icon-pick">
        <div class="preview">
          {#if $project.pack.iconPngBase64}
            <img src={`data:image/png;base64,${$project.pack.iconPngBase64}`} alt="pack icon preview" />
          {/if}
        </div>
        <label class="pick">
          <span>Change…</span>
          <input type="file" accept="image/png" on:change={onPackIconPicked} hidden />
        </label>
        {#if $project.pack.iconPngBase64}
          <button type="button" class="link" on:click={clearPackIcon}>Clear</button>
        {/if}
      </div>
    </section>

    <section>
      <h4 class="section-title">Advanced</h4>
      <label class="stack">
        <span class="field-label">Namespace</span>
        <span class="field-hint">Lowercase, used internally. Don't change after publishing.</span>
        <input class="field" class:invalid={namespaceError !== null}
          bind:value={$project.pack.namespace} on:blur={validateNamespace} />
        {#if namespaceError}<span class="err">{namespaceError}</span>{/if}
      </label>
      <label class="stack">
        <span class="field-label">Creative menu group</span>
        <input class="field" bind:value={$project.pack.creativeGroupName} />
      </label>
      <span class="field-label">Version</span>
      <div class="row3">
        <input class="field" type="number" min="0" bind:value={$project.pack.semver[0]} aria-label="Major version" />
        <input class="field" type="number" min="0" bind:value={$project.pack.semver[1]} aria-label="Minor version" />
        <input class="field" type="number" min="0" bind:value={$project.pack.semver[2]} aria-label="Patch version" />
      </div>
    </section>
  </div>
{/if}

<style>
  .shade {
    position: fixed; inset: 0; background: rgba(15,23,42,.4);
    backdrop-filter: blur(2px); z-index: 10;
  }
  .drawer {
    position: fixed; right: 0; top: 0; bottom: 0; width: 380px;
    background: var(--bg); border-left: 1px solid var(--border);
    box-shadow: var(--shadow-lg); padding: var(--space-8);
    overflow: auto; z-index: 11; outline: none;
    display: flex; flex-direction: column; gap: var(--space-7);
  }
  .head { display: flex; align-items: center; gap: var(--space-3); margin-bottom: 0; }
  .head h2 { font-size: var(--fs-lg); font-weight: 700; margin: 0; flex: 1; }
  .close {
    width: 28px; height: 28px; border-radius: var(--radius-sm);
    background: var(--surface-2); color: var(--text-muted);
    display: inline-flex; align-items: center; justify-content: center;
  }
  .close:hover { background: var(--surface); }
  section { display: flex; flex-direction: column; gap: var(--space-3); }
  .stack { display: flex; flex-direction: column; gap: var(--space-1); }
  .row3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: var(--space-2); }
  .icon-pick {
    display: flex; align-items: center; gap: var(--space-4);
    padding: var(--space-3); border: 1px dashed var(--border-strong); border-radius: var(--radius-lg);
  }
  .preview {
    width: 48px; height: 48px; border-radius: var(--radius);
    background: var(--surface-2); overflow: hidden;
    display: inline-flex; align-items: center; justify-content: center;
  }
  .preview img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
  .pick { font-size: var(--fs-xs); font-weight: 600; color: var(--primary); cursor: pointer; }
  .link { font-size: var(--fs-xs); color: var(--text-muted); text-decoration: underline; }
  .err { font-size: var(--fs-xs); color: var(--danger); }

  @media (max-width: 899px) {
    .drawer { width: 100%; padding: var(--space-6); }
  }
</style>
