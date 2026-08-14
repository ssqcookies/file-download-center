/**
 * 分片持久化存储
 *
 * 将已下载的分片信息存储到 Map 中，支持按任务 ID 查询已下载的分片序号。
 *
 */

import type { Chunk } from '@/types'

export class ChunkStore {
  private storage: Map<string, string>
  private readonly prefix = 'chunk_'

  constructor(storage?: Map<string, string>) {
    this.storage = storage ?? new Map()
  }

  /**
   * 保存已下载的分片
   */
  async saveChunk(taskId: string, chunk: Chunk): Promise<void> {
    const key = `${this.prefix}${taskId}_${chunk.id}`
    const value = JSON.stringify({ index: chunk.index, size: chunk.size })
    this.storage.set(key, value)
  }

  /**
   * 获取指定任务已下载的分片序号列表
   *
   * 遍历存储中以 `chunk_{taskId}_` 开头的 key，
   * 从 key 末尾解析数字序号。
   *
   */
  async getDownloadedChunkIndices(taskId: string): Promise<number[]> {
    const indices: number[] = []
    const searchPrefix = `${this.prefix}${taskId}_`

    for (const key of this.storage.keys()) {
      if (key.startsWith(searchPrefix)) {
        const part = key.substring(searchPrefix.length)
        const index = parseInt(part, 10)
        if (!isNaN(index)) {
          indices.push(index)
        }
      }
    }

    return indices.sort((a, b) => a - b)
  }

  /**
   * 清除指定任务的所有分片记录
   */
  async clear(taskId: string): Promise<void> {
    const searchPrefix = `${this.prefix}${taskId}_`
    const keysToDelete: string[] = []

    for (const key of this.storage.keys()) {
      if (key.startsWith(searchPrefix)) {
        keysToDelete.push(key)
      }
    }

    keysToDelete.forEach((key) => this.storage.delete(key))
  }

  /**
   * 获取内部存储引用（主要用于测试）
   */
  getInternalStorage(): Map<string, string> {
    return this.storage
  }
}
