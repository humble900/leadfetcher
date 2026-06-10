const fs = require('fs');
const readline = require('readline');

async function findWrites() {
  const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const matches = [];
  for await (const line of rl) {
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(tc.name)) {
          const file = tc.args.TargetFile || '';
          if (file.includes('leads.routes.ts') || file.includes('lead.service.ts')) {
            matches.push({
              step: obj.step_index,
              tool: tc.name,
              file,
              args: tc.args
            });
          }
        }
      }
    }
  }

  console.log(`Found ${matches.length} matches:`);
  for (const m of matches) {
    console.log(`Step ${m.step}: ${m.tool} on ${m.file}`);
    if (m.tool === 'write_to_file') {
      console.log(`  CodeContent length: ${m.args.CodeContent ? m.args.CodeContent.length : 0}`);
    } else if (m.tool === 'replace_file_content') {
      console.log(`  Target length: ${m.args.TargetContent ? m.args.TargetContent.length : 0}`);
      console.log(`  Replacement length: ${m.args.ReplacementContent ? m.args.ReplacementContent.length : 0}`);
    }
  }
}

findWrites().catch(console.error);
