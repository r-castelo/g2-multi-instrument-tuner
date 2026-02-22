import {
  APP_TEXT,
  AUDIO,
  DEFAULT_SELECTION,
  MENU,
  STORAGE_KEYS,
  TIMING,
  TUNING,
  YIN,
} from "../config/constants";
import {
  DEFAULT_TUNING_BY_INSTRUMENT,
  getTuningById,
  getTuningsForInstrument,
  normalizeSelection,
} from "../domain/music/tuningCatalog";
import { nearestNote } from "../domain/music/notes";
import { detectPitchYin } from "../domain/pitch/yin";
import { PitchSmoother } from "../domain/pitch/smoothing";
import { selectTargetString } from "../domain/tuner/targetSelection";
import { buildTunerViewModel } from "../domain/tuner/viewModel";
import { AppStateMachine } from "./state";
import type {
  AudioInputAdapter,
  AudioStatus,
  GestureEvent,
  GlassAdapter,
  InstrumentId,
  PhoneView,
  PitchDetection,
  PitchFrame,
  TunerReading,
  TuningDefinition,
  TuningSelection,
  Unsubscribe,
} from "../types/contracts";

interface ControllerOptions {
  glass: GlassAdapter;
  audio: AudioInputAdapter;
  phone: PhoneView;
}

const INSTRUMENT_MENU_ITEMS: ReadonlyArray<{ label: string; instrument?: InstrumentId }> = [
  { label: "Guitar", instrument: "guitar" },
  { label: "Bass", instrument: "bass" },
  { label: "Ukulele", instrument: "ukulele" },
  { label: MENU.close },
];

export class Controller {
  private readonly glass: GlassAdapter;
  private readonly audio: AudioInputAdapter;
  private readonly phone: PhoneView;
  private readonly state: AppStateMachine;
  private readonly smoother = new PitchSmoother({
    staleMs: TIMING.STALE_READING_MS,
  });

  private unsubscribeGesture: Unsubscribe | null = null;
  private unsubscribeAudioFrame: Unsubscribe | null = null;
  private unsubscribeAudioStatus: Unsubscribe | null = null;

  private gestureQueue: Promise<void> = Promise.resolve();

  private latestAudioStatus: AudioStatus = { kind: "idle" };
  private currentReading: TunerReading | null = null;
  private needsAudioEnable = false;

  private started = false;
  private tuningDrawn = false;
  private lastRenderMs = 0;

  private pendingFrame: PitchFrame | null = null;
  private processingFrame = false;
  private detectionLocked = false;
  private readonly tunedStrings = new Set<string>();
  private readonly tunedStreakByString = new Map<string, number>();
  private activeTarget: string | null = null;

  constructor(options: ControllerOptions) {
    this.glass = options.glass;
    this.audio = options.audio;
    this.phone = options.phone;

    const persistedSelection = this.loadSelection();
    const normalized = normalizeSelection(persistedSelection);
    this.state = new AppStateMachine(normalized);

    this.phone.setSelection(normalized);
    this.phone.setAvailableTunings(getTuningsForInstrument(normalized.instrument));
    this.phone.setAudioStatus(this.latestAudioStatus);
    this.phone.setReading(null);
    this.phone.setError(null);
    this.phone.setNeedsAudioEnable(false);
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;

    await this.glass.connect();

    this.unsubscribeGesture = this.glass.onGesture((gesture) => {
      this.gestureQueue = this.gestureQueue
        .then(() => this.handleGesture(gesture))
        .catch((error: unknown) => {
          console.error("Gesture handling failed", error);
        });
    });

    this.unsubscribeAudioFrame = this.audio.onFrame((frame) => {
      this.pendingFrame = frame;
      if (!this.processingFrame) {
        this.processingFrame = true;
        void this.drainFrameQueue();
      }
    });

    this.unsubscribeAudioStatus = this.audio.onStatus((status) => {
      void this.handleAudioStatus(status);
    });

    this.state.enterTuning();
    await this.renderTuning(true);

    await this.startAudio();
  }

