import { CompositeAudioInputAdapter } from "./adapters/audioInputAdapter";
import { detectPlatformCapabilities } from "./adapters/capabilities";
import { GlassAdapterImpl } from "./adapters/glassAdapter";
import { Controller } from "./app/controller";
import { PhoneUI } from "./phone/phoneUI";

async function bootstrap(): Promise<void> {
  const glass = new GlassAdapterImpl();
  const capabilities = detectPlatformCapabilities();
  const audio = new CompositeAudioInputAdapter({ capabilities });

  let controller: Controller;

  const phone = new PhoneUI({
    onSelectInstrument: (instrument) => {
      void controller.selectInstrument(instrument).catch((error: unknown) => {
        console.error("Failed to select instrument", error);
      });
    },
    onSelectTuning: (tuningId) => {
      void controller.selectTuning(tuningId).catch((error: unknown) => {
        console.error("Failed to select tuning", error);
      });
    },
    onRetryAudio: () => {
      void controller.retryAudio().catch((error: unknown) => {
        console.error("Failed to retry audio", error);
      });
    },
    onEnableAudio: () => {
      void controller.enableAudioFromPhone().catch((error: unknown) => {
        console.error("Failed to enable audio", error);
      });
    },
  });

  controller = new Controller({
    glass,
    audio,
    phone,
  });

  await controller.start();
}

void bootstrap().catch((error: unknown) => {
  console.error("Failed to bootstrap G2 Multi Tuner", error);
});
