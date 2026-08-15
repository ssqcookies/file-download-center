import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RetryPolicy } from '@/core/RetryPolicy'

/**
 * RetryPolicy 测试套件
 *
 * 测试重试策略的成功执行、失败重试成功、超过最大重试次数以及重试延迟。
 */

describe('RetryPolicy', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('成功执行', () => {
    it('首次成功时不重试', async () => {
      const policy = new RetryPolicy(3, 100)
      const fn = vi.fn().mockResolvedValue('success')

      const result = await policy.execute(fn)

      expect(result).toBe('success')
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('返回原始值（数字）', async () => {
      const policy = new RetryPolicy(2, 50)
      const fn = vi.fn().mockResolvedValue(42)

      const result = await policy.execute(fn)

      expect(result).toBe(42)
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('返回原始值（对象）', async () => {
      const policy = new RetryPolicy(2, 50)
      const data = { id: 1, name: 'test' }
      const fn = vi.fn().mockResolvedValue(data)

      const result = await policy.execute(fn)

      expect(result).toEqual(data)
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('失败后重试成功', () => {
    it('前两次失败第三次成功', async () => {
      const policy = new RetryPolicy(3, 100)
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('attempt 1 failed'))
        .mockRejectedValueOnce(new Error('attempt 2 failed'))
        .mockResolvedValueOnce('success on 3rd try')

      const promise = policy.execute(fn)

      // 推进 fake timer 以跳过重试延迟
      await vi.advanceTimersByTimeAsync(100)
      await vi.advanceTimersByTimeAsync(100)

      const result = await promise

      expect(result).toBe('success on 3rd try')
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('第一次失败第二次成功', async () => {
      const policy = new RetryPolicy(3, 50)
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('first fail'))
        .mockResolvedValueOnce('recovered')

      const promise = policy.execute(fn)

      await vi.advanceTimersByTimeAsync(50)

      const result = await promise

      expect(result).toBe('recovered')
      expect(fn).toHaveBeenCalledTimes(2)
    })
  })

  describe('超过最大重试次数', () => {
    it('超过最大重试次数后抛出最后的错误', async () => {
      const policy = new RetryPolicy(2, 50)
      const error = new Error('always fails')
      const fn = vi.fn().mockRejectedValue(error)

      const promise = policy.execute(fn)
      promise.catch(() => {})

      // 推进 timer 以触发所有重试（2 次重试 = 2 次延迟）
      await vi.advanceTimersByTimeAsync(50)
      await vi.advanceTimersByTimeAsync(50)

      await expect(promise).rejects.toThrow('always fails')

      // 最大重试次数 2 意味着总共执行 3 次（1 次初始 + 2 次重试）
      expect(fn).toHaveBeenCalledTimes(3)
    })

    it('最大重试次数为 0 时只执行一次', async () => {
      const policy = new RetryPolicy(0, 50)
      const error = new Error('no retry')
      const fn = vi.fn().mockRejectedValue(error)

      const promise = policy.execute(fn)

      await expect(promise).rejects.toThrow('no retry')
      expect(fn).toHaveBeenCalledTimes(1)
    })
  })

  describe('重试延迟', () => {
    it('每次重试之间有延迟', async () => {
      const delay = 200
      const policy = new RetryPolicy(2, delay)
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockRejectedValueOnce(new Error('fail 3'))

      const promise = policy.execute(fn)
      promise.catch(() => {})

      // 第一次调用立即执行
      expect(fn).toHaveBeenCalledTimes(1)

      // 推进 delay-1 ms，第二次调用还未发生
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(fn).toHaveBeenCalledTimes(1)

      // 推进剩余 1ms，第二次调用发生
      await vi.advanceTimersByTimeAsync(1)
      expect(fn).toHaveBeenCalledTimes(2)

      // 推进 delay-1 ms，第三次调用还未发生
      await vi.advanceTimersByTimeAsync(delay - 1)
      expect(fn).toHaveBeenCalledTimes(2)

      // 推进剩余 1ms，第三次调用发生
      await vi.advanceTimersByTimeAsync(1)
      expect(fn).toHaveBeenCalledTimes(3)

      await expect(promise).rejects.toThrow('fail 3')
    })

    it('延迟时间正确（使用 mock 时间验证）', async () => {
      const delay = 500
      const policy = new RetryPolicy(1, delay)
      const fn = vi
        .fn()
        .mockRejectedValueOnce(new Error('first'))
        .mockResolvedValueOnce('ok')

      const startTime = Date.now()
      const promise = policy.execute(fn)

      // 推进延迟时间
      await vi.advanceTimersByTimeAsync(delay)

      const result = await promise
      const elapsed = Date.now() - startTime

      expect(result).toBe('ok')
      expect(fn).toHaveBeenCalledTimes(2)
      // 经过至少一次延迟
      expect(elapsed).toBeGreaterThanOrEqual(delay)
    })
  })

  describe('多次调用独立性', () => {
    it('同一 RetryPolicy 实例多次调用时重试次数不共享', async () => {
      const policy = new RetryPolicy(2, 50)

      // 第一次调用：失败 2 次后成功（用完 2 次重试预算）
      const fn1 = vi
        .fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('success 1')

      const promise1 = policy.execute(fn1)
      await vi.advanceTimersByTimeAsync(50)
      await vi.advanceTimersByTimeAsync(50)
      const result1 = await promise1

      expect(result1).toBe('success 1')
      expect(fn1).toHaveBeenCalledTimes(3)

      // 第二次调用：失败 1 次后应成功（重试预算应重置，不共享）
      const fn2 = vi
        .fn()
        .mockRejectedValueOnce(new Error('recoverable'))
        .mockResolvedValueOnce('success 2')

      const promise2 = policy.execute(fn2)
      promise2.catch(() => {})
      await vi.advanceTimersByTimeAsync(50)

      const result2 = await promise2

      expect(result2).toBe('success 2')
      expect(fn2).toHaveBeenCalledTimes(2)
    })
  })

  describe('不同返回类型', () => {
    it('支持返回 Promise<void>', async () => {
      const policy = new RetryPolicy(1, 50)
      const fn = vi.fn().mockResolvedValue(undefined)

      const result = await policy.execute(fn)

      expect(result).toBeUndefined()
      expect(fn).toHaveBeenCalledTimes(1)
    })

    it('支持返回数组', async () => {
      const policy = new RetryPolicy(1, 50)
      const fn = vi.fn().mockResolvedValue([1, 2, 3])

      const result = await policy.execute(fn)

      expect(result).toEqual([1, 2, 3])
    })
  })
})
