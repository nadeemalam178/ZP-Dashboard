const https = require('https');
const fs = require('fs');
const path = 'C:\\Users\\alamn\\Downloads\\Sangathan Search Website\\data_live.csv';

const SHEET_ID = '194ei4yzOTUMrnMLe1fseis__QQnRGk6rwA6U_WSVEUA';
const GID = '1400833008';
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;

console.log('Downloading live CSV from Google Sheets...');

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        console.log('Following redirect to:', res.headers.location.slice(0, 100) + '...');
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }

      if (res.statusCode !== 200) {
        return reject(new Error(`Failed with status code: ${res.statusCode}`));
      }

      const file = fs.createWriteStream(dest);
      let bytes = 0;
      let lines = 0;
      let lastChunk = '';

      res.on('data', (chunk) => {
        bytes += chunk.length;
        file.write(chunk);
        
        lastChunk += chunk.toString();
        const split = lastChunk.split('\n');
        lastChunk = split.pop();
        lines += split.length;
        
        if (bytes % (1024 * 1024 * 5) < chunk.length) {
          console.log(`Downloaded ${(bytes / 1024 / 1024).toFixed(1)} MB (${lines} lines)...`);
        }
      });

      res.on('end', () => {
        if (lastChunk) lines++;
        file.end();
        console.log(`Done! Total ${(bytes / 1024 / 1024).toFixed(2)} MB, ${lines} lines.`);
        resolve({ bytes, lines });
      });

      res.on('error', reject);
    }).on('error', reject);
  });
}

download(CSV_URL, path)
  .then(res => console.log('Download complete:', res))
  .catch(err => console.error('Download failed:', err));
