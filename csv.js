// Simple CSV parser for the expected format
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean);
  if (lines.length === 0) return [];
  const header = parseCSVLine(lines[0]);
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVLine(lines[i]);
    if (row.length === 0) continue;
    const obj = {};
    for (let j = 0; j < header.length; j++) obj[header[j]] = row[j] === undefined ? '' : row[j];
    out.push(obj);
  }
  return out;
}

function parseCSVLine(line) {
  const res = []; let cur = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false }
      } else cur += ch;
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { res.push(cur); cur = '' }
      else cur += ch;
    }
  }
  res.push(cur);
  return res.map(s => s.trim());
}