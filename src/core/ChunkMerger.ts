/**
 * 分片合并器
 *
 * 将多个已下载的分片按序号合并为完整的 Blob。
 */

import type { Chunk } from '@/types';

export class ChunkMerger {
  /**
   * 合并分片为 Blob
   * @param chunks 已下载的分片列表
   * @param fileName 文件名（用于日志，不影响 Blob 内容）
   * @returns 合并后的 Blob
   */
  merge(chunks: Chunk[], fileName: string): Blob {
    const sorted = [...chunks].sort((a, b) => a.index - b.index);
    const blobParts: ArrayBuffer[] = sorted.map((chunk) => chunk.data);
    return new Blob(blobParts, { type: 'application/octet-stream' });
  }
}
