// Supabase 'photos' 버킷 전체 삭제 + registrations.photo_url NULL 처리
//
// 사용법:
//   1) .env.local 에 SUPABASE_SERVICE_ROLE_KEY 추가 (대시보드 > Settings > API)
//   2) node scripts/purge-supabase-photos.mjs
//
// 이 스크립트는 되돌릴 수 없는 파괴적 작업을 수행합니다.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  const raw = readFileSync(envPath, 'utf-8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env.local 에 필요합니다.');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
const BUCKET = 'photos';

async function listAll(prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 1000;
  while (true) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    if (!data || data.length === 0) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        // folder
        const nested = await listAll(path);
        out.push(...nested);
      } else {
        out.push(path);
      }
    }

    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function main() {
  console.log(`[1/3] '${BUCKET}' 버킷의 모든 파일 목록 조회 중...`);
  const paths = await listAll('');
  console.log(`  → ${paths.length}개 파일 발견`);

  if (paths.length > 0) {
    console.log('[2/3] 파일 삭제 중...');
    const CHUNK = 100;
    for (let i = 0; i < paths.length; i += CHUNK) {
      const slice = paths.slice(i, i + CHUNK);
      const { error } = await supabase.storage.from(BUCKET).remove(slice);
      if (error) throw error;
      console.log(`  → ${Math.min(i + CHUNK, paths.length)}/${paths.length}`);
    }
  } else {
    console.log('[2/3] 삭제할 파일 없음');
  }

  console.log('[3/3] registrations.photo_url NULL 처리 중...');
  const { error: updErr, count } = await supabase
    .from('registrations')
    .update({ photo_url: null }, { count: 'exact' })
    .not('photo_url', 'is', null);
  if (updErr) throw updErr;
  console.log(`  → ${count ?? 0}개 레코드 업데이트`);

  console.log('\n완료. 이제 Cloudinary로 새 사진을 업로드할 수 있습니다.');
}

main().catch((err) => {
  console.error('\n실패:', err);
  process.exit(1);
});
