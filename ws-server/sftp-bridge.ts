import type { WebSocket, RawData } from "ws";
import { createSftpSession, type SftpSession, type TransferHandle } from "@/lib/sftp-session-manager";
import { listLocalDir, defaultLocalHome } from "@/lib/local-fs";
import type { SftpClientMessage, SftpServerMessage } from "@/types/sftp";

function send(ws: WebSocket, message: SftpServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function attachSftpBridge(ws: WebSocket) {
  let session: SftpSession | null = null;
  const transfers = new Map<string, TransferHandle>();

  ws.on("message", (raw: RawData) => {
    let message: SftpClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (message.type) {
      case "connect": {
        if (session) return;
        session = createSftpSession(message.host, {
          onReady: (homePath) =>
            send(ws, { type: "ready", homePath, localHomePath: defaultLocalHome() }),
          onKeyboardInteractive: (name, instructions, prompts) =>
            send(ws, {
              type: "keyboard-interactive-prompt",
              name,
              instructions,
              prompts,
            }),
          onError: (msg, fatal) => send(ws, { type: "error", message: msg, fatal }),
          onClosed: () => send(ws, { type: "closed" }),
        });
        break;
      }
      case "list": {
        session
          ?.list(message.path)
          .then((entries) =>
            send(ws, { type: "list-result", requestId: message.requestId, entries })
          )
          .catch((err: Error) =>
            send(ws, {
              type: "list-error",
              requestId: message.requestId,
              message: err.message,
            })
          );
        break;
      }
      case "local-list": {
        listLocalDir(message.path)
          .then((entries) =>
            send(ws, { type: "local-list-result", requestId: message.requestId, entries })
          )
          .catch((err: Error) =>
            send(ws, {
              type: "local-list-error",
              requestId: message.requestId,
              message: err.message,
            })
          );
        break;
      }
      case "transfer-start": {
        if (!session) return;
        const { transferId, direction, localPath, remotePath } = message;
        const handle =
          direction === "upload"
            ? session.pipeUpload(
                localPath,
                remotePath,
                (bytesWritten, totalSize) =>
                  send(ws, { type: "upload-progress", transferId, bytesWritten, totalSize }),
                (error) => {
                  transfers.delete(transferId);
                  if (error) {
                    send(ws, { type: "upload-error", transferId, message: error });
                  } else {
                    send(ws, { type: "upload-complete", transferId });
                  }
                }
              )
            : session.pipeDownload(
                remotePath,
                localPath,
                (bytesRead, totalSize) =>
                  send(ws, { type: "download-progress", transferId, bytesRead, totalSize }),
                (error) => {
                  transfers.delete(transferId);
                  if (error) {
                    send(ws, { type: "download-error", transferId, message: error });
                  } else {
                    send(ws, { type: "download-complete", transferId });
                  }
                }
              );
        transfers.set(transferId, handle);
        break;
      }
      case "cancel-transfer": {
        transfers.get(message.transferId)?.cancel();
        transfers.delete(message.transferId);
        break;
      }
      case "keyboard-interactive-response":
        session?.respondPrompt(message.responses);
        break;
      case "disconnect":
        session?.close();
        session = null;
        break;
    }
  });

  ws.on("close", () => {
    session?.close();
    session = null;
    transfers.clear();
  });
}
