import { Badge, Button, Card, CardContent, CardHeader, Select, Text } from "@jappyjan/even-realities-ui";
import { CompleteIcon, HintIcon } from "@jappyjan/even-realities-ui/icons";
import "@jappyjan/even-realities-ui/styles.css";
import { createRoot, type Root } from "react-dom/client";
import type {
  AudioStatus,
  InstrumentId,
  PhoneActions,
  PhoneView,
  TunerReading,
  TuningDefinition,
  TuningSelection,
} from "../types/contracts";
import "./phoneUI.css";

interface PhoneUIState {
  selection: TuningSelection;
  availableTunings: readonly TuningDefinition[];
  status: AudioStatus;
  reading: TunerReading | null;
  error: string | null;
  needsAudioEnable: boolean;
}

const INSTRUMENT_OPTIONS: ReadonlyArray<{
  value: InstrumentId;
  label: string;
}> = [
  { value: "guitar", label: "Guitar" },
  { value: "bass", label: "Bass" },
  { value: "ukulele", label: "Ukulele" },
];

export class PhoneUI implements PhoneView {
  private readonly actions: PhoneActions;
  private readonly root: Root;

  private state: PhoneUIState = {
    selection: {
      instrument: "guitar",
      tuning: "gtr_standard",
    },
    availableTunings: [],
    status: { kind: "idle" },
    reading: null,
    error: null,
    needsAudioEnable: false,
  };

  constructor(actions: PhoneActions) {
    this.actions = actions;
    this.root = createRoot(requireEl("phone-root"));
    this.render();
  }

  setSelection(selection: TuningSelection): void {
    this.patchState({ selection });
  }

  setAvailableTunings(tunings: readonly TuningDefinition[]): void {
    this.patchState({ availableTunings: tunings });
  }

  setAudioStatus(status: AudioStatus): void {
    this.patchState({
      status,
      error: status.kind === "error" ? this.state.error : null,
    });
  }

  setReading(reading: TunerReading | null): void {
    this.patchState({ reading });
  }

  setError(message: string | null): void {
    this.patchState({ error: message });
  }

  setNeedsAudioEnable(needsEnable: boolean): void {
    this.patchState({ needsAudioEnable: needsEnable });
  }

  private patchState(patch: Partial<PhoneUIState>): void {
    this.state = {
      ...this.state,
      ...patch,
    };

    this.render();
  }

  private render(): void {
    this.root.render(
      <PhoneCompanion
        state={this.state}
        actions={this.actions}
      />,
    );
  }
}

