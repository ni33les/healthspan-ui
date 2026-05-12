import { NextResponse } from "next/server";
import { requireOpenClawRequest } from "@/lib/openclaw-api";
import { kickCronWorker, kickTaskWorker } from "@/lib/task-worker";

export const runtime = "nodejs";

async function runDueWork(request: Request) {
  const unauthorized = requireOpenClawRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const baseUrl = new URL(request.url).origin;
    const result = await kickCronWorker();
    void kickTaskWorker({ baseUrl });

    return NextResponse.json(
      {
        ...(result ?? { queued: 0 }),
        taskWorker: {
          kicked: true
        }
      },
      {
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    console.error("Unable to run scheduled workers", error);

    return NextResponse.json(
      { message: "Unable to run scheduled actions" },
      {
        headers: {
          "Cache-Control": "no-store"
        },
        status: 500
      }
    );
  }
}

export async function GET(request: Request) {
  return runDueWork(request);
}

export async function POST(request: Request) {
  return runDueWork(request);
}
