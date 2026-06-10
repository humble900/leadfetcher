/**
 * Comprehensive workspace recovery script.
 * 
 * Strategy:
 * 1. Dashboard pages: Extract from Next.js Turbopack SSR source maps (they contain original TSX)
 * 2. API/Worker TS files: Reconstruct from compiled JS in dist/ directories
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/USER/leadfetcher';
const SSR_DIR = path.join(ROOT, 'apps/dashboard/.next/server/chunks/ssr');

// ─── Phase 1: Recover Dashboard pages from SSR source maps ───

function recoverFromSourceMaps() {
  console.log('\n═══ Phase 1: Recovering Dashboard pages from SSR source maps ═══');
  
  const nextDir = path.join(ROOT, 'apps/dashboard/.next');
  if (!fs.existsSync(nextDir)) {
    console.error('Dashboard .next directory not found:', nextDir);
    return;
  }
  
  const files = walkDir(nextDir, '.map');
  console.log(`Found ${files.length} source map files`);
  
  let recovered = 0;
  
  for (const mapPath of files) {
    try {
      const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
      
      if (!mapData.sourcesContent || !mapData.sources) continue;
      
      for (let i = 0; i < mapData.sources.length; i++) {
        const source = mapData.sources[i];
        const content = mapData.sourcesContent[i];
        
        if (!content || !source) continue;
        
        // Only process our app source files (not CSS modules or node_modules)
        if (!source.includes('apps/dashboard/src/')) continue;
        if (source.includes('node_modules')) continue;
        if (source.endsWith('.css')) continue;
        if (source.includes('__turbopack')) continue;
        
        // Extract the relative path from the source
        const match = source.match(/apps\/dashboard\/src\/(.*)/);
        if (!match) continue;
        
        const relPath = match[1];
        const targetPath = path.join(ROOT, 'apps/dashboard/src', relPath);
        
        // Check if target file is missing or corrupted (< 3000 bytes and 1-2 lines)
        let needsRecovery = false;
        if (!fs.existsSync(targetPath)) {
          needsRecovery = true;
        } else {
          const existing = fs.readFileSync(targetPath, 'utf8');
          const lineCount = existing.split('\n').length;
          // If file has very few lines but content is large (truncated string), it's corrupted
          if (lineCount <= 3 && content.length > 500) {
            needsRecovery = true;
          }
        }
        
        if (needsRecovery) {
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          fs.writeFileSync(targetPath, content, 'utf8');
          console.log(`  ✅ Recovered: ${relPath} (${content.length} bytes)`);
          recovered++;
        }
      }
    } catch (e) {
      // Skip files that can't be parsed
    }
  }
  
  console.log(`Phase 1 complete: Recovered ${recovered} dashboard files`);
}

// ─── Phase 2: Recover API/Worker files from compiled JS ───

function recoverFromCompiledJS() {
  console.log('\n═══ Phase 2: Recovering API/Worker files from compiled JS ═══');
  
  const apps = [
    { name: 'api', distDir: 'apps/api/dist', srcDir: 'apps/api/src' },
    { name: 'worker', distDir: 'apps/worker/dist', srcDir: 'apps/worker/src' },
  ];
  
  let recovered = 0;
  
  for (const app of apps) {
    const distPath = path.join(ROOT, app.distDir);
    const srcPath = path.join(ROOT, app.srcDir);
    
    if (!fs.existsSync(distPath)) {
      console.log(`  Skipping ${app.name}: dist directory not found`);
      continue;
    }
    
    // Walk dist directory for .js files
    const jsFiles = walkDir(distPath, '.js');
    
    for (const jsFile of jsFiles) {
      if (jsFile.endsWith('.js.map')) continue;
      if (jsFile.endsWith('.d.ts')) continue;
      
      const relPath = path.relative(distPath, jsFile);
      const tsRelPath = relPath.replace(/\.js$/, '.ts');
      const tsPath = path.join(srcPath, tsRelPath);
      
      // Check if TS source is missing or corrupted
      let needsRecovery = false;
      if (!fs.existsSync(tsPath)) {
        needsRecovery = true;
      } else {
        const existing = fs.readFileSync(tsPath, 'utf8');
        const lineCount = existing.split('\n').length;
        if (lineCount <= 3 && existing.length > 100) {
          needsRecovery = true;
        }
      }
      
      if (needsRecovery) {
        // Try to read the source map first (it might contain sourcesContent)
        const mapPath = jsFile + '.map';
        let sourceContent = null;
        
        if (fs.existsSync(mapPath)) {
          try {
            const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
            if (mapData.sourcesContent && mapData.sourcesContent.length > 0) {
              // Use the first non-empty sourcesContent
              for (const sc of mapData.sourcesContent) {
                if (sc && sc.length > 100) {
                  sourceContent = sc;
                  break;
                }
              }
            }
          } catch (e) {}
        }
        
        if (!sourceContent) {
          // Fallback: use the compiled JS (strip sourceMappingURL comment)
          let jsContent = fs.readFileSync(jsFile, 'utf8');
          jsContent = jsContent.replace(/\/\/# sourceMappingURL=.*$/m, '').trim();
          sourceContent = jsContent;
        }
        
        fs.mkdirSync(path.dirname(tsPath), { recursive: true });
        fs.writeFileSync(tsPath, sourceContent, 'utf8');
        console.log(`  ✅ Recovered: ${app.name}/${tsRelPath} (${sourceContent.length} bytes, ${sourceContent.includes('export') ? 'has exports' : 'no exports'})`);
        recovered++;
      }
    }
  }
  
  console.log(`Phase 2 complete: Recovered ${recovered} API/Worker files`);
}

// ─── Phase 3: Recover shared package files from compiled JS ───

function recoverSharedPackage() {
  console.log('\n═══ Phase 3: Recovering shared package files ═══');
  
  const distPath = path.join(ROOT, 'packages/shared/dist');
  const srcPath = path.join(ROOT, 'packages/shared/src');
  
  if (!fs.existsSync(distPath)) {
    console.log('  Shared package dist not found');
    return;
  }
  
  let recovered = 0;
  const jsFiles = walkDir(distPath, '.js');
  
  for (const jsFile of jsFiles) {
    if (jsFile.endsWith('.js.map')) continue;
    if (jsFile.endsWith('.d.ts')) continue;
    
    const relPath = path.relative(distPath, jsFile);
    const tsRelPath = relPath.replace(/\.js$/, '.ts');
    const tsPath = path.join(srcPath, tsRelPath);
    
    let needsRecovery = false;
    if (!fs.existsSync(tsPath)) {
      needsRecovery = true;
    } else {
      const existing = fs.readFileSync(tsPath, 'utf8');
      const lineCount = existing.split('\n').length;
      if (lineCount <= 3 && existing.length > 100) {
        needsRecovery = true;
      }
    }
    
    if (needsRecovery) {
      // Try source map first
      const mapPath = jsFile + '.map';
      let sourceContent = null;
      
      if (fs.existsSync(mapPath)) {
        try {
          const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
          if (mapData.sourcesContent && mapData.sourcesContent.length > 0) {
            for (const sc of mapData.sourcesContent) {
              if (sc && sc.length > 100) {
                sourceContent = sc;
                break;
              }
            }
          }
        } catch (e) {}
      }
      
      if (!sourceContent) {
        let jsContent = fs.readFileSync(jsFile, 'utf8');
        jsContent = jsContent.replace(/\/\/# sourceMappingURL=.*$/m, '').trim();
        sourceContent = jsContent;
      }
      
      fs.mkdirSync(path.dirname(tsPath), { recursive: true });
      fs.writeFileSync(tsPath, sourceContent, 'utf8');
      console.log(`  ✅ Recovered: shared/${tsRelPath} (${sourceContent.length} bytes)`);
      recovered++;
    }
  }
  
  console.log(`Phase 3 complete: Recovered ${recovered} shared package files`);
}

// ─── Helper: Walk directory ───

function walkDir(dir, ext) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath, ext));
    } else if (fullPath.endsWith(ext) && !fullPath.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Run all phases ───

recoverFromSourceMaps();
recoverFromCompiledJS();
recoverSharedPackage();

// ─── Phase 4: Summary — check what's still missing ───
console.log('\n═══ Phase 4: Verification — checking all source files ═══');

const criticalFiles = [
  'apps/api/src/config/database.ts',
  'apps/api/src/config/dotenv.ts',
  'apps/api/src/config/env.ts',
  'apps/api/src/config/redis.ts',
  'apps/api/src/db/schema.ts',
  'apps/api/src/db/seed.ts',
  'apps/api/src/middleware/auth.middleware.ts',
  'apps/api/src/middleware/errorHandler.middleware.ts',
  'apps/api/src/middleware/limit.middleware.ts',
  'apps/api/src/middleware/tenant.middleware.ts',
  'apps/api/src/routes/auth.routes.ts',
  'apps/api/src/routes/jobs.routes.ts',
  'apps/api/src/routes/leads.routes.ts',
  'apps/api/src/services/auth.service.ts',
  'apps/api/src/services/job.service.ts',
  'apps/api/src/services/lead.service.ts',
  'apps/api/src/services/usage.service.ts',
  'apps/api/src/utils/hash.ts',
  'apps/api/src/utils/jwt.ts',
  'apps/api/src/utils/logger.ts',
  'apps/worker/src/engine/discovery.ts',
  'apps/worker/src/engine/dom-extractor.ts',
  'apps/worker/src/engine/extractor.ts',
  'apps/worker/src/engine/fetcher.ts',
  'apps/worker/src/engine/llm-extractor.ts',
  'apps/worker/src/engine/regex-extractor.ts',
  'apps/worker/src/pipeline/processor.ts',
  'apps/worker/src/processors/db-schema.ts',
  'apps/worker/src/processors/job.processor.ts',
  'packages/shared/src/index.ts',
  'packages/shared/src/schemas/index.ts',
  'packages/shared/src/schemas/lead.schema.ts',
  'packages/shared/src/schemas/job.schema.ts',
  'packages/shared/src/schemas/auth.schema.ts',
  'packages/shared/src/types/index.ts',
  'packages/shared/src/constants/index.ts',
  'packages/shared/src/constants/limits.ts',
];

let ok = 0, bad = 0, missing = 0;
for (const f of criticalFiles) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) {
    console.log(`  ❌ MISSING: ${f}`);
    missing++;
  } else {
    const content = fs.readFileSync(fp, 'utf8');
    const lines = content.split('\n').length;
    if (lines <= 3 && content.length > 500) {
      console.log(`  ⚠️  CORRUPTED (${lines} lines, ${content.length} bytes): ${f}`);
      bad++;
    } else {
      console.log(`  ✓  OK (${lines} lines): ${f}`);
      ok++;
    }
  }
}

console.log(`\nSummary: ${ok} OK, ${bad} corrupted, ${missing} missing`);
