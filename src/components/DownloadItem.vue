<script setup lang="ts">
import type { DownloadTask } from '@/composables/useDownload'
import DownloadButton from './DownloadButton.vue'

defineProps<{
  task: DownloadTask
}>()

const emit = defineEmits<{
  (e: 'pause'): void
  (e: 'resume'): void
  (e: 'cancel'): void
}>()

const statusText: Record<DownloadTask['status'], string> = {
  pending: '等待中',
  downloading: '下载中',
  paused: '已暂停',
  completed: '已完成',
  error: '错误'
}

const formatSpeed = (speed: number): string => {
  if (!speed || speed <= 0) return '-'
  if (speed >= 1) return `${speed.toFixed(2)} MB/s`
  return `${(speed * 1024).toFixed(0)} KB/s`
}
</script>

<template>
  <div class="item">
    <div class="item-header">
      <span class="file-name" :title="task.fileName">{{ task.fileName }}</span>
      <span class="status-badge" :class="`status-${task.status}`">
        {{ statusText[task.status] }}
      </span>
    </div>

    <div class="progress-wrap">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :class="`fill-${task.status}`"
          :style="{ width: `${Math.min(Math.max(task.progress, 0), 100)}%` }"
        ></div>
      </div>
      <span class="progress-text">{{ task.progress.toFixed(1) }}%</span>
    </div>

    <div class="item-footer">
      <span class="meta">
        <span class="speed">速度: {{ formatSpeed(task.speed) }}</span>
        <span class="size">{{ task.fileSize }} MB</span>
      </span>
      <div class="actions">
        <DownloadButton
          v-if="task.status === 'downloading'"
          label="暂停"
          type="warning"
          @click="emit('pause')"
        />
        <DownloadButton
          v-if="task.status === 'paused' || task.status === 'error'"
          label="恢复"
          type="primary"
          @click="emit('resume')"
        />
        <DownloadButton
          v-if="task.status !== 'completed'"
          label="取消"
          type="danger"
          @click="emit('cancel')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.item {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background-color: #ffffff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.file-name {
  font-size: 15px;
  font-weight: 600;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  flex-shrink: 0;
  padding: 2px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 999px;
  line-height: 18px;
}

/* pending: 灰色 */
.status-pending {
  background-color: #e5e7eb;
  color: #4b5563;
}
/* downloading: 蓝色 */
.status-downloading {
  background-color: #dbeafe;
  color: #1d4ed8;
}
/* paused: 黄色 */
.status-paused {
  background-color: #fef3c7;
  color: #b45309;
}
/* completed: 绿色 */
.status-completed {
  background-color: #d1fae5;
  color: #047857;
}
/* error: 红色 */
.status-error {
  background-color: #fee2e2;
  color: #b91c1c;
}

.progress-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background-color: #f3f4f6;
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.2s ease;
}

.fill-pending {
  background-color: #9ca3af;
}
.fill-downloading {
  background-color: #3b82f6;
}
.fill-paused {
  background-color: #f59e0b;
}
.fill-completed {
  background-color: #10b981;
}
.fill-error {
  background-color: #ef4444;
}

.progress-text {
  flex-shrink: 0;
  width: 52px;
  text-align: right;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: #4b5563;
}

.item-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 16px;
  font-size: 13px;
  color: #6b7280;
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
