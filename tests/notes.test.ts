import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  centsBetween,
  frequencyToMidi,
  midiToFrequency,
  nearestNote,
} from "../src/domain/music/notes.js";

describe("notes", () => {
  it("maps 440Hz to A4", () => {
    const match = nearestNote(440);
    assert.equal(match.note, "A4");
    assert.ok(Math.abs(match.cents) < 0.001);
  });

  it("computes cents between octave frequencies", () => {
    const cents = centsBetween(220, 110);
    assert.ok(Math.abs(cents - 1200) < 0.001);
  });

  it("midi/frequency roundtrip is stable", () => {
    const freq = midiToFrequency(57); // A3
    const midi = frequencyToMidi(freq);
    assert.ok(Math.abs(midi - 57) < 0.0001);
  });
});
