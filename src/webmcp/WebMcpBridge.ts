import type { CubeEngine } from '../core/CubeEngine';
import { buildCubeToolDefinitions } from './cubeTools';
import { installModelContextShim } from './modelContextShim';
import type {
  ModelContextInterface,
  WebMcpActionHooks,
  WebMcpJsonSchema,
  WebMcpLogEntry,
  WebMcpRegisterOptions,
  WebMcpToolContent,
  WebMcpToolDefinition,
  WebMcpToolResult,
} from './types';

export type {
  ModelContextInterface,
  WebMcpActionHooks,
  WebMcpJsonSchema,
  WebMcpLogEntry,
  WebMcpRegisterOptions,
  WebMcpToolContent,
  WebMcpToolDefinition,
  WebMcpToolResult,
};

export class WebMcpBridge {
  private readonly engine: CubeEngine;
  private readonly hooks: WebMcpActionHooks;
  private readonly tools = new Map<string, WebMcpToolDefinition<any, any>>();
  private readonly abortController = new AbortController();
  private readonly logs: WebMcpLogEntry[] = [];
  private readonly logListeners = new Set<(logs: WebMcpLogEntry[]) => void>();

  constructor(engine: CubeEngine, hooks?: Partial<WebMcpActionHooks>) {
    this.engine = engine;
    this.hooks = {
      onMove:
        hooks?.onMove ??
        ((notation) => {
          this.engine.move(notation);
        }),
      onAlgorithm:
        hooks?.onAlgorithm ??
        ((notations) => {
          this.engine.applyAlgorithm(notations);
        }),
      onScramble: hooks?.onScramble ?? ((opts) => this.engine.scramble(opts)),
      onReset:
        hooks?.onReset ??
        (() => {
          this.engine.reset();
        }),
      onUndo: hooks?.onUndo ?? (() => this.engine.undo()?.notation ?? null),
      onRedo: hooks?.onRedo ?? (() => this.engine.redo()?.notation ?? null),
      onSetDifficulty:
        hooks?.onSetDifficulty ??
        ((diff) => {
          this.engine.setDifficulty(diff);
        }),
    };

    installModelContextShim(
      this.tools,
      () => this.listTools(),
      (name, args) => this.callTool(name, args)
    );
    this.registerAllCubeTools();

    if (typeof window !== 'undefined') {
      window.rubiksWebMCP = this;
    }
  }

  private createStatePayload(summaryMessage: string): WebMcpToolResult<Record<string, unknown>> {
    const state = this.engine.getState();
    const asciiDiagram = this.engine.toAsciiDiagram();
    const structured = {
      summary: summaryMessage,
      isSolved: state.isSolved,
      difficulty: state.difficulty,
      moveCount: state.moveCount,
      elapsedMs: state.elapsedMs,
      faceletString: state.faceletString,
      faces: state.faces,
      asciiDiagram,
      moveHistory: state.moveHistory,
      scrambleSequence: state.scrambleSequence,
    };

    return {
      content: [
        {
          type: 'text',
          text: `${summaryMessage}\nSolved: ${state.isSolved} | Moves: ${state.moveCount} | Difficulty: ${state.difficulty}\nFacelets: ${state.faceletString}\n\n${asciiDiagram}`,
        },
      ],
      structuredContent: structured,
    };
  }

  private registerAllCubeTools(): void {
    const toolDefs = buildCubeToolDefinitions(this.engine, this.hooks, (summary) =>
      this.createStatePayload(summary)
    );

    for (const tool of toolDefs) {
      if (typeof navigator !== 'undefined' && navigator.modelContext) {
        navigator.modelContext.registerTool(tool, {
          signal: this.abortController.signal,
        });
      } else {
        this.tools.set(tool.name, tool);
      }
    }
  }

  public listTools(): Omit<WebMcpToolDefinition<any, any>, 'execute'>[] {
    return Array.from(this.tools.values()).map(({ name, description, inputSchema }) => ({
      name,
      description,
      inputSchema,
    }));
  }

  public async callTool(
    name: string,
    args: Record<string, unknown> = {}
  ): Promise<WebMcpToolResult<any>> {
    const tool = this.tools.get(name);
    const startMs = performance.now();

    if (!tool) {
      const errorResult: WebMcpToolResult = {
        isError: true,
        content: [{ type: 'text', text: `Unknown WebMCP tool: "${name}"` }],
        structuredContent: { error: `Unknown WebMCP tool: "${name}"` },
      };
      this.recordLog(name, args, errorResult, performance.now() - startMs);
      return errorResult;
    }

    try {
      const result = await tool.execute(args);
      this.recordLog(name, args, result, performance.now() - startMs);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const errorResult: WebMcpToolResult = {
        isError: true,
        content: [{ type: 'text', text: `Error executing ${name}: ${message}` }],
        structuredContent: { error: message },
      };
      this.recordLog(name, args, errorResult, performance.now() - startMs);
      return errorResult;
    }
  }

  private recordLog(
    toolName: string,
    args: Record<string, unknown>,
    result: WebMcpToolResult<any>,
    durationMs: number
  ): void {
    const entry: WebMcpLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      toolName,
      args,
      result,
      durationMs: Math.round(durationMs * 100) / 100,
    };
    this.logs.unshift(entry);
    if (this.logs.length > 50) {
      this.logs.pop();
    }
    for (const listener of this.logListeners) {
      listener([...this.logs]);
    }
  }

  public getLogs(): WebMcpLogEntry[] {
    return [...this.logs];
  }

  public onLogsChange(listener: (logs: WebMcpLogEntry[]) => void): () => void {
    this.logListeners.add(listener);
    return () => {
      this.logListeners.delete(listener);
    };
  }

  public dispose(): void {
    this.abortController.abort();
    this.tools.clear();
  }
}
