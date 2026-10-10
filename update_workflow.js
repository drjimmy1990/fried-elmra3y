const fs = require('fs');
const https = require('https');

const wf = JSON.parse(fs.readFileSync('workflow.json', 'utf8'));

// 1. Remove leftover Upsert Contact in connections
delete wf.connections['Upsert Contact'];

// 2. Fix If AI Enabled conditions
const ifAi = wf.nodes.find(n => n.name === 'If AI Enabled');
if (ifAi) {
  ifAi.parameters = {
    conditions: {
      options: {
        caseSensitive: true,
        leftValue: '',
        typeValidation: 'loose',
        version: 3
      },
      conditions: [
        {
          leftValue: '={{ $json.ai_enabled }}',
          rightValue: true,
          operator: {
            type: 'boolean',
            operation: 'true',
            singleValue: true
          }
        }
      ],
      combinator: 'and'
    },
    options: {}
  };
}

// 3. Ensure Store User Message returns contact_id, ai_enabled, customer_name
const storeMsg = wf.nodes.find(n => n.name === 'Store User Message');
if (storeMsg) {
  storeMsg.parameters.query = `INSERT INTO public.messages (contact_id, sender_type, content, platform_message_id)
VALUES ('{{ $json.contact_id }}', 'user', '{{ $('Extract Transcribed Text').item ? $('Extract Transcribed Text').item.json.text : $('Parse Messenger Event').item.json.text }}', '{{ $('Parse Messenger Event').item.json.mid }}')
ON CONFLICT (platform_message_id) DO UPDATE SET content = EXCLUDED.content
RETURNING id AS message_log_id, contact_id, (SELECT ai_enabled FROM public.contacts WHERE id = public.messages.contact_id) AS ai_enabled, (SELECT name FROM public.contacts WHERE id = public.messages.contact_id) AS customer_name;`;
}

// 4. Fix Combine Messages safe contact extraction
const combineMsg = wf.nodes.find(n => n.name === 'Combine Messages');
if (combineMsg) {
  combineMsg.parameters.jsCode = `const allItems = $("Fetch User Queue").all().map(i => i.json);
const messages = allItems.map(i => i.message).filter(Boolean).reverse();
const combined = messages.join("  ");

const context = $("Parse Messenger Event").first().json;
let customerName = "عميل";
let contactId = null;

try {
  const storeMsg = $('Store User Message').first().json;
  contactId = storeMsg.contact_id;
  customerName = storeMsg.customer_name || customerName;
} catch (e) {}

if (!contactId) {
  try {
    const created = $('Create Contact with Name').first().json;
    contactId = created.contact_id;
    customerName = created.name || customerName;
  } catch (e) {
    try {
      const updated = $('Update Contact Timestamp').first().json;
      contactId = updated.contact_id;
      customerName = updated.name || customerName;
    } catch (e2) {}
  }
}

return [{
  json: {
    combined_message: combined || context.text,
    psid: context.psid,
    page_id: context.page_id,
    token: context.token,
    contact_id: contactId,
    customer_name: customerName,
    channel_id: context.channel_id
  }
}];`;
}

// 5. Validate all node connections
const nodeNames = new Set(wf.nodes.map(n => n.name));
let invalidSources = [];
let invalidTargets = [];

for (const [source, conn] of Object.entries(wf.connections)) {
  if (!nodeNames.has(source)) {
    invalidSources.push(source);
    delete wf.connections[source];
  }
  for (const [outputType, outputs] of Object.entries(conn)) {
    for (const group of outputs) {
      for (let i = group.length - 1; i >= 0; i--) {
        if (!nodeNames.has(group[i].node)) {
          invalidTargets.push({ from: source, to: group[i].node });
          group.splice(i, 1);
        }
      }
    }
  }
}

console.log('Fixed invalid sources:', invalidSources);
console.log('Fixed invalid targets:', invalidTargets);

fs.writeFileSync('workflow.json', JSON.stringify(wf, null, 2));
console.log('workflow.json cleaned and validated successfully!');
