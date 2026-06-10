const fs = require('fs');
const readline = require('readline');

async function restore() {
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
        let codeContent = toolCall.args.CodeContent;
        
        // Check if double JSON-encoded
        if (typeof codeContent === 'string') {
          if (codeContent.startsWith('"')) {
            try {
              codeContent = JSON.parse(codeContent);
            } catch (e) {
              console.log('JSON.parse failed, fallback replacement');
              codeContent = codeContent.slice(1, -1).replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
            }
          } else {
            // Unescape common characters
            codeContent = codeContent.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\"/g, '"');
          }
        }
        
        // Write the original plan content
        const targetPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/implementation_plan.md';
        fs.writeFileSync(targetPath, codeContent, 'utf8');
        console.log('Successfully restored implementation_plan.md');
        return;
      }
    }
  }
  console.log('Error: Step 30 write_to_file tool call not found in transcript.jsonl');
}

restore().catch(console.error);
