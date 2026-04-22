// 테스트 데이터 전체 삭제 스크립트
//
// 삭제 대상:
//   - edit_logs (전체 행)
//   - registrations (전체 행)
//   - groups (전체 행)
//   - Supabase 'photos' 버킷의 모든 파일
//
// 보존 대상:
//   - exam_locations (시험장소 설정)
//   - page_content (페이지 콘텐츠)
//
// 사용법:
//   1) .env.local 에 SUPABASE_SERVICE_ROLE_KEY 설정
//   2) node scripts/purge-test-data.mjs
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

async function deleteAllRows(table) {
  const { error, count } = await supabase
    .from(table)
    .delete({ count: 'exact' })
    .gte('created_at', '1970-01-01');
  if (error) throw error;
  return count ?? 0;
}

async function main() {
  console.log('=== 테스트 데이터 삭제 시작 ===\n');

  console.log('[1/4] edit_logs 삭제 중...');
  const logsCount = await deleteAllRows('edit_logs');
  console.log(`  → ${logsCount}개 삭제\n`);

  console.log('[2/4] registrations 삭제 중...');
  const regCount = await deleteAllRows('registrations');
  console.log(`  → ${regCount}개 삭제\n`);

  console.log('[3/4] groups 삭제 중...');
  const grpCount = await deleteAllRows('groups');
  console.log(`  → ${grpCount}개 삭제\n`);

  console.log(`[4/4] Supabase '${BUCKET}' 버킷 파일 삭제 중...`);
  const paths = await listAll('');
  console.log(`  → ${paths.length}개 파일 발견`);
  if (paths.length > 0) {
    const CHUNK = 100;
    for (let i = 0; i < paths.length; i += CHUNK) {
      const slice = paths.slice(i, i + CHUNK);
      const { error } = await supabase.storage.from(BUCKET).remove(slice);
      if (error) throw error;
      console.log(`  → ${Math.min(i + CHUNK, paths.length)}/${paths.length}`);
    }
  }

  console.log('\n=== 완료 ===');
  console.log('Cloudinary 테스트 이미지는 대시보드에서 직접 삭제하세요:');
  console.log('  Media Library → unigeo 폴더 → 선택 후 Delete');
}

main().catch((err) => {
  console.error('\n실패:', err);
  process.exit(1);
});
