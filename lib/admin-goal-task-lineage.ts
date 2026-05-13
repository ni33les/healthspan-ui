export type RetryLineageTask = Readonly<{
  createdAt: string;
  id: string;
  retryAttempt: number;
  retryOfTaskId: string | null;
  retryRootTaskId: string | null;
}>;

export type RetryLineageGroup<T extends RetryLineageTask> = Readonly<{
  hasRetryLineage: boolean;
  key: string;
  tasks: T[];
}>;

function retryLineageKey(task: RetryLineageTask) {
  return task.retryRootTaskId ?? task.retryOfTaskId ?? task.id;
}

export function groupRetryLineages<T extends RetryLineageTask>(
  tasks: readonly T[]
): Array<RetryLineageGroup<T>> {
  const groups = new Map<
    string,
    {
      firstIndex: number;
      tasks: T[];
    }
  >();

  tasks.forEach((task, index) => {
    const key = retryLineageKey(task);
    const group = groups.get(key);

    if (group) {
      group.tasks.push(task);
    } else {
      groups.set(key, {
        firstIndex: index,
        tasks: [task]
      });
    }
  });

  return Array.from(groups.entries())
    .sort((left, right) => left[1].firstIndex - right[1].firstIndex)
    .map(([key, group]) => ({
      hasRetryLineage:
        group.tasks.length > 1 || group.tasks.some((task) => task.retryAttempt > 0),
      key,
      tasks: [...group.tasks].sort((left, right) => {
        const attemptDelta = left.retryAttempt - right.retryAttempt;

        if (attemptDelta !== 0) {
          return attemptDelta;
        }

        return (
          new Date(left.createdAt).getTime() -
          new Date(right.createdAt).getTime()
        );
      })
    }));
}
