const fs = require('fs');
const path = require('path');

const targetProjectDir = path.resolve('C:/Users/alamn/Downloads/Sangathan Search Website');

// 1. vercel.json
const vercelJson = {
  version: 2,
  cleanUrls: true,
  trailingSlash: false,
  headers: [
    {
      source: "/data/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" },
        { key: "Access-Control-Allow-Origin", value: "*" }
      ]
    },
    {
      source: "/api/(.*)",
      headers: [
        { key: "Cache-Control", value: "public, max-age=60, s-maxage=300, stale-while-revalidate=3600" },
        { key: "Access-Control-Allow-Origin", value: "*" }
      ]
    }
  ]
};
fs.writeFileSync(path.join(targetProjectDir, 'vercel.json'), JSON.stringify(vercelJson, null, 2));

// 2. _headers
const headersContent = `/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/data/*
  Cache-Control: public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800
  Access-Control-Allow-Origin: *

/api/*
  Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=3600
  Access-Control-Allow-Origin: *

/app.js
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800

/style.css
  Cache-Control: public, max-age=86400, stale-while-revalidate=604800
`;
fs.writeFileSync(path.join(targetProjectDir, '_headers'), headersContent);

// 3. package.json
const packageJson = {
  name: "sangathan-search",
  version: "8.0.0",
  description: "Sangathan Contact Directory with High-Performance Static Data Architecture",
  scripts: {
    export: "node scripts/export_data.js",
    build: "node scripts/export_data.js",
    start: "npx serve -l 3000 ."
  },
  dependencies: {
    "@vercel/analytics": "^1.5.0"
  }
};
fs.writeFileSync(path.join(targetProjectDir, 'package.json'), JSON.stringify(packageJson, null, 2));

// 4. .github/workflows/sync-sheets.yml
const workflowsDir = path.join(targetProjectDir, '.github', 'workflows');
if (!fs.existsSync(workflowsDir)) fs.mkdirSync(workflowsDir, { recursive: true });

const workflowContent = `name: Sync Google Sheets Data

on:
  schedule:
    # Run every 6 hours automatically (UTC)
    - cron: '0 */6 * * *'
  workflow_dispatch: # Allows manual trigger from GitHub Actions tab

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Export & Pre-index Data
        run: |
          npm run export

      - name: Commit and Push Changes
        run: |
          git config --global user.name "github-actions[bot]"
          git config --global user.email "github-actions[bot]@users.noreply.github.com"
          git add data/
          git diff --quiet && git diff --staged --quiet || (git commit -m "chore(data): auto-sync data from Google Sheets [skip ci]" && git push)
`;
fs.writeFileSync(path.join(workflowsDir, 'sync-sheets.yml'), workflowContent);

// 5. Update index.html to add Vercel Analytics snippet in <head>
let indexHtml = fs.readFileSync(path.join(targetProjectDir, 'index.html'), 'utf8');
if (!indexHtml.includes('_vercel/insights')) {
  const vercelSnippet = `
  <!-- Vercel Web Analytics -->
  <script>
    window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  </script>
  <script defer src="/_vercel/insights/script.js"></script>
</head>`;
  indexHtml = indexHtml.replace('</head>', vercelSnippet);
  fs.writeFileSync(path.join(targetProjectDir, 'index.html'), indexHtml);
}

// 6. Update .gitignore
let gitignore = fs.existsSync(path.join(targetProjectDir, '.gitignore'))
  ? fs.readFileSync(path.join(targetProjectDir, '.gitignore'), 'utf8')
  : '';
if (!gitignore.includes('node_modules')) {
  gitignore += '\nnode_modules/\n';
  fs.writeFileSync(path.join(targetProjectDir, '.gitignore'), gitignore);
}

console.log('Successfully configured vercel.json, _headers, package.json, GitHub Actions, and Vercel Analytics in index.html!');
