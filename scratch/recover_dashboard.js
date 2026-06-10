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

function processMapData(mapData, onSource) {
  if (mapData.sources && mapData.sourcesContent) {
    for (let i = 0; i < mapData.sources.length; i++) {
      onSource(mapData.sources[i], mapData.sourcesContent[i]);
    }
  }
  if (mapData.sections) {
    for (const section of mapData.sections) {
      if (section.map) {
        processMapData(section.map, onSource);
      }
    }
  }
}

async function recoverDashboard() {
  console.log('═══ Recovering Dashboard from Turbopack Sectioned Source Maps ═══');
  
  if (!fs.existsSync(nextDir)) {
    console.error('.next directory not found:', nextDir);
    return;
  }

  const mapFiles = walkDir(nextDir, '.map');
  console.log(`Found ${mapFiles.length} source map files.`);

  // Keep track of the best/longest content found for each dashboard source file
  const extractedSources = new Map();

  for (const mapPath of mapFiles) {
    try {
      const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      processMapData(mapData, (source, content) => {
        if (!source || !content) return;
        
        // Match dashboard source files
        if (!source.includes('apps/dashboard/src/')) return;
        if (source.includes('node_modules')) return;
        if (source.includes('__turbopack')) return;
        
        // Clean up internal proxies or suffix files
        if (source.includes('__nextjs-internal-proxy') || source.includes('%20')) return;

        const match = source.match(/apps\/dashboard\/src\/(.*)/);
        if (!match) return;

        let relPath = match[1];
        // Clean trailing parts if path is e.g. "app/page.tsx/some-other-thing"
        if (relPath.includes('.tsx/')) {
          relPath = relPath.substring(0, relPath.indexOf('.tsx') + 4);
        } else if (relPath.includes('.ts/')) {
          relPath = relPath.substring(0, relPath.indexOf('.ts') + 3);
        }

        const normalized = relPath.replace(/\\/g, '/');
        
        // Save the content if it's longer than what we currently have
        const existing = extractedSources.get(normalized);
        if (!existing || content.length > existing.length) {
          extractedSources.set(normalized, content);
        }
      });
    } catch (e) {
      // Ignore parsing errors for specific maps
    }
  }

  console.log(`Extracted ${extractedSources.size} source files from maps.`);

  let restoredCount = 0;
  for (const [relPath, content] of extractedSources.entries()) {
    const targetPath = path.join(ROOT, 'apps/dashboard/src', relPath);
    
    let needsRestoration = false;
    if (!fs.existsSync(targetPath)) {
      needsRestoration = true;
    } else {
      const existing = fs.readFileSync(targetPath, 'utf8');
      const lines = existing.split('\n').length;
      // If it starts with quote, or has <= 6 lines and content in map is significantly longer
      if (existing.startsWith('"') || (lines <= 6 && content.length > existing.length)) {
        needsRestoration = true;
      }
    }

    if (needsRestoration) {
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content, 'utf8');
      console.log(`  ✅ Restored: ${relPath} (${content.length} bytes)`);
      restoredCount++;
    } else {
      console.log(`  ✓  Skipped (already OK): ${relPath}`);
    }
  }

  console.log(`\nRestoration complete: Restored ${restoredCount} dashboard files.`);
}

recoverDashboard().catch(console.error);
