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
    if (obj.step_index === 30) {
      const toolCall = obj.tool_calls.find(tc => tc.name === 'write_to_file');
      if (toolCall) {
        const codeContent = toolCall.args.CodeContent;
        console.log('Original CodeContent length:', codeContent.length);
        console.log('Starts with double quote:', codeContent.startsWith('"'));
        console.log('Ends with double quote:', codeContent.endsWith('"'));
        console.log('First 100 chars:', codeContent.slice(0, 100));
        console.log('Last 100 chars:', codeContent.slice(-100));
        return;
      }
    }
  }
}

check().catch(console.error);
