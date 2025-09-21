(function(){
  const STYLE_ID = "__explorerReadableScoped";
  function isExplorerWindow(el: Element): boolean {
    const titleAttr = (el.getAttribute("data-title") || el.getAttribute("aria-label") || "").toLowerCase()
    if (titleAttr.includes("explorer")) return true
    const titlebar = el.querySelector('[class*="title"], [class*="titlebar"], [data-role="title"]')
    if (titlebar && titlebar.textContent && titlebar.textContent.toLowerCase().includes("explorer")) return true
    if (el.querySelector(".file-list, [data-view='file-list'], [class*='filelist']")) return true
    return false
  }
  function styleSheet(): string {
    return `
    &, * {
      color: #eef3ff !important;
      -webkit-text-fill-color: currentColor !important;
      text-shadow: none !important;
      mix-blend-mode: normal !important;
      opacity: 1 !important;
      filter: none !important;
    }
    input, select, textarea, button {
      background: rgba(10,14,30,.6) !important;
      border: 1px solid rgba(120,140,200,.35) !important;
      color: #eef3ff !important;
      -webkit-text-fill-color: currentColor !important;
    }
    ::placeholder {
      color: rgba(210,220,255,.55) !important;
      -webkit-text-fill-color: rgba(210,220,255,.55) !important;
    }
    th, b, strong { color: #ffffff !important; }
    svg text { fill: currentColor !important; }
    [fill="#000"], [fill="black"] { fill: currentColor !important; }
    `;
  }
  function ensureStyle(container: Element){
    const id = STYLE_ID
    if (container.querySelector(`#${id}`)) return
    const style = document.createElement("style")
    style.id = id
    style.textContent = styleSheet()
    ;(container.querySelector(".content, .window-content, [data-role='content']") || container).appendChild(style)
  }
  function scan(){
    const candidates = document.querySelectorAll(
      ["[data-window]","[data-title]",".os-window",".window","[role='dialog']"].join(",")
    )
    candidates.forEach(el => { if (isExplorerWindow(el)) ensureStyle(el as Element) })
  }
  const mo = new MutationObserver(()=> scan())
  mo.observe(document.documentElement, { childList:true, subtree:true, attributes:true, attributeFilter:["data-title","aria-label","class"] })
  if (document.readyState === "loading"){ document.addEventListener("DOMContentLoaded", scan, { once:true }) } else { scan() }
})();
export {}
