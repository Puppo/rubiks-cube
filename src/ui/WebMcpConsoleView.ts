import type { WebMcpBridge, WebMcpLogEntry } from '../webmcp/WebMcpBridge';

const DEFAULT_TOOL_EXAMPLES: Record<string, string> = {
  get_cube_state: '{}',
  rotate_face: '{"move":"R"}',
  execute_algorithm: '{"algorithm":"R U R\' U\'"}',
  scramble_cube: '{"difficulty":"easy"}',
  set_difficulty: '{"difficulty":"hard"}',
  get_hint: '{}',
  solve_cube: '{"execute":true}',
  undo_move: '{}',
  redo_move: '{}',
  reset_cube: '{}',
};

export function initWebMcpConsoleUI(
  root: HTMLElement,
  webmcp: WebMcpBridge,
  onError: (msg: string) => void
): void {
  const toolSelect = root.querySelector<HTMLSelectElement>('#webmcp-tool-select');
  const argsInput = root.querySelector<HTMLInputElement>('#webmcp-args-input');

  if (toolSelect) {
    const tools = webmcp.listTools();
    toolSelect.innerHTML = tools
      .map((t) => `<option value="${t.name}">${t.name}</option>`)
      .join('');
    toolSelect.value = 'rotate_face';

    toolSelect.addEventListener('change', () => {
      if (argsInput) {
        argsInput.value = DEFAULT_TOOL_EXAMPLES[toolSelect.value] ?? '{}';
      }
    });
  }

  root.querySelector('#btn-webmcp-invoke')?.addEventListener('click', async () => {
    if (!toolSelect || !argsInput) return;
    try {
      const parsedArgs = JSON.parse(argsInput.value || '{}');
      await webmcp.callTool(toolSelect.value, parsedArgs);
    } catch (err) {
      onError(`Invalid JSON arguments: ${err instanceof Error ? err.message : String(err)}`);
    }
  });
}

export function renderWebMcpLogs(root: HTMLElement, logs: WebMcpLogEntry[]): void {
  const logList = root.querySelector<HTMLElement>('#webmcp-log-list');
  if (!logList) return;

  if (logs.length === 0) {
    logList.innerHTML = `<div class="webmcp-empty">No WebMCP tool calls recorded yet.</div>`;
    return;
  }

  logList.innerHTML = logs
    .slice(0, 8)
    .map(
      (entry) => `
      <div class="webmcp-log-item ${entry.result.isError ? 'log-error' : 'log-ok'}">
        <div class="log-top">
          <strong>${entry.toolName}</strong>
          <span>${entry.durationMs}ms</span>
        </div>
        <div class="log-args">Args: <code>${JSON.stringify(entry.args)}</code></div>
        <div class="log-summary">${entry.result.structuredContent?.summary ?? entry.result.content[0]?.text ?? ''}</div>
      </div>
    `
    )
    .join('');
}
