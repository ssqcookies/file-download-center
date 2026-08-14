import type { Chunk } from '@/types'

export class ChunkStore {
  private storage: Map<string, string>
  private readonly prefix = 'chunk_'

  constructor(storage?: Map<string, string>) {
    this.storage = storage ?? new Map()
  }

  async saveChunk(taskId: string, chunk: Chunk): Promise<void> {
    const key = `${this.prefix}${taskId}_${chunk.start}`
    const value = JSON.stringify({ index: chunk.index, size: chunk.size })
    this.storage.set(key, value)
  }

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

  async getChunkCount(taskId: string): Promise<number> {
    const indices = await this.getDownloadedChunkIndices(taskId)
    return indices.length
  }

  async hasChunk(taskId: string, index: number): Promise<boolean> {
    const indices = await this.getDownloadedChunkIndices(taskId)
    return indices.includes(index)
  }

  async getChunkInfo(taskId: string, index: number): Promise<{ index: number; size: number } | null> {
    const key = `${this.prefix}${taskId}_${index}`
    const value = this.storage.get(key)
    if (!value) return null
    return JSON.parse(value)
  }

  async getDownloadProgress(taskId: string, totalChunks: number): Promise<number> {
    const indices = await this.getDownloadedChunkIndices(taskId)
    return totalChunks > 0 ? indices.length / totalChunks : 0
  }

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

  getInternalStorage(): Map<string, string> {
    return this.storage
  }
}
