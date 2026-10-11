const fs = require('fs');
const path = require('path');

const wfPath = path.join(__dirname, '..', 'workflow.json');
const manualDocPath = path.join(__dirname, '..', 'AI_SYSTEM_PROMPTS_MANUAL_SETUP.md');

const wf = JSON.parse(fs.readFileSync(wfPath, 'utf8'));

// 1. Read the exact updated prompt text from AI_SYSTEM_PROMPTS_MANUAL_SETUP.md
const docContent = fs.readFileSync(manualDocPath, 'utf8');

// Extract the n8n prompt block between ```text and ```
const promptMatch = docContent.match(/## 🟣 الجزء الثاني: رسالة النظام الثابتة داخل نود n8n[\s\S]*?```text\n([\s\S]*?)\n```/);
if (!promptMatch) {
  console.error("Could not find n8n system message block in AI_SYSTEM_PROMPTS_MANUAL_SETUP.md");
  process.exit(1);
}

const newSystemMessage = promptMatch[1];

// 2. Update AI Agent2 node systemMessage
const aiAgentNode = wf.nodes.find(n => n.name === 'AI Agent2' || n.id === 'bab31d12-94ea-45f7-aa3e-83f90be345f7');
if (!aiAgentNode) {
  console.error("AI Agent2 node not found in workflow.json");
  process.exit(1);
}

if (!aiAgentNode.parameters.options) {
  aiAgentNode.parameters.options = {};
}
aiAgentNode.parameters.options.systemMessage = newSystemMessage;
console.log("Updated AI Agent2 systemMessage successfully.");

// 3. Update Code in JavaScript3 with the bulletproof complaint safeguard
const jsNode = wf.nodes.find(n => n.name === 'Code in JavaScript3' || n.id === '83fb0b3f-5ce3-4258-a146-d8985a857fd3');
if (!jsNode) {
  console.error("Code in JavaScript3 node not found in workflow.json");
  process.exit(1);
}

jsNode.parameters.jsCode = `// 1. Read the AI Agent's actual output (.output)
const raw = $input.first()?.json?.output 
         || $input.first()?.json?.text 
         || $input.first()?.json?.content 
         || "";

// Remove any markdown \`\`\`json wrapping
const cleaned = String(raw).replace(/\`\`\`json/gi, "").replace(/\`\`\`/g, "").trim();

let parsed = {};
try {
  parsed = JSON.parse(cleaned);
} catch (e) {
  // If parsing fails, use the raw Agent response directly
  parsed = {
    intent: "normal",
    reply: raw
  };
}

let intent = parsed.intent || "normal";
let order = null;
let complaint = null;

// 2. Fetch raw database branches & offers from Code1
let rawOffers = [];
let rawBranches = [];
try {
  const code1Data = $('Code1').first()?.json;
  rawOffers = code1Data?.raw_offers || [];
  rawBranches = code1Data?.raw_branches || [];
} catch (e) {}

// 3. Strict Rule: Only process and match order if intent is 'order'
if (intent === 'order' && parsed.order_details) {
  const o = parsed.order_details;
  let matchedBranchId = null;
  let matchedOfferId = null;
  let matchedDeliveryFee = 0;

  // Match Branch Name -> branch_id UUID
  const branchName = String(o.branch_name || "").trim().toLowerCase();
  if (branchName) {
    const foundBranch = rawBranches.find(b => b.branch_name && (
      b.branch_name.toLowerCase().includes(branchName) || 
      branchName.includes(b.branch_name.toLowerCase())
    ));
    if (foundBranch) matchedBranchId = foundBranch.branch_id;
  }

  // Match Offer Title -> offer_id UUID
  const offerTitle = String(o.offer_title || "").trim().toLowerCase();
  if (offerTitle) {
    const foundOffer = rawOffers.find(of => of.title && (
      of.title.toLowerCase().includes(offerTitle) || 
      offerTitle.includes(of.title.toLowerCase())
    ));
    if (foundOffer) matchedOfferId = foundOffer.id;
  }

  // Match Delivery Zone -> delivery_fee
  const zoneName = String(o.delivery_zone || "").trim().toLowerCase();
  if (zoneName) {
    const foundZone = rawBranches.find(b => b.zone_name && (
      b.zone_name.toLowerCase().includes(zoneName) || 
      zoneName.includes(b.zone_name.toLowerCase())
    ));
    if (foundZone) {
      matchedDeliveryFee = Number(foundZone.delivery_fee) || 0;
      if (!matchedBranchId) matchedBranchId = foundZone.branch_id;
    }
  }

  order = {
    branch_name: o.branch_name || "",
    branch_id: matchedBranchId,
    offer_title: o.offer_title || "",
    offer_id: matchedOfferId,
    delivery_zone: o.delivery_zone || "",
    delivery_fee: matchedDeliveryFee,
    items: o.items || [],
    total_amount: Number(o.total_amount) || 0,
    customer_name: o.customer_name || "",
    phone: o.phone || "",
    address: o.address || "",
    notes: o.notes || ""
  };
}

// 4. Strict Rule: Only process complaint if intent is 'complaint' AND both phone and issue exist
if (intent === 'complaint') {
  const cPhone = String(parsed.complaint_details?.phone || "").trim();
  const cIssue = String(parsed.complaint_details?.issue || "").trim();

  // Safeguard: If phone or issue details are missing, downgrade to normal so a ticket is not created prematurely
  if (!cPhone || !cIssue || cPhone.length < 8) {
    intent = "normal";
    complaint = null;
  } else {
    complaint = {
      phone: cPhone,
      issue: cIssue
    };
  }
}

// 5. Read context and contact IDs
let psid = "";
let page_id = "";
let token = "";
let contact_id = "";

try {
  const context = $('Parse Messenger Event').first()?.json;
  psid = context?.psid || "";
  page_id = context?.page_id || "";
  token = context?.token || "";
} catch (e) {}

try {
  contact_id = $('Edit Fields4').first()?.json?.contact_uuid 
            || $('Edit Fields1').first()?.json?.contact_uuid 
            || "";
} catch (e) {}

return [{
  json: {
    intent: intent,
    reply: parsed.reply || raw, // Always uses the AI Agent's actual response
    order_details: order,
    complaint_details: complaint,
    psid: psid,
    page_id: page_id,
    token: token,
    contact_id: contact_id
  }
}];`;
console.log("Updated Code in JavaScript3 safeguard successfully.");

// Write back to workflow.json with clean formatting
fs.writeFileSync(wfPath, JSON.stringify(wf, null, 2), 'utf8');
console.log("workflow.json saved successfully.");
