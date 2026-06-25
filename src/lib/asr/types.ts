/**
 * ASR（语音识别）类型定义。
 *
 * 与 src/lib/search、src/lib/storage 同范式：一个 provider 接口 + 多实现，
 * 运行时按 ASR_PROVIDER 选定。用于 IM（钉钉/企微）语音消息转文本。
 */

/** 支持的 ASR provider。默认 aliyun（国内可直连、原生吃 amr）。 */
export type AsrProviderId = "aliyun" | "tencent";

/** 入站音频格式。钉钉/企微语音多为 amr；silk 是微信私有编码需转码。 */
export type AudioFormat = "amr" | "silk" | "mp3" | "wav" | "pcm" | "opus";

export interface AsrResult {
  /** 转写文本（已 trim）。 */
  text: string;
  /** 置信度 0~1。provider 不返回时给经验值 0.8。 */
  confidence: number;
  /** 音频时长（毫秒），provider 返回则带上。 */
  durationMs?: number;
  /** 实际使用的 provider。 */
  provider: AsrProviderId;
  /** 原始响应（调试用）。 */
  raw?: unknown;
}

export interface AsrTranscribeOptions {
  /** 语言，默认 zh。 */
  lang?: "zh" | "en";
  /** 采样率（Hz）。不传则按格式推断（amr→8000，wav/pcm→16000）。 */
  sampleRate?: number;
}

export interface AsrProvider {
  id: AsrProviderId;
  /** provider 原生可直接识别的格式（不在此列表的需先转码）。 */
  supportedFormats: readonly AudioFormat[];
  /** 把音频 buffer 转成文本。 */
  transcribe(
    buffer: Buffer,
    format: AudioFormat,
    opts?: AsrTranscribeOptions,
  ): Promise<AsrResult>;
}

/** provider 未配置（缺 API key/凭证）时抛出，调用方据此回退/降级提示。 */
export class AsrProviderNotConfiguredError extends Error {
  constructor(providerId: AsrProviderId, detail?: string) {
    super(
      `ASR provider "${providerId}" 未配置${detail ? `：${detail}` : ""}`,
    );
    this.name = "AsrProviderNotConfiguredError";
  }
}

/** 格式不被任一 provider 直接支持且无可用转码器时抛出。 */
export class AsrUnsupportedFormatError extends Error {
  constructor(format: AudioFormat, detail?: string) {
    super(`音频格式 "${format}" 暂不支持${detail ? `：${detail}` : ""}`);
    this.name = "AsrUnsupportedFormatError";
  }
}
