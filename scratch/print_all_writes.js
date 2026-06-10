const fs = require('fs');
const readline = require('readline');

async function check() {
  const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const obj = JSON.parse(line);
    if (obj.step_index > 200) break;
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (tc.name === 'write_to_file') {
          let content = tc.args.CodeContent || '';
          if (typeof content === 'string' && content.startsWith('"') && content.endsWith('"')) {
            try { content = JSON.parse(content); } catch (e) {}
          }
          const firstLine = content.split('\n')[0] || '';
          console.log(`Step ${obj.step_index}: write_to_file ${tc.args.TargetFile} -> First line: ${JSON.stringify(firstLine)}`);
        }
      }
    }
  }
}

check().catch(console.error);
