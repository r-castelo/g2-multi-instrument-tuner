import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Controller } from "../src/app/controller.js";
import type {
  AudioInputAdapter,
  AudioStatus,
  GestureEvent,
  GlassAdapter,
  PhoneView,
  PitchFrame,
  TunerReading,
  TuningDefinition,
  TuningSelection,
  Unsubscribe,
} from "../src/types/contracts.js";

class FakeGlass implements GlassAdapter {
  public tunerRenders = 0;

  async connect(): Promise<void> {}

  onGesture(_handler: (event: GestureEvent) => void): Unsubscribe {
    return () => {};
  }

  async showTuner(): Promise<void> {
    this.tunerRenders += 1;
  }

  async updateTuner(): Promise<void> {
    this.tunerRenders += 1;
  }

  async showListMenu(): Promise<void> {}

  async showError(): Promise<void> {}
}

class FakeAudio implements AudioInputAdapter {
  private readonly frameHandlers = new Set<(frame: PitchFrame) => void>();
  private readonly statusHandlers = new Set<(status: AudioStatus) => void>();

  onFrame(handler: (frame: PitchFrame) => void): Unsubscribe {
    this.frameHandlers.add(handler);
    return () => {
      this.frameHandlers.delete(handler);
    };
  }

  onStatus(handler: (status: AudioStatus) => void): Unsubscribe {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  async start(): Promise<void> {
    this.emitStatus({ kind: "bridge_listening", source: "bridge_pcm" });
    this.emitStatus({ kind: "bridge_timeout", source: "bridge_pcm" });
    this.emitStatus({ kind: "web_requesting", source: "web_mic" });
    this.emitStatus({ kind: "web_active", source: "web_mic" });
  }

  async stop(): Promise<void> {
    this.emitStatus({ kind: "stopped" });
  }

  private emitStatus(status: AudioStatus): void {
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }
}

class FakePhone implements PhoneView {
  public status: AudioStatus = { kind: "idle" };
  public error: string | null = null;

  setSelection(_selection: TuningSelection): void {}

  setAvailableTunings(_tunings: readonly TuningDefinition[]): void {}

  setAudioStatus(status: AudioStatus): void {
    this.status = status;
  }

  setReading(_reading: TunerReading | null): void {}

  setError(message: string | null): void {
    this.error = message;
  }

  setNeedsAudioEnable(_needsEnable: boolean): void {}
}

describe("Controller audio fallback", () => {
  it("accepts bridge timeout and continues with web mic", async () => {
    const glass = new FakeGlass();
    const audio = new FakeAudio();
    const phone = new FakePhone();

    const controller = new Controller({ glass, audio, phone });
    await controller.start();

    await new Promise((resolve) => setTimeout(resolve, 0));

    assert.equal(phone.status.kind, "web_active");
    assert.equal(phone.status.source, "web_mic");
    assert.equal(phone.error, null);
    assert.ok(glass.tunerRenders > 0);

    await controller.stop();
  });
});
