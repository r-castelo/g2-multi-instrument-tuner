import {
  APP_TEXT,
  TEXT_LIMITS,
  TUNING,
  UI_GLYPHS,
} from "../../config/constants";
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
  tunedStrings: ReadonlySet<string>;
  activeTarget: string | null;
}

export function buildTunerViewModel(input: TunerViewModelInput): TunerViewModel {
  const lines: string[] = [];

  const instrumentCode = instrumentShortCode(input.selection.instrument);
  const tuningName = compactTuningName(input.tuning);
  lines.push(`[ ${instrumentCode} | ${tuningName} ]`);
  lines.push(
    formatStringBadges(
      input.tuning,
      input.tunedStrings,
      input.reading?.targetStringName ?? input.activeTarget,
    ),
  );
  lines.push("");

  if (input.reading) {
    const isTagged = input.tunedStrings.has(input.reading.targetStringName);
    lines.push(
      `NOTE: ${input.reading.detectedNote}   ${input.reading.detectedFrequencyHz.toFixed(1)}Hz   ${formatCentsToken(input.reading.cents)}`,
    );
    lines.push("");
    lines.push(`FLAT ${makeCentsBar(input.reading.cents)} SHARP`);
    lines.push("");
    lines.push(`Hint: ${makeHint(input.reading, input.needsAudioEnable, isTagged)}`);
  } else {
    lines.push(APP_TEXT.noSignal);
    lines.push("");
    lines.push(`FLAT ${makeCentsBar(0)} SHARP`);
    lines.push("");
    lines.push(`Hint: ${input.needsAudioEnable ? APP_TEXT.micEnable : "Pluck a string and let it ring"}`);
  }

  const statusText = humanStatus(input.status).slice(0, 64);

  return {
    content: lines.join("\n").slice(0, TEXT_LIMITS.startupOrRebuild),
    status: statusText,
  };
}

function humanStatus(status: AudioStatus): string {
  const sourceText = status.source === "bridge_pcm"
    ? "Bridge Mic"
    : status.source === "web_mic"
      ? "Phone Mic"
      : "Mic";

  switch (status.kind) {
    case "bridge_listening":
      return `${sourceText}: listening`;
    case "bridge_active":
      return `${sourceText}: live`;
    case "bridge_timeout":
      return "Bridge mic unavailable, falling back";
    case "web_requesting":
      return "Requesting microphone permission";
    case "web_active":
      return `${sourceText}: live`;
    case "needs_user_resume":
      return "Tap Enable Mic on phone";
    case "error":
      return "Mic error";
    case "starting":
      return "Starting tuner";
    case "stopped":
      return "Tuner paused";
    case "idle":
    default:
      return "Waiting for signal";
  }
}

function makeCentsBar(cents: number): string {
  const width = 23;
  const center = Math.floor(width / 2);
  const normalized = clamp(cents / TUNING.BAR_RANGE_CENTS, -1, 1);
  const offset = Math.round(normalized * center);
  const marker = center + offset;

  const chars = Array.from({ length: width }, () => "-");
  const leftGuide = Math.max(0, center - 4);
  const rightGuide = Math.min(width - 1, center + 4);
  chars[leftGuide] = "|";
  chars[rightGuide] = "|";
  chars[marker] = "^";

  return `[${chars.join("")}]`;
}

function formatCentsToken(cents: number): string {
  const rounded = Math.round(cents);
  const sign = rounded >= 0 ? "+" : "-";
  const abs = Math.abs(rounded).toString().padStart(2, "0");
  return `${sign}${abs}c`;
}

function makeHint(
  reading: TunerReading,
  needsAudioEnable: boolean,
  isTagged: boolean,
): string {
  if (needsAudioEnable) {
    return APP_TEXT.micEnable;
  }

  if (isTagged) {
    return "Locked in. Move to next string";
  }

  if (reading.cents > 0) {
    return "Loosen a touch";
  }

  return "Tighten a touch";
}

function compactTuningName(tuning: TuningDefinition): string {
  if (tuning.name.startsWith("Standard")) {
    return `Standard ${tuning.strings.length}`;
  }

  return tuning.name.replace(/\s*\(.*\)\s*/g, "").trim();
}

function instrumentShortCode(instrument: TuningSelection["instrument"]): string {
  switch (instrument) {
    case "guitar":
      return "GTR";
    case "bass":
      return "BASS";
    case "ukulele":
      return "UKE";
  }
}

function formatStringBadges(
  tuning: TuningDefinition,
  tunedStrings: ReadonlySet<string>,
  activeTarget: string | null,
): string {
  const badges: string[] = [];

  for (const item of tuning.strings) {
    const label = simplifiedStringLabel(item.label);
    const isTuned = tunedStrings.has(item.label);
    const isActive = activeTarget === item.label;

    if (isActive) {
      badges.push(isTuned ? `>${label}${UI_GLYPHS.tuned}<` : `>${label}<`);
      continue;
    }

    if (isTuned) {
      badges.push(`[${label}${UI_GLYPHS.tuned}]`);
      continue;
    }

    badges.push(`[${label}]`);
  }

  return badges.join("  ");
}

function simplifiedStringLabel(label: string): string {
  return label.replace(/[0-9]/g, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
