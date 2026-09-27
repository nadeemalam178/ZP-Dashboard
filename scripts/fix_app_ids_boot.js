const fs = require('fs');
const targetPath = 'C:\\Users\\alamn\\Downloads\\Sangathan Search Website\\app.js';
let code = fs.readFileSync(targetPath, 'utf8');

// 1. Fix IDs in initEvents
code = code.replace(
  "$('#btn-clear-filters').addEventListener('click', () => {",
  "const btnClear = $('#clear-filters') || $('#btn-clear-filters');\n    if (btnClear) btnClear.addEventListener('click', () => {"
);
code = code.replace(
  "$('#btn-export-csv').addEventListener('click', () => exportCSV());",
  "const btnCsv = $('#export-csv') || $('#btn-export-csv');\n    if (btnCsv) btnCsv.addEventListener('click', () => exportCSV());"
);
code = code.replace(
  "$('#btn-export-excel').addEventListener('click', () => exportExcel());",
  "const btnXlsx = $('#export-excel') || $('#btn-export-excel');\n    if (btnXlsx) btnXlsx.addEventListener('click', () => exportExcel());"
);
code = code.replace(
  "const pdfBtn = $('#btn-export-pdf');",
  "const pdfBtn = $('#export-pdf') || $('#btn-export-pdf');"
);
code = code.replace(
  "const btnRefresh = $('#btn-refresh');",
  "const btnRefresh = $('#btn-refresh-data') || $('#btn-refresh');"
);

// 2. Fix INIT runner
code = code.replace(
  `  // ─── INIT ─────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    updateViewModeUI();
    initEvents();
    loadData();
  });`,
  `  // ─── INIT ─────────────────────────────────────────
  function boot() {
    updateViewModeUI();
    initEvents();
    loadData();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }`
);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully updated app.js with exact IDs and readyState boot handling');
