const fs = require('fs');
const readline = require('readline');

async function scan() {
  const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const commands = [];
  let lineNum = 0;
  for await (const line of rl) {
    lineNum++;
    const obj = JSON.parse(line);
    if (obj.tool_calls) {
      for (const tc of obj.tool_calls) {
        if (tc.name === 'run_command') {
          commands.push({
            step: obj.step_index,
            cmd: tc.args.CommandLine,
            cwd: tc.args.Cwd
          });
        }
      }
    }
  }
  console.log(`Scanned ${lineNum} lines, found ${commands.length} commands:`);
  console.log(JSON.stringify(commands, null, 2));
}

scan().catch(console.error);
