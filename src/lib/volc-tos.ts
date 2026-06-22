/**
 * @deprecated 请改 import "@/lib/storage"（provider 抽象 barrel）。
 * 保留此文件作为 thin re-export，保证任何遗漏的旧 import 路径不破。
 */
export {
  generateUploadUrl,
  generateDownloadUrl,
  getPublicUrl,
  putObject,
  deleteObject,
  defaultBucket,
} from "@/lib/storage";
