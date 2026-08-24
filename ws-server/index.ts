import http from "http";
import { WebSocketServer } from "ws";
import { attachSshBridge } from "./ssh-bridge";
import { attachSftpBridge } from "./sftp-bridge";
import { validateSessionToken } from "@/lib/auth";

const PORT = Number(process.env.WS_PORT ?? 4101);

const server = http.createServer();
const wss = new WebSocketServer({ server });

wss.on("connection", (ws, req) => {
  const url = new URL(req.url ?? "", "http://internal");
  const path = url.pathname;
  const token = url.searchParams.get("token");

  const user = validateSessionToken(token);
  if (!user) {
    console.log(`[ws-server] rejected unauthenticated connection (${path})`);
    ws.close(4401, "Unauthorized");
    return;
  }

  console.log(`[ws-server] client connected (${path}) as ${user.username}`);

  if (path === "/sftp") {
    attachSftpBridge(ws);
  } else {
    attachSshBridge(ws);
  }

  ws.on("close", () => console.log("[ws-server] client disconnected"));
});

server.listen(PORT, () => {
  console.log(`[ws-server] listening on ws://localhost:${PORT}`);
});
