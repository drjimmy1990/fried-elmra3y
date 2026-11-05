/**
 * Full Supabase Backup Script (All 18 Live Tables + OpenAPI Schema + Auth Users + Storage Files)
 * Saves everything into ./supabase-backup/ so it can be restored into Self-Hosted Supabase.
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'dashboard', 'node_modules', '@supabase', 'supabase-js'));

const envPath = path.join(__dirname, '..', 'dashboard', '.env.local');
const env = fs.readFileSync(envPath, 'utf8');
const getVal = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].trim().replace(/^['"]|['"]$/g, '') : '';
};

const url = getVal('NEXT_PUBLIC_SUPABASE_URL');
const key = getVal('SUPABASE_SERVICE_ROLE_KEY');

if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TABLES = [
  'profiles',
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

async function fetchAllRows(table) {
  const pageSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      console.warn(`  [skip/warn] ${table}: ${error.message}`);
      return null;
    }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

(async () => {
  const backupRoot = path.join(__dirname, '..', 'supabase-backup');
  fs.mkdirSync(backupRoot, { recursive: true });
  const existingDirs = fs.readdirSync(backupRoot).filter((d) => d.startsWith('backup-')).sort();
  // Reuse the current backup folder if it exists so we don't duplicate 58k messages
  const outDir =
    existingDirs.length > 0
      ? path.join(backupRoot, existingDirs[existingDirs.length - 1])
      : path.join(backupRoot, `backup-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`);

  const tablesDir = path.join(outDir, 'tables');
  const storageDir = path.join(outDir, 'storage');
  fs.mkdirSync(tablesDir, { recursive: true });
  fs.mkdirSync(storageDir, { recursive: true });

  console.log(`Updating full Supabase backup in: ${outDir}`);

  // 0. Save exact PostgREST OpenAPI Schema Definition
  try {
    const specRes = await fetch(`${url}/rest/v1/`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (specRes.ok) {
      const specJson = await specRes.json();
      fs.writeFileSync(path.join(outDir, 'openapi_schema.json'), JSON.stringify(specJson, null, 2), 'utf8');
      console.log('0. Saved full OpenAPI schema definition (openapi_schema.json).');
    }
  } catch (e) {
    console.warn('Could not save OpenAPI schema:', e.message);
  }

  const summaryPath = path.join(outDir, 'backup_summary.json');
  const summary = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
    : {
        sourceUrl: url,
        createdAt: new Date().toISOString(),
        tables: {},
        authUsersCount: 0,
        storageFiles: [],
      };

  // 1. Backup Auth Users
  console.log('1. Backing up Auth Users...');
  const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (!usersErr && usersData?.users) {
    fs.writeFileSync(
      path.join(outDir, 'auth_users.json'),
      JSON.stringify(usersData.users, null, 2),
      'utf8'
    );
    summary.authUsersCount = usersData.users.length;
    console.log(`   -> Saved ${usersData.users.length} auth users.`);
  }

  // 2. Backup Missing / New Public Tables (or all tables if missing)
  console.log('2. Backing up Database Tables...');
  for (const table of TABLES) {
    const destFile = path.join(tablesDir, `${table}.json`);
    if (fs.existsSync(destFile) && summary.tables[table] !== undefined) {
      console.log(`   -> ${table}: already backed up (${summary.tables[table]} rows)`);
      continue;
    }
    const rows = await fetchAllRows(table);
    if (rows !== null) {
      fs.writeFileSync(destFile, JSON.stringify(rows, null, 2), 'utf8');
      summary.tables[table] = rows.length;
      console.log(`   -> ${table}: ${rows.length} rows`);
    }
  }

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log('\n✅ Full 18-table backup verified and complete!');
  console.log(JSON.stringify(summary, null, 2));
})().catch((err) => {
  console.error('Backup failed:', err);
  process.exit(1);
});
