const fs = require('fs');
const https = require('https');

const apiKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIwNjZhNTNhNC1hMzRkLTQwMjAtYWU1Mi00ODNiMjE3MmE4OTkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNjljNGM5MmMtNjQyZi00MTIyLTkzZTAtMjkxZWI4MDdkNDRhIiwiaWF0IjoxNzkxNTEwNjUzfQ.SNZVPv4HCReZMxaisqH9JhUeIw4-pDr6OSP7HtPPu0I';
const workflowId = '5YBvgMSYQqZpcXZM';

const localWf = JSON.parse(fs.readFileSync('workflow.json', 'utf8'));

// Format body for n8n API PUT /api/v1/workflows/:id
const payload = JSON.stringify({
  name: localWf.name || 'fried chiken',
  nodes: localWf.nodes,
  connections: localWf.connections,
  settings: {
    executionOrder: 'v1'
  }
});

const req = https.request({
  hostname: 'n8n.pr-media.forum',
  path: `/api/v1/workflows/${workflowId}`,
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': apiKey,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload)
  }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status code:', res.statusCode);
    try {
      const resp = JSON.parse(data);
      if (res.statusCode >= 200 && res.statusCode < 300) {
        console.log('SUCCESS! Workflow updated on n8n.');
        console.log('Total nodes:', resp.nodes?.length);
      } else {
        console.error('ERROR response:', JSON.stringify(resp, null, 2));
      }
    } catch(e) {
      console.log('Raw response:', data);
    }
  });
});

req.on('error', e => console.error('Request error:', e));
req.write(payload);
req.end();
