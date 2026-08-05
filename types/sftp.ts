import type { KeyboardInteractivePrompt } from "@/types/ssh";

export interface SftpEntry {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink";
  size: number;
  mtime: number;
  permissions: string;
}

export interface LocalFsEntry {
  name: string;
  type: "file" | "dir" | "symlink";
  size: number;
  mtime: number;
}

export type TransferDirection = "upload" | "download";

export type SftpClientMessage =
  | { type: "connect"; host: string }
  | { type: "list"; requestId: string; path: string }
  | { type: "local-list"; requestId: string; path: string }
  | {
      type: "transfer-start";
      transferId: string;
      direction: TransferDirection;
      localPath: string;
      remotePath: string;
    }
  | { type: "cancel-transfer"; transferId: string }
  | { type: "keyboard-interactive-response"; responses: string[] }
  | { type: "disconnect" };

export type SftpServerMessage =
  | { type: "ready"; homePath: string; localHomePath: string }
  | { type: "list-result"; requestId: string; entries: SftpEntry[] }
  | { type: "list-error"; requestId: string; message: string }
  | { type: "local-list-result"; requestId: string; entries: LocalFsEntry[] }
  | { type: "local-list-error"; requestId: string; message: string }
  | { type: "upload-progress"; transferId: string; bytesWritten: number; totalSize: number }
  | { type: "upload-complete"; transferId: string }
  | { type: "upload-error"; transferId: string; message: string }
  | {
      type: "download-progress";
      transferId: string;
      bytesRead: number;
      totalSize: number;
    }
  | { type: "download-complete"; transferId: string }
  | { type: "download-error"; transferId: string; message: string }
  | {
      type: "keyboard-interactive-prompt";
      name: string;
      instructions: string;
      prompts: KeyboardInteractivePrompt[];
    }
  | { type: "error"; message: string; fatal: boolean }
  | { type: "closed" };
