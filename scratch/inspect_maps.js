const fs = require('fs');
const path = require('path');
const nextDir = 'C:/Users/USER/leadfetcher/apps/dashboard/.next';

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
console.log('Found total maps:', files.length);

for (const f of files) {
  try {
    const mapData = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!mapData.sources) continue;
    const matching = mapData.sources.filter(s => s && s.toLowerCase().includes('dashboard'));
    if (matching.length > 0) {
      console.log('File:', path.basename(f));
      console.log('  Sources count:', mapData.sources.length);
      console.log('  Matching sources sample:', matching.slice(0, 5));
      if (mapData.sourcesContent) {
        console.log('  Sources content count:', mapData.sourcesContent.length);
      }
    }
  } catch (e) {}
}
