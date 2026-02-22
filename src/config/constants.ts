import type { InstrumentId, TuningSelection } from "../types/contracts";

export const DISPLAY = {
  WIDTH: 576,
  HEIGHT: 288,
} as const;

export const GLASS_LAYOUT = {
  x: 8,
  y: 4,
  width: 560,
  height: 248,
  statusY: 256,
  statusHeight: 28,
} as const;

export const CONTAINER_IDS = {
  content: 1,
  status: 2,
} as const;

export const CONTAINER_NAMES = {
  content: "content",
  status: "status",
} as const;

export const TEXT_LIMITS = {
  startupOrRebuild: 1000,
  upgrade: 2000,
} as const;

export const TIMING = {
  BRIDGE_TIMEOUT_MS: 15_000,
  REBUILD_RETRY_DELAY_MS: 300,
  SCROLL_COOLDOWN_MS: 300,
  BRIDGE_FIRST_AUDIO_TIMEOUT_MS: 1_500,
  RENDER_INTERVAL_MS: 70,
  STALE_READING_MS: 900,
} as const;

export const AUDIO = {
  FRAME_SIZE: 3072,
  BRIDGE_FRAME_HOP: 768,
  ACQUIRE_CONFIDENCE: 0.45,
  SUSTAIN_CONFIDENCE: 0.2,
  ACQUIRE_RMS: 0.005,
  SUSTAIN_RMS: 0.002,
  WEB_POLL_MS: 50,
} as const;

/** Stricter thresholds for the low-quality glasses bridge mic (16 kHz MEMS). */
export const BRIDGE_AUDIO = {
  ACQUIRE_CONFIDENCE: 0.65,
  SUSTAIN_CONFIDENCE: 0.40,
  ACQUIRE_RMS: 0.008,
  SUSTAIN_RMS: 0.004,
} as const;

export const YIN = {
  MIN_FREQ_HZ: 35,
  MAX_FREQ_HZ: 500,
  THRESHOLD: 0.1,
} as const;

/** More conservative YIN threshold for noisy bridge mic. */
export const BRIDGE_YIN = {
  THRESHOLD: 0.08,
} as const;

export const TUNING = {
  IN_TUNE_CENTS: 5,
  NEAR_TUNE_CENTS: 10,
  BAR_RANGE_CENTS: 50,
  MARK_TUNED_STREAK: 3,
} as const;

export const STORAGE_KEYS = {
  selection: "g2_multi_tuner.selection",
  lastAudioSource: "g2_multi_tuner.last_audio_source",
} as const;

export const DEFAULT_SELECTION: TuningSelection = {
  instrument: "guitar",
  tuning: "gtr_standard",
};

export const INSTRUMENT_LABELS: Record<InstrumentId, string> = {
  guitar: "Guitar",
  bass: "Bass",
  ukulele: "Ukulele",
};

export const APP_TEXT = {
  starting: "Starting tuner...",
  listening: "Listening...",
  pluck: "Pluck a string",
  noSignal: "No stable note detected",
  tapForMenu: "Tap: menu",
  micEnable: "Tap phone button to enable microphone",
  audioError: "Audio unavailable. Use retry on phone.",
} as const;

export const MENU = {
  close: "Close",
  back: "Back",
} as const;

export const UI_GLYPHS = {
  tuned: "*",
} as const;
