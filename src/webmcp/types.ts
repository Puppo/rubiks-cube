import type { DifficultyLevel, MoveNotation } from '../core/types';
import type { WebMcpBridge } from './WebMcpBridge';

export interface WebMcpJsonSchema {
  type: 'object';
  properties: Record<
    string,
    {
      type: string;
      description: string;
      enum?: string[];
      minimum?: number;
      maximum?: number;
      default?: unknown;
    }
  >;
  required?: string[];
}

export interface WebMcpToolContent {
  type: 'text';
  text: string;
}

export interface WebMcpToolResult<T = Record<string, unknown>> {
  content: WebMcpToolContent[];
  structuredContent: T;
  isError?: boolean;
}

export interface WebMcpToolDefinition<
  TArgs = Record<string, unknown>,
  TResult = Record<string, unknown>,
> {
  name: string;
  description: string;
  inputSchema: WebMcpJsonSchema;
  execute: (args: TArgs) => Promise<WebMcpToolResult<TResult>> | WebMcpToolResult<TResult>;
}

export interface WebMcpRegisterOptions {
  signal?: AbortSignal;
}

export interface WebMcpLogEntry {
  id: string;
  timestamp: string;
  toolName: string;
  args: Record<string, unknown>;
  result: WebMcpToolResult<any>;
  durationMs: number;
}

export interface ModelContextInterface {
  registerTool: (
    tool: WebMcpToolDefinition<any, any>,
    options?: WebMcpRegisterOptions
  ) => Promise<void> | void;
  unregisterTool: (name: string) => Promise<void> | void;
  provideContext: (context: { tools: WebMcpToolDefinition<any, any>[] }) => () => void;
  clearContext: () => void;
  listTools: () => Omit<WebMcpToolDefinition<any, any>, 'execute'>[];
  callTool: (name: string, args?: Record<string, unknown>) => Promise<WebMcpToolResult<any>>;
}

export type WebMcpActionHooks = {
  onMove: (notation: MoveNotation) => Promise<void> | void;
  onAlgorithm: (notations: MoveNotation[]) => Promise<void> | void;
  onScramble: (options?: {
    difficulty?: DifficultyLevel;
    customLength?: number;
  }) => Promise<MoveNotation[]> | MoveNotation[];
  onReset: () => Promise<void> | void;
  onUndo: () => Promise<MoveNotation | null> | MoveNotation | null;
  onRedo: () => Promise<MoveNotation | null> | MoveNotation | null;
  onSetDifficulty: (difficulty: DifficultyLevel) => void;
};

declare global {
  interface Navigator {
    modelContext?: ModelContextInterface;
  }
  interface Window {
    rubiksWebMCP?: WebMcpBridge;
  }
}