  async stop(): Promise<void> {
    this.started = false;

    this.unsubscribeGesture?.();
    this.unsubscribeGesture = null;

    this.unsubscribeAudioFrame?.();
    this.unsubscribeAudioFrame = null;

    this.unsubscribeAudioStatus?.();
    this.unsubscribeAudioStatus = null;

    await this.audio.stop();
    this.state.setStopped();
  }

  async selectInstrument(instrument: InstrumentId): Promise<void> {
    const selection: TuningSelection = {
      instrument,
      tuning: DEFAULT_TUNING_BY_INSTRUMENT[instrument],
    };
    await this.applySelection(selection);
  }

  async selectTuning(tuningId: TuningSelection["tuning"]): Promise<void> {
    const tuning = getTuningById(tuningId);
    await this.applySelection({
      instrument: tuning.instrument,
      tuning: tuning.id,
    });
  }

  async retryAudio(): Promise<void> {
    await this.audio.stop();
    this.smoother.reset();
    this.detectionLocked = false;
    this.currentReading = null;
    this.activeTarget = null;
    this.phone.setReading(null);
    await this.startAudio();
  }

  async enableAudioFromPhone(): Promise<void> {
    await this.retryAudio();
  }

  private async startAudio(): Promise<void> {
    try {
      this.phone.setError(null);
      await this.audio.start();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.failWithError(`${APP_TEXT.audioError}\n${message}`);
    }
  }

  private async handleAudioStatus(status: AudioStatus): Promise<void> {
    this.latestAudioStatus = status;
    this.needsAudioEnable = status.kind === "needs_user_resume";

    if (status.source) {
      this.state.setLastAudioSource(status.source);
      this.persistAudioSource(status.source);
    }

    this.phone.setAudioStatus(status);
    this.phone.setNeedsAudioEnable(this.needsAudioEnable);

    if (status.kind === "error") {
      this.phone.setError(status.message ?? APP_TEXT.audioError);
    }

    if (status.kind === "bridge_active" || status.kind === "web_active") {
      this.phone.setError(null);
      if (this.state.mode === "ERROR") {
        this.state.enterTuning();
        this.tuningDrawn = false;
        await this.renderTuning(true);
      }
    }

    if (this.state.mode === "TUNING") {
      await this.renderTuning(true);
    }
  }

  private async drainFrameQueue(): Promise<void> {
    try {
      while (this.pendingFrame) {
        const frame = this.pendingFrame;
        this.pendingFrame = null;
        await this.handleFrame(frame);
      }
    } finally {
      this.processingFrame = false;
    }
  }

  private async handleFrame(frame: PitchFrame): Promise<void> {
    const raw = detectPitchYin(frame.samples, frame.sampleRateHz, {
      minFreqHz: YIN.MIN_FREQ_HZ,
      maxFreqHz: YIN.MAX_FREQ_HZ,
      threshold: YIN.THRESHOLD,
    });

    const filtered = this.filterDetection(raw);
    const smoothed = this.smoother.next(filtered, frame.tsMs);

    this.currentReading = this.buildReading(smoothed, frame.source);
    this.updateSessionTuningProgress(this.currentReading);
    this.phone.setReading(this.currentReading);

    if (this.state.mode === "TUNING") {
      const now = Date.now();
      if (now - this.lastRenderMs >= TIMING.RENDER_INTERVAL_MS) {
        await this.renderTuning(false);
      }
    }
  }

  private filterDetection(detection: PitchDetection | null): PitchDetection | null {
    if (!detection) return null;

    const minConfidence = this.detectionLocked
      ? AUDIO.SUSTAIN_CONFIDENCE
      : AUDIO.ACQUIRE_CONFIDENCE;
    const minRms = this.detectionLocked
      ? AUDIO.SUSTAIN_RMS
      : AUDIO.ACQUIRE_RMS;

    if (detection.confidence < minConfidence || detection.rms < minRms) {
      return null;
    }

    this.detectionLocked = true;
    return detection;
  }

