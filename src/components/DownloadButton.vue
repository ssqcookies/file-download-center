<script setup lang="ts">
withDefaults(
  defineProps<{
    label: string
    type?: 'primary' | 'warning' | 'danger' | 'default'
    disabled?: boolean
  }>(),
  {
    type: 'default',
    disabled: false
  }
)

defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <button
    class="btn"
    :class="`btn-${type}`"
    :disabled="disabled"
    @click="$emit('click')"
  >
    {{ label }}
  </button>
</template>

<style scoped>
.btn {
  --btn-bg: #f3f4f6;
  --btn-border: #d1d5db;
  --btn-color: #374151;

  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  border: 1px solid var(--btn-border);
  border-radius: 6px;
  background-color: var(--btn-bg);
  color: var(--btn-color);
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
  white-space: nowrap;
}

.btn:hover:not(:disabled) {
  opacity: 0.9;
}

.btn:active:not(:disabled) {
  transform: translateY(1px);
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  --btn-bg: #2563eb;
  --btn-border: #2563eb;
  --btn-color: #ffffff;
}

.btn-warning {
  --btn-bg: #f59e0b;
  --btn-border: #f59e0b;
  --btn-color: #ffffff;
}

.btn-danger {
  --btn-bg: #ef4444;
  --btn-border: #ef4444;
  --btn-color: #ffffff;
}

.btn-default {
  --btn-bg: #f3f4f6;
  --btn-border: #d1d5db;
  --btn-color: #374151;
}
</style>
