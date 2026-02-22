import { waitForEvenAppBridge, type EvenAppBridge } from "@evenrealities/even_hub_sdk";
import { AUDIO, TIMING } from "../config/constants";
import type {
  AudioInputAdapter,
  AudioSource,
  AudioStatus,
  PitchFrame,
  PlatformCapabilities,
  Unsubscribe,
} from "../types/contracts";

interface AudioAdapterOptions {
  capabilities: PlatformCapabilities;
  frameSize?: number;
  frameHop?: number;
  bridgeFirstFrameTimeoutMs?: number;
  webPollMs?: number;
}

const BRIDGE_SAMPLE_RATE_HZ = 16_000;

export class CompositeAudioInputAdapter implements AudioInputAdapter {
  private readonly capabilities: PlatformCapabilities;
  private readonly frameSize: number;
  private readonly frameHop: number;
  private readonly bridgeFirstFrameTimeoutMs: number;
  private readonly webPollMs: number;

  private readonly frameHandlers = new Set<(frame: PitchFrame) => void>();
  private readonly statusHandlers = new Set<(status: AudioStatus) => void>();

  private bridge: EvenAppBridge | null = null;
  private bridgeUnsubscribe: Unsubscribe | null = null;
  private bridgeAudioOpen = false;
  private bridgeCarry: number[] = [];
  private firstBridgeFrameResolve: (() => void) | null = null;

  private webStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaNode: MediaStreamAudioSourceNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private activeSource: AudioSource | null = null;
  private startPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;

  constructor(options: AudioAdapterOptions) {
    this.capabilities = options.capabilities;
    this.frameSize = options.frameSize ?? AUDIO.FRAME_SIZE;
    this.frameHop = Math.max(1, Math.min(
      options.frameHop ?? AUDIO.BRIDGE_FRAME_HOP,
      this.frameSize,
    ));
    this.bridgeFirstFrameTimeoutMs =
      options.bridgeFirstFrameTimeoutMs ?? TIMING.BRIDGE_FIRST_AUDIO_TIMEOUT_MS;
    this.webPollMs = options.webPollMs ?? AUDIO.WEB_POLL_MS;
  }

  onFrame(handler: (frame: PitchFrame) => void): Unsubscribe {
    this.frameHandlers.add(handler);
    return () => {
      this.frameHandlers.delete(handler);
    };
  }

