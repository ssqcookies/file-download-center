/**
 * 大文件下载中心 - 类型定义
 */

export interface Chunk {
  /** 分片序号（从 0 开始） */
  index: number;
  /** 分片唯一 ID（UUID） */
  id: string;
  /** 分片数据 */
  data: ArrayBuffer;
  /** 分片大小（字节） */
  size: number;
  /** 文件起始位置（字节） */
  start: number;
  /** 文件结束位置（字节） */
  end: number;
}

export interface DownloadTask {
  id: string;
  url: string;
  fileName: string;
  /** 文件总大小（字节） */
  fileSize: number;
  /** 分片大小（字节） */
  chunkSize: number;
  /** 总分片数 */
  totalChunks: number;
  status: DownloadStatus;
  /** 已下载的分片序号列表 */
  downloadedChunks: number[];
  /** 下载进度（0-100） */
  progress: number;
}

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadOptions {
  /** 分片大小（字节），默认 2MB */
  chunkSize?: number;
  /** 并发下载数，默认 3 */
  concurrency?: number;
  /** 最大重试次数，默认 3 */
  maxRetries?: number;
  /** 重试延迟（毫秒），默认 1000 */
  retryDelay?: number;
}

export interface ProgressInfo {
  taskId: string;
  /** 文件总大小（字节） */
  total: number;
  /** 已下载大小（字节） */
  downloaded: number;
  /** 下载百分比（0-100，四舍五入） */
  percentage: number;
  /** 下载速度（字节/秒） */
  speed: number;
}
