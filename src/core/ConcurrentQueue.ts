/**
 * 并发控制队列
 *
 * 限制同时执行的任务数量，支持暂停 / 恢复 / 清空。
 */

type TaskExecutor<T> = () => Promise<T>;

interface QueueItem<T> {
  executor: TaskExecutor<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

export class ConcurrentQueue {
  private concurrency: number;
  private queue: QueueItem<unknown>[] = [];
  private activeCount = 0;
  private paused = false;

  constructor(concurrency: number) {
    this.concurrency = Math.max(1, concurrency);
  }

  /**
   * 添加任务到队列并执行（受并发数限制）
   */
  add<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        executor: task as TaskExecutor<unknown>,
        resolve: resolve as (value: unknown) => void,
        reject,
      });
      this.processQueue();
    });
  }

  /**
   * 暂停队列，待执行任务不再被调度
   */
  pause(): void {
    this.paused = true;
  }

  /**
   * 恢复队列，继续调度待执行任务
   */
  resume(): void {
    this.paused = false;
    while (this.activeCount < this.concurrency && this.queue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * 清空待执行任务队列（不影响正在执行的任务）
   */
  clear(): void {
    this.queue = [];
  }

  /** 等待执行的任务数 */
  get pending(): number {
    return this.queue.length;
  }

  /** 正在执行的任务数 */
  get active(): number {
    return this.activeCount;
  }

  private processQueue(): void {
    if (this.activeCount >= this.concurrency) {
      return;
    }

    const item = this.queue.shift();
    if (!item) return;

    this.activeCount++;

    item
      .executor()
      .then((result) => {
        this.activeCount--;
        this.processQueue();
        item.resolve(result);
      })
      .catch((error) => {
        this.activeCount--;
        this.processQueue();
        item.reject(error);
      });
  }
}
