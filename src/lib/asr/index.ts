import { getActiveAsrProvider } from "./config";
import { ensureAsrFormat } from "./transcode";
import { aliyunProvider } from "./providers/aliyun";
import { tencentProvider } from "./providers/tencent";
import type {
  AsrProvider,
  AsrProviderId,
  AsrResult,
  AsrTranscribeOptions,
  AudioFormat,
} from "./types";

export type {
  AsrProvider,
  AsrProviderId,
  AsrResult,
  AsrTranscribeOptions,
  AudioFormat,
} from "./types";
export {
  AsrProviderNotConfiguredError,
  AsrUnsupportedFormatError,
} from "./types";
export {
  getActiveAsrProvider,
  isAsrProviderConfigured,
  getAsrMinConfidence,
} from "./config";

const REGISTRY: Record<AsrProviderId, AsrProvider> = {
  aliyun: aliyunProvider,
  tencent: tencentProvider,
};

let lastLoggedProvider: AsrProviderId | null = null;

/**
 * 统一 ASR 入口：把音频 buffer 转成文本。
 *
 * 1. ensureAsrFormat：需转码的格式（silk）先转/或抛错；其余直透。
 * 2. 按 ASR_PROVIDER 选 provider（可用 forceProvider 覆盖），默认 aliyun。
 */
export async function transcribeAudio(
  buffer: Buffer,
  format: AudioFormat,
  opts?: AsrTranscribeOptions & { forceProvider?: AsrProviderId },
): Promise<AsrResult> {
  const { buffer: ready, format: readyFmt } = await ensureAsrFormat(buffer, format);
  const providerId = opts?.forceProvider ?? getActiveAsrProvider();
  const provider = REGISTRY[providerId];
  if (!provider) {
    throw new Error(`Unknown ASR provider: ${providerId}`);
  }
  if (!opts?.forceProvider && lastLoggedProvider !== providerId) {
    lastLoggedProvider = providerId;
    console.info(`[asr] active provider: ${providerId}`);
  }
  return provider.transcribe(ready, readyFmt, {
    lang: opts?.lang ?? "zh",
    sampleRate: opts?.sampleRate,
  });
}
