/**
 * 错误重试策略
 *
 * 在执行异步任务失败时自动重试，最多重试 maxRetries 次。
 */

export class RetryPolicy {
  private maxRetries: number;
  private delay: number;
  private currentDelay: number;

  /**
   * @param maxRetries 最大重试次数（不含首次执行）
   * @param delay 每次重试前的初始延迟（毫秒），采用指数退避策略
   */
  constructor(maxRetries: number, delay: number) {
    this.maxRetries = maxRetries;
    this.delay = delay;
    this.currentDelay = delay;
  }

  /**
   * 执行任务，失败时自动重试
   * @param fn 要执行的任务
   * @returns 任务的返回值
   * @throws 超过最大重试次数后抛出最后的错误
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    let currentRetries = 0;

    for (; currentRetries <= this.maxRetries; currentRetries++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (currentRetries < this.maxRetries) {
          await this.sleep(this.currentDelay);
          this.currentDelay *= 2;
        }
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
