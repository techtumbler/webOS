// src/types/window-management.d.ts
// Minimal types for optional Window Management API support.
interface ScreenDetails extends EventTarget {
  readonly screens: ReadonlyArray<Screen>;
  readonly currentScreen: Screen;
  onscreenschange: ((this: ScreenDetails, ev: Event) => any) | null;
  oncurrentscreenchange: ((this: ScreenDetails, ev: Event) => any) | null;
}
interface Window {
  getScreenDetails?: () => Promise<ScreenDetails>;
}
