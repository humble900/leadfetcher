const fs = require('fs');
const path = require('path');

const chunksDir = 'C:/Users/USER/leadfetcher/apps/dashboard/.next/server/chunks/ssr';

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

const files = walk(chunksDir);
console.log(`Found ${files.length} chunk files. Searching...`);

for (const file of files) {
  if (!file.endsWith('.js')) continue;
  try {
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('wa.me') && content.includes('isExportModalOpen')) {
      console.log(`Found match in file: ${file}`);
      console.log(`Length of match file: ${content.length}`);
      
      // Dump the entire file or large chunks of it!
      // Let's write it to a temporary file in our scratch directory so we can read it easily!
      const destPath = 'C:/Users/USER/leadfetcher/scratch/leads_page_compiled.js';
      fs.writeFileSync(destPath, content, 'utf8');
      console.log(`Wrote compiled file to ${destPath}`);
      break;
    }
  } catch (e) {
    console.error('Error reading file:', file, e.message);
  }
}
