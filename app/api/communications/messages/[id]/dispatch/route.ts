import {
  openClawJson,
  taskApiError
} from "@/lib/openclaw-api";
import { adminClawRequestAllowed } from "@/lib/admin-auth";
import { dispatchCommunicationMessage } from "@/lib/communications";
import { workerRequestAllowed, workerUnauthorized } from "@/lib/worker-auth";

export const runtime = "nodejs";

type DispatchRouteProps = Readonly<{
  params: Promise<{
    id: string;
  }>;
}>;

export async function POST(request: Request, { params }: DispatchRouteProps) {
  if (!adminClawRequestAllowed(request) && !workerRequestAllowed(request)) {
    return workerUnauthorized();
  }

  const { id } = await params;

  try {
    const result = await dispatchCommunicationMessage(id);

    return openClawJson(
      { dispatch: result },
      { status: result.configured ? 200 : 202 }
    );
  } catch (error) {
    return taskApiError(error, "Unable to dispatch communication message");
  }
}
