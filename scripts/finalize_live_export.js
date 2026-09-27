const fs = require('fs');
const path = require('path');

const src = 'C:\\Users\\alamn\\Downloads\\ZP Dashboard\\scripts\\export_live_data.js';
const dst = 'C:\\Users\\alamn\\Downloads\\Sangathan Search Website\\scripts\\export_data.js';

let content = fs.readFileSync(src, 'utf8');
// Point to data.csv
content = content.replace("const CSV_FILE = path.join(ROOT_DIR, 'data_live.csv');", "const CSV_FILE = path.join(ROOT_DIR, 'data.csv');");

fs.writeFileSync(dst, content, 'utf8');
console.log('Updated scripts/export_data.js in Sangathan Search Website');

// Replace data.csv with data_live.csv
const liveCsv = 'C:\\Users\\alamn\\Downloads\\Sangathan Search Website\\data_live.csv';
const targetCsv = 'C:\\Users\\alamn\\Downloads\\Sangathan Search Website\\data.csv';

if (fs.existsSync(liveCsv)) {
  fs.copyFileSync(liveCsv, targetCsv);
  fs.unlinkSync(liveCsv);
  console.log('Replaced data.csv with fresh live CSV (41.26 MB) and removed data_live.csv');
}
