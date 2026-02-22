const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export interface NoteMatch {
  midi: number;
  note: string;
  frequencyHz: number;
  cents: number;
}

export function midiToFrequency(midi: number, a4Hz = 440): number {
  return a4Hz * 2 ** ((midi - 69) / 12);
}

export function frequencyToMidi(frequencyHz: number, a4Hz = 440): number {
  return 69 + 12 * Math.log2(frequencyHz / a4Hz);
}

export function midiToNoteName(midi: number): string {
  const rounded = Math.round(midi);
  const note = NOTE_NAMES[((rounded % 12) + 12) % 12] ?? "C";
  const octave = Math.floor(rounded / 12) - 1;
  return `${note}${octave}`;
}

export function centsBetween(frequencyHz: number, targetHz: number): number {
  return 1200 * Math.log2(frequencyHz / targetHz);
}

export function nearestNote(frequencyHz: number, a4Hz = 440): NoteMatch {
  const midiFloat = frequencyToMidi(frequencyHz, a4Hz);
  const midi = Math.round(midiFloat);
  const target = midiToFrequency(midi, a4Hz);

  return {
    midi,
    note: midiToNoteName(midi),
    frequencyHz: target,
    cents: centsBetween(frequencyHz, target),
  };
}

export function formatCents(cents: number): string {
  const rounded = Math.round(cents * 10) / 10;
  return rounded > 0 ? `+${rounded.toFixed(1)}` : rounded.toFixed(1);
}
