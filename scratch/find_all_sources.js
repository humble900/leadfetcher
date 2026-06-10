const fs = require('fs');
const path = require('path');
const ROOT = 'C:/Users/USER/leadfetcher';
const nextDir = path.join(ROOT, 'apps/dashboard/.next');

function walkDir(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath, ext));
    } else if (fullPath.endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walkDir(nextDir, '.map');
const uniqueSources = new Set();

for (const mapPath of files) {
  try {
    const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    if (!mapData.sources) continue;
    for (const source of mapData.sources) {
      if (source && source.includes('apps/dashboard/src/')) {
        uniqueSources.add(source);
      }
    }
  } catch (e) {}
}

console.log('Unique dashboard sources found in maps:');
const sorted = Array.from(uniqueSources).sort();
sorted.forEach(s => console.log('  ', s));
