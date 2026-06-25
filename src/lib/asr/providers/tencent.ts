import {
  AsrProviderNotConfiguredError,
  type AsrProvider,
  type AsrResult,
  type AudioFormat,
} from "../types";

/**
 * 腾讯云 ASR provider —— P0 仅占位（保持多厂家可配置的抽象）。
 *
 * 腾讯云一句话识别走 TC3-HMAC-SHA256 签名，待二期补全实现。
 * 本期请使用 ASR_PROVIDER=aliyun。设为 tencent 时给出清晰报错而非静默失败。
 */
export const tencentProvider: AsrProvider = {
  id: "tencent",
  supportedFormats: ["amr", "wav", "pcm", "mp3"],

  async transcribe(
    _buffer: Buffer,
    _format: AudioFormat,
  ): Promise<AsrResult> {
    throw new AsrProviderNotConfiguredError(
      "tencent",
      "腾讯云 ASR 尚未实现（P0 仅接入阿里云），请设置 ASR_PROVIDER=aliyun",
    );
  },
};
