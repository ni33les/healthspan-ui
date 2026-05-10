import {
  openClawJson,
  requireOpenClawRequest,
  taskApiError
} from "@/lib/openclaw-api";
import { listGoalTasks } from "@/lib/task-service";

export const runtime = "nodejs";

type GoalTasksRouteProps = Readonly<{
  params: Promise<{
    goalId: string;
  }>;
}>;

export async function GET(request: Request, { params }: GoalTasksRouteProps) {
  const unauthorized = requireOpenClawRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const { goalId } = await params;

  try {
    return openClawJson(await listGoalTasks({ goalId }));
  } catch (error) {
    return taskApiError(error, "Unable to load goal tasks");
  }
}
