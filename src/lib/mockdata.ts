import { REGIONS } from './regions';

const MOCK_SCHOOLS: Record<string, string[]> = {
  'Seoul': ['서울고', '경기고', '한성고', '세화고', '중동고', '숙명여고', '대원외고'],
  'Busan': ['부산고', '해운대고', '동래고', '부일외고'],
  'Daegu': ['대구고', '경북고', '대건고'],
  'Incheon': ['인천고', '제물포고', '인천외고'],
  'Gwangju': ['광주일고', '전남고', '숭덕고'],
  'Daejeon': ['대전고', '충남고', '대전외고'],
  'Ulsan': ['울산고', '학성고'],
  'Sejong-si': ['세종고', '두루고'],
  'Gyeonggi-do': ['수원고', '안양고', '성남고', '고양고', '용인외고', '과천고'],
  'Chungcheongbuk-do': ['청주고', '충북고', '세광고'],
  'Chungcheongnam-do': ['천안고', '공주고', '온양고'],
  'Jeollabuk-do': ['전주고', '군산고', '이리고'],
  'Jellanam-do': ['목포고', '순천고', '여수고'],
  'Gyeongsangbuk-do': ['포항고', '안동고', '경주고'],
  'Gyeongsangnam-do': ['창원고', '마산고', '진주고'],
  'Jeju-do': ['제주고', '서귀포고'],
  'Gangwon-do': ['춘천고', '원주고', '강릉고'],
};

const FIRST_NAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍'];
const GIVEN_NAMES = ['민준', '서윤', '도윤', '서연', '하준', '지우', '시우', '하은', '주원', '지호', '지한', '수빈', '예준', '소율', '건우', '지민', '현우', '채원', '준서', '수아', '지훈', '유진', '태윤', '예은', '승현'];
const TEACHER_GIVEN_NAMES = ['성호', '재현', '은영', '미경', '동훈', '수정', '경철', '혜진', '상윤', '주은', '태경', '윤정', '석민', '하늘', '진욱', '나래'];

function randomName() {
  const last = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const given = GIVEN_NAMES[Math.floor(Math.random() * GIVEN_NAMES.length)];
  return last + given;
}

function randomTeacherName() {
  const last = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const given = TEACHER_GIVEN_NAMES[Math.floor(Math.random() * TEACHER_GIVEN_NAMES.length)];
  return last + given;
}

function randomPhone() {
  const mid = String(Math.floor(Math.random() * 9000) + 1000);
  const end = String(Math.floor(Math.random() * 9000) + 1000);
  return `010-${mid}-${end}`;
}

// 지역별 신청자 수 분포 (현실적인 비율)
const REGION_WEIGHTS: Record<string, number> = {
  'Seoul': 72,
  'Gyeonggi-do': 65,
  'Busan': 28,
  'Daegu': 22,
  'Incheon': 20,
  'Gwangju': 18,
  'Daejeon': 16,
  'Gyeongsangnam-do': 15,
  'Gyeongsangbuk-do': 14,
  'Chungcheongnam-do': 12,
  'Jeollabuk-do': 11,
  'Jellanam-do': 10,
  'Chungcheongbuk-do': 10,
  'Gangwon-do': 9,
  'Ulsan': 8,
  'Jeju-do': 5,
  'Sejong-si': 3,
};

