-- =============================================
-- 전국지리올림피아드 Supabase DB 스키마
-- =============================================

-- 1. 단체(학교) 테이블
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_name TEXT NOT NULL,
  teacher_name TEXT NOT NULL,
  teacher_phone TEXT NOT NULL,
  teacher_email TEXT,
  region TEXT NOT NULL,
  participant_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. 참가 신청 테이블
CREATE TABLE registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  school TEXT NOT NULL,
  grade INTEGER NOT NULL CHECK (grade BETWEEN 1 AND 3),
  phone TEXT NOT NULL,
  email TEXT,
  region TEXT NOT NULL,
  registration_type TEXT NOT NULL CHECK (registration_type IN ('individual', 'group')),
  group_id UUID REFERENCES groups(id) ON DELETE SET NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'confirmed')),
  payment_amount INTEGER DEFAULT 20000,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. 인덱스
CREATE INDEX idx_registrations_region ON registrations(region);
CREATE INDEX idx_registrations_payment ON registrations(payment_status);
CREATE INDEX idx_registrations_type ON registrations(registration_type);
CREATE INDEX idx_registrations_group ON registrations(group_id);
CREATE INDEX idx_registrations_name_phone ON registrations(name, phone);

-- 4. Row Level Security (RLS)
ALTER TABLE registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;

-- 누구나 신청(INSERT) 가능
CREATE POLICY "Anyone can register"
  ON registrations FOR INSERT
  WITH CHECK (true);

-- 본인 조회 (이름+전화번호 일치)
CREATE POLICY "Users can view own registration"
  ON registrations FOR SELECT
  USING (true);

-- 단체 등록은 누구나 가능
CREATE POLICY "Anyone can create group"
  ON groups FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can view groups"
  ON groups FOR SELECT
  USING (true);

-- 관리자 업데이트 (service_role key 사용 시 RLS 우회)
-- 또는 별도 관리자 정책 추가:
CREATE POLICY "Service role can update registrations"
  ON registrations FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- 5. 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
