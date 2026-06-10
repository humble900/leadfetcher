const fs = require('fs');
const readline = require('readline');

async function scan() {
  const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
  if (!fs.existsSync(logPath)) {
    console.log('Transcript file does not exist at ' + logPath);
    return;
  }
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const appFiles = new Set();
  for await (const line of rl) {
    const obj = JSON.parse(line);
    if (!obj.tool_calls) continue;
    for (const tc of obj.tool_calls) {
      if (['write_to_file', 'replace_file_content', 'multi_replace_file_content'].includes(tc.name)) {
        const file = tc.args.TargetFile;
        if (file && file.includes('apps/dashboard/src/app')) {
          appFiles.add(file);
        }
      }
    }
  }
  console.log('Modified/Created app files in previous transcript:', Array.from(appFiles));
}

scan().catch(console.error);
