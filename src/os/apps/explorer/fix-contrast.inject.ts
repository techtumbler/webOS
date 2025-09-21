(function(){
  const ID="explorer-contrast-inject";
  if (document.getElementById(ID)) return;
  const style=document.createElement("style");
  style.id=ID;
  style.textContent = `
    :root{ --expl-text:#e9f2ff; --expl-text-dim:#c6d3ff; }
    :where(.explorer,[data-title*="Explorer"]) .file-list,
    :where(.explorer,[data-title*="Explorer"]) .file-list *,
    :where(.file-list).file-list, :where(.file-list).file-list *{
      color: var(--expl-text) !important;
      -webkit-text-fill-color: currentColor !important;
      text-shadow: none !important;
    }
    :where(.explorer,[data-title*="Explorer"]) table.file-list thead th,
    :where(.file-list).file-list thead th{
      color: var(--expl-text-dim) !important; font-weight:700 !important;
    }
  `;
  document.head.appendChild(style);
})();
export {};
