// Tiny Server-Sent Events helper for Next.js Route Handlers.
//
// Usage:
//   const { stream, send, close, response } = createSSEStream();
//   (async () => {
//     try {
//       send("stage", { key: "fetch", label: "Fetching…" });
//       // …
//       send("done", { id: "abc" });
//     } catch (err) {
//       send("error", { message: String(err) });
//     } finally {
//       close();
//     }
//   })();
//   return response;
//
// The `send()` JSON-encodes the data so the client can `JSON.parse(evt.data)`.
// Events use distinct names ("stage" / "done" / "error") so the consumer
// can match on `evt.type` rather than poking inside the payload.

export interface SSEStream {
  stream: ReadableStream<Uint8Array>;
  /** Emit a named event with a JSON-serialisable payload. */
  send: (event: string, data: unknown) => void;
  /** Close the stream. Safe to call multiple times. */
  close: () => void;
  /** Pre-built Response with the right headers — return it from the route. */
  response: Response;
}

export function createSSEStream(): SSEStream {
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
    cancel() { controller = null; },
  });

  const send = (event: string, data: unknown) => {
    if (!controller) return;
    const payload = JSON.stringify(data);
    const chunk = `event: ${event}\ndata: ${payload}\n\n`;
    try {
      controller.enqueue(encoder.encode(chunk));
    } catch {
      // Client disconnected — drop the controller so subsequent
      // sends are silent no-ops.
      controller = null;
    }
  };

  const close = () => {
    if (!controller) return;
    try { controller.close(); } catch { /* already closed */ }
    controller = null;
  };

  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      // Disable buffering on Vercel + most reverse proxies so the
      // user actually sees progress chunks as they happen.
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });

  return { stream, send, close, response };
}

// Client-side helper — consumes a fetch Response body as SSE events.
// Returns an async iterator of { event, data } objects.
//
//   const res = await fetch("/api/import/url", { method: "POST", body: ... });
//   for await (const evt of readSSE(res)) {
//     if (evt.event === "stage") { /* update UI */ }
//     if (evt.event === "done")  { /* navigate */ }
//   }
export async function* readSSE(res: Response): AsyncGenerator<{ event: string; data: unknown }> {
  if (!res.body) throw new Error("Response has no body");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE events are delimited by a blank line. Parse out whole
    // events; leave the trailing partial in the buffer for the next
    // chunk to complete.
    let sepIdx;
    while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const raw = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      let event = "message";
      const dataLines: string[] = [];
      for (const line of raw.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      if (dataLines.length === 0) continue;
      let data: unknown;
      try {
        data = JSON.parse(dataLines.join("\n"));
      } catch {
        data = dataLines.join("\n");
      }
      yield { event, data };
    }
  }
}
