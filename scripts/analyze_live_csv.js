const fs = require('fs');
const readline = require('readline');

async function analyze() {
  const p = 'C:\\Users\\alamn\\Downloads\\Sangathan Search Website\\data_live.csv';
  const fileStream = fs.createReadStream(p);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let header = null;
  let inQuotes = false;
  let currentRecord = '';
  let totalRows = 0;
  
  const fullTuples = new Set();
  const phoneAndName = new Set();
  const districtCounts = {};

  for await (const line of rl) {
    let quoteCount = 0;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') quoteCount++;
    }

    if (currentRecord) currentRecord += '\n' + line;
    else currentRecord = line;

    if (!inQuotes) {
      if (quoteCount % 2 !== 0) {
        inQuotes = true;
      } else {
        processRow(currentRecord);
        currentRecord = '';
      }
    } else {
      if (quoteCount % 2 !== 0) {
        inQuotes = false;
        processRow(currentRecord);
        currentRecord = '';
      }
    }
  }

  function parseLine(text) {
    const res = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (inQ && text[i+1] === '"') { cur += '"'; i++; }
        else { inQ = !inQ; }
      } else if (c === ',' && !inQ) {
        res.push(cur.trim());
        cur = '';
      } else {
        cur += c;
      }
    }
    res.push(cur.trim());
    return res;
  }

  function processRow(recordText) {
    if (!header) {
      header = parseLine(recordText);
      console.log('Headers:', header);
      return;
    }

    totalRows++;
    const vals = parseLine(recordText);
    const row = {};
    header.forEach((h, idx) => { row[h] = vals[idx] || ''; });

    const dist = row['District'] || 'Unknown';
    districtCounts[dist] = (districtCounts[dist] || 0) + 1;

    const fullKey = vals.map(v => v.toLowerCase().trim()).join('||');
    fullTuples.add(fullKey);

    const contact = (row['Contact No.'] || '').replace(/\D/g, '');
    const name = (row['Name'] || '').trim().toLowerCase();
    phoneAndName.add(`${contact}_${name}`);

    if (totalRows % 50000 === 0) {
      console.log(`Processed ${totalRows} rows...`);
    }
  }

  console.log('=== ANALYSIS COMPLETE ===');
  console.log('Total Raw Rows:', totalRows);
  console.log('Unique Full Rows (user definition):', fullTuples.size);
  console.log('Unique Phone+Name:', phoneAndName.size);
  console.log('Districts count:', Object.keys(districtCounts).length);
  const sortedDist = Object.entries(districtCounts).sort((a,b) => b[1] - a[1]);
  console.log('Top 10 Districts:');
  sortedDist.slice(0, 10).forEach(d => console.log(`  ${d[0]}: ${d[1]} rows`));
}

analyze();
