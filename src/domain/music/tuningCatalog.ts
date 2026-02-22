import type {
  InstrumentId,
  TuningDefinition,
  TuningId,
  TuningSelection,
} from "../../types/contracts";

export const TUNING_CATALOG: readonly TuningDefinition[] = [
  {
    id: "gtr_standard",
    instrument: "guitar",
    name: "Standard (E A D G B E)",
    strings: [
      { label: "E2", frequencyHz: 82.4069 },
      { label: "A2", frequencyHz: 110.0 },
      { label: "D3", frequencyHz: 146.8324 },
      { label: "G3", frequencyHz: 195.9977 },
      { label: "B3", frequencyHz: 246.9417 },
      { label: "E4", frequencyHz: 329.6276 },
    ],
  },
  {
    id: "gtr_drop_d",
    instrument: "guitar",
    name: "Drop D (D A D G B E)",
    strings: [
      { label: "D2", frequencyHz: 73.4162 },
      { label: "A2", frequencyHz: 110.0 },
      { label: "D3", frequencyHz: 146.8324 },
      { label: "G3", frequencyHz: 195.9977 },
      { label: "B3", frequencyHz: 246.9417 },
      { label: "E4", frequencyHz: 329.6276 },
    ],
  },
  {
    id: "gtr_open_g",
    instrument: "guitar",
    name: "Open G (D G D G B D)",
    strings: [
      { label: "D2", frequencyHz: 73.4162 },
      { label: "G2", frequencyHz: 97.9989 },
      { label: "D3", frequencyHz: 146.8324 },
      { label: "G3", frequencyHz: 195.9977 },
      { label: "B3", frequencyHz: 246.9417 },
      { label: "D4", frequencyHz: 293.6648 },
    ],
  },
  {
    id: "gtr_dadgad",
    instrument: "guitar",
    name: "DADGAD (D A D G A D)",
    strings: [
      { label: "D2", frequencyHz: 73.4162 },
      { label: "A2", frequencyHz: 110.0 },
      { label: "D3", frequencyHz: 146.8324 },
      { label: "G3", frequencyHz: 195.9977 },
      { label: "A3", frequencyHz: 220.0 },
      { label: "D4", frequencyHz: 293.6648 },
    ],
  },
  {
    id: "bass_standard_4",
    instrument: "bass",
    name: "Standard 4 (E A D G)",
    strings: [
      { label: "E1", frequencyHz: 41.2034 },
      { label: "A1", frequencyHz: 55.0 },
      { label: "D2", frequencyHz: 73.4162 },
      { label: "G2", frequencyHz: 97.9989 },
    ],
  },
  {
    id: "uke_standard_c6",
    instrument: "ukulele",
    name: "Standard C6 (G C E A)",
    strings: [
      { label: "G4", frequencyHz: 391.9954 },
      { label: "C4", frequencyHz: 261.6256 },
      { label: "E4", frequencyHz: 329.6276 },
      { label: "A4", frequencyHz: 440.0 },
    ],
  },
] as const;

export const DEFAULT_TUNING_BY_INSTRUMENT: Record<InstrumentId, TuningId> = {
  guitar: "gtr_standard",
  bass: "bass_standard_4",
  ukulele: "uke_standard_c6",
};

export function getTuningById(id: TuningId): TuningDefinition {
  const tuning = TUNING_CATALOG.find((item) => item.id === id);
  if (!tuning) {
    throw new Error(`Unknown tuning id: ${id}`);
  }
  return tuning;
}

export function getTuningsForInstrument(
  instrument: InstrumentId,
): readonly TuningDefinition[] {
  return TUNING_CATALOG.filter((item) => item.instrument === instrument);
}

export function normalizeSelection(selection: TuningSelection): TuningSelection {
  const tunings = getTuningsForInstrument(selection.instrument);
  const valid = tunings.some((item) => item.id === selection.tuning);
  if (valid) return selection;

  return {
    instrument: selection.instrument,
    tuning: DEFAULT_TUNING_BY_INSTRUMENT[selection.instrument],
  };
}
