const fs = require('fs');

const wf = JSON.parse(fs.readFileSync('workflow.json', 'utf8'));

// Check if AI Agent already exists
const existingAgent = wf.nodes.find(n => n.name === 'AI Agent');
if (existingAgent) {
  console.log('AI Agent already exists, skipping addition.');
  process.exit(0);
}

const newNodes = [
  {
    parameters: {
      promptType: 'define',
      text: '=الوقت الحالي (مصر): {{ DateTime.now().setZone("Africa/Cairo").format(\'M/dd/yyyy H:mm\') }}\n\nرسالة العميل: {{ $json.combined_message }}\nاسم العميل: {{ $json.customer_name }}\n\nIMPORTANT: If this message requests the menu, branch locations, or has a complaint, call the matching tool immediately. Always reply in friendly Egyptian Arabic. Never output an empty response.',
      options: {
        systemMessage: '=أنت المساعد الذكي الرسمي لمطعم فراخ مقلية (بروستد وكريسبي واسترسبس). تتحدث مع العملاء في الرسائل الخاصة بلهجة مصرية ودودة ومختصرة ومحترفة (يا فندم، تحت أمرك، بالهنا والشفا، منورنا).\n\n## 1. قواعد الأدوات (أولوية قصوى):\n- عند طلب المنيو أو الأسعار: استدعِ أداة Menu Tool فوراً لإرسال صورة المنيو للعميل على ماسنجر.\n- عند الاستفسار عن الفروع وأماكن التواجد: استدعِ أداة Branches Tool لإرسال الفروع وأرقام التواصل.\n- عند وجود شكوى بخصوص أوردر أو جودة طعام: اجمع تفاصيل المشكلة ورقم موبايل العميل ثم استدعِ أداة Complaints Tool فوراً لتسجيل الشكوى لإدارة المطعم.\n\n## 2. مواعيد العمل والتوصيل:\n- مواعيد خدمة التوصيل والدليفري من 10:00 صباحاً حتى 3:00 فجراً (بتوقيت القاهرة).\n- الوقت الحالي: {{ DateTime.now().setZone("Africa/Cairo").format(\'M/dd/yyyy h:mm a\') }}\n- لو الوقت خارج مواعيد العمل (بين 3:01 فجراً و 9:59 صباحاً): اعتذر بلطف وأخبر العميل أن خدمة الدليفري مغلقة حالياً وستعاود العمل الساعة 10:00 صباحاً.\n\n## 3. تعليمات عامة:\n- لا تُخرج رداً فارغاً أبداً، اكتب دائماً رداً نصياً ودوداً ومباشراً بعد استدعاء الأدوات.\n- عند الاعتذار لأي عميل، لا تستخدم أبداً عبارة "تجربة سيئة"، بل اعتذر بأدب واهتمام واعداً بحل المشكلة فوراً.'
      }
    },
    type: '@n8n/n8n-nodes-langchain.agent',
    typeVersion: 3.1,
    position: [7100, 256],
    id: 'a1b2c3d4-agent-4020-ae52-483b2172a899',
    name: 'AI Agent'
  },
  {
    parameters: {
      model: {
        __rl: true,
        value: 'qwen3.8-flash',
        mode: 'list',
        cachedResultName: 'qwen3.8-flash'
      },
      options: {}
    },
    type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    typeVersion: 1.3,
    position: [6940, 520],
    id: 'b2c3d4e5-model-4020-ae52-483b2172a899',
    name: 'OpenAI Chat Model',
    credentials: {
      openAiApi: {
        id: 'Arwid7CTslrXwpfL',
        name: 'OpenAI account'
      }
    }
  },
  {
    parameters: {
      sessionIdType: 'customKey',
      sessionKey: '={{ $(\'Combine Messages\').item.json.psid }}',
      tableName: 'chat_histories',
      contextWindowLength: 30
    },
    type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
    typeVersion: 1.3,
    position: [7260, 520],
    id: 'c3d4e5f6-memory-4020-ae52-483b2172a899',
    name: 'Postgres Chat Memory',
    credentials: {
      postgres: {
        id: '04KoYjDIxvd2lSQ5',
        name: 'messenger project drgimy11'
      }
    }
  },
  {
    parameters: {
      toolDescription: 'Sends the restaurant menu image directly to the customer on Facebook Messenger. Use this tool whenever the customer asks for the menu, prices, or catalog (المنيو، قائمة الطعام، الأسعار). Requires no input.',
      method: 'POST',
      url: '=https://graph.facebook.com/v24.0/{{ $(\'Combine Messages\').item.json.page_id }}/messages',
      sendQuery: true,
      queryParameters: {
        parameters: [
          {
            name: 'access_token',
            value: '={{ $(\'Combine Messages\').item.json.token }}'
          }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={\n  "recipient": {\n    "id": "{{ $(\'Combine Messages\').item.json.psid }}"\n  },\n  "messaging_type": "RESPONSE",\n  "message": {\n    "attachment": {\n      "type": "image",\n      "payload": {\n        "url": "https://i.postimg.cc/mr9Mwqjn/branches.jpg",\n        "is_reusable": true\n      }\n    }\n  }\n}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequestTool',
    typeVersion: 4.2,
    position: [6780, 720],
    id: 'd4e5f6a1-menu-4020-ae52-483b2172a899',
    name: 'Menu Tool'
  },
  {
    parameters: {
      toolDescription: 'Sends the list of official restaurant branches and locations. Use this tool whenever the customer asks about branches, locations, addresses, or where we are located (الفروع، أماكنكم فين، العنوان). Requires no input.',
      method: 'POST',
      url: '=https://graph.facebook.com/v24.0/{{ $(\'Combine Messages\').item.json.page_id }}/messages',
      sendQuery: true,
      queryParameters: {
        parameters: [
          {
            name: 'access_token',
            value: '={{ $(\'Combine Messages\').item.json.token }}'
          }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={\n  "recipient": {\n    "id": "{{ $(\'Combine Messages\').item.json.psid }}"\n  },\n  "messaging_type": "RESPONSE",\n  "message": {\n    "attachment": {\n      "type": "image",\n      "payload": {\n        "url": "https://i.postimg.cc/mr9Mwqjn/branches.jpg",\n        "is_reusable": true\n      }\n    }\n  }\n}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequestTool',
    typeVersion: 4.2,
    position: [7100, 720],
    id: 'e5f6a1b2-branches-4020-ae52-483b2172a899',
    name: 'Branches Tool'
  },
  {
    parameters: {
      toolDescription: 'Sends an urgent complaint notification to restaurant management. Call this tool when the customer has a complaint about food quality, missing items, or service, AND you have the complaint details and their mobile phone number. Input: Body — Arabic summary with customer name, phone number, branch name, and complaint details.',
      method: 'POST',
      url: 'https://ntfy.pr-media.forum/ALERTS',
      sendHeaders: true,
      headerParameters: {
        parameters: [
          {
            name: 'Title',
            value: 'NEW COMPLAINT - FRIED CHICKEN'
          },
          {
            name: 'Priority',
            value: 'urgent'
          },
          {
            name: 'Tags',
            value: 'warning,poultry_leg'
          }
        ]
      },
      sendBody: true,
      contentType: 'raw',
      rawContentType: 'text/plain',
      body: '=Customer: {{ $(\'Combine Messages\').item.json.customer_name }}\nPSID: {{ $(\'Combine Messages\').item.json.psid }}\n{{ $fromAI(\'Body\', \'ملخص تفصيلي للشكوى بالعربي ورقم موبايل العميل\', \'string\') }}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequestTool',
    typeVersion: 4.2,
    position: [7420, 720],
    id: 'f6a1b2c3-complaints-4020-ae52-483b2172a899',
    name: 'Complaints Tool'
  },
  {
    parameters: {
      operation: 'executeQuery',
      query: `INSERT INTO public.messages (contact_id, sender_type, content)
VALUES ('{{ $('Combine Messages').item.json.contact_id }}', 'bot', '{{ $json.output }}')
RETURNING id AS bot_msg_id;`,
      options: {}
    },
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [7580, 256],
    id: 'a2b3c4d5-save-4020-ae52-483b2172a899',
    name: 'Save Bot Message',
    credentials: {
      postgres: {
        id: '04KoYjDIxvd2lSQ5',
        name: 'messenger project drgimy11'
      }
    }
  },
  {
    parameters: {
      method: 'POST',
      url: '=https://graph.facebook.com/v24.0/{{ $(\'Combine Messages\').item.json.page_id }}/messages',
      sendQuery: true,
      queryParameters: {
        parameters: [
          {
            name: 'access_token',
            value: '={{ $(\'Combine Messages\').item.json.token }}'
          }
        ]
      },
      sendBody: true,
      specifyBody: 'json',
      jsonBody: '={\n  "recipient": {\n    "id": "{{ $(\'Combine Messages\').item.json.psid }}"\n  },\n  "message": {\n    "text": "{{ $(\'AI Agent\').item.json.output }}"\n  },\n  "messaging_type": "RESPONSE"\n}',
      options: {}
    },
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [7920, 256],
    id: 'b3c4d5e6-send-4020-ae52-483b2172a899',
    name: 'Send Messenger Reply'
  }
];

wf.nodes.push(...newNodes);

// Setup Connections:
// 1. Combine Messages -> AI Agent
wf.connections['Combine Messages'] = {
  main: [
    [
      {
        node: 'AI Agent',
        type: 'main',
        index: 0
      }
    ]
  ]
};

// 2. Sub-nodes connected to AI Agent:
wf.connections['OpenAI Chat Model'] = {
  ai_languageModel: [
    [
      {
        node: 'AI Agent',
        type: 'ai_languageModel',
        index: 0
      }
    ]
  ]
};

wf.connections['Postgres Chat Memory'] = {
  ai_memory: [
    [
      {
        node: 'AI Agent',
        type: 'ai_memory',
        index: 0
      }
    ]
  ]
};

wf.connections['Menu Tool'] = {
  ai_tool: [
    [
      {
        node: 'AI Agent',
        type: 'ai_tool',
        index: 0
      }
    ]
  ]
};

wf.connections['Branches Tool'] = {
  ai_tool: [
    [
      {
        node: 'AI Agent',
        type: 'ai_tool',
        index: 0
      }
    ]
  ]
};

wf.connections['Complaints Tool'] = {
  ai_tool: [
    [
      {
        node: 'AI Agent',
        type: 'ai_tool',
        index: 0
      }
    ]
  ]
};

// 3. AI Agent -> Save Bot Message -> Send Messenger Reply
wf.connections['AI Agent'] = {
  main: [
    [
      {
        node: 'Save Bot Message',
        type: 'main',
        index: 0
      }
    ]
  ]
};

wf.connections['Save Bot Message'] = {
  main: [
    [
      {
        node: 'Send Messenger Reply',
        type: 'main',
        index: 0
      }
    ]
  ]
};

fs.writeFileSync('workflow.json', JSON.stringify(wf, null, 2));
console.log('AI Agent and all response delivery nodes added to workflow.json successfully!');
