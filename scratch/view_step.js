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

  for await (const line of rl) {
    const obj = JSON.parse(line);
    if (obj.step_index === 1114 || obj.step_index === 1115 || obj.step_index === 1116) {
      console.log(`=== STEP ${obj.step_index} (${obj.source}) ===`);
      console.log(obj.content);
    }
  }
}

scan().catch(console.error);
