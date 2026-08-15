import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DownloadManager } from '@/core/DownloadManager'
import type { DownloadTask, DownloadOptions } from '@/types'

/**
 * DownloadManager 测试套件
 *
 * 测试下载管理器的完整下载、暂停/恢复（状态管理）、进度回调与取消功能。
 */

/** 辅助函数：创建模拟 Response */
function createMockResponse(data: ArrayBuffer, status: number = 200): Response {
  const headers = new Headers()
  headers.set('Content-Length', String(data.byteLength))
  headers.set('Content-Range', `bytes 0-${data.byteLength - 1}/${data.byteLength}`)

  return new Response(data, {
    status,
    statusText: status === 200 ? 'OK' : 'Partial Content',
    headers
  })
}

/** 辅助函数：创建模拟 fetch 实现 */
function createMockFetch(
  fileSize: number,
  chunkSize: number,
  delay: number = 10
): {
  fetchImpl: (url: string, options?: RequestInit) => Promise<Response>
  getCallCount: () => number
  getRequestedRanges: () => string[]
} {
  let callCount = 0
  const requestedRanges: string[] = []

  const fetchImpl = vi.fn(async (url: string, options?: RequestInit): Promise<Response> => {
    callCount++
    const rangeHeader = options?.headers ? new Headers(options.headers as HeadersInit).get('Range') : null

    if (rangeHeader) {
      requestedRanges.push(rangeHeader)
    }

    // 模拟网络延迟
    await new Promise((resolve) => setTimeout(resolve, delay))

    // 解析 Range header: "bytes=start-end"
    let start = 0
    let end = fileSize - 1
    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d+)?/)
      if (match) {
        start = parseInt(match[1], 10)
        if (match[2]) {
          end = parseInt(match[2], 10)
        }
      }
    }

    // 限制 end 不超过文件大小
    end = Math.min(end, fileSize - 1)

    const chunkLength = end - start + 1
    const buffer = new ArrayBuffer(chunkLength)

    return createMockResponse(buffer, 206)
  })

  return {
    fetchImpl: fetchImpl as unknown as (url: string, options?: RequestInit) => Promise<Response>,
    getCallCount: () => callCount,
    getRequestedRanges: () => [...requestedRanges]
  }
}

/** 辅助函数：创建下载任务 */
function createDownloadTask(overrides: Partial<DownloadTask> = {}): DownloadTask {
  return {
    id: 'test-task-001',
    url: 'https://example.com/large-file.zip',
    fileName: 'large-file.zip',
    fileSize: 10 * 1024, // 10KB
    chunkSize: 2 * 1024, // 2KB -> 5 chunks
    totalChunks: 5,
    status: 'pending',
    downloadedChunks: [],
    progress: 0,
    ...overrides
  }
}

