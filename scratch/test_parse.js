const fs = require('fs');

const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line) continue;
  const obj = JSON.parse(line);
  if (obj.step_index === 1906) {
    const tc = obj.tool_calls.find(t => t.name === 'write_to_file');
    if (tc) {
      const content = tc.args.CodeContent;
      console.log('Type of CodeContent:', typeof content);
      console.log('Starts with quote:', content.startsWith('"'));
      console.log('Ends with quote:', content.endsWith('"'));
      console.log('Length:', content.length);
      console.log('First 200 chars:', JSON.stringify(content.substring(0, 200)));
      try {
        const parsed = JSON.parse(content);
        console.log('Successfully parsed! First 200 of parsed:', JSON.stringify(parsed.substring(0, 200)));
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    }
  }
}