  private buildReading(
    detection: PitchDetection | null,
    source: PitchFrame["source"],
  ): TunerReading | null {
    if (!detection) {
      this.detectionLocked = false;
      return null;
    }

    const tuning = getTuningById(this.state.selection.tuning);
    const target = selectTargetString(detection.frequencyHz, tuning);
    const note = nearestNote(detection.frequencyHz);
    const absCents = Math.abs(target.cents);

    return {
      detectedFrequencyHz: detection.frequencyHz,
      detectedNote: note.note,
      targetStringName: target.stringLabel,
      targetFrequencyHz: target.targetFrequencyHz,
      cents: target.cents,
      inTune: absCents <= TUNING.IN_TUNE_CENTS,
      quality:
        detection.confidence > 0 && detection.rms > 0
          ? (absCents <= TUNING.NEAR_TUNE_CENTS ? "good" : "weak")
          : "weak",
      source,
    };
  }

  private async handleGesture(gesture: GestureEvent): Promise<void> {
    if (gesture.kind === "FOREGROUND_EXIT") {
      await this.handleForegroundExit();
      return;
    }

    if (gesture.kind === "FOREGROUND_ENTER") {
      await this.handleForegroundEnter();
      return;
    }

    if (this.state.mode === "TUNING") {
      if (gesture.kind === "TAP" || gesture.kind === "DOUBLE_TAP") {
        this.state.openInstrumentMenu();
        await this.renderInstrumentMenu();
      }
      return;
    }

    if (this.state.mode === "MENU_INSTRUMENT") {
      if (gesture.kind === "TAP" || gesture.kind === "DOUBLE_TAP") {
        await this.handleInstrumentMenuTap(gesture.listIndex ?? 0);
      }
      return;
    }

    if (this.state.mode === "MENU_TUNING") {
      if (gesture.kind === "TAP" || gesture.kind === "DOUBLE_TAP") {
        await this.handleTuningMenuTap(gesture.listIndex ?? 0);
      }
      return;
    }

    if (this.state.mode === "ERROR" && gesture.kind === "TAP") {
      await this.retryAudio();
    }
  }

  private async handleInstrumentMenuTap(index: number): Promise<void> {
    const item = INSTRUMENT_MENU_ITEMS[index] ?? INSTRUMENT_MENU_ITEMS[0];
    if (!item) return;

    if (!item.instrument) {
      this.state.enterTuning();
      await this.renderTuning(true);
      return;
    }

    this.state.openTuningMenu(item.instrument);
    await this.renderTuningMenu(item.instrument);
  }

  private async handleTuningMenuTap(index: number): Promise<void> {
    const instrument = this.state.snapshot.menuInstrument;
    if (!instrument) {
      this.state.openInstrumentMenu();
      await this.renderInstrumentMenu();
      return;
    }

    const tunings = getTuningsForInstrument(instrument);

    if (index < tunings.length) {
      const selected = tunings[index];
      if (selected) {
        await this.applySelection({
          instrument,
          tuning: selected.id,
        });
      }
      return;
    }

    const backIndex = tunings.length;
    const closeIndex = tunings.length + 1;

    if (index === backIndex) {
      this.state.openInstrumentMenu();
      await this.renderInstrumentMenu();
      return;
    }

    if (index === closeIndex) {
      this.state.enterTuning();
      await this.renderTuning(true);
    }
  }

  private async applySelection(nextSelection: TuningSelection): Promise<void> {
    const normalized = normalizeSelection(nextSelection);
    this.state.setSelection(normalized);
    this.tunedStrings.clear();
    this.tunedStreakByString.clear();
    this.activeTarget = null;

    this.persistSelection(normalized);

    this.phone.setSelection(normalized);
    this.phone.setAvailableTunings(getTuningsForInstrument(normalized.instrument));

    this.state.enterTuning();
    await this.renderTuning(true);
  }

