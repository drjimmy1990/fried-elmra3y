const fs = require('fs');

const wf = JSON.parse(fs.readFileSync('workflow.json', 'utf8'));

// 1. Update Parse Messenger Event to return [] for non-messages and set message_type
const parseNode = wf.nodes.find(n => n.name === 'Parse Messenger Event');
if (parseNode) {
  parseNode.parameters.jsCode = `const item = $input.first().json;
const ev = item.event;
const ch = item.channel;

// 1. Drop echoes, delivery receipts, read receipts, and messages from the page itself
if (ev.message?.is_echo || ev.delivery || ev.read || ev.sender?.id === ch.page_id) {
  return []; // Returning empty array stops execution cleanly in n8n
}

const psid = ev.sender?.id;
if (!psid) return [];

const mid = ev.message?.mid || null;
const attachment = ev.message?.attachments?.[0];
const attachmentType = attachment?.type || null;
const attachmentUrl = attachment?.payload?.url || null;

const isAudio = attachmentType === "audio";
const isImage = attachmentType === "image";

const audioUrl = isAudio ? attachmentUrl : null;
const imageUrl = isImage ? attachmentUrl : null;

const text = (ev.message?.text || ev.postback?.title || "").trim();
const payload = ev.postback?.payload || ev.message?.quick_reply?.payload || null;

// 2. Drop if no audio, no image, no text, no quick reply, and no attachment
if (!isAudio && !isImage && !text && !payload && !attachmentUrl) {
  return [];
}

const messageType = isAudio ? "audio" : (isImage ? "image" : "text");

return [{
  json: {
    message_type: messageType,
    is_audio: Boolean(isAudio),
    audio_url: audioUrl,
    is_image: Boolean(isImage),
    image_url: imageUrl,
    attachment_type: attachmentType,
    attachment_url: attachmentUrl,
    text: text || payload || (isImage ? "[صورة من العميل]" : ""),
    payload: payload,
    psid,
    page_id: ch.page_id,
    channel_id: ch.id,
    token: ch.token,
    mid,
    timestamp: ev.timestamp || Date.now(),
  }
}];`;
  console.log('Updated Parse Messenger Event code');
}

// 2. Remove obsolete 'If Valid Messenger Event' and 'If Audio Message'
wf.nodes = wf.nodes.filter(n => n.name !== 'If Valid Messenger Event' && n.name !== 'If Audio Message');

// 3. Add Switch Message Type node
const switchMessageTypeNode = {
  parameters: {
    rules: {
      values: [
        {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: '',
              typeValidation: 'loose',
              version: 3
            },
            conditions: [
              {
                leftValue: '={{ $json.message_type }}',
                rightValue: 'audio',
                operator: {
                  type: 'string',
                  operation: 'equals'
                }
              }
            ],
            combinator: 'and'
          },
          renameOutput: true,
          outputKey: 'audio'
        },
        {
          conditions: {
            options: {
              caseSensitive: true,
              leftValue: '',
              typeValidation: 'loose',
              version: 3
            },
            conditions: [
              {
                leftValue: '={{ $json.message_type }}',
                rightValue: 'image',
                operator: {
                  type: 'string',
                  operation: 'equals'
                }
              }
            ],
            combinator: 'and'
          },
          renameOutput: true,
          outputKey: 'image'
        }
      ]
    },
    looseTypeValidation: true,
    options: {
      fallbackOutput: 'extra',
      renameFallbackOutput: 'text'
    }
  },
  type: 'n8n-nodes-base.switch',
  typeVersion: 3.4,
  position: [2100, 256],
  id: 'switch-msg-type-4020-ae52-483b2172a899',
  name: 'Switch Message Type'
};

// Check if Switch Message Type already exists
const existingSwitch = wf.nodes.find(n => n.name === 'Switch Message Type');
if (!existingSwitch) {
  wf.nodes.push(switchMessageTypeNode);
} else {
  Object.assign(existingSwitch, switchMessageTypeNode);
}

// 4. Update Connections
delete wf.connections['If Valid Messenger Event'];
delete wf.connections['If Audio Message'];

// Parse Messenger Event -> Switch Message Type
wf.connections['Parse Messenger Event'] = {
  main: [
    [
      {
        node: 'Switch Message Type',
        type: 'main',
        index: 0
      }
    ]
  ]
};

// Switch Message Type outputs:
// Output 0 (audio) -> Download Voice Note
// Output 1 (image) -> Check Existing Contact
// Output 2 (text / fallback) -> Check Existing Contact
wf.connections['Switch Message Type'] = {
  main: [
    [
      {
        node: 'Download Voice Note',
        type: 'main',
        index: 0
      }
    ],
    [
      {
        node: 'Check Existing Contact',
        type: 'main',
        index: 0
      }
    ],
    [
      {
        node: 'Check Existing Contact',
        type: 'main',
        index: 0
      }
    ]
  ]
};

// Clean up any remaining invalid connections
const nodeNames = new Set(wf.nodes.map(n => n.name));
for (const [source, conn] of Object.entries(wf.connections)) {
  if (!nodeNames.has(source)) {
    delete wf.connections[source];
    continue;
  }
  for (const [outType, outputs] of Object.entries(conn)) {
    for (const group of outputs) {
      for (let i = group.length - 1; i >= 0; i--) {
        if (!nodeNames.has(group[i].node)) {
          group.splice(i, 1);
        }
      }
    }
  }
}

fs.writeFileSync('workflow.json', JSON.stringify(wf, null, 2));
console.log('Successfully switched to Switch Message Type node in workflow.json');
