/**
 * 下载组合式函数
 *
 * 提供 Vue 响应式的下载任务管理接口。
 */

import { ref } from 'vue';
import { DownloadManager } from '@/core/DownloadManager';
import type { DownloadStatus } from '@/types';

/**
 * UI 层使用的下载任务类型
 * fileSize 单位为 MB（便于展示），speed 单位为 MB/s
 */
export interface DownloadTask {
  id: string;
  url: string;
  fileName: string;
  /** 文件大小（MB） */
  fileSize: number;
  status: DownloadStatus;
  /** 下载进度（0-100） */
  progress: number;
  /** 下载速度（MB/s） */
  speed: number;
}

const BYTES_PER_MB = 1024 * 1024;

export function useDownload() {
  const tasks = ref<DownloadTask[]>([]);
  const manager = new DownloadManager();

  // 监听进度更新
  manager.onProgress((info) => {
    const task = tasks.value.find((t) => t.id === info.taskId);
    if (task) {
      task.progress = info.percentage;
      task.speed = info.speed / BYTES_PER_MB;
    }
  });

  /**
   * 开始下载
   * @param url 下载地址
   * @param fileName 文件名
   * @param fileSizeMB 文件大小（MB）
   */
  const startDownload = (
    url: string,
    fileName: string,
    fileSizeMB: number,
  ): void => {
    const fileSizeBytes = fileSizeMB * BYTES_PER_MB;
    const chunkSize = 2 * BYTES_PER_MB; // 2MB
    const totalChunks = Math.ceil(fileSizeBytes / chunkSize);
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const coreTask = {
      id: taskId,
      url,
      fileName,
      fileSize: fileSizeBytes,
      chunkSize,
      totalChunks,
      status: 'pending' as DownloadStatus,
      downloadedChunks: [],
      progress: 0,
    };

    const uiTask: DownloadTask = {
      id: taskId,
      url,
      fileName,
      fileSize: fileSizeMB,
      status: 'pending',
      progress: 0,
      speed: 0,
    };

    tasks.value.push(uiTask);

    // 更新状态为下载中
    uiTask.status = 'downloading';

    manager
      .start(coreTask)
      .then(() => {
        const result = manager.getTask(taskId);
        if (result) {
          uiTask.status = result.status;
          uiTask.progress = result.progress;
        }
      })
      .catch(() => {
        uiTask.status = 'error';
      });
  };

  /**
   * 暂停下载
   */
  const pauseTask = (taskId: string): void => {
    manager.pause(taskId);
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) {
      task.status = 'paused';
    }
  };

  /**
   * 恢复下载（断点续传）
   */
  const resumeTask = (taskId: string): void => {
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) {
      task.status = 'downloading';
    }

    manager
      .resume(taskId)
      .then(() => {
        const result = manager.getTask(taskId);
        const t = tasks.value.find((item) => item.id === taskId);
        if (t && result) {
          t.status = result.status;
          t.progress = result.progress;
        }
      })
      .catch(() => {
        const t = tasks.value.find((item) => item.id === taskId);
        if (t) {
          t.status = 'error';
        }
      });
  };

  /**
   * 取消下载
   */
  const cancelTask = (taskId: string): void => {
    manager.cancel(taskId);
    const task = tasks.value.find((t) => t.id === taskId);
    if (task) {
      task.status = 'error';
    }
  };

  return {
    tasks,
    startDownload,
    pauseTask,
    resumeTask,
    cancelTask,
  };
}
