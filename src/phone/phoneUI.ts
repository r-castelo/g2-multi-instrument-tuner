import type {
  AudioStatus,
  InstrumentId,
  PhoneActions,
  PhoneView,
  TunerReading,
  TuningDefinition,
  TuningSelection,
} from "../types/contracts";

export class PhoneUI implements PhoneView {
  private readonly actions: PhoneActions;
  private readonly instrumentButtonsRoot: HTMLElement;
  private readonly tuningButtonsRoot: HTMLElement;
  private readonly audioStatusEl: HTMLElement;
  private readonly sourceStatusEl: HTMLElement;
  private readonly errorEl: HTMLElement;
  private readonly retryBtn: HTMLButtonElement;
  private readonly enableAudioBtn: HTMLButtonElement;
  private readonly readingEls: Record<string, HTMLElement>;

  private selection: TuningSelection = {
    instrument: "guitar",
    tuning: "gtr_standard",
  };

  private availableTunings: readonly TuningDefinition[] = [];

  constructor(actions: PhoneActions) {
    this.actions = actions;

    this.instrumentButtonsRoot = requireEl("instrument-buttons");
    this.tuningButtonsRoot = requireEl("tuning-buttons");
    this.audioStatusEl = requireEl("audio-status");
    this.sourceStatusEl = requireEl("source-status");
    this.errorEl = requireEl("error-msg");
    this.retryBtn = requireEl("retry-audio-btn") as HTMLButtonElement;
    this.enableAudioBtn = requireEl("enable-audio-btn") as HTMLButtonElement;

    this.readingEls = {
      note: requireEl("reading-note"),
      freq: requireEl("reading-freq"),
      target: requireEl("reading-target"),
      cents: requireEl("reading-cents"),
      quality: requireEl("reading-quality"),
      intune: requireEl("reading-intune"),
    };

    this.bindEvents();
  }

  setSelection(selection: TuningSelection): void {
    this.selection = selection;
    this.updateInstrumentButtons();
    this.renderTuningButtons();
  }

  setAvailableTunings(tunings: readonly TuningDefinition[]): void {
    this.availableTunings = tunings;
    this.renderTuningButtons();
  }

  setAudioStatus(status: AudioStatus): void {
    this.audioStatusEl.textContent = `Audio status: ${status.kind}`;

    const source = status.source === "bridge_pcm"
      ? "bridge PCM"
      : status.source === "web_mic"
        ? "web microphone"
        : "n/a";

    this.sourceStatusEl.textContent = `Source: ${source}`;

    if (status.kind !== "error") {
      this.setError(null);
    }

    this.setNeedsAudioEnable(status.kind === "needs_user_resume");
  }

  setReading(reading: TunerReading | null): void {
    if (!reading) {
      this.readingEls.note.textContent = "--";
      this.readingEls.freq.textContent = "--";
      this.readingEls.target.textContent = "--";
      this.readingEls.cents.textContent = "--";
      this.readingEls.quality.textContent = "--";
      this.readingEls.intune.textContent = "--";
      return;
    }

    this.readingEls.note.textContent = reading.detectedNote;
    this.readingEls.freq.textContent = `${reading.detectedFrequencyHz.toFixed(1)} Hz`;
    this.readingEls.target.textContent = `${reading.targetStringName} (${reading.targetFrequencyHz.toFixed(1)} Hz)`;
    this.readingEls.cents.textContent = `${reading.cents >= 0 ? "+" : ""}${reading.cents.toFixed(1)}`;
    this.readingEls.quality.textContent = reading.quality;
    this.readingEls.intune.textContent = reading.inTune ? "yes" : "no";
  }

  setError(message: string | null): void {
    if (!message) {
      this.errorEl.classList.add("hidden");
      this.errorEl.textContent = "";
      return;
    }

    this.errorEl.classList.remove("hidden");
    this.errorEl.textContent = message;
  }

  setNeedsAudioEnable(needsEnable: boolean): void {
    this.enableAudioBtn.classList.toggle("hidden", !needsEnable);
  }

  private bindEvents(): void {
    this.instrumentButtonsRoot.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button[data-instrument]") as HTMLButtonElement | null;
      const instrument = button?.dataset.instrument as InstrumentId | undefined;
      if (!instrument) return;
      this.actions.onSelectInstrument(instrument);
    });

    this.tuningButtonsRoot.addEventListener("click", (event) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button[data-tuning]") as HTMLButtonElement | null;
      const tuningId = button?.dataset.tuning;
      if (!tuningId) return;
      this.actions.onSelectTuning(tuningId as TuningSelection["tuning"]);
    });

    this.retryBtn.addEventListener("click", () => {
      this.actions.onRetryAudio();
    });

    this.enableAudioBtn.addEventListener("click", () => {
      this.actions.onEnableAudio();
    });
  }

  private updateInstrumentButtons(): void {
    const buttons = this.instrumentButtonsRoot.querySelectorAll<HTMLButtonElement>("button[data-instrument]");
    for (const button of buttons) {
      button.classList.toggle(
        "active",
        button.dataset.instrument === this.selection.instrument,
      );
    }
  }

  private renderTuningButtons(): void {
    this.tuningButtonsRoot.innerHTML = "";

    for (const tuning of this.availableTunings) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "pill";
      button.dataset.tuning = tuning.id;
      button.textContent = tuning.name;
      button.classList.toggle("active", tuning.id === this.selection.tuning);
      this.tuningButtonsRoot.appendChild(button);
    }
  }
}

function requireEl(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element;
}
