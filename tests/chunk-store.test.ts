import { describe, it, expect, beforeEach } from 'vitest'
import { ChunkStore } from '@/storage/ChunkStore'
import type { Chunk } from '@/types'

/**
 * ChunkStore 测试套件
 *
 * 测试分片存储的保存、读取、清除以及隔离性。
 */

/** 辅助函数：创建模拟分片 */
function createChunk(index: number, size: number = 1024): Chunk {
  return {
    index,
    id: `uuid-${index}-${Math.random().toString(36).slice(2, 10)}`,
    data: new ArrayBuffer(size),
    size,
    start: index * size,
    end: (index + 1) * size
  }
}

describe('ChunkStore', () => {
  let store: ChunkStore

  beforeEach(() => {
    store = new ChunkStore()
  })

  describe('saveChunk & getDownloadedChunkIndices', () => {
    it('保存单个分片后应能检索到该分片序号', async () => {
      const taskId = 'task-001'
      const chunk = createChunk(0)

      await store.saveChunk(taskId, chunk)
      const indices = await store.getDownloadedChunkIndices(taskId)

      expect(indices).toEqual([0])
    })

    it('保存多个分片后应返回完整的序号列表', async () => {
      const taskId = 'task-002'

      await store.saveChunk(taskId, createChunk(0))
      await store.saveChunk(taskId, createChunk(1))
      await store.saveChunk(taskId, createChunk(2))

      const indices = await store.getDownloadedChunkIndices(taskId)

      expect(indices).toEqual([0, 1, 2])
    })

    it('保存多个分片后内部存储应包含对应条目', async () => {
      const taskId = 'task-003'

      await store.saveChunk(taskId, createChunk(0))
      await store.saveChunk(taskId, createChunk(1))

      const internalStorage = store.getInternalStorage()

      // 内部存储应有 2 条记录
      expect(internalStorage.size).toBe(2)

      // 验证 key 中包含 taskId
      for (const key of internalStorage.keys()) {
        expect(key).toContain(taskId)
      }
    })

    it('未保存任何分片时 getDownloadedChunkIndices 返回空数组', async () => {
      const taskId = 'task-empty'
      const indices = await store.getDownloadedChunkIndices(taskId)

      expect(indices).toEqual([])
    })
  })

  describe('clear', () => {
    it('保存分片后 clear，再 getDownloadedChunkIndices 返回空', async () => {
      const taskId = 'task-clear'

      await store.saveChunk(taskId, createChunk(0))
      await store.saveChunk(taskId, createChunk(1))
      await store.saveChunk(taskId, createChunk(2))

      // 清除前内部存储有数据
      expect(store.getInternalStorage().size).toBe(3)

      await store.clear(taskId)

      // 清除后内部存储为空
      expect(store.getInternalStorage().size).toBe(0)

      const indices = await store.getDownloadedChunkIndices(taskId)
      expect(indices).toEqual([])
    })

    it('clear 不存在的 taskId 不应抛出错误', async () => {
      const taskId = 'task-not-exist'

      await expect(store.clear(taskId)).resolves.not.toThrow()
    })
  })

  describe('不同 taskId 隔离', () => {
    it('不同 taskId 的分片互不影响', async () => {
      const taskIdA = 'task-A'
      const taskIdB = 'task-B'

      await store.saveChunk(taskIdA, createChunk(0))
      await store.saveChunk(taskIdA, createChunk(1))
      await store.saveChunk(taskIdB, createChunk(0))

      // 内部存储应有 3 条记录（A 的 2 条 + B 的 1 条）
      expect(store.getInternalStorage().size).toBe(3)

      // 清除 A 不影响 B
      await store.clear(taskIdA)
      expect(store.getInternalStorage().size).toBe(1)

      // 剩余的 key 应属于 taskIdB
      const remainingKeys = Array.from(store.getInternalStorage().keys())
      expect(remainingKeys.length).toBe(1)
      expect(remainingKeys[0]).toContain(taskIdB)
    })

    it('清除一个 taskId 后另一个 taskId 的分片仍然存在', async () => {
      const taskIdA = 'task-A2'
      const taskIdB = 'task-B2'

      await store.saveChunk(taskIdA, createChunk(0))
      await store.saveChunk(taskIdB, createChunk(0))
      await store.saveChunk(taskIdB, createChunk(1))

      await store.clear(taskIdA)

      // B 的分片仍在
      expect(store.getInternalStorage().size).toBe(2)

      const remainingKeys = Array.from(store.getInternalStorage().keys())
      remainingKeys.forEach((key) => {
        expect(key).toContain(taskIdB)
        expect(key).not.toContain(taskIdA)
      })
    })
  })

  describe('自定义存储', () => {
    it('使用自定义 Map 作为底层存储', async () => {
      const customStorage = new Map<string, string>()
      const store = new ChunkStore(customStorage)
      const taskId = 'task-custom'

      await store.saveChunk(taskId, createChunk(0))

      // 自定义存储应被使用
      expect(customStorage.size).toBe(1)

      // getInternalStorage 应返回同一个 Map 引用
      expect(store.getInternalStorage()).toBe(customStorage)
    })
  })
})
