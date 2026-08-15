import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConcurrentQueue } from '@/core/ConcurrentQueue'

/**
 * ConcurrentQueue 测试套件
 *
 * 测试并发队列的并发数限制、暂停/恢复、清空以及任务结果返回。
 */

/** 辅助函数：创建延迟任务 */
function createDelayedTask<T>(
  result: T,
  delay: number = 50,
  onExecute?: () => void,
): () => Promise<T> {
  return () =>
    new Promise<T>((resolve) => {
      if (onExecute) onExecute()
      setTimeout(() => resolve(result), delay)
    })
}

describe('ConcurrentQueue', () => {
  describe('并发数限制', () => {
    it('并发数为 2 时，同时执行的任务不超过 2 个', async () => {
      const queue = new ConcurrentQueue(2)
      let activeCount = 0
      let maxActive = 0

      const createTask = (id: number) => () =>
        new Promise<number>((resolve) => {
          activeCount++
          maxActive = Math.max(maxActive, activeCount)
          setTimeout(() => {
            activeCount--
            resolve(id)
          }, 80)
        })

      // 添加 5 个任务
      const promises: Promise<number>[] = []
      for (let i = 0; i < 5; i++) {
        promises.push(queue.add(createTask(i)))
      }

      await Promise.all(promises)

      // 同时执行的任务不应超过并发数 2
      expect(maxActive).toBeLessThanOrEqual(2)
    })

    it('并发数为 1 时，任务串行执行', async () => {
      const queue = new ConcurrentQueue(1)
      const executionOrder: number[] = []
      let activeCount = 0
      let maxActive = 0

      const createTask = (id: number) => () =>
        new Promise<number>((resolve) => {
          activeCount++
          maxActive = Math.max(maxActive, activeCount)
          executionOrder.push(id)
          setTimeout(() => {
            activeCount--
            resolve(id)
          }, 30)
        })

      const promises: Promise<number>[] = []
      for (let i = 0; i < 4; i++) {
        promises.push(queue.add(createTask(i)))
      }

      const results = await Promise.all(promises)

      expect(maxActive).toBe(1)
      expect(results).toEqual([0, 1, 2, 3])
      expect(executionOrder).toEqual([0, 1, 2, 3])
    })

    it('并发数为 3 时，同时执行的任务不超过 3 个', async () => {
      const queue = new ConcurrentQueue(3)
      let activeCount = 0
      let maxActive = 0

      const createTask = (id: number) => () =>
        new Promise<number>((resolve) => {
          activeCount++
          maxActive = Math.max(maxActive, activeCount)
          setTimeout(() => {
            activeCount--
            resolve(id)
          }, 60)
        })

      const promises: Promise<number>[] = []
      for (let i = 0; i < 8; i++) {
        promises.push(queue.add(createTask(i)))
      }

      await Promise.all(promises)

      expect(maxActive).toBeLessThanOrEqual(3)
    })
  })

  describe('pause & resume', () => {
    it('暂停后待执行任务不执行，恢复后继续执行', async () => {
      const queue = new ConcurrentQueue(1)
      const executed: number[] = []

      // 添加第一个任务并等待完成
      await queue.add(
        () =>
          new Promise<number>((resolve) => {
            executed.push(1)
            setTimeout(() => resolve(1), 20)
          }),
      )

      // 暂停队列
      queue.pause()

      // 添加后续任务（由于暂停，不应立即执行）
      const promise2 = queue.add(
        () =>
          new Promise<number>((resolve) => {
            executed.push(2)
            setTimeout(() => resolve(2), 20)
          }),
      )

      // 等待一段时间，确认任务 2 未执行
      await new Promise((resolve) => setTimeout(resolve, 80))
      expect(executed).not.toContain(2)

      // 恢复队列
      queue.resume()

      const result = await promise2
      expect(result).toBe(2)
      expect(executed).toContain(2)
    })

    it('暂停后 pending 数量应反映待执行任务', async () => {
      const queue = new ConcurrentQueue(1)

      // 先执行一个任务
      const promise1 = queue.add(createDelayedTask(1, 50))

      // 添加更多任务（pending 中等待）
      queue.add(createDelayedTask(2, 50))
      queue.add(createDelayedTask(3, 50))

      // 等待一小段时间让第一个任务开始执行
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 暂停
      queue.pause()

      // 应有 pending 任务（第一个在执行中，其余在排队）
      // 注意：pending 表示尚未开始执行的任务数
      expect(queue.pending).toBeGreaterThanOrEqual(1)

      await promise1
      queue.clear()
    })

    it('resume 后应填满所有并发槽位', async () => {
      const concurrency = 3
      const queue = new ConcurrentQueue(concurrency)

      let activeCount = 0
      let maxActiveAfterResume = 0

      const createTask = (id: number) => () =>
        new Promise<number>((resolve) => {
          activeCount++
          maxActiveAfterResume = Math.max(maxActiveAfterResume, activeCount)
          setTimeout(() => {
            activeCount--
            resolve(id)
          }, 50)
        })

      // 添加 6 个任务
      const promises: Promise<number>[] = []
      for (let i = 0; i < 6; i++) {
        promises.push(queue.add(createTask(i)))
      }

      // 等待前 3 个开始执行
      await new Promise((resolve) => setTimeout(resolve, 10))

      // 暂停（3 个在执行，3 个在 pending）
      queue.pause()

      // 等待正在执行的任务完成
      await new Promise((resolve) => setTimeout(resolve, 80))

      // 重置统计
      maxActiveAfterResume = 0

      // 恢复后应填满所有并发槽位
      queue.resume()

      // 等待一下让任务开始
      await new Promise((resolve) => setTimeout(resolve, 10))

      // resume 后应该有最多 concurrency 个任务同时执行
      expect(maxActiveAfterResume).toBe(concurrency)

      await Promise.all(promises)
    })
  })

  describe('clear', () => {
    it('清空后待执行任务数量为 0', async () => {
      const queue = new ConcurrentQueue(1)

      // 添加一个任务占住执行槽
      const promise1 = queue.add(createDelayedTask(1, 100))

      // 添加更多任务
      queue.add(createDelayedTask(2, 50))
      queue.add(createDelayedTask(3, 50))

      await new Promise((resolve) => setTimeout(resolve, 10))

      // 清空队列
      queue.clear()

      // pending 应为 0
      expect(queue.pending).toBe(0)

      await promise1
    })

    it('clear 后添加新任务可正常执行', async () => {
      const queue = new ConcurrentQueue(1)

      // 先占住执行槽
      const promise1 = queue.add(createDelayedTask(1, 50))

      // 添加任务后清空
      queue.add(createDelayedTask(2, 50))
      queue.clear()

      await promise1

      // clear 后添加新任务应正常执行
      const result = await queue.add(createDelayedTask(3, 30))
      expect(result).toBe(3)
    })
  })

  describe('任务结果', () => {
    it('任务结果正确返回', async () => {
      const queue = new ConcurrentQueue(2)

      const result1 = await queue.add(createDelayedTask('hello', 20))
      const result2 = await queue.add(createDelayedTask('world', 20))

      expect(result1).toBe('hello')
      expect(result2).toBe('world')
    })

    it('任务抛出的错误能被捕获', async () => {
      const queue = new ConcurrentQueue(1)

      const errorTask = () =>
        new Promise<string>((_resolve, reject) => {
          setTimeout(() => reject(new Error('task failed')), 20)
        })

      await expect(queue.add(errorTask)).rejects.toThrow('task failed')
    })

    it('多个任务并行执行并返回各自结果', async () => {
      const queue = new ConcurrentQueue(3)

      const promises: Promise<number>[] = []
      for (let i = 0; i < 6; i++) {
        promises.push(queue.add(createDelayedTask(i * 10, 30)))
      }

      const results = await Promise.all(promises)

      expect(results).toEqual([0, 10, 20, 30, 40, 50])
    })
  })

  describe('active & pending 属性', () => {
    it('active 返回当前正在执行的任务数', async () => {
      const queue = new ConcurrentQueue(2)

      const promise1 = queue.add(createDelayedTask(1, 80))
      const promise2 = queue.add(createDelayedTask(2, 80))

      // 等待任务开始
      await new Promise((resolve) => setTimeout(resolve, 10))

      expect(queue.active).toBe(2)

      await Promise.all([promise1, promise2])

      expect(queue.active).toBe(0)
    })

    it('pending 返回等待执行的任务数', async () => {
      const queue = new ConcurrentQueue(1)

      // 第一个任务占住执行槽
      const promise1 = queue.add(createDelayedTask(1, 80))

      // 添加 3 个待执行任务
      queue.add(createDelayedTask(2, 20))
      queue.add(createDelayedTask(3, 20))
      queue.add(createDelayedTask(4, 20))

      await new Promise((resolve) => setTimeout(resolve, 10))

      // 3 个任务在 pending
      expect(queue.pending).toBe(3)

      await promise1
      queue.clear()
    })
  })
})
