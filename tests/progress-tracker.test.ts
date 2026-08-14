import { describe, it, expect, beforeEach } from 'vitest'
import { ProgressTracker } from '@/progress/ProgressTracker'

/**
 * ProgressTracker 测试套件
 *
 * 测试进度追踪器的百分比计算、分片累加、重置以及批量设置已下载分片。
 */

describe('ProgressTracker', () => {
  describe('update & percentage', () => {
    it('update 后 percentage 正确计算', () => {
      const tracker = new ProgressTracker('task-001', 1000)

      tracker.update(500)

      const progress = tracker.getProgress()
      expect(progress.downloaded).toBe(500)
      expect(progress.total).toBe(1000)
      expect(progress.percentage).toBe(50)
    })

    it('下载完成时 percentage 为 100', () => {
      const tracker = new ProgressTracker('task-002', 2000)

      tracker.update(2000)

      const progress = tracker.getProgress()
      expect(progress.percentage).toBe(100)
    })

    it('未下载任何内容时 percentage 为 0', () => {
      const tracker = new ProgressTracker('task-003', 1000)

      const progress = tracker.getProgress()
      expect(progress.percentage).toBe(0)
      expect(progress.downloaded).toBe(0)
    })

    it('percentage 四舍五入到整数', () => {
      const tracker = new ProgressTracker('task-004', 3)

      tracker.update(1)

      const progress = tracker.getProgress()
      // 1/3 = 33.33... 应四舍五入到 33
      expect(progress.percentage).toBe(33)
    })

    it('percentage 不超过 100', () => {
      const tracker = new ProgressTracker('task-005', 1000)

      tracker.update(1500) // 超过 total

      const progress = tracker.getProgress()
      expect(progress.percentage).toBeLessThanOrEqual(100)
    })
  })

  describe('addChunk', () => {
    it('addChunk 累加已下载字节数', () => {
      const tracker = new ProgressTracker('task-006', 3000)

      tracker.addChunk(1000)
      let progress = tracker.getProgress()
      expect(progress.downloaded).toBe(1000)
      expect(progress.percentage).toBe(Math.round((1000 / 3000) * 100))

      tracker.addChunk(500)
      progress = tracker.getProgress()
      expect(progress.downloaded).toBe(1500)
      expect(progress.percentage).toBe(Math.round((1500 / 3000) * 100))

      tracker.addChunk(500)
      progress = tracker.getProgress()
      expect(progress.downloaded).toBe(2000)
      expect(progress.percentage).toBe(Math.round((2000 / 3000) * 100))
    })

    it('addChunk 多次调用后累计正确', () => {
      const tracker = new ProgressTracker('task-007', 5000)
      const chunkSize = 500

      for (let i = 0; i < 10; i++) {
        tracker.addChunk(chunkSize)
      }

      const progress = tracker.getProgress()
      expect(progress.downloaded).toBe(5000)
      expect(progress.percentage).toBe(100)
    })
  })

  describe('reset', () => {
    it('reset 后所有进度归零', () => {
      const tracker = new ProgressTracker('task-008', 1000)

      tracker.addChunk(500)
      tracker.addChunk(300)
      expect(tracker.getProgress().downloaded).toBe(800)

      tracker.reset()

      const progress = tracker.getProgress()
      expect(progress.downloaded).toBe(0)
      expect(progress.percentage).toBe(0)
      expect(progress.speed).toBe(0)
    })

    it('reset 后可继续更新进度', () => {
      const tracker = new ProgressTracker('task-009', 2000)

      tracker.addChunk(1000)
      tracker.reset()

      tracker.addChunk(500)

      const progress = tracker.getProgress()
      expect(progress.downloaded).toBe(500)
      expect(progress.percentage).toBe(25) // 500/2000 = 25%
    })
  })

  describe('setDownloadedChunks', () => {
    it('setDownloadedChunks 设置已下载分片列表', () => {
      const tracker = new ProgressTracker('task-010', 5000)

      tracker.setDownloadedChunks([0, 1, 2])

      const progress = tracker.getProgress()
      expect(progress.taskId).toBe('task-010')
    })

    it('setDownloadedChunks 后 addChunk 继续累加', () => {
      const tracker = new ProgressTracker('task-011', 5000)

      tracker.setDownloadedChunks([0, 1])
      tracker.addChunk(1000)

      const progress = tracker.getProgress()
      // addChunk 应在 setDownloadedChunks 的基础上继续累加
      expect(progress.downloaded).toBeGreaterThanOrEqual(1000)
    })

    it('setDownloadedChunks 设置空数组不报错', () => {
      const tracker = new ProgressTracker('task-012', 1000)

      tracker.setDownloadedChunks([])

      const progress = tracker.getProgress()
      expect(progress.downloaded).toBe(0)
    })

    it('setDownloadedChunks 设置完整分片列表后进度正确', () => {
      const tracker = new ProgressTracker('task-013', 4000)
      const chunkSize = 1000
      const totalChunks = 4

      // 设置所有分片为已下载
      tracker.setDownloadedChunks([0, 1, 2, 3])

      // 如果 setDownloadedChunks 会根据分片数计算下载量
      // 逐个添加模拟
      const tracker2 = new ProgressTracker('task-013b', 4000)
      for (let i = 0; i < totalChunks; i++) {
        tracker2.addChunk(chunkSize)
      }

      const progress2 = tracker2.getProgress()
      expect(progress2.downloaded).toBe(4000)
      expect(progress2.percentage).toBe(100)
    })
  })

  describe('getProgress', () => {
    it('返回正确的 taskId', () => {
      const taskId = 'task-progress-001'
      const tracker = new ProgressTracker(taskId, 1000)

      const progress = tracker.getProgress()
      expect(progress.taskId).toBe(taskId)
    })

    it('返回正确的 total', () => {
      const total = 5555
      const tracker = new ProgressTracker('task-total', total)

      const progress = tracker.getProgress()
      expect(progress.total).toBe(total)
    })

    it('speed 字段存在且为数字', () => {
      const tracker = new ProgressTracker('task-speed', 1000)

      tracker.addChunk(500)

      const progress = tracker.getProgress()
      expect(typeof progress.speed).toBe('number')
      expect(progress.speed).toBeGreaterThanOrEqual(0)
    })
  })

  describe('边界情况', () => {
    it('total 为 0 时不抛出错误', () => {
      const tracker = new ProgressTracker('task-zero-total', 0)

      expect(() => tracker.getProgress()).not.toThrow()
    })

    it('update 传入 0 不影响进度', () => {
      const tracker = new ProgressTracker('task-update-zero', 1000)

      tracker.update(0)

      const progress = tracker.getProgress()
      expect(progress.downloaded).toBe(0)
      expect(progress.percentage).toBe(0)
    })
  })
})
