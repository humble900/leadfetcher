const fs = require('fs');

const mapPath = 'C:/Users/USER/leadfetcher/apps/dashboard/.next/server/chunks/ssr/apps_dashboard_src_app_leads_0f2_3ed._.js.map';

try {
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  
  // sourcesContent[1] contains the page.tsx source
  const sourceCode = mapData.sourcesContent[1];
  
  if (sourceCode) {
    const destPath = 'C:/Users/USER/leadfetcher/apps/dashboard/src/app/leads/page.tsx';
    fs.writeFileSync(destPath, sourceCode, 'utf8');
    console.log(`Successfully restored leads/page.tsx! Size: ${sourceCode.length} bytes.`);
  } else {
    console.error('Error: page.tsx source code not found in mapData.sourcesContent[1]');
  }
} catch (e) {
  console.error('Failed to parse source map:', e.message);
}
