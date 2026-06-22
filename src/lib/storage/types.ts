/**
 * 对象存储 provider 统一接口。
 * 签名与原 volc-tos.ts 导出完全一致，调用方零改动。
 */
export interface StorageProvider {
  /**
   * 生成预签名上传 URL（客户端直接 PUT 文件到此 URL）
   * @param objectKey  对象键
   * @param contentType MIME 类型（保留参数，TOS 预签名不在 URL 中指定 Content-Type）
   * @param expiresIn  过期秒数，默认 3600
   */
  generateUploadUrl(objectKey: string, contentType: string, expiresIn?: number): string;

  /**
   * 生成预签名下载 URL
   * @param objectKey  对象键
   * @param expiresIn  过期秒数，默认 3600
   */
  generateDownloadUrl(objectKey: string, expiresIn?: number): string;

  /**
   * 获取公开访问 URL（需桶设置为公开读）
   */
  getPublicUrl(objectKey: string): string;

  /**
   * 服务端直接上传 Buffer（AIGC 转存专用）。
   * 内部使用「预签名 PUT URL + 原生 fetch」，不走 SDK 上传。
   */
  putObject(objectKey: string, body: Buffer | Uint8Array, contentType: string): Promise<void>;

  /**
   * 删除对象
   */
  deleteObject(objectKey: string): Promise<void>;

  /** 默认存储桶名称 */
  readonly defaultBucket: string;
}
