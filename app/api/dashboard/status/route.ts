import { listHosts } from "@/lib/ssh-config";
import { fetchHostStatus } from "@/lib/ssh-exec";

export async function GET() {
  const hosts = listHosts();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      await Promise.all(
        hosts.map(async (host) => {
          const result = await fetchHostStatus(host.name);
          send(result);
        })
      );

      send({ done: true });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
