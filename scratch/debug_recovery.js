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
console.log('Total maps:', files.length);

for (const mapPath of files) {
  try {
    const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    if (!mapData.sourcesContent || !mapData.sources) continue;
    
    for (let i = 0; i < mapData.sources.length; i++) {
      const source = mapData.sources[i];
      const content = mapData.sourcesContent[i];
      
      if (!content || !source) continue;
      
      if (!source.includes('apps/dashboard/src/')) continue;
      if (source.includes('node_modules')) continue;
      if (source.endsWith('.css')) continue;
      if (source.includes('__turbopack')) continue;
      
      const match = source.match(/apps\/dashboard\/src\/(.*)/);
      if (!match) continue;
      
      const relPath = match[1];
      // Clean up relPath (remove query params or subpaths if present)
      // e.g. layout.tsx/__nextjs-internal-proxy.mjs or page.tsx/worker
      if (relPath.includes('/')) {
        const parts = relPath.split('/');
        // if parts contain page.tsx or layout.tsx, let's look closer
      }
      
      const targetPath = path.join(ROOT, 'apps/dashboard/src', relPath);
      
      console.log(`Matched source: ${source}`);
      console.log(`  relPath: ${relPath}`);
      console.log(`  targetPath: ${targetPath}`);
      console.log(`  Exists: ${fs.existsSync(targetPath)}`);
      if (fs.existsSync(targetPath)) {
        const existing = fs.readFileSync(targetPath, 'utf8');
        const lines = existing.split('\n').length;
        console.log(`  Existing lines: ${lines}, length: ${existing.length}`);
        console.log(`  Content length: ${content.length}`);
        console.log(`  Needs recovery: ${lines <= 3 && content.length > 500}`);
      }
    }
  } catch (e) {}
}