function randomBirthdate() {
  const year = 2007 + Math.floor(Math.random() * 3); // 2007~2009
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function generateMockRegistrations() {
  const registrations: {
    id: string;
    name: string;
    school: string;
    grade: number;
    phone: string;
    email: string | null;
    region: string;
    registration_type: 'individual' | 'group';
    group_id: string | null;
    payment_status: 'pending' | 'confirmed' | 'deleted' | 'cancelled';
    payment_amount: number;
    created_at: string;
    birthdate: string | null;
    photo_url: string | null;
    is_deleted: boolean;
    teacher_name: string | null;
    teacher_phone: string | null;
    teacher_email: string | null;
  }[] = [];

  let idCounter = 1;

  for (const region of REGIONS) {
    const count = REGION_WEIGHTS[region.nameEn] || 5;
    const schools = MOCK_SCHOOLS[region.nameEn] || ['기타고'];

    // 학교별 지도교사 고정 (같은 학교의 단체는 같은 교사)
    const schoolTeacher: Record<string, { name: string; phone: string; email: string | null }> = {};
    for (const s of schools) {
      schoolTeacher[s] = {
        name: randomTeacherName(),
        phone: randomPhone(),
        email: Math.random() > 0.3 ? `teacher_${s}@school.kr` : null,
      };
    }

    for (let i = 0; i < count; i++) {
      const school = schools[Math.floor(Math.random() * schools.length)];
      const isGroup = Math.random() > 0.6;
      const daysAgo = Math.floor(Math.random() * 20);
      const date = new Date();
      date.setDate(date.getDate() - daysAgo);

      const t = schoolTeacher[school];

      registrations.push({
        id: String(idCounter++),
        name: randomName(),
        school: school + '등학교',
        grade: Math.floor(Math.random() * 3) + 1,
        phone: randomPhone(),
        email: Math.random() > 0.5 ? `student${idCounter}@example.com` : null,
        region: region.nameEn,
        registration_type: isGroup ? 'group' : 'individual',
        group_id: null,
        payment_status: Math.random() > 0.35 ? 'confirmed' : 'pending',
        payment_amount: 20000,
        created_at: date.toISOString(),
        birthdate: randomBirthdate(),
        photo_url: null,
        is_deleted: false,
        teacher_name: t.name,
        teacher_phone: t.phone,
        teacher_email: t.email,
      });
    }
  }

  return registrations;
}

// 싱글톤: 세션 동안 동일한 목 데이터 유지
let _cached: ReturnType<typeof generateMockRegistrations> | null = null;

export function getMockRegistrations() {
  if (!_cached) {
    _cached = generateMockRegistrations();
  }
  return _cached;
}

export function updateMockPaymentStatus(ids: string[], status: 'pending' | 'confirmed') {
  const data = getMockRegistrations();
  ids.forEach(id => {
    const item = data.find(r => r.id === id);
    if (item) item.payment_status = status;
  });
}

export function softDeleteMockRegistrations(ids: string[]) {
  const data = getMockRegistrations();
  ids.forEach(id => {
    const item = data.find(r => r.id === id);
    if (item) (item as Record<string, unknown>).is_deleted = true;
  });
}

export function restoreMockRegistrations(ids: string[]) {
  const data = getMockRegistrations();
  // 휴지통 복구 시 created_at을 현재 시각으로 갱신 → 맨 뒤로 정렬되어 기존 학생 수험번호 변동 없음
  const now = new Date().toISOString();
  ids.forEach(id => {
    const item = data.find(r => r.id === id);
    if (item) {
      (item as Record<string, unknown>).is_deleted = false;
      item.payment_status = 'pending';
      item.created_at = now;
    }
  });
}

export function cancelMockRegistrations(ids: string[]) {
  const data = getMockRegistrations();
  ids.forEach(id => {
    const item = data.find(r => r.id === id);
    if (item) item.payment_status = 'cancelled';
  });
}

export function uncancelMockRegistrations(ids: string[]) {
  const data = getMockRegistrations();
  ids.forEach(id => {
    const item = data.find(r => r.id === id);
    if (item) item.payment_status = 'pending';
  });
}

export function permanentDeleteMockRegistrations(ids: string[]) {
  if (!_cached) return;
  _cached = _cached.filter(r => !ids.includes(r.id));
}

// 시험장소 인메모리 저장소 (Mock 모드용)
export interface ExamLocation {
  school_name: string;
  address: string;
}

const _examLocations: Record<string, ExamLocation> = {};

export function getMockExamLocations(): Record<string, ExamLocation> {
  const copy: Record<string, ExamLocation> = {};
  for (const [k, v] of Object.entries(_examLocations)) {
    copy[k] = { ...v };
  }
  return copy;
}

export function setMockExamLocations(locations: Record<string, ExamLocation>) {
  for (const [region, location] of Object.entries(locations)) {
    _examLocations[region] = { ...location };
  }
}
