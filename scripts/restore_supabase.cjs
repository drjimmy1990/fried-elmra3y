/**
 * Full Supabase Restore Script for Self-Hosted Supabase
 *
 * Usage:
 *   NEW_SUPABASE_URL="https://supabase.yourdomain.com" \
 *   NEW_SERVICE_ROLE_KEY="eyJ..." \
 *   OLD_SUPABASE_URL="https://old-project.supabase.co" \
 *   node scripts/restore_supabase.cjs ./supabase-backup/backup-YYYY-MM-DDTHH-MM-SS
 */
const fs = require('fs');
const path = require('path');
const { createClient } = require(path.join(__dirname, '..', 'dashboard', 'node_modules', '@supabase', 'supabase-js'));

const backupDir = process.argv[2];
const newUrl = (process.env.NEW_SUPABASE_URL || '').replace(/\/+$/, '');
const newKey = process.env.NEW_SERVICE_ROLE_KEY || '';
const oldUrl = (process.env.OLD_SUPABASE_URL || '').replace(/\/+$/, '');

if (!backupDir || !newUrl || !newKey) {
  console.error(
    'Usage:\n  NEW_SUPABASE_URL="https://..." NEW_SERVICE_ROLE_KEY="eyJ..." node scripts/restore_supabase.cjs <backup-folder>'
  );
  process.exit(1);
}

const supabase = createClient(newUrl, newKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Order of restoration respecting foreign-key dependencies
const RESTORE_ORDER = [
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

function rewriteStorageUrls(obj, sourceBaseUrl, targetBaseUrl) {
  if (!sourceBaseUrl || !targetBaseUrl) return obj;
  const raw = JSON.stringify(obj);
  const replaced = raw.split(sourceBaseUrl).join(targetBaseUrl);
  return JSON.parse(replaced);
}

async function upsertInBatches(table, rows, batchSize = 250) {
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) {
      console.error(`  [ERROR] ${table} batch ${i}..${i + chunk.length}: ${error.message}`);
      throw error;
    }
  }
}

(async () => {
  const resolvedDir = path.resolve(backupDir);
  const summaryPath = path.join(resolvedDir, 'backup_summary.json');
  const summary = fs.existsSync(summaryPath)
    ? JSON.parse(fs.readFileSync(summaryPath, 'utf8'))
    : {};
  const sourceUrl = (oldUrl || summary.sourceUrl || '').replace(/\/+$/, '');

  console.log(`Restoring backup from: ${resolvedDir}`);
  console.log(`Target Self-Hosted Supabase: ${newUrl}`);

  // 1. Restore Storage Buckets & Files first (so URLs work immediately)
  const bucketsPath = path.join(resolvedDir, 'storage_buckets.json');
  if (fs.existsSync(bucketsPath)) {
    console.log('\n1. Restoring Storage Buckets & Files...');
    const buckets = JSON.parse(fs.readFileSync(bucketsPath, 'utf8'));
    for (const b of buckets) {
      await supabase.storage.createBucket(b.name, {
        public: Boolean(b.public),
        fileSizeLimit: b.file_size_limit || undefined,
        allowedMimeTypes: b.allowed_mime_types || undefined,
      });

      const localBucketDir = path.join(resolvedDir, 'storage', b.name);
      if (!fs.existsSync(localBucketDir)) continue;

      function walkFiles(dir, prefix = '') {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        let list = [];
        for (const entry of entries) {
          const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            list = list.concat(walkFiles(full, rel));
          } else {
            list.push({ rel, full });
          }
        }
        return list;
      }

      const files = walkFiles(localBucketDir);
      for (const f of files) {
        const buf = fs.readFileSync(f.full);
        const ext = path.extname(f.rel).toLowerCase();
        const contentType =
          ext === '.png'
            ? 'image/png'
            : ext === '.jpg' || ext === '.jpeg'
            ? 'image/jpeg'
            : ext === '.webp'
            ? 'image/webp'
            : ext === '.pdf'
            ? 'application/pdf'
            : 'application/octet-stream';
        const { error: upErr } = await supabase.storage
          .from(b.name)
          .upload(f.rel, buf, { upsert: true, contentType });
        if (upErr) {
          console.warn(`   [warn] upload ${b.name}/${f.rel}: ${upErr.message}`);
        } else {
          console.log(`   -> Uploaded ${b.name}/${f.rel}`);
        }
      }
    }
  }

  // 2. Restore Auth Users & Profiles
  const authUsersPath = path.join(resolvedDir, 'auth_users.json');
  const profilesPath = path.join(resolvedDir, 'tables', 'profiles.json');
  const emailToNewId = new Map();

  if (fs.existsSync(authUsersPath)) {
    console.log('\n2. Restoring Auth Users...');
    const authUsers = JSON.parse(fs.readFileSync(authUsersPath, 'utf8'));
    const { data: existingList } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingByEmail = new Map(
      (existingList?.users || []).map((u) => [(u.email || '').toLowerCase(), u])
    );

    for (const u of authUsers) {
      const email = (u.email || '').toLowerCase();
      if (!email) continue;
      if (existingByEmail.has(email)) {
        const ex = existingByEmail.get(email);
        emailToNewId.set(u.id, ex.id);
        console.log(`   -> User ${email} already exists (${ex.id})`);
      } else {
        const defaultPass = email.includes('test@') ? 'Demo@2026!' : 'Khedewy@2026!';
        const { data: crt, error: crtErr } = await supabase.auth.admin.createUser({
          id: u.id,
          email: u.email,
          password: defaultPass,
          email_confirm: true,
          user_metadata: u.user_metadata || {},
          app_metadata: u.app_metadata || {},
        });
        if (crtErr) {
          console.warn(`   [warn] Could not create user ${email}: ${crtErr.message}`);
        } else {
          emailToNewId.set(u.id, crt.user.id);
          console.log(`   -> Created user ${email} (${crt.user.id}) [temp password: ${defaultPass}]`);
        }
      }
    }
  }

  if (fs.existsSync(profilesPath)) {
    console.log('\n3. Restoring Profiles...');
    const profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8')).map((p) => ({
      ...p,
      id: emailToNewId.get(p.id) || p.id,
    }));
    await upsertInBatches('profiles', profiles);
    console.log(`   -> Restored ${profiles.length} profiles.`);
  }

  // 3. Restore Public Tables in Dependency Order
  console.log('\n4. Restoring Public Tables...');
  for (const table of RESTORE_ORDER) {
    const filePath = path.join(resolvedDir, 'tables', `${table}.json`);
    if (!fs.existsSync(filePath)) continue;
    let rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`   -> ${table}: 0 rows (skipped)`);
      continue;
    }
    rows = rewriteStorageUrls(rows, sourceUrl, newUrl);
    await upsertInBatches(table, rows);
    console.log(`   -> Restored ${table}: ${rows.length} rows`);
  }

  console.log('\n✅ Restore completed! Remember to run the sequence sync SQL in Supabase SQL Editor:');
  console.log(`
SELECT setval('public.orders_order_number_seq', COALESCE((SELECT MAX(order_number) FROM public.orders), 1), true);
SELECT setval('public.complaints_ticket_number_seq', COALESCE((SELECT MAX(ticket_number) FROM public.complaints), 1), true);
  `);
})().catch((err) => {
  console.error('Restore failed:', err);
  process.exit(1);
});
