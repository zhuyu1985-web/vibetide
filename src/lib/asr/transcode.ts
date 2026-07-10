import { AsrUnsupportedFormatError, type AudioFormat } from "./types";

/**
 * 确保音频格式可被 ASR provider 消费。
 *
 * - amr / wav / pcm / mp3 / opus：阿里云 NLS 一句话识别原生支持，直透。
 * - silk：微信私有编码，云端 ASR 不直吃，需先转 pcm/wav。P0 暂不内置转码器
 *   （silk-wasm/ffmpeg 在 Serverless 的可用性需先验证），命中时抛清晰错误，
 *   由上层降级为"请改用文字"。二期接入 silk-wasm 后在此补转码分支。
 */
export async function ensureAsrFormat(
  buffer: Buffer,
  format: AudioFormat,
): Promise<{ buffer: Buffer; format: AudioFormat }> {
  if (format === "silk") {
    throw new AsrUnsupportedFormatError(
      "silk",
      "微信私有编码暂未接入转码（二期 silk-wasm），请改用文字消息",
    );
  }
  // 其余格式 ASR provider 原生支持，直透
  return { buffer, format };
}

/** 按格式推断默认采样率（Hz）。amr-nb 为 8k，wav/pcm 常见 16k。 */
export function defaultSampleRate(format: AudioFormat): number {
  return format === "amr" ? 8000 : 16000;
}
