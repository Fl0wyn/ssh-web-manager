import type { WebSocket } from "ws";
import { createSshSession, type SshSession } from "@/lib/ssh-session-manager";
import type { ClientMessage, ServerMessage } from "@/types/ssh";

function send(ws: WebSocket, message: ServerMessage) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

export function attachSshBridge(ws: WebSocket) {
  let session: SshSession | null = null;

  ws.on("message", (raw) => {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return;
    }

    switch (message.type) {
      case "connect": {
        if (session) return;
        session = createSshSession(message.host, message.cols, message.rows, {
          onReady: () => send(ws, { type: "ready" }),
          onData: (data) => send(ws, { type: "data", data }),
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
      case "data":
        session?.write(message.data);
        break;
      case "resize":
        session?.resize(message.cols, message.rows);
        break;
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
  });
}
