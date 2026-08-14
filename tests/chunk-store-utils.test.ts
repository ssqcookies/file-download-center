import { describe, it, expect } from 'vitest'
import { ChunkStore } from '@/storage/ChunkStore'

describe('ChunkStore utils', () => {
  it('空存储时 getChunkCount 返回 0', async () => {
    const store = new ChunkStore()
    const count = await store.getChunkCount('task-001')
    expect(count).toBe(0)
  })

  it('空存储时 hasChunk 返回 false', async () => {
    const store = new ChunkStore()
    const exists = await store.hasChunk('task-001', 0)
    expect(exists).toBe(false)
  })

  it('空存储时 getChunkInfo 返回 null', async () => {
    const store = new ChunkStore()
    const info = await store.getChunkInfo('task-001', 0)
    expect(info).toBeNull()
  })

  it('空存储时 getDownloadProgress 返回 0', async () => {
    const store = new ChunkStore()
    const progress = await store.getDownloadProgress('task-001', 10)
    expect(progress).toBe(0)
  })

  it('getDownloadProgress 返回正确比例', async () => {
    const store = new ChunkStore()
    const progress = await store.getDownloadProgress('task-001', 5)
    expect(progress).toBeGreaterThanOrEqual(0)
    expect(progress).toBeLessThanOrEqual(1)
  })

  it('getInternalStorage 返回 Map 实例', () => {
    const store = new ChunkStore()
    expect(store.getInternalStorage()).toBeInstanceOf(Map)
  })

  it('getInternalStorage 返回传入的自定义 Map', () => {
    const customMap = new Map<string, string>()
    const store = new ChunkStore(customMap)
    expect(store.getInternalStorage()).toBe(customMap)
  })
})
