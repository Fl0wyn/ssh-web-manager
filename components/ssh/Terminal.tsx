"use client";

import { useEffect, useRef } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import type { ClientMessage, ServerMessage } from "@/types/ssh";
import "@xterm/xterm/css/xterm.css";

export type ConnectionStatus = "connecting" | "connected" | "disconnected" | "error";

interface TerminalProps {
  hostAlias: string;
  active: boolean;
  onStatusChange: (status: ConnectionStatus, errorMessage?: string) => void;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4101";

export function Terminal({ hostAlias, active, onStatusChange }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const promptModeRef = useRef<{ echo: boolean; buffer: string } | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new XTerm({
      cursorBlink: true,
      convertEol: true,
      fontSize: 14,
      theme: { background: "#0a0a0a" },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);

    termRef.current = term;
    fitRef.current = fitAddon;

    let cancelled = false;

    const rafId = requestAnimationFrame(() => {
      if (cancelled) return;
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        fitAddon.fit();
      }
    });
    let hadFatalError = false;
    let lastErrorMessage: string | undefined;

    onStatusChangeRef.current("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    function sendMessage(message: ClientMessage) {
      if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify(message));
      }
    }

    ws.addEventListener("open", () => {
      sendMessage({
        type: "connect",
        host: hostAlias,
        cols: term.cols,
        rows: term.rows,
      });
    });

    ws.addEventListener("error", () => {
      if (cancelled) return;
      hadFatalError = true;
      lastErrorMessage = "Erreur de connexion au serveur WebSocket.";
      onStatusChangeRef.current("error", lastErrorMessage);
    });

    ws.addEventListener("message", (event) => {
      if (cancelled) return;
      const message: ServerMessage = JSON.parse(event.data);
      switch (message.type) {
        case "ready":
          onStatusChangeRef.current("connected");
          break;
        case "data":
          term.write(message.data);
          break;
        case "keyboard-interactive-prompt": {
          const first = message.prompts[0];
          if (message.instructions) term.write(`\r\n${message.instructions}\r\n`);
          term.write(`\r\n${first?.prompt ?? ""}`);
          promptModeRef.current = { echo: first?.echo ?? true, buffer: "" };
          break;
        }
        case "error":
          term.write(`\r\n\x1b[31m${message.message}\x1b[0m\r\n`);
          lastErrorMessage = message.message;
          if (message.fatal) {
            hadFatalError = true;
            onStatusChangeRef.current("error", lastErrorMessage);
          }
          break;
        case "closed":
          term.write("\r\n\x1b[90mConnexion fermee.\x1b[0m\r\n");
          onStatusChangeRef.current(
            hadFatalError ? "error" : "disconnected",
            hadFatalError ? lastErrorMessage : undefined
          );
          break;
      }
    });

    const onData = term.onData((data) => {
      const promptMode = promptModeRef.current;
      if (promptMode) {
        if (data === "\r") {
          term.write("\r\n");
          promptModeRef.current = null;
          sendMessage({
            type: "keyboard-interactive-response",
            responses: [promptMode.buffer],
          });
        } else if (data === "") {
          if (promptMode.buffer.length > 0) {
            promptMode.buffer = promptMode.buffer.slice(0, -1);
            term.write("\b \b");
          }
        } else {
          promptMode.buffer += data;
          term.write(promptMode.echo ? data : "*");
        }
        return;
      }
      sendMessage({ type: "data", data });
    });

    const resizeObserver = new ResizeObserver(() => {
      if (cancelled || container.clientWidth === 0 || container.clientHeight === 0) return;
      fitAddon.fit();
      sendMessage({ type: "resize", cols: term.cols, rows: term.rows });
    });
    resizeObserver.observe(container);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      resizeObserver.disconnect();
      onData.dispose();
      ws.close();
      term.dispose();
    };
  }, [hostAlias]);

  useEffect(() => {
    if (!active) return;
    const rafId = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        fitRef.current?.fit();
        termRef.current?.focus();
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [active]);

  return (
    <div
      className={active ? "block h-full w-full" : "hidden h-full w-full"}
      ref={containerRef}
    />
  );
}
