/**
 * 单分片下载器
 *
 * 使用 HTTP Range header 下载文件的指定分片范围。
 */

import type { Chunk } from '@/types';

export type FetchImpl = (url: string, options?: RequestInit) => Promise<Response>;

export class ChunkDownloader {
  private fetchImpl: FetchImpl;

  constructor(fetchImpl: FetchImpl) {
    this.fetchImpl = fetchImpl;
  }

  /**
   * 下载指定分片
   * @param url 文件 URL
   * @param chunk 分片信息（包含 start/end 字节范围）
   * @returns 包含下载数据的分片
   */
  async download(url: string, chunk: Chunk): Promise<Chunk> {
    const rangeHeader = `bytes=${chunk.start}-${chunk.end}`;

    const response = await this.fetchImpl(url, {
      headers: { Range: rangeHeader },
    });

    if (!response.ok && response.status !== 206) {
      throw new Error(
        `Failed to download chunk ${chunk.index}: HTTP ${response.status}`,
      );
    }

    const data = await response.arrayBuffer();

    return {
      ...chunk,
      data,
      size: data.byteLength,
    };
  }
}
