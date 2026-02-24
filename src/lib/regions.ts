// 17개 광역자치단체 데이터
// GeoJSON의 CTP_ENG_NM과 매칭
export const REGIONS = [
  { code: '11', nameEn: 'Seoul', nameKo: '서울특별시', students: 203087 },
  { code: '26', nameEn: 'Busan', nameKo: '부산광역시', students: 70832 },
  { code: '27', nameEn: 'Daegu', nameKo: '대구광역시', students: 59533 },
  { code: '28', nameEn: 'Incheon', nameKo: '인천광역시', students: 75891 },
  { code: '29', nameEn: 'Gwangju', nameKo: '광주광역시', students: 41505 },
  { code: '30', nameEn: 'Daejeon', nameKo: '대전광역시', students: 38605 },
  { code: '31', nameEn: 'Ulsan', nameKo: '울산광역시', students: 31404 },
  { code: '36', nameEn: 'Sejong-si', nameKo: '세종특별자치시', students: 14342 },
  { code: '41', nameEn: 'Gyeonggi-do', nameKo: '경기도', students: 360932 },
  { code: '43', nameEn: 'Chungcheongbuk-do', nameKo: '충청북도', students: 40497 },
  { code: '44', nameEn: 'Chungcheongnam-do', nameKo: '충청남도', students: 59648 },
  { code: '45', nameEn: 'Jeollabuk-do', nameKo: '전북특별자치도', students: 48191 },
  { code: '46', nameEn: 'Jellanam-do', nameKo: '전라남도', students: 45721 },
  { code: '47', nameEn: 'Gyeongsangbuk-do', nameKo: '경상북도', students: 64076 },
  { code: '48', nameEn: 'Gyeongsangnam-do', nameKo: '경상남도', students: 89933 },
  { code: '50', nameEn: 'Jeju-do', nameKo: '제주특별자치도', students: 18711 },
  { code: '51', nameEn: 'Gangwon-do', nameKo: '강원특별자치도', students: 36558 },
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

// 영문명 → 2글자 약어 매핑
export const regionShortMap: Record<string, string> = {
  'Seoul': '서울',
  'Busan': '부산',
  'Daegu': '대구',
  'Incheon': '인천',
  'Gwangju': '광주',
  'Daejeon': '대전',
  'Ulsan': '울산',
  'Sejong-si': '세종',
  'Gyeonggi-do': '경기',
  'Chungcheongbuk-do': '충북',
  'Chungcheongnam-do': '충남',
  'Jeollabuk-do': '전북',
  'Jellanam-do': '전남',
  'Gyeongsangbuk-do': '경북',
  'Gyeongsangnam-do': '경남',
  'Jeju-do': '제주',
  'Gangwon-do': '강원',
};

// 영문명 → 수험번호용 지역코드(2자리) 매핑
export const examRegionCodeMap: Record<string, string> = {
  'Seoul': '01',
  'Incheon': '02',
  'Gyeonggi-do': '03',
  'Gangwon-do': '04',
  'Busan': '05',
  'Ulsan': '06',
  'Gyeongsangnam-do': '07',
  'Daegu': '08',
  'Gyeongsangbuk-do': '09',
  'Gwangju': '10',
  'Jellanam-do': '11',
  'Jeollabuk-do': '12',
  'Daejeon': '13',
  'Sejong-si': '14',
  'Chungcheongnam-do': '15',
  'Chungcheongbuk-do': '16',
  'Jeju-do': '17',
};
