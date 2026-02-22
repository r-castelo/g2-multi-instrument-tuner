import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectPitchYin } from "../src/domain/pitch/yin.js";

function sineWave(freqHz: number, sampleRateHz: number, size: number): Float32Array {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    out[i] = Math.sin((2 * Math.PI * freqHz * i) / sampleRateHz);
  }
  return out;
}

describe("detectPitchYin", () => {
  it("detects guitar-range frequencies", () => {
    const sampleRate = 16_000;
    const sample = sineWave(110, sampleRate, 4096);
    const result = detectPitchYin(sample, sampleRate, {
      minFreqHz: 35,
      maxFreqHz: 500,
      threshold: 0.1,
    });

    assert.ok(result);
    assert.ok(Math.abs((result?.frequencyHz ?? 0) - 110) < 1.0);
    assert.ok((result?.confidence ?? 0) > 0.7);
  });

  it("detects bass E1", () => {
    const sampleRate = 16_000;
    const sample = sineWave(41.2034, sampleRate, 4096);
    const result = detectPitchYin(sample, sampleRate, {
      minFreqHz: 35,
      maxFreqHz: 500,
      threshold: 0.1,
    });

    assert.ok(result);
    assert.ok(Math.abs((result?.frequencyHz ?? 0) - 41.2034) < 1.5);
  });

  it("detects ukulele A4", () => {
    const sampleRate = 16_000;
    const sample = sineWave(440, sampleRate, 4096);
    const result = detectPitchYin(sample, sampleRate, {
      minFreqHz: 35,
      maxFreqHz: 500,
      threshold: 0.1,
    });

    assert.ok(result);
    assert.ok(Math.abs((result?.frequencyHz ?? 0) - 440) < 1.0);
  });

  it("returns null for silence", () => {
    const sample = new Float32Array(4096);
    const result = detectPitchYin(sample, 16_000, {
      minFreqHz: 35,
      maxFreqHz: 500,
      threshold: 0.1,
    });

    assert.equal(result, null);
  });
});
