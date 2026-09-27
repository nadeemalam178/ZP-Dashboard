const fs = require('fs');
const targetPath = 'C:\\Users\\alamn\\Downloads\\Sangathan Search Website\\api\\search.js';
let content = fs.readFileSync(targetPath, 'utf8');

// Replace loadIndex path resolution
content = content.replace(
  "const filePath = path.join(process.cwd(), 'data', 'search_index.json');",
  "let filePath = path.join(__dirname, '..', 'data', 'search_index.json');\n    if (!fs.existsSync(filePath)) filePath = path.join(process.cwd(), 'data', 'search_index.json');"
);

// Increase perPage cap from 200 to 1000
content = content.replace(
  "perPage = Math.min(200, Math.max(10, parseInt(req.query.perPage, 10) || 50));",
  "perPage = Math.min(1000, Math.max(10, parseInt(req.query.perPage, 10) || 50));"
);
content = content.replace(
  "perPage = Math.min(200, Math.max(10, parseInt(params.get('perPage'), 10) || 50));",
  "perPage = Math.min(1000, Math.max(10, parseInt(params.get('perPage'), 10) || 50));"
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Updated api/search.js successfully');