  onStatus(handler: (status: AudioStatus) => void): Unsubscribe {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  async start(): Promise<void> {
    if (this.activeSource) return;
    if (this.startPromise) return this.startPromise;

    this.startPromise = this.startInternal().finally(() => {
      this.startPromise = null;
    });

    return this.startPromise;
  }

  async stop(): Promise<void> {
    if (this.stopPromise) return this.stopPromise;

    this.stopPromise = this.stopInternal().finally(() => {
      this.stopPromise = null;
    });

    return this.stopPromise;
  }

  private async startInternal(): Promise<void> {
    await this.stopInternal(false);
    this.emitStatus({ kind: "starting" });

    if (this.capabilities.bridgeAudioAvailable) {
      const bridgeOk = await this.tryStartBridgeAudio();
      if (bridgeOk) {
        return;
      }
    }

    if (this.capabilities.webMicAvailable) {
      const webOk = await this.tryStartWebAudio();
      if (webOk) {
        return;
      }
    }

    this.emitStatus({ kind: "error", message: "No available microphone path" });
    throw new Error("Unable to start bridge or web microphone audio");
  }

  private async stopInternal(emit = true): Promise<void> {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    this.analyserNode?.disconnect();
    this.mediaNode?.disconnect();
    this.analyserNode = null;
    this.mediaNode = null;

    if (this.audioContext) {
      await this.audioContext.close().catch(() => undefined);
      this.audioContext = null;
    }

    if (this.webStream) {
      for (const track of this.webStream.getTracks()) {
        track.stop();
      }
      this.webStream = null;
    }

    await this.closeBridgeAudio();

    this.bridgeCarry = [];
    this.activeSource = null;

    if (emit) {
      this.emitStatus({ kind: "stopped" });
    }
  }

  private async tryStartBridgeAudio(): Promise<boolean> {
    try {
      this.bridge = await waitForEvenAppBridge();
      this.emitStatus({ kind: "bridge_listening", source: "bridge_pcm" });

      const firstFramePromise = new Promise<void>((resolve) => {
        this.firstBridgeFrameResolve = resolve;
      });

      this.bridgeUnsubscribe?.();
      this.bridgeUnsubscribe = this.bridge.onEvenHubEvent((event) => {
        const pcmRaw = event.audioEvent?.audioPcm;
        if (!pcmRaw) return;

        const bytes = normalizePcmBytes(pcmRaw);
        if (bytes.length < 2) return;

        const samples = pcm16LeToFloat32(bytes);
        for (let i = 0; i < samples.length; i += 1) {
          const sample = samples[i] ?? 0;
          this.bridgeCarry.push(sample);
        }

        while (this.bridgeCarry.length >= this.frameSize) {
          const frame = new Float32Array(this.frameSize);
          for (let i = 0; i < this.frameSize; i += 1) {
            frame[i] = this.bridgeCarry[i] ?? 0;
          }

          this.bridgeCarry = this.bridgeCarry.slice(this.frameHop);
          this.emitFrame({
            samples: frame,
            sampleRateHz: BRIDGE_SAMPLE_RATE_HZ,
            tsMs: Date.now(),
            source: "bridge_pcm",
          });

          if (this.firstBridgeFrameResolve) {
            this.firstBridgeFrameResolve();
            this.firstBridgeFrameResolve = null;
          }
        }
      });

      const opened = await this.bridge.audioControl(true);
      if (!opened) {
        throw new Error("bridge.audioControl(true) returned false");
      }

      this.bridgeAudioOpen = true;

      await Promise.race([
        firstFramePromise,
        timeoutReject(this.bridgeFirstFrameTimeoutMs, "Bridge audio timed out"),
      ]);

      this.activeSource = "bridge_pcm";
      this.emitStatus({ kind: "bridge_active", source: "bridge_pcm" });
      return true;
    } catch {
      this.emitStatus({ kind: "bridge_timeout", source: "bridge_pcm" });
      await this.closeBridgeAudio();
      return false;
    }
  }

  private async tryStartWebAudio(): Promise<boolean> {
    if (typeof window === "undefined" || !window.navigator?.mediaDevices) {
      this.emitStatus({ kind: "error", message: "Web microphone APIs unavailable" });
      return false;
    }

    try {
      this.emitStatus({ kind: "web_requesting", source: "web_mic" });

      this.webStream = await window.navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const AudioContextCtor = window.AudioContext ?? (window as typeof window & {
        webkitAudioContext?: typeof AudioContext;
      }).webkitAudioContext;

      if (!AudioContextCtor) {
        throw new Error("AudioContext unavailable in this WebView");
      }

      this.audioContext = new AudioContextCtor();
      this.mediaNode = this.audioContext.createMediaStreamSource(this.webStream);
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = Math.max(8192, this.frameSize * 2);
      this.mediaNode.connect(this.analyserNode);

      if (this.audioContext.state === "suspended") {
        this.emitStatus({
          kind: "needs_user_resume",
          source: "web_mic",
          message: "Audio context suspended",
        });

        await this.audioContext.resume().catch(() => undefined);

        if (this.audioContext.state === "suspended") {
          this.emitStatus({
            kind: "needs_user_resume",
            source: "web_mic",
            message: "Tap Enable Mic on phone",
          });
          this.activeSource = "web_mic";
          return true;
        }
      }

      const readBuffer = new Float32Array(this.analyserNode.fftSize);
      this.pollTimer = setInterval(() => {
        if (!this.analyserNode) return;

        this.analyserNode.getFloatTimeDomainData(readBuffer);

        const start = Math.max(0, readBuffer.length - this.frameSize);
        const frame = readBuffer.slice(start);

        this.emitFrame({
          samples: frame,
          sampleRateHz: this.audioContext?.sampleRate ?? 44_100,
          tsMs: Date.now(),
          source: "web_mic",
        });
      }, this.webPollMs);

      this.activeSource = "web_mic";
      this.emitStatus({ kind: "web_active", source: "web_mic" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.emitStatus({ kind: "error", source: "web_mic", message });
      await this.stopInternal(false);
      return false;
    }
  }

  private async closeBridgeAudio(): Promise<void> {
    this.firstBridgeFrameResolve = null;

    if (this.bridge && this.bridgeAudioOpen) {
      await this.bridge.audioControl(false).catch(() => undefined);
    }

    this.bridgeAudioOpen = false;

    this.bridgeUnsubscribe?.();
    this.bridgeUnsubscribe = null;
  }

  private emitFrame(frame: PitchFrame): void {
    for (const handler of this.frameHandlers) {
      handler(frame);
    }
  }

  private emitStatus(status: AudioStatus): void {
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }
}

function normalizePcmBytes(value: Uint8Array | number[] | string): Uint8Array {
  if (value instanceof Uint8Array) {
    return value;
  }

  if (Array.isArray(value)) {
    return Uint8Array.from(value);
  }

  // Base64 fallback.
  if (typeof atob === "function") {
    const binary = atob(value);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  return new Uint8Array();
}

function pcm16LeToFloat32(bytes: Uint8Array): Float32Array {
  const sampleCount = Math.floor(bytes.length / 2);
  const out = new Float32Array(sampleCount);

  for (let i = 0; i < sampleCount; i += 1) {
    const lo = bytes[i * 2] ?? 0;
    const hi = bytes[i * 2 + 1] ?? 0;
    let value = (hi << 8) | lo;

    if (value & 0x8000) {
      value -= 0x10000;
    }

    out[i] = value / 32768;
  }

  return out;
}

function timeoutReject(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}
