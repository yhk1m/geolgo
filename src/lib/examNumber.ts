import { examRegionCodeMap } from './regions';

interface RegistrationForExamNumber {
  id: string;
  region: string;
  created_at: string;
}

/**
 * 전체 등록 데이터를 받아 지역별 created_at 순으로 수험번호를 부여한다.
 * 수험번호 = '11' + 지역코드(2자리) + 순번(3자리, 1000명 이상 시 4자리)
 * 삭제된 항목도 포함하여 순번을 매겨 번호 안정성 유지.
 */
export function computeExamNumbers(registrations: RegistrationForExamNumber[]): Map<string, string> {
  const result = new Map<string, string>();

  // 지역별로 그룹핑
  const byRegion = new Map<string, RegistrationForExamNumber[]>();
  for (const reg of registrations) {
    const list = byRegion.get(reg.region) || [];
    list.push(reg);
    byRegion.set(reg.region, list);
  }

  // 각 지역에서 created_at 순 정렬 후 순번 부여
  for (const [region, list] of byRegion) {
    const regionCode = examRegionCodeMap[region];
    if (!regionCode) continue;

    // created_at 오름차순 정렬
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (let i = 0; i < list.length; i++) {
      const seq = i + 1;
      const seqStr = list.length >= 1000
        ? String(seq).padStart(4, '0')
        : String(seq).padStart(3, '0');
      result.set(list[i].id, `11${regionCode}${seqStr}`);
    }
  }

  return result;
}
