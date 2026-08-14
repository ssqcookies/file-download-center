export interface Chunk {
  index: number;
  id: string;
  data: ArrayBuffer;
  size: number;
  start: number;
  end: number;
}

export interface DownloadTask {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  chunkSize: number;
  totalChunks: number;
  status: DownloadStatus;
  downloadedChunks: number[];
  progress: number;
}

export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'error';

export interface DownloadOptions {
  chunkSize?: number;
  concurrency?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface ProgressInfo {
  taskId: string;
  total: number;
  downloaded: number;
  percentage: number;
  speed: number;
}
