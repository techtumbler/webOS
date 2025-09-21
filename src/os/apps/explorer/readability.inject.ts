// src/os/apps/explorer/readability.inject.ts
// Guarantees Explorer readability styles are applied even if CSS imports are skipped.
// Import this file once in the Explorer entry.
const CSS = `
/* injected explorer readability */
:root{
  --exp-fg: #eef3ff;
  --exp-fg-dim: #c5d2ff;
  --exp-bg: #0c1224;
  --exp-bg-elev: #0f1733;
  --exp-border: #1e2a52;
  --exp-row-hover: #121c3a;
  --exp-row-active: #172554;
}
body :where(.explorer, [data-app="explorer"], [data-app*="Explorer"], [data-window*="Explorer"], [data-title*="Explorer"]) {
  color: var(--exp-fg) !important;
  font: 600 14px/1.5 system-ui, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji" !important;
  letter-spacing: .01em !important;
  text-shadow: none !important;
  opacity: 1 !important;
}
body :where(.explorer, [data-app*="Explorer"]) table.file-list thead th{
  background: #0e1731 !important;
  color: var(--exp-fg-dim) !important;
  font-weight: 700 !important;
  padding: 8px 10px !important;
  position: sticky !important;
  top: 0 !important;
  z-index: 2 !important;
}
`
function ensure(){
  const id = "explorer-readability-css"
  if (document.getElementById(id)) return
  const style = document.createElement("style")
  style.id = id
  style.setAttribute("data-origin","readability.inject.ts")
  style.textContent = CSS
  document.head.appendChild(style)
}
ensure()

export {}
