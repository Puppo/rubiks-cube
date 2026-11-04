import type { ModelContextInterface, WebMcpToolDefinition, WebMcpToolResult } from './types';

export function installModelContextShim(
  toolsMap: Map<string, WebMcpToolDefinition<any, any>>,
  listTools: () => Omit<WebMcpToolDefinition<any, any>, 'execute'>[],
  callTool: (name: string, args?: Record<string, unknown>) => Promise<WebMcpToolResult<any>>
): void {
  if (typeof navigator === 'undefined') return;

  const nativeCtx = navigator.modelContext;
  const nativeRegister = nativeCtx?.registerTool?.bind(nativeCtx);
  const nativeUnregister = nativeCtx?.unregisterTool?.bind(nativeCtx);
  const nativeProvide = nativeCtx?.provideContext?.bind(nativeCtx);
  const nativeClear = nativeCtx?.clearContext?.bind(nativeCtx);

  const modelContextShim: ModelContextInterface = {
    registerTool: async (tool, options) => {
      toolsMap.set(tool.name, tool);
      if (options?.signal) {
        options.signal.addEventListener(
          'abort',
          () => {
            toolsMap.delete(tool.name);
          },
          { once: true }
        );
      }
      if (nativeRegister) {
        try {
          await nativeRegister(tool, options);
        } catch {
          // Ignore native errors in non-HTTPS or partial test environments
        }
      }
    },
    unregisterTool: async (name: string) => {
      toolsMap.delete(name);
      if (nativeUnregister) {
        try {
          await nativeUnregister(name);
        } catch {
          // Ignore
        }
      }
    },
    provideContext: (context) => {
      toolsMap.clear();
      for (const tool of context.tools) {
        toolsMap.set(tool.name, tool);
      }
      let nativeCleanup: (() => void) | undefined;
      if (nativeProvide) {
        try {
          nativeCleanup = nativeProvide(context);
        } catch {
          // Ignore
        }
      }
      return () => {
        toolsMap.clear();
        nativeCleanup?.();
      };
    },
    clearContext: () => {
      toolsMap.clear();
      if (nativeClear) {
        try {
          nativeClear();
        } catch {
          // Ignore
        }
      }
    },
    listTools: () => listTools(),
    callTool: (name, args = {}) => callTool(name, args),
  };

  try {
    Object.defineProperty(navigator, 'modelContext', {
      value: modelContextShim,
      configurable: true,
      writable: true,
    });
  } catch {
    (navigator as any).modelContext = modelContextShim;
  }
}