function PhoneCompanion({
  state,
  actions,
}: {
  state: PhoneUIState;
  actions: PhoneActions;
}) {
  const reading = state.reading;
  const hint = reading ? buildHint(reading) : "Pluck a string and let it ring";

  return (
    <div className="phone-app">
      <header className="phone-header">
        <Text as="h1" variant="title-lg">G2 Multi Tuner</Text>
        <Text as="p" variant="subtitle">Cross-platform tuner for guitar, bass, and ukulele</Text>
      </header>

      <Card>
        <CardHeader className="phone-card-header">
          <Text as="h2" variant="title-2">Tuning Setup</Text>
        </CardHeader>
        <CardContent className="phone-stack">
          <label className="phone-stack" htmlFor="instrument-select">
            <Text as="span" variant="detail">Instrument</Text>
            <Select
              className="phone-select"
              id="instrument-select"
              value={state.selection.instrument}
              onChange={(event) => {
                actions.onSelectInstrument(event.currentTarget.value as InstrumentId);
              }}
            >
              {INSTRUMENT_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </Select>
          </label>

          <label className="phone-stack" htmlFor="tuning-select">
            <Text as="span" variant="detail">Tuning</Text>
            <Select
              className="phone-select"
              id="tuning-select"
              value={state.selection.tuning}
              onChange={(event) => {
                actions.onSelectTuning(event.currentTarget.value as TuningSelection["tuning"]);
              }}
            >
              {state.availableTunings.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </Select>
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="phone-card-header phone-row phone-row--between">
          <Text as="h2" variant="title-2">Microphone</Text>
          <Badge>{humanAudioSource(state.status)}</Badge>
        </CardHeader>
        <CardContent className="phone-stack">
          <Text as="p" variant="body-2">{humanAudioStatus(state.status)}</Text>
          {state.error ? (
            <Text as="p" variant="detail" className="phone-error">{state.error}</Text>
          ) : null}
          <div className="phone-actions">
            <Button
              size="md"
              type="button"
              variant="primary"
              onClick={() => {
                actions.onRetryAudio();
              }}
            >
              Retry Mic
            </Button>
            {state.needsAudioEnable ? (
              <Button
                size="md"
                type="button"
                variant="accent"
                onClick={() => {
                  actions.onEnableAudio();
                }}
              >
                Enable Mic
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="phone-card-header phone-row phone-row--between">
          <Text as="h2" variant="title-2">Live Reading</Text>
          {reading?.inTune ? (
            <Badge className="phone-badge">
              <CompleteIcon size={12} />
              <span>In tune</span>
            </Badge>
          ) : (
            <Badge>Adjust</Badge>
          )}
        </CardHeader>
        <CardContent className="phone-stack">
          <div className="phone-reading-grid">
            <ReadingField label="Detected note" value={reading?.detectedNote ?? "--"} />
            <ReadingField label="Frequency" value={reading ? `${reading.detectedFrequencyHz.toFixed(1)} Hz` : "--"} />
            <ReadingField label="Target string" value={reading?.targetStringName ?? "--"} />
            <ReadingField label="Target pitch" value={reading ? `${reading.targetFrequencyHz.toFixed(1)} Hz` : "--"} />
            <ReadingField label="Deviation" value={reading ? `${reading.cents >= 0 ? "+" : ""}${reading.cents.toFixed(1)} c` : "--"} />
            <ReadingField label="Tracking quality" value={reading?.quality ?? "--"} />
          </div>
          <div className="phone-hint">
            <HintIcon size={14} />
            <Text as="p" variant="body-2">{hint}</Text>
          </div>
        </CardContent>
      </Card>

      <footer className="phone-footer">
        <Text as="p" variant="detail">Created by Renato Castelo Branco</Text>
      </footer>
    </div>
  );
}

function ReadingField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="phone-reading-item">
      <Text as="span" variant="detail">{label}</Text>
      <Text as="span" variant="body-1" className="phone-value">{value}</Text>
    </div>
  );
}

function buildHint(reading: TunerReading): string {
  if (reading.inTune) {
    return "Locked in. Move to next string.";
  }

  if (reading.cents > 0) {
    return "Loosen a touch.";
  }

  return "Tighten a touch.";
}

function humanAudioSource(status: AudioStatus): string {
  if (status.source === "web_mic") return "Phone mic";
  if (status.source === "bridge_pcm") return "Bridge mic";
  return "Phone mic";
}

function humanAudioStatus(status: AudioStatus): string {
  switch (status.kind) {
    case "starting":
      return "Starting microphone capture.";
    case "web_requesting":
      return "Requesting microphone permission.";
    case "web_active":
      return "Microphone is live.";
    case "needs_user_resume":
      return "Tap Enable Mic to resume audio.";
    case "error":
      return status.message ?? "Microphone unavailable.";
    case "stopped":
      return "Microphone stopped.";
    case "bridge_listening":
      return "Bridge listening.";
    case "bridge_active":
      return "Bridge audio live.";
    case "bridge_timeout":
      return "Bridge audio timeout.";
    case "idle":
    default:
      return "Waiting to start microphone.";
  }
}

function requireEl(id: string): HTMLElement {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing required element #${id}`);
  }
  return element;
}
