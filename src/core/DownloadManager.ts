/**
 * 下载管理器
 *
 * 协调分片下载器、并发队列、重试策略、分片存储和进度追踪器，
 * 完成大文件的分片下载、断点续传、并发控制与错误重试。
 */

import type { Chunk, DownloadTask, DownloadOptions, ProgressInfo } from '@/types'
import { ChunkDownloader, type FetchImpl } from './ChunkDownloader'
import { ChunkMerger } from './ChunkMerger'
import { ConcurrentQueue } from './ConcurrentQueue'
import { RetryPolicy } from './RetryPolicy'
import { ChunkStore } from '@/storage/ChunkStore'
import { ProgressTracker } from '@/progress/ProgressTracker'

const DEFAULT_OPTIONS: Required<DownloadOptions> = {
  chunkSize: 2 * 1024 * 1024,
  concurrency: 3,
  maxRetries: 3,
  retryDelay: 1000
}

export class DownloadManager {
  private options: Required<DownloadOptions>
  private chunkDownloader: ChunkDownloader
  private chunkMerger: ChunkMerger
  private chunkStore: ChunkStore
  private retryPolicy: RetryPolicy
  private tasks: Map<string, DownloadTask> = new Map()
  private queues: Map<string, ConcurrentQueue> = new Map()
  private trackers: Map<string, ProgressTracker> = new Map()
  private progressCallbacks: ((info: ProgressInfo) => void)[] = []
  private cancelledTasks: Set<string> = new Set()
  private pausedTasks: Set<string> = new Set()
  private taskErrors: Map<string, boolean> = new Map()
  private pauseHandlers: Map<string, (pendingCount: number) => void> = new Map()

  constructor(options?: DownloadOptions, fetchImpl?: FetchImpl) {
    this.options = { ...DEFAULT_OPTIONS, ...options }
    const fetchFn = fetchImpl || ((url: string, init?: RequestInit) => fetch(url, init))
    this.chunkDownloader = new ChunkDownloader(fetchFn)
    this.chunkMerger = new ChunkMerger()
    this.chunkStore = new ChunkStore()
    this.retryPolicy = new RetryPolicy(this.options.maxRetries, this.options.retryDelay)
  }

  /**
   * 开始下载任务
   */
  async start(task: DownloadTask): Promise<void> {
    this.tasks.set(task.id, task)
    task.status = 'downloading'
    task.progress = 0
    task.downloadedChunks = []

    const tracker = new ProgressTracker(task.id, task.fileSize)
    this.trackers.set(task.id, tracker)
    this.taskErrors.set(task.id, false)

    const queue = new ConcurrentQueue(this.options.concurrency)
    this.queues.set(task.id, queue)

    const chunkSize = task.chunkSize || this.options.chunkSize
    const totalChunks = task.totalChunks || Math.ceil(task.fileSize / chunkSize)
    const downloadedChunks: Chunk[] = []

    return new Promise<void>((resolve) => {
      let completedCount = 0
      let resolved = false

      const safeResolve = () => {
        if (!resolved) {
          resolved = true
          resolve()
        }
      }

      const onChunkDone = () => {
        completedCount++
        if (completedCount >= totalChunks) {
          this.finishDownload(task, downloadedChunks, tracker, safeResolve)
        }
      }

      // 设置 pause handler：被清空的待执行任务计入完成
      this.pauseHandlers.set(task.id, (pendingCount: number) => {
        for (let i = 0; i < pendingCount; i++) {
          onChunkDone()
        }
      })

      for (let i = 0; i < totalChunks; i++) {
        const chunkStart = i * chunkSize
        const chunkEnd = Math.min((i + 1) * chunkSize - 1, task.fileSize - 1)

        const chunk: Chunk = {
          index: i,
          id: this.generateId(),
          data: new ArrayBuffer(0),
          size: 0,
          start: chunkStart,
          end: chunkEnd
        }

        let chunkProcessed = false

        queue.add(async () => {
          if (chunkProcessed) return

          // 检查是否被暂停或取消
          if (this.pausedTasks.has(task.id) || this.cancelledTasks.has(task.id)) {
            chunkProcessed = true
            onChunkDone()
            return
          }

          try {
            const downloadedChunk = await this.retryPolicy.execute(() => this.chunkDownloader.download(task.url, chunk))

            // 下载完成后再次检查状态
            if (this.pausedTasks.has(task.id) || this.cancelledTasks.has(task.id)) {
              chunkProcessed = true
              onChunkDone()
              return
            }

            // 保存分片到存储
            await this.chunkStore.saveChunk(task.id, downloadedChunk)

            // 更新进度
            tracker.addChunk(downloadedChunk.size)
            task.downloadedChunks.push(i)
            this.notifyProgress(task.id, tracker)
            downloadedChunks.push(downloadedChunk)
          } catch {
            // 单个分片下载失败，标记错误但继续
            this.taskErrors.set(task.id, true)
          }

          chunkProcessed = true
          onChunkDone()
        })
      }
    })
  }

