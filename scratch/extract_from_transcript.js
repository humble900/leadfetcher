const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function extractFromTranscript() {
  const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
  
  if (!fs.existsSync(logPath)) {
    console.error('Transcript file not found at:', logPath);
    return;
  }

  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  // Map to store target file path -> latest code content
  const latestWrites = new Map();

  for await (const line of rl) {
    try {
      const step = JSON.parse(line);
      
      // Look at tool calls from MODEL
      if (step.tool_calls) {
        for (const tc of step.tool_calls) {
          if (tc.name === 'write_to_file') {
            const targetFile = tc.args.TargetFile;
            const content = tc.args.CodeContent;
            
            if (targetFile && content) {
              let cleanTarget = targetFile;
              cleanTarget = cleanTarget.replace(/^["']|["']$/g, '');

              let cleanContent = content;
              if (cleanContent.startsWith('"')) {
                try {
                  let parseTarget = cleanContent;
                  if (!parseTarget.endsWith('"')) {
                    parseTarget += '"';
                  }
                  const parsed = JSON.parse(parseTarget);
                  if (typeof parsed === 'string') {
                    cleanContent = parsed;
                  }
                } catch (e) {
                  // Fallback
                }
              }

              if (cleanContent.includes('\\n') && !cleanContent.includes('\n\n')) {
                cleanContent = cleanContent
                  .replace(/\\n/g, '\n')
                  .replace(/\\t/g, '\t')
                  .replace(/\\"/g, '"')
                  .replace(/\\\\/g, '\\')
                  .replace(/\\'/g, "'")
                  .replace(/\\r/g, '\r');
              }

              // Remove any truncation markers if they were written to the log literally
              cleanContent = cleanContent.replace(/<truncated \d+ bytes>/g, '');

              const normalized = cleanTarget.replace(/\\+/g, '/').replace(/\/+/g, '/').toLowerCase();
              latestWrites.set(normalized, {
                originalPath: cleanTarget,
                content: cleanContent,
                step: step.step_index
              });
            }
          }
        }
      }
      
      // Also look at plan/walkthrough updates or other things if needed,
      // but write_to_file is the main one.
    } catch (e) {
      // Ignore parse errors for specific lines
    }
  }

  console.log(`Found ${latestWrites.size} unique files written in the transcript.`);

  console.log('Sample dashboard keys in latestWrites:');
  for (const k of latestWrites.keys()) {
    if (k.includes('dashboard')) {
      console.log('  ', k);
    }
  }

  // List of files that currently need a fix (from showStatus or compiler errors)
  const dashboardFilesToFix = [
    'apps/dashboard/src/hooks/useauth.ts',
    'apps/dashboard/src/lib/api.ts',
    'apps/dashboard/src/app/admin/settings/page.tsx',
    'apps/dashboard/src/app/jobs/new/page.tsx',
    'apps/dashboard/src/app/jobs/page.tsx',
    'apps/dashboard/src/app/jobs/[id]/page.tsx',
    'apps/dashboard/src/app/login/page.tsx',
    'apps/dashboard/src/app/page.tsx',
    'apps/dashboard/src/app/register/page.tsx',
    'apps/dashboard/src/app/usage/page.tsx',
    'apps/dashboard/src/components/layout/authcontext.tsx',
    'apps/dashboard/src/components/layout/sidebar.tsx'
  ];

  let restoredCount = 0;
  for (const fileKey of latestWrites.keys()) {
    const isDashboardFile = dashboardFilesToFix.some(df => fileKey.endsWith(df));
    if (isDashboardFile) {
      const data = latestWrites.get(fileKey);
      
      // Determine actual path to write
      // We want to write to the local directory (c:/Users/USER/leadfetcher/...)
      const relPath = data.originalPath.replace(/\\/g, '/').replace(/.*leadfetcher\//i, '');
      const localPath = path.join('C:/Users/USER/leadfetcher', relPath);
      
      // Ensure directory exists
      fs.mkdirSync(path.dirname(localPath), { recursive: true });
      fs.writeFileSync(localPath, data.content, 'utf8');
      
      console.log(`Restored ${relPath} from step ${data.step} (${data.content.length} bytes)`);
      restoredCount++;
    }
  }
  
  console.log(`Restored ${restoredCount} dashboard files from transcript!`);
}

extractFromTranscript().catch(console.error);
