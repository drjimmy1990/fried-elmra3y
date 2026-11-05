/**
 * Converts a JSON backup folder into a single PostgreSQL SQL dump file (full_data_dump.sql)
 * using SET session_replication_role = 'replica' so all UUIDs, Foreign Keys, and Sequences
 * restore cleanly without any constraint errors.
 */
const fs = require('fs');
const path = require('path');

const backupRoot = path.join(__dirname, '..', 'supabase-backup');
const dirs = fs
  .readdirSync(backupRoot)
  .filter((d) => d.startsWith('backup-'))
  .sort();

if (dirs.length === 0) {
  console.error('No backup folder found');
  process.exit(1);
}

const latestDir = path.join(backupRoot, dirs[dirs.length - 1]);
const tablesDir = path.join(latestDir, 'tables');

const TABLES_ORDER = [
  'bot_settings',
  'branches',
  'branch_delivery_zones',
  'offers',
  'meta_apps',
  'channels',
  'channel_secrets',
  'comment_settings',
  'post_settings',
  'comment_rules',
  'comment_events',
  'contacts',
  'orders',
  'order_items',
  'complaints',
  'messages',
  'n8n_chat_histories',
  'n8n_chat_histories1',
  'queue',
];

function sqlLiteral(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'number') return Number.isFinite(val) ? String(val) : 'NULL';
  if (Array.isArray(val) || typeof val === 'object') {
    const jsonStr = JSON.stringify(val).replace(/'/g, "''");
    return `'${jsonStr}'::jsonb`;
  }
  const str = String(val).replace(/'/g, "''");
  return `'${str}'`;
}

// Column type overrides for TEXT[] array columns
const TEXT_ARRAY_COLUMNS = {
  bot_settings: ['menu_images'],
  comment_settings: ['Filter_words', 'sensitive_keywords'],
  comment_rules: ['keywords', 'reply_variations', 'delete_keywords'],
};

function formatColumnValue(table, col, val) {
  if (val === null || val === undefined) return 'NULL';
  if (
    TEXT_ARRAY_COLUMNS[table] &&
    TEXT_ARRAY_COLUMNS[table].includes(col) &&
    Array.isArray(val)
  ) {
    if (val.length === 0) return 'ARRAY[]::TEXT[]';
    const items = val.map((v) => `'${String(v).replace(/'/g, "''")}'`).join(', ');
    return `ARRAY[${items}]::TEXT[]`;
  }
  return sqlLiteral(val);
}

const outSqlPath = path.join(latestDir, 'full_data_dump.sql');
const stream = fs.createWriteStream(outSqlPath, { encoding: 'utf8' });

stream.write(`-- ==============================================================================\n`);
stream.write(`-- Full Data SQL Dump generated from ${path.basename(latestDir)}\n`);
stream.write(`-- Generated at: ${new Date().toISOString()}\n`);
stream.write(`-- ==============================================================================\n\n`);
stream.write(`BEGIN;\n`);
stream.write(`-- Disable foreign key & trigger checks during bulk data import\n`);
stream.write(`SET session_replication_role = 'replica';\n\n`);

let totalRows = 0;

for (const table of TABLES_ORDER) {
  const jsonFile = path.join(tablesDir, `${table}.json`);
  if (!fs.existsSync(jsonFile)) continue;
  const rows = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
  if (!Array.isArray(rows) || rows.length === 0) continue;

  stream.write(`-- Table: public.${table} (${rows.length} rows)\n`);
  const cols = Object.keys(rows[0]);
  const colList = cols.map((c) => `"${c}"`).join(', ');

  for (const row of rows) {
    const vals = cols.map((c) => formatColumnValue(table, c, row[c])).join(', ');
    stream.write(
      `INSERT INTO public."${table}" (${colList}) VALUES (${vals}) ON CONFLICT (id) DO UPDATE SET ${cols
        .filter((c) => c !== 'id')
        .map((c) => `"${c}" = EXCLUDED."${c}"`)
        .join(', ')};\n`
    );
    totalRows++;
  }
  stream.write(`\n`);
}

stream.write(`-- Re-enable foreign key & trigger checks\n`);
stream.write(`SET session_replication_role = 'origin';\n\n`);
stream.write(`-- Sync auto-increment sequences to highest existing numbers\n`);
stream.write(
  `SELECT setval('public.orders_order_number_seq', COALESCE((SELECT MAX(order_number) FROM public.orders), 1), true);\n`
);
stream.write(
  `SELECT setval('public.complaints_ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM public.complaints), 1), true);\n`
);
stream.write(
  `SELECT setval(pg_get_serial_sequence('public.n8n_chat_histories', 'id'), COALESCE((SELECT MAX(id) FROM public.n8n_chat_histories), 1), true);\n`
);
stream.write(
  `SELECT setval(pg_get_serial_sequence('public.n8n_chat_histories1', 'id'), COALESCE((SELECT MAX(id) FROM public.n8n_chat_histories1), 1), true);\n`
);
stream.write(
  `SELECT setval(pg_get_serial_sequence('public.queue', 'id'), COALESCE((SELECT MAX(id) FROM public.queue), 1), true);\n\n`
);
stream.write(`COMMIT;\n`);
stream.end(() => {
  const stats = fs.statSync(outSqlPath);
  console.log(
    `✅ Generated SQL dump: ${outSqlPath} (${totalRows} total rows, ${(
      stats.size /
      (1024 * 1024)
    ).toFixed(2)} MB)`
  );
});
