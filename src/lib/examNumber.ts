import { examRegionCodeMap } from './regions';

interface RegistrationForExamNumber {
  id: string;
  region: string;
  created_at: string;
}

/**
 * 전체 등록 데이터를 받아 지역별 created_at 순으로 수험번호를 부여한다.
 * 수험번호 = '11' + 분반(2자리) + 번호(2자리, 01~70) + 지역번호(2자리) = 총 8자리
 * 분반은 01부터 시작하며, 번호가 70에 도달하면 분반이 +1되고 번호는 01로 초기화된다.
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

  const MAX_PER_CLASS = 70;

  // 각 지역에서 created_at 순 정렬 후 분반+번호 부여
  for (const [region, list] of byRegion) {
    const regionCode = examRegionCodeMap[region];
    if (!regionCode) continue;

    // created_at 오름차순 정렬
    list.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    for (let i = 0; i < list.length; i++) {
      const classNum = Math.floor(i / MAX_PER_CLASS) + 1;  // 분반: 01부터
      const seatNum = (i % MAX_PER_CLASS) + 1;              // 번호: 01~70
      const classStr = String(classNum).padStart(2, '0');
      const seatStr = String(seatNum).padStart(2, '0');
      result.set(list[i].id, `11${classStr}${seatStr}${regionCode}`);
    }
  }

  return result;
}
