// © 2026 김용현
import { supabase, isSupabaseConfigured } from './supabase';

export interface PageContent {
  hero: {
    year: string;
    title: string;
    subtitle: string;
  };
  schedule: {
    items: { period: string; date: string; note: string }[];
    footnote: string;
  };
  info: {
    items: { label: string; value: string }[];
    footnote: string;
  };
  contact: {
    general: { label: string; value: string }[];
    regions: { region: string; email: string }[];
  };
  announcementImageUrl?: string;
  registrationPeriod?: {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
  };
  groupGuideUrl?: string;
}

export const DEFAULT_CONTENT: PageContent = {
  hero: {
    year: '2026년',
    title: '제26회 전국지리올림피아드',
    subtitle: '대한지리학회 · 국토연구원 주최 | 전국지리교사연합회 주관',
  },
  schedule: {
    items: [
      { period: '참가 신청', date: '2026. 4. 27.(월) ~ 5. 16.(토)', note: '참가등록페이지에서 신청' },
      { period: '대회', date: '2026. 5. 23.(토) 14:00 ~ 15:30', note: '선택형 및 서술형 시험 · 지역 시험장' },
      { period: '결과 발표', date: '2026. 6. 11.(목)', note: '전국지리교사연합회 · 대한지리학회 홈페이지' },
      { period: '시상식', date: '2026. 7. 11.(토)', note: '전국 부문 입상자 (서울대학교 예정)' },
    ],
    footnote: '* 위 일정은 대회 사정에 따라 변경될 수 있습니다.',
  },
  info: {
    items: [
      { label: '대회 방식', value: '선택형 27문항, 서술형 3세트' },
      { label: '참가 자격', value: '고등학교 재학생 중 희망 학생\n학교별 참가인원 제한 없음' },
      { label: '참가비', value: '20,000원\n(사)대한지리학회\n국민은행 477401-01-176602' },
      { label: '접수 방법', value: '본 사이트에서 참가신청서 제출\n참가비 입금 시 소속 고등학교와\n본인 이름으로 입금 (○○고 김○○)' },
    ],
    footnote: '* 접수 기간 내에 신청서 제출과 참가비 납부 모두 완료한 건에 한해서만 등록 유효',
  },
  contact: {
    general: [
      { label: '접수 및 참가비 관련', value: '전국지리교사연합회 총무 (ilovejos@korea.kr)' },
      { label: '대회 장소 관련', value: '각 지역 지리올림피아드 담당자' },
    ],
    regions: [
      { region: '서울', email: 'rokmc807@gmail.com' },
      { region: '인천', email: 'rokmc807@gmail.com' },
      { region: '경기', email: 'ilovejos@korea.kr' },
      { region: '강원', email: 'sky89526@naver.com' },
      { region: '충북', email: 'geolee0401@korea.kr' },
      { region: '충남', email: 'swf9519@ai.cne.go.kr' },
      { region: '광주', email: 'christin092@gmail.com' },
      { region: '전남', email: 'yatmotakeshi@naver.com' },
      { region: '대구', email: 'obiwan@yeungnam.ms.kr' },
      { region: '경북', email: 'chui5222@naver.com' },
      { region: '대전', email: 'loverlckd@naver.com' },
      { region: '세종', email: 'xodn0109@naver.com' },
      { region: '부산', email: 'narayou1@naver.com' },
      { region: '울산', email: 'geoedtr@gmail.com' },
      { region: '경남', email: 'geo9835@naver.com' },
      { region: '전북', email: 'ikarroce@hanmail.net' },
      { region: '제주', email: 'gtow@naver.com' },
    ],
  },
};

export async function fetchPageContent(): Promise<PageContent> {
  if (!isSupabaseConfigured) return DEFAULT_CONTENT;
  try {
    const { data, error } = await supabase
      .from('page_content')
      .select('content')
      .eq('id', 'main')
      .single();
    if (error || !data) return DEFAULT_CONTENT;
    return data.content as PageContent;
  } catch {
    return DEFAULT_CONTENT;
  }
}

export async function savePageContent(content: PageContent) {
  const { error } = await supabase
    .from('page_content')
    .upsert({ id: 'main', content, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  return { error };
}
