<script setup lang="ts">
import DownloadList from '@/components/DownloadList.vue'
</script>

<template>
  <div class="app">
    <header class="app-header">
      <h1 class="app-title">大文件下载中心</h1>
      <p class="app-subtitle">高效管理大文件下载任务</p>
    </header>
    <main class="app-main">
      <DownloadList />
    </main>
  </div>
</template>

<style scoped>
.app {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 16px 48px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue',
    Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
  color: #1f2937;
}

.app-header {
  text-align: center;
  margin-bottom: 24px;
}

.app-title {
  font-size: 28px;
  font-weight: 700;
  margin: 0 0 8px;
  color: #111827;
}

.app-subtitle {
  margin: 0;
  font-size: 14px;
  color: #6b7280;
}

.app-main {
  width: 100%;
}
</style>