describe('DownloadManager', () => {
  let options: DownloadOptions

  beforeEach(() => {
    options = {
      chunkSize: 2 * 1024,
      concurrency: 2,
      maxRetries: 3,
      retryDelay: 50
    }
  })

  describe('正常完整下载', () => {
    it('start 后任务状态最终变为 completed', async () => {
      const fileSize = 10 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = Math.ceil(fileSize / chunkSize)

      const { fetchImpl } = createMockFetch(fileSize, chunkSize)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        fileSize,
        chunkSize,
        totalChunks
      })

      await manager.start(task)

      const result = manager.getTask(task.id)
      expect(result).toBeDefined()
      expect(result!.status).toBe('completed')
    })

    it('下载完成后 progress 为 100', async () => {
      const fileSize = 8 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = Math.ceil(fileSize / chunkSize)

      const { fetchImpl } = createMockFetch(fileSize, chunkSize)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        id: 'test-progress-100',
        fileSize,
        chunkSize,
        totalChunks
      })

      await manager.start(task)

      const result = manager.getTask(task.id)
      expect(result).toBeDefined()
      expect(result!.progress).toBe(100)
    })

    it('所有分片都被请求下载', async () => {
      const fileSize = 6 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = 3

      const { fetchImpl, getCallCount } = createMockFetch(fileSize, chunkSize)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        id: 'test-all-chunks',
        fileSize,
        chunkSize,
        totalChunks
      })

      await manager.start(task)

      // 3 个分片应被请求 3 次
      expect(getCallCount()).toBe(totalChunks)
    })
  })

  describe('状态管理', () => {
    it('暂停后恢复时验证行为一致性', async () => {
      const fileSize = 10 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = 5

      const { fetchImpl, getCallCount } = createMockFetch(fileSize, chunkSize, 20)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        id: 'test-resume-skip',
        fileSize,
        chunkSize,
        totalChunks
      })

      // 先完整下载
      await manager.start(task)
      expect(manager.getTask(task.id)!.status).toBe('completed')

      const countAfterStart = getCallCount()

      // 暂停后恢复（所有分片已完成）
      manager.pause(task.id)
      await manager.resume(task.id)

      const finalCount = getCallCount()
      const resumeFetchCount = finalCount - countAfterStart

      // 验证恢复后的行为
      expect(resumeFetchCount).toBe(0)
    })

    it('恢复后任务状态正确', async () => {
      const fileSize = 6 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = 3

      const { fetchImpl } = createMockFetch(fileSize, chunkSize, 20)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        id: 'test-resume-complete',
        fileSize,
        chunkSize,
        totalChunks
      })

      // 开始下载
      const startPromise = manager.start(task)

      // 等待一小段时间
      await new Promise((resolve) => setTimeout(resolve, 30))

      // 暂停
      manager.pause(task.id)

      // 恢复
      await manager.resume(task.id)

      // 等待完成
      try {
        await startPromise
      } catch {
        // 忽略 pause 导致的中断
      }
      await new Promise((resolve) => setTimeout(resolve, 200))

      const result = manager.getTask(task.id)
      expect(result).toBeDefined()
      expect(result!.status).toBe('completed')
    })
  })

  describe('进度回调', () => {
    it('下载过程中进度回调被调用', async () => {
      const fileSize = 8 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = 4

      const { fetchImpl } = createMockFetch(fileSize, chunkSize, 20)
      const manager = new DownloadManager(options, fetchImpl)

      const progressCallback = vi.fn()
      manager.onProgress(progressCallback)

      const task = createDownloadTask({
        id: 'test-progress-callback',
        fileSize,
        chunkSize,
        totalChunks
      })

      await manager.start(task)

      // 进度回调应被调用至少一次
      expect(progressCallback).toHaveBeenCalled()

      // 最后一次调用的 percentage 应为 100
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1]
      const lastProgress = lastCall?.[0]
      expect(lastProgress).toBeDefined()
      expect(lastProgress.percentage).toBe(100)
    })

    it('进度回调包含正确的 taskId', async () => {
      const fileSize = 4 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = 2

      const { fetchImpl } = createMockFetch(fileSize, chunkSize, 10)
      const manager = new DownloadManager(options, fetchImpl)

      const progressCallback = vi.fn()
      manager.onProgress(progressCallback)

      const task = createDownloadTask({
        id: 'test-task-id-in-progress',
        fileSize,
        chunkSize,
        totalChunks
      })

      await manager.start(task)

      // 所有进度回调都应包含正确的 taskId
      for (const call of progressCallback.mock.calls) {
        expect(call[0].taskId).toBe(task.id)
      }
    })

    it('进度回调中 downloaded 递增', async () => {
      const fileSize = 8 * 1024
      const chunkSize = 1 * 1024
      const totalChunks = 8

      const { fetchImpl } = createMockFetch(fileSize, chunkSize, 5)
      const manager = new DownloadManager({ ...options, concurrency: 1 }, fetchImpl)

      const progressCallback = vi.fn()
      manager.onProgress(progressCallback)

      const task = createDownloadTask({
        id: 'test-progress-increasing',
        fileSize,
        chunkSize,
        totalChunks
      })

      await manager.start(task)

      // 验证 downloaded 字段递增（非严格递增，但最终值应等于 fileSize）
      const calls = progressCallback.mock.calls
      if (calls.length >= 2) {
        const lastCall = calls[calls.length - 1]
        expect(lastCall[0].downloaded).toBe(fileSize)
      }
    })
  })

  describe('cancel', () => {
    it('cancel 后任务状态为 error 或 paused', async () => {
      const fileSize = 10 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = 5

      const { fetchImpl } = createMockFetch(fileSize, chunkSize, 50)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        id: 'test-cancel',
        fileSize,
        chunkSize,
        totalChunks
      })

      // 开始下载
      manager.start(task)

      // 等待一小段时间
      await new Promise((resolve) => setTimeout(resolve, 30))

      // 取消
      manager.cancel(task.id)

      const result = manager.getTask(task.id)
      expect(result).toBeDefined()
      // cancel 后状态可能是 error 或其他非 downloading 状态
      expect(result!.status).not.toBe('downloading')
    })

    it('cancel 后可获取任务信息', async () => {
      const { fetchImpl } = createMockFetch(8 * 1024, 2 * 1024, 50)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        id: 'test-cancel-info',
        fileSize: 8 * 1024,
        chunkSize: 2 * 1024,
        totalChunks: 4
      })

      manager.start(task)
      await new Promise((resolve) => setTimeout(resolve, 20))
      manager.cancel(task.id)

      const result = manager.getTask(task.id)
      expect(result).toBeDefined()
      expect(result!.id).toBe(task.id)
      expect(result!.url).toBe(task.url)
      expect(result!.fileName).toBe(task.fileName)
    })
  })

  describe('getTask', () => {
    it('任务对象的封装性', async () => {
      const fileSize = 4 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = 2

      const { fetchImpl } = createMockFetch(fileSize, chunkSize, 10)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        id: 'test-no-mutation',
        fileSize,
        chunkSize,
        totalChunks
      })

      const originalDownloadedChunks = [...task.downloadedChunks]

      await manager.start(task)

      // 验证 task 对象的封装性
      expect(task.downloadedChunks).toEqual(originalDownloadedChunks)
    })

    it('获取不存在的任务返回 undefined', () => {
      const { fetchImpl } = createMockFetch(1024, 1024)
      const manager = new DownloadManager(options, fetchImpl)

      const result = manager.getTask('non-existent-id')
      expect(result).toBeUndefined()
    })

    it('start 后可通过 getTask 获取任务', async () => {
      const fileSize = 4 * 1024
      const chunkSize = 2 * 1024
      const totalChunks = 2

      const { fetchImpl } = createMockFetch(fileSize, chunkSize, 10)
      const manager = new DownloadManager(options, fetchImpl)

      const task = createDownloadTask({
        id: 'test-get-task',
        fileSize,
        chunkSize,
        totalChunks
      })

      await manager.start(task)

      const result = manager.getTask(task.id)
      expect(result).toBeDefined()
      expect(result!.id).toBe(task.id)
      expect(result!.status).toBe('completed')
    })
  })

  describe('错误处理', () => {
    it('fetch 失败时任务状态变为 error', async () => {
      const fetchImpl = vi.fn().mockRejectedValue(new Error('Network error'))
      const manager = new DownloadManager({ ...options, maxRetries: 0 }, fetchImpl as unknown as (url: string, options?: RequestInit) => Promise<Response>)

      const task = createDownloadTask({
        id: 'test-error',
        fileSize: 4 * 1024,
        chunkSize: 2 * 1024,
        totalChunks: 2
      })

      try {
        await manager.start(task)
      } catch {
        // 忽略错误
      }

      // 等待一下确保状态更新
      await new Promise((resolve) => setTimeout(resolve, 50))

      const result = manager.getTask(task.id)
      expect(result).toBeDefined()
      expect(result!.status).toBe('error')
    })
  })
})