  private async renderInstrumentMenu(): Promise<void> {
    const items = INSTRUMENT_MENU_ITEMS.map((item) => item.label);
    await this.glass.showListMenu(items, "Pick instrument");
  }

  private async renderTuningMenu(instrument: InstrumentId): Promise<void> {
    const tunings = getTuningsForInstrument(instrument);
    const items = [
      ...tunings.map((item) => item.name),
      MENU.back,
      MENU.close,
    ];

    await this.glass.showListMenu(items, "Pick tuning");
  }

  private async renderTuning(force: boolean): Promise<void> {
    if (this.state.mode !== "TUNING") return;

    const tuning = getTuningById(this.state.selection.tuning);
    const model = buildTunerViewModel({
      selection: this.state.selection,
      tuning,
      reading: this.currentReading,
      status: this.latestAudioStatus,
      needsAudioEnable: this.needsAudioEnable,
      tunedStrings: this.tunedStrings,
      activeTarget: this.activeTarget,
    });

    if (force || !this.tuningDrawn) {
      await this.glass.showTuner(model);
      this.tuningDrawn = true;
    } else {
      await this.glass.updateTuner(model);
    }

    this.lastRenderMs = Date.now();
  }

  private async failWithError(message: string): Promise<void> {
    this.state.setError(message);
    this.phone.setError(message);
    this.phone.setNeedsAudioEnable(false);
    await this.glass.showError(`${message}\n\nTap to retry`);
  }

  private async handleForegroundExit(): Promise<void> {
    await this.audio.stop();
  }

  private async handleForegroundEnter(): Promise<void> {
    await this.startAudio();

    if (this.state.mode === "TUNING") {
      this.tuningDrawn = false;
      await this.renderTuning(true);
      return;
    }

    if (this.state.mode === "MENU_INSTRUMENT") {
      await this.renderInstrumentMenu();
      return;
    }

    if (this.state.mode === "MENU_TUNING") {
      const instrument = this.state.snapshot.menuInstrument;
      if (instrument) {
        await this.renderTuningMenu(instrument);
      }
    }
  }

  private loadSelection(): TuningSelection {
    try {
      if (typeof window === "undefined" || !window.localStorage) {
        return DEFAULT_SELECTION;
      }

      const raw = window.localStorage.getItem(STORAGE_KEYS.selection);
      if (!raw) return DEFAULT_SELECTION;

      const parsed = JSON.parse(raw) as Partial<TuningSelection>;
      if (!parsed.instrument || !parsed.tuning) return DEFAULT_SELECTION;

      const candidate: TuningSelection = {
        instrument: parsed.instrument,
        tuning: parsed.tuning,
      };

      return normalizeSelection(candidate);
    } catch {
      return DEFAULT_SELECTION;
    }
  }

  private persistSelection(selection: TuningSelection): void {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEYS.selection, JSON.stringify(selection));
      }
    } catch {
      // Best effort only.
    }
  }

  private persistAudioSource(source: AudioStatus["source"]): void {
    if (!source) return;

    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEYS.lastAudioSource, source);
      }
    } catch {
      // Best effort only.
    }
  }

  private updateSessionTuningProgress(reading: TunerReading | null): void {
    if (!reading) {
      this.activeTarget = null;
      this.tunedStreakByString.clear();
      return;
    }

    const target = reading.targetStringName;
    this.activeTarget = target;

    if (this.tunedStrings.has(target)) {
      return;
    }

    if (reading.inTune) {
      const streak = (this.tunedStreakByString.get(target) ?? 0) + 1;
      this.tunedStreakByString.set(target, streak);
      if (streak >= TUNING.MARK_TUNED_STREAK) {
        this.tunedStrings.add(target);
        this.tunedStreakByString.delete(target);
      }
      return;
    }

    this.tunedStreakByString.set(target, 0);
  }

  getCurrentTuningsForPhone(): readonly TuningDefinition[] {
    return getTuningsForInstrument(this.state.selection.instrument);
  }
}