  /**
   * 暂停下载
   */
  pause(taskId: string): void {
    this.pausedTasks.add(taskId)
    const queue = this.queues.get(taskId)
    if (queue) {
      const pendingCount = queue.pending
      queue.pause()
      queue.clear()

      // 通知 start：被清空的待执行任务计入完成
      const handler = this.pauseHandlers.get(taskId)
      if (handler) {
        handler(pendingCount)
      }
    }

    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'paused'
    }
  }

  /**
   * 恢复下载（断点续传）
   *
   * 从 ChunkStore 获取已下载的分片序号列表，跳过已下载的分片。
  
   */
  async resume(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) return

    this.pausedTasks.delete(taskId)
    this.taskErrors.set(taskId, false)

    // 获取已下载的分片序号
    const downloadedIndices = await this.chunkStore.getDownloadedChunkIndices(taskId)

    task.status = 'downloading'

    const queue = new ConcurrentQueue(this.options.concurrency)
    this.queues.set(taskId, queue)

    const chunkSize = task.chunkSize || this.options.chunkSize
    const totalChunks = task.totalChunks || Math.ceil(task.fileSize / chunkSize)
    const tracker = this.trackers.get(taskId) || new ProgressTracker(taskId, task.fileSize)

    const downloadedChunks: Chunk[] = []

    // 计算需要下载的分片（跳过已下载的）
    const chunksToDownload: number[] = []
    for (let i = 0; i < totalChunks; i++) {
      if (!downloadedIndices.includes(i)) {
        chunksToDownload.push(i)
      }
    }

    return new Promise<void>((resolve) => {
      let completedCount = 0
      let resolved = false

      const safeResolve = () => {
        if (!resolved) {
          resolved = true
          resolve()
        }
      }

      const onChunkDone = () => {
        completedCount++
        if (completedCount >= chunksToDownload.length) {
          if (this.cancelledTasks.has(taskId)) {
            task.status = 'error'
            safeResolve()
            return
          }

          if (this.taskErrors.get(taskId)) {
            task.status = 'error'
            safeResolve()
            return
          }

          if (downloadedChunks.length > 0) {
            this.chunkMerger.merge(downloadedChunks, task.fileName)
          }
          task.status = 'completed'
          task.progress = 100
          tracker.update(task.fileSize)
          this.notifyProgress(taskId, tracker)
          safeResolve()
        }
      }

      // 没有需要下载的分片，直接完成
      if (chunksToDownload.length === 0) {
        task.status = 'completed'
        task.progress = 100
        tracker.update(task.fileSize)
        this.notifyProgress(taskId, tracker)
        safeResolve()
        return
      }

      // 设置 pause handler
      this.pauseHandlers.set(taskId, (pendingCount: number) => {
        for (let i = 0; i < pendingCount; i++) {
          onChunkDone()
        }
      })

      for (const i of chunksToDownload) {
        const chunkStart = i * chunkSize
        const chunkEnd = Math.min((i + 1) * chunkSize - 1, task.fileSize - 1)

        const chunk: Chunk = {
          index: i,
          id: this.generateId(),
          data: new ArrayBuffer(0),
          size: 0,
          start: chunkStart,
          end: chunkEnd
        }

        let chunkProcessed = false

        queue.add(async () => {
          if (chunkProcessed) return

          if (this.cancelledTasks.has(taskId)) {
            chunkProcessed = true
            onChunkDone()
            return
          }

          try {
            const downloadedChunk = await this.retryPolicy.execute(() => this.chunkDownloader.download(task.url, chunk))

            if (this.cancelledTasks.has(taskId)) {
              chunkProcessed = true
              onChunkDone()
              return
            }

            await this.chunkStore.saveChunk(taskId, downloadedChunk)
            tracker.addChunk(downloadedChunk.size)
            task.downloadedChunks.push(i)
            this.notifyProgress(taskId, tracker)
            downloadedChunks.push(downloadedChunk)
          } catch {
            this.taskErrors.set(taskId, true)
          }

          chunkProcessed = true
          onChunkDone()
        })
      }
    })
  }

  /**
   * 取消下载
   */
  cancel(taskId: string): void {
    this.cancelledTasks.add(taskId)
    const queue = this.queues.get(taskId)
    if (queue) {
      const pendingCount = queue.pending
      queue.pause()
      queue.clear()

      const handler = this.pauseHandlers.get(taskId)
      if (handler) {
        handler(pendingCount)
      }
    }

    const task = this.tasks.get(taskId)
    if (task) {
      task.status = 'error'
    }
  }

  /**
   * 注册进度回调
   */
  onProgress(callback: (info: ProgressInfo) => void): void {
    this.progressCallbacks.push(callback)
  }

  /**
   * 获取任务信息
   */
  getTask(taskId: string): DownloadTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 完成下载的收尾工作
   */
  private finishDownload(task: DownloadTask, chunks: Chunk[], tracker: ProgressTracker, resolve: () => void): void {
    this.pauseHandlers.delete(task.id)

    if (this.cancelledTasks.has(task.id)) {
      task.status = 'error'
      resolve()
      return
    }

    if (this.pausedTasks.has(task.id)) {
      resolve()
      return
    }

    if (this.taskErrors.get(task.id)) {
      task.status = 'error'
      resolve()
      return
    }

    if (chunks.length > 0) {
      this.chunkMerger.merge(chunks, task.fileName)
    }
    task.status = 'completed'
    task.progress = 100
    tracker.update(task.fileSize)
    this.notifyProgress(task.id, tracker)
    this.queues.delete(task.id)
    resolve()
  }

  private notifyProgress(taskId: string, tracker: ProgressTracker): void {
    const info = tracker.getProgress()
    for (const cb of this.progressCallbacks) {
      cb(info)
    }
  }

  private generateId(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  }
}
