const fs = require('fs');

const logPath = 'C:/Users/USER/.gemini/antigravity-ide/brain/8137a219-0d6f-458a-8616-63bda6196c1e/.system_generated/logs/transcript.jsonl';
const lines = fs.readFileSync(logPath, 'utf8').split('\n');

for (const line of lines) {
  if (!line) continue;
  const obj = JSON.parse(line);
  if (obj.step_index === 80) {
    const tc = obj.tool_calls.find(t => t.name === 'write_to_file');
    if (tc) {
      let content = tc.args.CodeContent;
      if (typeof content === 'string' && content.startsWith('"') && content.endsWith('"')) {
        try { content = JSON.parse(content); } catch (e) {}
      }
      fs.writeFileSync('C:/Users/USER/leadfetcher/scratch/lead.service.ts.step80', content, 'utf8');
      console.log('Wrote lead.service.ts step 80');
    }
  }
  if (obj.step_index === 84) {
    const tc = obj.tool_calls.find(t => t.name === 'write_to_file');
    if (tc) {
      let content = tc.args.CodeContent;
      if (typeof content === 'string' && content.startsWith('"') && content.endsWith('"')) {
        try { content = JSON.parse(content); } catch (e) {}
      }
      fs.writeFileSync('C:/Users/USER/leadfetcher/scratch/leads.routes.ts.step84', content, 'utf8');
      console.log('Wrote leads.routes.ts step 84');
    }
  }
}
