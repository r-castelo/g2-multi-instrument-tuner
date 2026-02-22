import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PitchSmoother } from "../src/domain/pitch/smoothing.js";

describe("PitchSmoother", () => {
  it("holds last frequency during short signal gaps", () => {
    const smoother = new PitchSmoother({
      medianWindow: 3,
      alpha: 1,
      staleMs: 1500,
    });

    const first = smoother.next(
      {
        frequencyHz: 110,
        confidence: 0.9,
        rms: 0.02,
      },
      0,
    );

    assert.ok(first);
    assert.equal(Math.round(first?.frequencyHz ?? 0), 110);

    const held = smoother.next(null, 700);
    assert.ok(held);
    assert.equal(Math.round(held?.frequencyHz ?? 0), 110);
  });

  it("clears reading after stale timeout", () => {
    const smoother = new PitchSmoother({
      medianWindow: 3,
      alpha: 1,
      staleMs: 1000,
    });

    smoother.next(
      {
        frequencyHz: 220,
        confidence: 0.9,
        rms: 0.02,
      },
      0,
    );

    const stale = smoother.next(null, 1501);
    assert.equal(stale, null);
  });

  it("tracks large note jumps quickly with attack alpha", () => {
    const smoother = new PitchSmoother({
      medianWindow: 1,
      attackAlpha: 0.8,
      releaseAlpha: 0.2,
      fastChangeHz: 2,
      staleMs: 1000,
    });

    const first = smoother.next(
      {
        frequencyHz: 110,
        confidence: 0.9,
        rms: 0.02,
      },
      0,
    );
    assert.ok(first);

    const jumped = smoother.next(
      {
        frequencyHz: 146.83,
        confidence: 0.9,
        rms: 0.02,
      },
      10,
    );

    assert.ok(jumped);
    // Should move strongly toward the new note in one update, not feel sticky.
    assert.ok((jumped?.frequencyHz ?? 0) > 135);
  });
});
