/**
 * 进度追踪器
 *
 * 追踪下载进度，计算百分比和速度。
 */

import type { ProgressInfo } from '@/types';

export class ProgressTracker {
  private taskId: string;
  private total: number;
  private downloadedBytes = 0;
  private startTime: number;
  private lastUpdateTime: number;
  private lastDownloadedBytes = 0;
  private speed = 0;
  private downloadedChunkIndices: number[] = [];

  constructor(taskId: string, total: number) {
    this.taskId = taskId;
    this.total = total;
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
  }

  /**
   * 设置已下载字节数（绝对值）
   */
  update(downloadedBytes: number): void {
    this.lastDownloadedBytes = this.downloadedBytes;
    this.downloadedBytes = downloadedBytes;
    this.updateSpeed();
  }

  /**
   * 增加一个已下载分片的大小（增量）
   */
  addChunk(size: number): void {
    this.downloadedBytes += size;
    this.updateSpeed();
  }

  /**
   * 设置已下载的分片序号列表（用于断点续传初始化）
   */
  setDownloadedChunks(indices: number[]): void {
    this.downloadedChunkIndices = [...indices];
  }

  /**
   * 获取当前进度信息
   */
  getProgress(): ProgressInfo {
    const percentage =
      this.total > 0
        ? Math.min(Math.round((this.downloadedBytes / this.total) * 100), 100)
        : 0;

    return {
      taskId: this.taskId,
      total: this.total,
      downloaded: this.downloadedBytes,
      percentage,
      speed: this.speed,
    };
  }

  /**
   * 重置进度
   */
  reset(): void {
    this.downloadedBytes = 0;
    this.lastDownloadedBytes = 0;
    this.speed = 0;
    this.downloadedChunkIndices = [];
    this.startTime = Date.now();
    this.lastUpdateTime = this.startTime;
  }

  private updateSpeed(): void {
    const now = Date.now();
    const elapsed = (now - this.lastUpdateTime) / 1000;

    if (elapsed > 0) {
      const delta = this.downloadedBytes - this.lastDownloadedBytes;
      this.speed = Math.max(0, delta / elapsed);
    }

    this.lastDownloadedBytes = this.downloadedBytes;
    this.lastUpdateTime = now;
  }
}
