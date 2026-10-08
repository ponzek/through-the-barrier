/* csv.js -- minimal RFC-4180 CSV parser (quoted fields, CRLF). Browser: window.CSV, Node: module.exports */
(function (root) {
  "use strict";
  function parse(text) {
    const rows = []; let row = [], cur = "", q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) { if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
      else if (c === '"') q = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; }
      else cur += c;
    }
    if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
    const head = rows.shift();
    return rows.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }
  root.CSV = { parse };
  if (typeof module !== "undefined" && module.exports) module.exports = root.CSV;
})(typeof window !== "undefined" ? window : globalThis);
