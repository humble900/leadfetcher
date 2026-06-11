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

  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (line.includes('git') || line.includes('github') || line.includes('clone') || line.includes('remote')) {
      console.log(`Line ${lineNum}:`);
      console.log(line.substring(0, 500) + '...');
    }
  }
}

scan().catch(console.error);
