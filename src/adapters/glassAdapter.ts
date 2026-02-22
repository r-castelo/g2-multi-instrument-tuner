import {
  CreateStartUpPageContainer,
  EvenAppBridge,
  ListContainerProperty,
  ListItemContainerProperty,
  OsEventTypeList,
  RebuildPageContainer,
  StartUpPageCreateResult,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenHubEvent,
} from "@evenrealities/even_hub_sdk";
import {
  CONTAINER_IDS,
  CONTAINER_NAMES,
  GLASS_LAYOUT,
  TEXT_LIMITS,
  TIMING,
} from "../config/constants";
import type {
  GestureEvent,
  GlassAdapter,
  TunerViewModel,
  Unsubscribe,
} from "../types/contracts";

type ScreenMode = "tuning" | "menu" | "error" | null;

export class GlassAdapterImpl implements GlassAdapter {
  private bridge: EvenAppBridge | null = null;
  private unsubscribeHub: Unsubscribe | null = null;
  private startupDone = false;
  private screenMode: ScreenMode = null;
  private readonly gestureHandlers = new Set<(event: GestureEvent) => void>();
  private lastScrollMs = 0;

  async connect(): Promise<void> {
    if (this.bridge) return;

    this.bridge = await this.waitForBridge();
    this.bindEvents();
  }

  getBridge(): EvenAppBridge | null {
    return this.bridge;
  }

  onGesture(handler: (event: GestureEvent) => void): Unsubscribe {
    this.gestureHandlers.add(handler);
    return () => {
      this.gestureHandlers.delete(handler);
    };
  }

