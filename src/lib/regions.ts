// 17개 광역자치단체 데이터
// GeoJSON의 CTP_ENG_NM과 매칭
export const REGIONS = [
  { code: '11', nameEn: 'Seoul', nameKo: '서울특별시', students: 245000 },
  { code: '26', nameEn: 'Busan', nameKo: '부산광역시', students: 92000 },
  { code: '27', nameEn: 'Daegu', nameKo: '대구광역시', students: 72000 },
  { code: '28', nameEn: 'Incheon', nameKo: '인천광역시', students: 88000 },
  { code: '29', nameEn: 'Gwangju', nameKo: '광주광역시', students: 48000 },
  { code: '30', nameEn: 'Daejeon', nameKo: '대전광역시', students: 46000 },
  { code: '31', nameEn: 'Ulsan', nameKo: '울산광역시', students: 34000 },
  { code: '36', nameEn: 'Sejong-si', nameKo: '세종특별자치시', students: 14000 },
  { code: '41', nameEn: 'Gyeonggi-do', nameKo: '경기도', students: 380000 },
  { code: '43', nameEn: 'Chungcheongbuk-do', nameKo: '충청북도', students: 46000 },
  { code: '44', nameEn: 'Chungcheongnam-do', nameKo: '충청남도', students: 62000 },
  { code: '45', nameEn: 'Jeollabuk-do', nameKo: '전북특별자치도', students: 48000 },
  { code: '46', nameEn: 'Jellanam-do', nameKo: '전라남도', students: 48000 },
  { code: '47', nameEn: 'Gyeongsangbuk-do', nameKo: '경상북도', students: 72000 },
  { code: '48', nameEn: 'Gyeongsangnam-do', nameKo: '경상남도', students: 96000 },
  { code: '50', nameEn: 'Jeju-do', nameKo: '제주특별자치도', students: 20000 },
  { code: '51', nameEn: 'Gangwon-do', nameKo: '강원특별자치도', students: 42000 },
] as const;

export type Region = typeof REGIONS[number];

// 영문명 → 한글명 매핑
export const regionNameMap: Record<string, string> = Object.fromEntries(
  REGIONS.map(r => [r.nameEn, r.nameKo])
);

// 영문명 → 고등학생 수 매핑
export const regionStudentsMap: Record<string, number> = Object.fromEntries(
  REGIONS.map(r => [r.nameEn, r.students])
);
