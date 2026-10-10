const fs = require('fs');

const wf = JSON.parse(fs.readFileSync('workflow.json', 'utf8'));

// 1. Update Parse Messenger Event to capture images and attachments
const parseNode = wf.nodes.find(n => n.name === 'Parse Messenger Event');
if (parseNode) {
  parseNode.parameters.jsCode = `const item = $input.first().json;
const ev = item.event;
const ch = item.channel;

// Ignore echoes, delivery receipts, read receipts, and messages from the page itself
if (ev.message?.is_echo || ev.delivery || ev.read || ev.sender?.id === ch.page_id) {
  return [{ json: { is_valid: false } }];
}

const psid = ev.sender?.id;
if (!psid) return [{ json: { is_valid: false } }];

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

// Valid if has audio, image, text, quick reply payload, or any valid attachment
if (!isAudio && !isImage && !text && !payload && !attachmentUrl) {
  return [{ json: { is_valid: false } }];
}

return [{
  json: {
    is_valid: true,
    psid,
    page_id: ch.page_id,
    channel_id: ch.id,
    token: ch.token,
    mid,
    is_audio: Boolean(isAudio),
    audio_url: audioUrl,
    is_image: Boolean(isImage),
    image_url: imageUrl,
    attachment_type: attachmentType,
    attachment_url: attachmentUrl,
    text: text || payload || (isImage ? "[صورة من العميل]" : ""),
    payload: payload,
    timestamp: ev.timestamp || Date.now(),
  }
}];`;
  console.log('Updated Parse Messenger Event jsCode');
}

// 2. Update Store User Message to persist media_url and media_type into public.messages
const storeMsg = wf.nodes.find(n => n.name === 'Store User Message');
if (storeMsg) {
  storeMsg.parameters.query = `INSERT INTO public.messages (contact_id, sender_type, content, media_url, media_type, platform_message_id)
VALUES (
  '{{ $json.contact_id }}',
  'user',
  '{{ $('Extract Transcribed Text').item ? $('Extract Transcribed Text').item.json.text : $('Parse Messenger Event').item.json.text }}',
  NULLIF('{{ $('Parse Messenger Event').item.json.attachment_url || "" }}', ''),
  NULLIF('{{ $('Parse Messenger Event').item.json.attachment_type || "" }}', ''),
  '{{ $('Parse Messenger Event').item.json.mid }}'
)
ON CONFLICT (platform_message_id) DO UPDATE SET 
  content = EXCLUDED.content, 
  media_url = EXCLUDED.media_url, 
  media_type = EXCLUDED.media_type
RETURNING id AS message_log_id, contact_id, (SELECT ai_enabled FROM public.contacts WHERE id = public.messages.contact_id) AS ai_enabled, (SELECT name FROM public.contacts WHERE id = public.messages.contact_id) AS customer_name;`;
  console.log('Updated Store User Message query to save media_url & media_type');
}

fs.writeFileSync('workflow.json', JSON.stringify(wf, null, 2));
console.log('Saved to workflow.json successfully');