  async showTuner(view: TunerViewModel): Promise<void> {
    const content = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y,
      width: GLASS_LAYOUT.width,
      height: GLASS_LAYOUT.height,
      containerID: CONTAINER_IDS.content,
      containerName: CONTAINER_NAMES.content,
      isEventCapture: 1,
      content: view.content.slice(0, TEXT_LIMITS.startupOrRebuild),
    });

    const status = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.statusY,
      width: GLASS_LAYOUT.width,
      height: GLASS_LAYOUT.statusHeight,
      containerID: CONTAINER_IDS.status,
      containerName: CONTAINER_NAMES.status,
      isEventCapture: 0,
      content: view.status.slice(0, TEXT_LIMITS.startupOrRebuild),
    });

    await this.renderContainers({ textObject: [content, status] });
    this.screenMode = "tuning";
  }

  async updateTuner(view: TunerViewModel): Promise<void> {
    if (!this.bridge) {
      throw new Error("Not connected");
    }

    if (this.screenMode !== "tuning") {
      await this.showTuner(view);
      return;
    }

    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: CONTAINER_IDS.content,
        containerName: CONTAINER_NAMES.content,
        contentOffset: 0,
        contentLength: view.content.length,
        content: view.content.slice(0, TEXT_LIMITS.upgrade),
      }),
    );

    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: CONTAINER_IDS.status,
        containerName: CONTAINER_NAMES.status,
        contentOffset: 0,
        contentLength: view.status.length,
        content: view.status.slice(0, TEXT_LIMITS.upgrade),
      }),
    );
  }

  async showListMenu(items: string[], statusText: string): Promise<void> {
    const clampedItems = items.slice(0, 20).map((item) => item.slice(0, 64));
    const safeItems = clampedItems.length > 0 ? clampedItems : ["(empty)"];

    const listContainer = new ListContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y,
      width: GLASS_LAYOUT.width,
      height: GLASS_LAYOUT.height,
      containerID: CONTAINER_IDS.content,
      containerName: CONTAINER_NAMES.content,
      isEventCapture: 1,
      itemContainer: new ListItemContainerProperty({
        itemCount: safeItems.length,
        itemName: safeItems,
        isItemSelectBorderEn: 1,
      }),
    });

    const status = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.statusY,
      width: GLASS_LAYOUT.width,
      height: GLASS_LAYOUT.statusHeight,
      containerID: CONTAINER_IDS.status,
      containerName: CONTAINER_NAMES.status,
      isEventCapture: 0,
      content: statusText.slice(0, TEXT_LIMITS.startupOrRebuild),
    });

    await this.renderContainers({
      listObject: [listContainer],
      textObject: [status],
    });

    this.screenMode = "menu";
  }

  async showError(text: string): Promise<void> {
    const content = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.y,
      width: GLASS_LAYOUT.width,
      height: GLASS_LAYOUT.height,
      containerID: CONTAINER_IDS.content,
      containerName: CONTAINER_NAMES.content,
      isEventCapture: 1,
      content: text.slice(0, TEXT_LIMITS.startupOrRebuild),
    });

    const status = new TextContainerProperty({
      xPosition: GLASS_LAYOUT.x,
      yPosition: GLASS_LAYOUT.statusY,
      width: GLASS_LAYOUT.width,
      height: GLASS_LAYOUT.statusHeight,
      containerID: CONTAINER_IDS.status,
      containerName: CONTAINER_NAMES.status,
      isEventCapture: 0,
      content: "ERROR",
    });

    await this.renderContainers({ textObject: [content, status] });
    this.screenMode = "error";
  }

  private async renderContainers(payload: {
    listObject?: ListContainerProperty[];
    textObject?: TextContainerProperty[];
  }): Promise<void> {
    if (!this.bridge) {
      throw new Error("Not connected");
    }

    const containerTotalNum =
      (payload.listObject?.length ?? 0) + (payload.textObject?.length ?? 0);

    const config = {
      containerTotalNum,
      ...(payload.listObject ? { listObject: payload.listObject } : {}),
      ...(payload.textObject ? { textObject: payload.textObject } : {}),
    };

    if (!this.startupDone) {
      const result = await this.bridge.createStartUpPageContainer(
        new CreateStartUpPageContainer(config),
      );

      if (result !== StartUpPageCreateResult.success) {
        throw new Error(`createStartUpPageContainer failed: ${String(result)}`);
      }

      this.startupDone = true;
      return;
    }

    let ok = await this.bridge.rebuildPageContainer(new RebuildPageContainer(config));
    if (!ok) {
      await this.delay(TIMING.REBUILD_RETRY_DELAY_MS);
      ok = await this.bridge.rebuildPageContainer(new RebuildPageContainer(config));
    }

    if (!ok) {
      throw new Error("rebuildPageContainer failed after retry");
    }
  }

  private bindEvents(): void {
    if (!this.bridge) return;

    this.unsubscribeHub?.();
    this.unsubscribeHub = this.bridge.onEvenHubEvent((event) => {
      const gesture = this.mapEventToGesture(event);
      if (!gesture) return;

      if (gesture.kind === "SCROLL_FWD" || gesture.kind === "SCROLL_BACK") {
        const now = Date.now();
        if (now - this.lastScrollMs < TIMING.SCROLL_COOLDOWN_MS) {
          return;
        }
        this.lastScrollMs = now;
      }

      for (const handler of this.gestureHandlers) {
        handler(gesture);
      }
    });
  }

  private mapEventToGesture(event: EvenHubEvent): GestureEvent | null {
    const eventType =
      event.listEvent?.eventType ??
      event.textEvent?.eventType ??
      event.sysEvent?.eventType;

    if (eventType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
      return { kind: "SCROLL_FWD" };
    }

    if (eventType === OsEventTypeList.SCROLL_TOP_EVENT) {
      return { kind: "SCROLL_BACK" };
    }

    if (eventType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      return {
        kind: "DOUBLE_TAP",
        listIndex: event.listEvent?.currentSelectItemIndex,
      };
    }

    // CLICK_EVENT = 0 often arrives as undefined due SDK deserialization quirk.
    if (
      eventType === OsEventTypeList.CLICK_EVENT ||
      eventType === undefined
    ) {
      return {
        kind: "TAP",
        listIndex: event.listEvent?.currentSelectItemIndex,
      };
    }

    if (eventType === OsEventTypeList.FOREGROUND_ENTER_EVENT) {
      return { kind: "FOREGROUND_ENTER" };
    }

    if (eventType === OsEventTypeList.FOREGROUND_EXIT_EVENT) {
      return { kind: "FOREGROUND_EXIT" };
    }

    return null;
  }

  private async waitForBridge(): Promise<EvenAppBridge> {
    let timer: ReturnType<typeof setTimeout> | null = null;

    try {
      const bridge = await Promise.race([
        waitForEvenAppBridge(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                "Timed out waiting for EvenAppBridge. Open this URL via Even App dev mode.",
              ),
            );
          }, TIMING.BRIDGE_TIMEOUT_MS);
        }),
      ]);

      return bridge;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
