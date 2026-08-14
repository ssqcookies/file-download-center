<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDownload } from '@/composables/useDownload'
import DownloadItem from './DownloadItem.vue'

const { tasks, startDownload, pauseTask, resumeTask, cancelTask } = useDownload()

const url = ref('')
const fileName = ref('')
const fileSize = ref('')

const canSubmit = computed(
  () => url.value.trim() !== '' && fileName.value.trim() !== '' && Number(fileSize.value) > 0
)

const handleAdd = () => {
  if (!canSubmit.value) return
  startDownload(url.value.trim(), fileName.value.trim(), Number(fileSize.value))
  url.value = ''
  fileName.value = ''
  fileSize.value = ''
}
</script>

<template>
  <div class="download-list">
    <form class="form" @submit.prevent="handleAdd">
      <div class="form-row">
        <input
          v-model="url"
          type="url"
          class="input"
          placeholder="下载地址 URL"
          required
        />
      </div>
      <div class="form-row form-row-split">
        <input
          v-model="fileName"
          type="text"
          class="input"
          placeholder="文件名"
          required
        />
        <input
          v-model="fileSize"
          type="number"
          min="1"
          step="1"
          class="input input-size"
          placeholder="文件大小 (MB)"
          required
        />
        <button type="submit" class="btn-add" :disabled="!canSubmit">添加下载</button>
      </div>
    </form>

    <div class="list">
      <DownloadItem
        v-for="task in tasks"
        :key="task.id"
        :task="task"
        @pause="pauseTask(task.id)"
        @resume="resumeTask(task.id)"
        @cancel="cancelTask(task.id)"
      />
      <p v-if="tasks.length === 0" class="empty">暂无下载任务，请在上方添加。</p>
    </div>
  </div>
</template>

<style scoped>
.download-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px;
  background-color: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row-split {
  flex-direction: row;
  align-items: stretch;
  flex-wrap: wrap;
}

.input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  font-size: 14px;
  color: #1f2937;
  background-color: #f9fafb;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.input::placeholder {
  color: #9ca3af;
}

.input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
  background-color: #ffffff;
}

.input-size {
  flex: 0 0 160px;
}

.btn-add {
  flex: 0 0 auto;
  padding: 9px 18px;
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
  background-color: #2563eb;
  border: 1px solid #2563eb;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}

.btn-add:hover:not(:disabled) {
  background-color: #1d4ed8;
}

.btn-add:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty {
  margin: 0;
  padding: 32px 16px;
  text-align: center;
  font-size: 14px;
  color: #9ca3af;
  background-color: #ffffff;
  border: 1px dashed #e5e7eb;
  border-radius: 10px;
}
</style>
