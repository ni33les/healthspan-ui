const globalTaskWakeup = globalThis as typeof globalThis & {
  mattanutraTaskWakeupWaiters?: Set<() => void>;
};

function taskWakeupWaiters() {
  globalTaskWakeup.mattanutraTaskWakeupWaiters ??= new Set();

  return globalTaskWakeup.mattanutraTaskWakeupWaiters;
}

export function notifyTaskQueueChanged() {
  const waiters = taskWakeupWaiters();

  for (const waiter of waiters) {
    waiter();
  }

  waiters.clear();
}

export function waitForTaskQueueChange(timeoutMs: number) {
  if (timeoutMs <= 0) {
    return Promise.resolve(false);
  }

  return new Promise<boolean>((resolve) => {
    const waiters = taskWakeupWaiters();
    const complete = (changed: boolean) => {
      clearTimeout(timeout);
      waiters.delete(onWakeup);
      resolve(changed);
    };
    const onWakeup = () => complete(true);
    const timeout = setTimeout(() => complete(false), timeoutMs);

    waiters.add(onWakeup);
  });
}
