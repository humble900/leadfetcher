/**
 * Properly unescape all dist/ and src/ files that are stored as JSON string literals.
 * 
 * The transcript restoration wrote all file contents as JSON-encoded strings
 * (wrapped in double quotes with \n escaped as literal backslash-n).
 * 
 * This script reads each file, detects if it's a JSON string, parses it,
 * and writes the unescaped content back.
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/USER/leadfetcher';

function walkDir(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results.push(...walkDir(fullPath, extensions));
    } else if (extensions.some(ext => fullPath.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

function tryUnescapeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Check if file starts with a double quote character (ASCII 34)
  if (!content.startsWith('"')) return false;
  
  // Get the first line
  const lines = content.split('\n');
  const firstLine = lines[0];
  
  // The first line should be a JSON-encoded string (starts and ends with ")
  // But some files were truncated, so the closing " might be missing
  
  // Strategy 1: Try parsing first line as-is
  try {
    const parsed = JSON.parse(firstLine);
    if (typeof parsed === 'string' && parsed.length > 20) {
      fs.writeFileSync(filePath, parsed, 'utf8');
      return true;
    }
  } catch (e) {}
  
  // Strategy 2: First line doesn't end with " — it was truncated
  // Try adding a closing quote
  try {
    const parsed = JSON.parse(firstLine + '"');
    if (typeof parsed === 'string' && parsed.length > 20) {
      fs.writeFileSync(filePath, parsed, 'utf8');
      return true;
    }
  } catch (e) {}
  
  // Strategy 3: Content spans multiple lines due to line splitting
  // Join all lines and try to parse the whole thing
  try {
    const joined = content.trim();
    const parsed = JSON.parse(joined);
    if (typeof parsed === 'string' && parsed.length > 20) {
      fs.writeFileSync(filePath, parsed, 'utf8');
      return true;
    }
  } catch (e) {}
  
  // Strategy 4: Manual unescape - find the content between first and last quote
  // and replace escaped sequences
  try {
    let str = firstLine;
    // Remove leading quote
    if (str.startsWith('"')) str = str.slice(1);
    // Remove trailing quote if present
    if (str.endsWith('"')) str = str.slice(0, -1);
    
    // Replace common escape sequences
    str = str.replace(/\\n/g, '\n');
    str = str.replace(/\\t/g, '\t');
    str = str.replace(/\\"/g, '"');
    str = str.replace(/\\\\/g, '\\');
    str = str.replace(/\\'/g, "'");
    str = str.replace(/\\r/g, '\r');
    
    if (str.length > 20 && str.split('\n').length > 3) {
      fs.writeFileSync(filePath, str, 'utf8');
      return true;
    }
  } catch (e) {}
  
  return false;
}

// ─── Process ALL files in dist/ and src/ directories ───

const directories = [
  // dist directories (compiled JS)
  'apps/api/dist',
  'apps/worker/dist',
  'packages/shared/dist',
  // src directories (corrupted source)
  'apps/api/src',
  'apps/worker/src',
  'packages/shared/src',
];

const extensions = ['.ts', '.tsx', '.js', '.d.ts'];

let totalFixed = 0;
let totalSkipped = 0;
let totalFailed = 0;

for (const dir of directories) {
  const fullDir = path.join(ROOT, dir);
  if (!fs.existsSync(fullDir)) continue;
  
  const files = walkDir(fullDir, extensions);
  let dirFixed = 0;
  
  for (const file of files) {
    if (file.endsWith('.js.map')) continue;
    
    const content = fs.readFileSync(file, 'utf8');
    if (!content.startsWith('"')) {
      totalSkipped++;
      continue;
    }
    
    const relPath = path.relative(ROOT, file);
    const beforeLines = content.split('\n').length;
    
    if (tryUnescapeFile(file)) {
      const after = fs.readFileSync(file, 'utf8');
      const afterLines = after.split('\n').length;
      console.log(`  ✅ ${relPath}: ${beforeLines} → ${afterLines} lines`);
      dirFixed++;
      totalFixed++;
    } else {
      console.log(`  ❌ FAILED: ${relPath}`);
      totalFailed++;
    }
  }
  
  if (dirFixed > 0) {
    console.log(`  [${dir}: fixed ${dirFixed} files]`);
  }
}

console.log(`\n═══ Summary ═══`);
console.log(`Fixed: ${totalFixed}`);
console.log(`Skipped (already OK): ${totalSkipped}`);
console.log(`Failed: ${totalFailed}`);

// ─── Now copy unescaped dist/ JS to src/ TS for files that are still broken ───
console.log('\n═══ Copying fixed dist/ JS to src/ TS where needed ═══');

const apps = [
  { distDir: 'apps/api/dist', srcDir: 'apps/api/src' },
  { distDir: 'apps/worker/dist', srcDir: 'apps/worker/src' },
  { distDir: 'packages/shared/dist', srcDir: 'packages/shared/src' },
];

let copied = 0;

for (const app of apps) {
  const distPath = path.join(ROOT, app.distDir);
  const srcPath = path.join(ROOT, app.srcDir);
  
  if (!fs.existsSync(distPath)) continue;
  
  const jsFiles = walkDir(distPath, ['.js']);
  
  for (const jsFile of jsFiles) {
    if (jsFile.endsWith('.js.map') || jsFile.endsWith('.d.ts')) continue;
    
    const relPath = path.relative(distPath, jsFile);
    const tsRelPath = relPath.replace(/\.js$/, '.ts');
    const tsPath = path.join(srcPath, tsRelPath);
    
    if (!fs.existsSync(tsPath)) continue;
    
    const tsContent = fs.readFileSync(tsPath, 'utf8');
    const tsLines = tsContent.split('\n').length;
    
    if (tsLines <= 6 && tsContent.length > 100) {
      // Still corrupted — copy from fixed dist JS
      const jsContent = fs.readFileSync(jsFile, 'utf8')
        .replace(/\/\/# sourceMappingURL=.*$/m, '')
        .trim();
      const jsLines = jsContent.split('\n').length;
      
      if (jsLines > tsLines) {
        fs.writeFileSync(tsPath, jsContent, 'utf8');
        console.log(`  ✅ ${path.relative(ROOT, tsPath)}: now ${jsLines} lines (from dist JS)`);
        copied++;
      }
    }
  }
}

console.log(`Copied ${copied} files from dist/ to src/`);

// ─── Final verification ───
console.log('\n═══ Final Verification ═══');

const criticalFiles = [
  'apps/api/src/db/schema.ts',
  'apps/api/src/db/seed.ts',
  'apps/api/src/middleware/auth.middleware.ts',
  'apps/api/src/middleware/limit.middleware.ts',
  'apps/api/src/routes/auth.routes.ts',
  'apps/api/src/routes/jobs.routes.ts',
  'apps/api/src/routes/leads.routes.ts',
  'apps/api/src/services/auth.service.ts',
  'apps/api/src/services/job.service.ts',
  'apps/api/src/services/lead.service.ts',
  'apps/api/src/server.ts',
  'apps/worker/src/engine/discovery.ts',
  'apps/worker/src/engine/dom-extractor.ts',
  'apps/worker/src/engine/extractor.ts',
  'apps/worker/src/engine/fetcher.ts',
  'apps/worker/src/engine/regex-extractor.ts',
  'apps/worker/src/pipeline/processor.ts',
  'apps/worker/src/processors/db-schema.ts',
  'apps/worker/src/processors/job.processor.ts',
  'apps/worker/src/worker.ts',
  'packages/shared/src/schemas/job.schema.ts',
  'packages/shared/src/schemas/lead.schema.ts',
  'packages/shared/src/types/index.ts',
  'packages/shared/src/constants/limits.ts',
];

let ok = 0, bad = 0;
for (const f of criticalFiles) {
  const fp = path.join(ROOT, f);
  if (!fs.existsSync(fp)) {
    console.log(`  ❌ MISSING: ${f}`);
    bad++;
    continue;
  }
  const content = fs.readFileSync(fp, 'utf8');
  const lines = content.split('\n').length;
  if (lines <= 6) {
    console.log(`  ⚠️  STILL BAD (${lines} lines): ${f}`);
    bad++;
  } else {
    console.log(`  ✓  OK (${lines} lines): ${f}`);
    ok++;
  }
}

console.log(`\nFinal: ${ok} OK, ${bad} still need fixing`);
