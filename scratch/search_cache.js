const fs = require('fs');
const path = require('path');

const cacheDir = 'C:/Users/USER/leadfetcher/apps/dashboard/.next/dev/cache/turbopack';

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      walk(fullPath, results);
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

const files = walk(cacheDir);
console.log(`Found ${files.length} cache files. Searching...`);

for (const file of files) {
  if (!file.endsWith('.sst')) continue;
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('wa.me') || content.includes('isExportModalOpen')) {
      console.log(`Found match in file: ${file}`);
      // Find the position of 'wa.me' or 'isExportModalOpen'
      let idx = content.indexOf('wa.me');
      if (idx === -1) idx = content.indexOf('isExportModalOpen');
      
      // Print surrounding context (e.g. 5000 characters before and after)
      const start = Math.max(0, idx - 5000);
      const end = Math.min(content.length, idx + 10000);
      console.log('--- Context start ---');
      console.log(content.substring(start, end));
      console.log('--- Context end ---');
      break;
    }
  } catch (e) {
    // Ignore read errors
  }
}
