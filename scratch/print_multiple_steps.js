const fs = require('fs');
const readline = require('readline');

async function printSteps() {
  const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const stepsToPrint = [382, 383, 466, 467, 477, 478];

  for await (const line of rl) {
    const obj = JSON.parse(line);
    if (stepsToPrint.includes(obj.step_index)) {
      console.log(`--- STEP ${obj.step_index} ---`);
      console.log(JSON.stringify(obj, null, 2).slice(0, 1000));
      if (obj.content && obj.content.length > 1000) {
        console.log('... content length:', obj.content.length);
      }
    }
  }
}

printSteps().catch(console.error);
