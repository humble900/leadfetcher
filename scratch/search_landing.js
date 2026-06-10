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

  let matches = 0;
  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    if (line.toLowerCase().includes('landing')) {
      matches++;
      console.log(`Line ${lineNum} matches:`);
      // truncate print
      console.log(line.substring(0, 500) + '...');
    }
  }
  console.log(`Scan completed. Found ${matches} matches for "landing".`);
}

scan().catch(console.error);
