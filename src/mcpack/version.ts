// Generates a tiny .mcfunction that prints the addon's build sha and
// generation date to the player who runs it. Always present in every
// export regardless of dev mode, so users can verify which build is loaded
// in-game with a single `/function <ns>/version` command.

export function buildVersionMcfunction(opts: { buildSha: string; buildDate: string }): string {
  const sha = opts.buildSha || 'unknown';
  const date = opts.buildDate || 'unknown';
  return [
    `# paintings-addon version info`,
    `# build: ${sha}`,
    `# generated: ${date}`,
    `tellraw @s {"rawtext":[{"text":"[paintings] build ${sha}"}]}`,
    `tellraw @s {"rawtext":[{"text":"[paintings] generated ${date}"}]}`,
    '',
  ].join('\n');
}

export function versionMcfunctionPath(namespace: string): string {
  return `BP_${namespace}/functions/${namespace}/version.mcfunction`;
}

export function versionFunctionCommand(namespace: string): string {
  return `/function ${namespace}/version`;
}
