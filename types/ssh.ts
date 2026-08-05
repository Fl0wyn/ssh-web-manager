export interface HostEntry {
  name: string;
  description: string;
}

export interface ResolvedHost {
  name: string;
  hostname: string;
  user?: string;
  port: number;
  identityFiles: string[];
  proxyJump?: string;
}

export interface KeyboardInteractivePrompt {
  prompt: string;
  echo: boolean;
}

export type ClientMessage =
  | { type: "connect"; host: string; cols: number; rows: number }
  | { type: "data"; data: string }
  | { type: "resize"; cols: number; rows: number }
  | { type: "keyboard-interactive-response"; responses: string[] }
  | { type: "disconnect" };

export type ServerMessage =
  | { type: "ready" }
  | { type: "data"; data: string }
  | {
      type: "keyboard-interactive-prompt";
      name: string;
      instructions: string;
      prompts: KeyboardInteractivePrompt[];
    }
  | { type: "error"; message: string; fatal: boolean }
  | { type: "closed" };
