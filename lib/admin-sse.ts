const encoder = new TextEncoder();

const DEFAULT_SNAPSHOT_INTERVAL_MS = 10_000;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 15_000;

function sseEvent(name: string, data: unknown) {
  return encoder.encode(`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function streamAdminSnapshots<T>({
  eventName,
  heartbeatIntervalMs = DEFAULT_HEARTBEAT_INTERVAL_MS,
  load,
  request,
  snapshotIntervalMs = DEFAULT_SNAPSHOT_INTERVAL_MS,
  waitForSnapshotSignal
}: Readonly<{
  eventName: string;
  heartbeatIntervalMs?: number;
  load: () => Promise<T>;
  request: Request;
  snapshotIntervalMs?: number;
  waitForSnapshotSignal?: (timeoutMs: number) => Promise<boolean>;
}>) {
  let closed = false;
  let streaming = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;

  function stop() {
    closed = true;
    clearInterval(heartbeat);
  }

  function waitForNextSnapshot() {
    if (waitForSnapshotSignal) {
      return waitForSnapshotSignal(snapshotIntervalMs);
    }

    return new Promise<boolean>((resolve) => {
      setTimeout(() => resolve(false), snapshotIntervalMs);
    });
  }

  const stream = new ReadableStream<Uint8Array>({
    cancel() {
      stop();
    },
    start(controller) {
      async function sendSnapshot() {
        if (closed || streaming) {
          return;
        }

        streaming = true;

        try {
          const data = await load();

          if (!closed) {
            controller.enqueue(sseEvent(eventName, data));
          }
        } catch (error) {
          if (!closed) {
            controller.enqueue(
              sseEvent("error", {
                message:
                  error instanceof Error
                    ? error.message
                    : "Unable to stream admin data"
              })
            );
          }
        } finally {
          streaming = false;
        }
      }

      function sendHeartbeat() {
        if (!closed) {
          controller.enqueue(
            sseEvent("pong", {
              at: new Date().toISOString()
            })
          );
        }
      }

      void sendSnapshot();
      sendHeartbeat();

      void (async function streamSnapshots() {
        while (!closed) {
          try {
            await waitForNextSnapshot();
          } catch {
            await new Promise((resolve) => setTimeout(resolve, snapshotIntervalMs));
          }

          await sendSnapshot();
        }
      })();

      heartbeat = setInterval(() => {
        sendHeartbeat();
      }, heartbeatIntervalMs);

      request.signal.addEventListener("abort", () => {
        stop();

        try {
          controller.close();
        } catch {
          // The client may have already closed the stream.
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream"
    }
  });
}
