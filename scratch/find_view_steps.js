const fs = require('fs');
const readline = require('readline');

async function findViewFile() {
  const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  for await (const line of rl) {
    const obj = JSON.parse(line);
    // Check if tool_calls contain view_file for implementation_plan.md
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (tc.name === 'view_file' && tc.args.AbsolutePath.includes('implementation_plan.md')) {
          console.log(`Step ${obj.step_index}: viewed implementation_plan.md`);
        }
      }
    }
  }
}

findViewFile().catch(console.error);
