// Autostart Explorer to ensure it's visible even if not registered in launcher
// Import this file once from your app entry (e.g., src/main.tsx): 
//   import "./os/autostart/explorer";

try {
  // We avoid tight coupling to Kernel's exact export shape:
  const mod = await import("../kernel/Kernel");
  const Kernel:any = (mod as any)?.default ?? (mod as any);
  if (Kernel?.get) {
    Kernel.get().spawn?.("explorer");
  }
} catch (e) {
  console.warn("[autostart] explorer spawn failed:", e);
}
