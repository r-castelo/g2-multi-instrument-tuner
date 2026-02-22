import type {
  AppMode,
  AudioSource,
  InstrumentId,
  TuningSelection,
} from "../types/contracts";

export interface AppState {
  mode: AppMode;
  selection: TuningSelection;
  menuInstrument: InstrumentId | null;
  errorMessage: string | null;
  lastAudioSource: AudioSource | null;
}

export class AppStateMachine {
  private state: AppState;

  constructor(initialSelection: TuningSelection) {
    this.state = {
      mode: "BOOT",
      selection: initialSelection,
      menuInstrument: null,
      errorMessage: null,
      lastAudioSource: null,
    };
  }

  get snapshot(): Readonly<AppState> {
    return this.state;
  }

  get mode(): AppMode {
    return this.state.mode;
  }

  get selection(): TuningSelection {
    return this.state.selection;
  }

  enterTuning(): void {
    this.state.mode = "TUNING";
    this.state.menuInstrument = null;
    this.state.errorMessage = null;
  }

  openInstrumentMenu(): void {
    this.state.mode = "MENU_INSTRUMENT";
    this.state.menuInstrument = null;
  }

  openTuningMenu(instrument: InstrumentId): void {
    this.state.mode = "MENU_TUNING";
    this.state.menuInstrument = instrument;
  }

  setSelection(selection: TuningSelection): void {
    this.state.selection = selection;
  }

  setError(message: string): void {
    this.state.mode = "ERROR";
    this.state.errorMessage = message;
  }

  clearError(): void {
    this.state.errorMessage = null;
  }

  setStopped(): void {
    this.state.mode = "STOPPED";
  }

  setLastAudioSource(source: AudioSource | null): void {
    this.state.lastAudioSource = source;
  }
}
