// src/os/apps/explorer/readability.force.ts
// Nuclear option: ensures readable text color inside Explorer even if other CSS sets black.
// Import this file ONCE in the Explorer entry after other CSS imports.
(function(){
  const STYLE_ID = "explorer-readability-force";
  if (document.getElementById(STYLE_ID)) return;

  const css = `
  /* Force readable text within Explorer containers */
  body :where(.explorer, [data-app="explorer"], [data-app*="Explorer"], [data-window*="Explorer"], [data-title*="Explorer"]) {
    --_exp_text: #eef3ff;
    color: var(--_exp_text) !important;
  }
  /* Inherit readable color everywhere inside; fix Safari fill color */
  body :where(.explorer, [data-app*="Explorer"]) * {
    color: inherit !important;
    -webkit-text-fill-color: currentColor !important;
    text-shadow: none !important;
    filter: none !important;
    opacity: 1 !important;
    mix-blend-mode: normal !important;
  }
  /* Inputs, placeholders */
  body :where(.explorer, [data-app*="Explorer"]) input,
  body :where(.explorer, [data-app*="Explorer"]) select,
  body :where(.explorer, [data-app*="Explorer"]) textarea {
    color: var(--_exp_text) !important;
    -webkit-text-fill-color: currentColor !important;
    background: rgba(10,14,30,.6) !important;
    border: 1px solid rgba(120,140,200,.35) !important;
  }
  body :where(.explorer, [data-app*="Explorer"]) input::placeholder,
  body :where(.explorer, [data-app*="Explorer"]) textarea::placeholder {
    color: rgba(210,220,255,.5) !important;
    -webkit-text-fill-color: rgba(210,220,255,.5) !important;
  }
  /* Links and emphasis */
  body :where(.explorer, [data-app*="Explorer"]) a {
    color: #b9d0ff !important;
  }
  body :where(.explorer, [data-app*="Explorer"]) strong, 
  body :where(.explorer, [data-app*="Explorer"]) b,
  body :where(.explorer, [data-app*="Explorer"]) th {
    color: #ffffff !important;
  }
  /* Tables / cells */
  body :where(.explorer, [data-app*="Explorer"]) td, 
  body :where(.explorer, [data-app*="Explorer"]) th {
    color: inherit !important;
    background: transparent !important;
  }
  /* SVG text & fills */
  body :where(.explorer, [data-app*="Explorer"]) svg text {
    fill: currentColor !important;
  }
  body :where(.explorer, [data-app*="Explorer"]) svg *[fill="#000"],
  body :where(.explorer, [data-app*="Explorer"]) svg *[fill="black"] {
    fill: currentColor !important;
  }
  `;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.setAttribute("data-origin","readability.force.ts");
  style.textContent = css;
  document.head.appendChild(style);
})();
export {};
