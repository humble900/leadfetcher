/**
 * Fix recovered files that contain JSON-escaped strings.
 * The source map extraction wrote sourcesContent as raw JSON strings.
 * This script unescapes them to proper multi-line source code.
 * 
 * Also reads the ACTUAL compiled JS dist files directly for files
 * where source maps didn't contain sourcesContent.
 */
const fs = require('fs');
const path = require('path');

const ROOT = 'C:/Users/USER/leadfetcher';

// ─── Phase 1: Fix JSON-escaped source files ───

function fixJsonEscaped() {
  console.log('═══ Phase 1: Fixing JSON-escaped recovered files ═══');
  
  const dirs = [
    'apps/api/src',
    'apps/worker/src',
    'packages/shared/src',
    'apps/dashboard/src',
  ];
  
  let fixed = 0;
  
  for (const dir of dirs) {
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) continue;
    
    const tsFiles = walkDir(fullDir, '.ts');
    const tsxFiles = walkDir(fullDir, '.tsx');
    const allFiles = [...tsFiles, ...tsxFiles];
    
    for (const filePath of allFiles) {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      // Detect JSON-escaped content: starts with " and has \n escapes
      if (lines.length <= 6 && content.startsWith('"')) {
        try {
          // Try to extract just the JSON string part (first line usually)
          // The format is: "escaped content"\n< truncated;\nNNNN;\nbytes > ;\nexport {};
          let jsonStr = lines[0];
          
          // If the first line doesn't end with ", try to find the complete string
          if (!jsonStr.endsWith('"')) {
            // The content might be truncated by the viewer but the actual file has it all
            // Try parsing the whole content up to the truncation marker
            const truncIdx = content.indexOf('< truncated;');
            if (truncIdx > 0) {
              // The JSON string was truncated in the view but might be complete in the file
              // Let's just try to parse the first line as-is
            }
          }
          
          // Attempt to parse as JSON string
          let parsed = JSON.parse(jsonStr);
          if (typeof parsed === 'string' && parsed.length > 50) {
            const relPath = path.relative(ROOT, filePath);
            fs.writeFileSync(filePath, parsed, 'utf8');
            const newLines = parsed.split('\n').length;
            console.log(`  ✅ Fixed: ${relPath} (${newLines} lines)`);
            fixed++;
            continue;
          }
        } catch (e) {
          // Not a valid JSON string, try alternative approach
        }
        
        // Alternative: the content might just have literal \n that need to be converted
        if (content.includes('\\n') && !content.includes('\n\n')) {
          try {
            let unescaped = content;
            // Remove wrapping quotes if present
            if (unescaped.startsWith('"')) unescaped = unescaped.slice(1);
            // Remove trailing content after the main string
            const lastQuote = unescaped.lastIndexOf('"');
            if (lastQuote > 0) {
              // Check if there's truncation markers
              const truncIdx = unescaped.indexOf('\n');
              if (truncIdx > 0 && truncIdx < lastQuote) {
                // Content was split across lines, try a different approach
              }
            }
          } catch (e) {}
        }
      }
    }
  }
  
  console.log(`Phase 1 complete: Fixed ${fixed} files\n`);
}

// ─── Phase 2: Read actual compiled JS and .d.ts to reconstruct source ───

