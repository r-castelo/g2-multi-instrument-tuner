import {
  APP_TEXT,
  INSTRUMENT_LABELS,
  TEXT_LIMITS,
  TUNING,
} from "../../config/constants";
import { formatCents } from "../music/notes";
import type {
  AudioStatus,
  TunerReading,
  TunerViewModel,
  TuningDefinition,
  TuningSelection,
} from "../../types/contracts";

export interface TunerViewModelInput {
  selection: TuningSelection;
  tuning: TuningDefinition;
  reading: TunerReading | null;
  status: AudioStatus;
  needsAudioEnable: boolean;
}

export function buildTunerViewModel(input: TunerViewModelInput): TunerViewModel {
  const lines: string[] = [];

  const instrumentName = INSTRUMENT_LABELS[input.selection.instrument];
  lines.push(`${instrumentName} | ${input.tuning.name}`);

  if (input.reading) {
    lines.push(
      `Target: ${input.reading.targetStringName} ${input.reading.targetFrequencyHz.toFixed(1)}Hz`,
    );
    lines.push(
      `Detect: ${input.reading.detectedNote} ${input.reading.detectedFrequencyHz.toFixed(1)}Hz`,
    );
    lines.push(
      `Cents: ${formatCents(input.reading.cents)} ${input.reading.inTune ? "IN TUNE" : "ADJUST"}`,
    );
    lines.push(makeCentsBar(input.reading.cents));
    lines.push(`Quality: ${input.reading.quality.toUpperCase()}`);
  } else {
    lines.push(APP_TEXT.pluck);
    lines.push(APP_TEXT.noSignal);
    lines.push(makeCentsBar(0));
  }

  if (input.needsAudioEnable) {
    lines.push(APP_TEXT.micEnable);
  }

  lines.push(APP_TEXT.tapForMenu);

  const source = input.status.source === "bridge_pcm"
    ? "BRIDGE"
    : input.status.source === "web_mic"
      ? "WEBMIC"
      : "NONE";

  const statusText = `${source} ${statusLabel(input.status)}`.slice(0, 64);

  return {
    content: lines.join("\n").slice(0, TEXT_LIMITS.startupOrRebuild),
    status: statusText,
  };
}

function statusLabel(status: AudioStatus): string {
  switch (status.kind) {
    case "bridge_listening":
      return "LISTEN";
    case "bridge_active":
      return "ACTIVE";
    case "bridge_timeout":
      return "TIMEOUT";
    case "web_requesting":
      return "REQ";
    case "web_active":
      return "ACTIVE";
    case "needs_user_resume":
      return "ENABLE";
    case "error":
      return "ERROR";
    case "starting":
      return "START";
    case "stopped":
      return "STOP";
    case "idle":
    default:
      return "IDLE";
  }
}

function makeCentsBar(cents: number): string {
  const width = 21;
  const center = Math.floor(width / 2);
  const normalized = clamp(cents / TUNING.BAR_RANGE_CENTS, -1, 1);
  const offset = Math.round(normalized * center);
  const marker = center + offset;

  const chars = Array.from({ length: width }, () => "-");
  chars[center] = "|";
  chars[marker] = "^";

  return `[${chars.join("")}]`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
