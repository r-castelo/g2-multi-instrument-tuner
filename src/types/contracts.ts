export type Unsubscribe = () => void;

export type AppMode =
  | "BOOT"
  | "TUNING"
  | "MENU_INSTRUMENT"
  | "MENU_TUNING"
  | "ERROR"
  | "STOPPED";

export type GestureKind =
  | "SCROLL_FWD"
  | "SCROLL_BACK"
  | "TAP"
  | "DOUBLE_TAP"
  | "FOREGROUND_ENTER"
  | "FOREGROUND_EXIT";

export interface GestureEvent {
  kind: GestureKind;
  listIndex?: number;
}

export type InstrumentId = "guitar" | "bass" | "ukulele";

export type TuningId =
  | "gtr_standard"
  | "gtr_drop_d"
  | "gtr_open_g"
  | "gtr_dadgad"
  | "bass_standard_4"
  | "uke_standard_c6";

export interface TuningSelection {
  instrument: InstrumentId;
  tuning: TuningId;
}

export interface TuningString {
  label: string;
  frequencyHz: number;
}

export interface TuningDefinition {
  id: TuningId;
  instrument: InstrumentId;
  name: string;
  strings: readonly TuningString[];
}

export type AudioSource = "bridge_pcm" | "web_mic";

export interface PitchFrame {
  samples: Float32Array;
  sampleRateHz: number;
  tsMs: number;
  source: AudioSource;
}

export type AudioStatusKind =
  | "idle"
  | "starting"
  | "bridge_listening"
  | "bridge_active"
  | "bridge_timeout"
  | "web_requesting"
  | "web_active"
  | "needs_user_resume"
  | "error"
  | "stopped";

export interface AudioStatus {
  kind: AudioStatusKind;
  source?: AudioSource;
  message?: string;
}

export interface PlatformCapabilities {
  bridgeAudioAvailable: boolean;
  webMicAvailable: boolean;
  audioContextNeedsUserResume: boolean;
}

export type TuningQuality = "good" | "weak" | "none";

export interface TunerReading {
  detectedFrequencyHz: number;
  detectedNote: string;
  targetStringName: string;
  targetFrequencyHz: number;
  cents: number;
  inTune: boolean;
  quality: TuningQuality;
  source: AudioSource;
}

export interface TunerViewModel {
  content: string;
  status: string;
}

export interface GlassAdapter {
  connect(): Promise<void>;
  onGesture(handler: (event: GestureEvent) => void): Unsubscribe;
  showTuner(view: TunerViewModel): Promise<void>;
  updateTuner(view: TunerViewModel): Promise<void>;
  showListMenu(items: string[], statusText: string): Promise<void>;
  showError(text: string): Promise<void>;
}

export interface AudioInputAdapter {
  start(): Promise<void>;
  stop(): Promise<void>;
  onFrame(handler: (frame: PitchFrame) => void): Unsubscribe;
  onStatus(handler: (status: AudioStatus) => void): Unsubscribe;
}

export interface PhoneView {
  setSelection(selection: TuningSelection): void;
  setAvailableTunings(tunings: readonly TuningDefinition[]): void;
  setAudioStatus(status: AudioStatus): void;
  setReading(reading: TunerReading | null): void;
  setError(message: string | null): void;
  setNeedsAudioEnable(needsEnable: boolean): void;
}

export interface PhoneActions {
  onSelectInstrument: (instrument: InstrumentId) => void;
  onSelectTuning: (tuningId: TuningId) => void;
  onRetryAudio: () => void;
  onEnableAudio: () => void;
}

export interface PitchDetection {
  frequencyHz: number;
  confidence: number;
  rms: number;
}