function reconstructFromDist() {
  console.log('═══ Phase 2: Reconstructing from dist/ JS and .d.ts files ═══');
  
  const apps = [
    { distDir: 'apps/api/dist', srcDir: 'apps/api/src' },
    { distDir: 'apps/worker/dist', srcDir: 'apps/worker/src' },
    { distDir: 'packages/shared/dist', srcDir: 'packages/shared/src' },
  ];
  
  let reconstructed = 0;
  
  for (const app of apps) {
    const distPath = path.join(ROOT, app.distDir);
    const srcPath = path.join(ROOT, app.srcDir);
    
    if (!fs.existsSync(distPath)) continue;
    
    const jsFiles = walkDir(distPath, '.js');
    
    for (const jsFile of jsFiles) {
      if (jsFile.endsWith('.js.map') || jsFile.endsWith('.d.ts')) continue;
      
      const relPath = path.relative(distPath, jsFile);
      const tsRelPath = relPath.replace(/\.js$/, '.ts');
      const tsPath = path.join(srcPath, tsRelPath);
      
      // Check if TS source still needs fixing
      if (!fs.existsSync(tsPath)) continue;
      
      const existing = fs.readFileSync(tsPath, 'utf8');
      const lineCount = existing.split('\n').length;
      
      // If the file has <= 6 lines but is large, it's still corrupted
      if (lineCount > 6) continue;
      
      // Read the compiled JS
      const jsContent = fs.readFileSync(jsFile, 'utf8')
        .replace(/\/\/# sourceMappingURL=.*$/m, '')
        .trim();
      
      const jsLines = jsContent.split('\n').length;
      
      // Read the .d.ts file for type information
      const dtsPath = jsFile.replace(/\.js$/, '.d.ts');
      let dtsContent = '';
      if (fs.existsSync(dtsPath)) {
        dtsContent = fs.readFileSync(dtsPath, 'utf8');
      }
      
      // If the JS is also just a few lines, try source map sourcesContent
      if (jsLines <= 3) {
        // Try parsing the source map
        const mapPath = jsFile + '.map';
        if (fs.existsSync(mapPath)) {
          try {
            const raw = fs.readFileSync(mapPath, 'utf8');
            const mapData = JSON.parse(raw);
            if (mapData.sourcesContent) {
              for (const sc of mapData.sourcesContent) {
                if (sc && sc.length > 100) {
                  fs.writeFileSync(tsPath, sc, 'utf8');
                  const newLines = sc.split('\n').length;
                  console.log(`  ✅ From sourcemap: ${path.relative(ROOT, tsPath)} (${newLines} lines)`);
                  reconstructed++;
                  break;
                }
              }
              continue;
            }
          } catch (e) {}
        }
      }
      
      // Use the JS content if it's substantially larger
      if (jsLines > lineCount) {
        fs.writeFileSync(tsPath, jsContent, 'utf8');
        console.log(`  ✅ From JS: ${path.relative(ROOT, tsPath)} (${jsLines} lines)`);
        reconstructed++;
      } else {
        console.log(`  ⚠️  Still small: ${path.relative(ROOT, tsPath)} (JS: ${jsLines} lines, TS: ${lineCount} lines)`);
        // Print first 200 chars of JS for debugging
        console.log(`     JS preview: ${jsContent.substring(0, 200)}`);
      }
    }
  }
  
  console.log(`Phase 2 complete: Reconstructed ${reconstructed} files\n`);
}

// ─── Phase 3: Show all files and their status ───

function showStatus() {
  console.log('═══ Phase 3: Final status of all source files ═══');
  
  const dirs = [
    'apps/api/src',
    'apps/worker/src', 
    'packages/shared/src',
    'apps/dashboard/src',
  ];
  
  for (const dir of dirs) {
    console.log(`\n--- ${dir} ---`);
    const fullDir = path.join(ROOT, dir);
    if (!fs.existsSync(fullDir)) {
      console.log('  NOT FOUND');
      continue;
    }
    
    const allFiles = [...walkDir(fullDir, '.ts'), ...walkDir(fullDir, '.tsx')];
    for (const f of allFiles) {
      const content = fs.readFileSync(f, 'utf8');
      const lines = content.split('\n').length;
      const relPath = path.relative(ROOT, f);
      const status = lines <= 6 ? '⚠️  NEEDS FIX' : '✓  OK';
      console.log(`  ${status} (${lines} lines, ${content.length} bytes): ${relPath}`);
    }
  }
}

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

fixJsonEscaped();
reconstructFromDist();
showStatus();
