'use client';

import { useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { REGIONS } from '@/lib/regions';

interface Participant {
  name: string;
  grade: string;
  phone: string;
}

function parseCSV(text: string): Participant[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const results: Participant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    // 헤더행 스킵
    if (i === 0 && (cols[0] === '이름' || cols[0].toLowerCase() === 'name')) continue;
    if (cols.length < 3) continue;

    const [name, grade, phone] = cols;
    if (!name || !grade || !phone) continue;

    const gradeNum = grade.replace(/[^0-9]/g, '');
    if (!['1', '2', '3'].includes(gradeNum)) continue;

    results.push({ name, grade: gradeNum, phone });
  }
  return results;
}

export default function GroupRegisterPage() {
  const [teacher, setTeacher] = useState({
    name: '',
    phone: '',
    email: '',
    school: '',
    region: '',
  });
  const [participants, setParticipants] = useState<Participant[]>([
    { name: '', grade: '', phone: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addParticipant = () => {
    setParticipants(prev => [...prev, { name: '', grade: '', phone: '' }]);
  };

  const removeParticipant = (index: number) => {
    if (participants.length <= 1) return;
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: keyof Participant, value: string) => {
    setParticipants(prev =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const parsed = parseCSV(text);

      if (parsed.length === 0) {
        setCsvError('유효한 데이터가 없습니다. CSV 양식을 확인해주세요.');
        return;
      }

      setParticipants(parsed);
    };
    reader.readAsText(file, 'UTF-8');

    // 같은 파일 재업로드 허용
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadTemplate = () => {
    const bom = '\uFEFF';
    const content = bom + '이름,학년,전화번호\n홍길동,1,010-1234-5678\n김철수,2,010-9876-5432\n';
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '단체접수_양식.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .insert({
          school_name: teacher.school,
          teacher_name: teacher.name,
          teacher_phone: teacher.phone,
          teacher_email: teacher.email || null,
          region: teacher.region,
          participant_count: participants.length,
        })
        .select('id')
        .single();

      if (groupError) throw groupError;

      const registrations = participants.map(p => ({
        name: p.name,
        school: teacher.school,
        grade: parseInt(p.grade),
        phone: p.phone,
        region: teacher.region,
        registration_type: 'group',
        group_id: groupData.id,
        payment_status: 'pending',
        payment_amount: 20000,
      }));

      const { error: regError } = await supabase.from('registrations').insert(registrations);
      if (regError) throw regError;

      const total = participants.length * 20000;
      setResult({
        success: true,
        message: `${teacher.school} 단체 접수가 완료되었습니다. (${participants.length}명, 총 ${total.toLocaleString()}원)`,
      });
      setTeacher({ name: '', phone: '', email: '', school: '', region: '' });
      setParticipants([{ name: '', grade: '', phone: '' }]);
    } catch {
      setResult({
        success: false,
        message: '신청 중 오류가 발생했습니다. 다시 시도해주세요.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const totalAmount = participants.length * 20000;

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="text-3xl font-bold mb-2 text-[#111]">학교 단체 접수</h1>
      <p className="text-[#666] mb-10">지도교사가 학생들을 일괄 신청합니다.</p>

      {result && (
        <div className={`p-4 rounded-lg mb-8 text-sm ${
          result.success
            ? 'bg-[#f0f0f0] border border-[#ccc] text-[#111]'
            : 'bg-[#fff0f0] border border-[#e5c5c5] text-[#c00]'
        }`}>
          {result.success ? (
            <div>
              <p className="font-semibold mb-2">{result.message}</p>
              <div className="p-3 bg-white rounded border border-[#ddd]">
                <p className="text-xs text-[#999] mb-1">입금 계좌</p>
                <p className="font-medium">(사)대한지리학회 국민은행 477401-01-176602</p>
                <p className="text-xs text-[#999] mt-2">입금자명: 학교명 (예: ○○고)</p>
              </div>
            </div>
          ) : result.message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* 지도교사 정보 */}
        <div>
          <h2 className="text-lg font-semibold mb-4 text-[#111] pb-2 border-b border-[#e5e5e5]">
            지도교사 정보
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1.5">
                  교사명 <span className="text-[#c00]">*</span>
                </label>
                <input
                  type="text"
                  value={teacher.name}
                  onChange={e => setTeacher(p => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="김교사"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1.5">
                  학교명(반드시 학교 전체 명칭을 기입해주세요) <span className="text-[#c00]">*</span>
                </label>
                <input
                  type="text"
                  value={teacher.school}
                  onChange={e => setTeacher(p => ({ ...p, school: e.target.value }))}
                  required
                  placeholder="○○고등학교"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1.5">
                  연락처 <span className="text-[#c00]">*</span>
                </label>
                <input
                  type="tel"
                  value={teacher.phone}
                  onChange={e => setTeacher(p => ({ ...p, phone: e.target.value }))}
                  required
                  placeholder="010-1234-5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#333] mb-1.5">
                  지역 <span className="text-[#c00]">*</span>
                </label>
                <select
                  value={teacher.region}
                  onChange={e => setTeacher(p => ({ ...p, region: e.target.value }))}
                  required
                >
                  <option value="">선택</option>
                  {REGIONS.map(r => (
                    <option key={r.code} value={r.nameEn}>{r.nameKo}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1.5">
                이메일 <span className="text-[#c00]">*</span>
              </label>
              <input
                type="email"
                value={teacher.email}
                onChange={e => setTeacher(p => ({ ...p, email: e.target.value }))}
                required
                placeholder="teacher@school.kr"
              />
            </div>
          </div>
        </div>

        {/* 참가 학생 목록 */}
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#e5e5e5]">
            <h2 className="text-lg font-semibold text-[#111]">
              참가 학생 ({participants.length}명)
            </h2>
            <button
              type="button"
              onClick={addParticipant}
              className="btn btn-secondary text-sm px-4 py-1.5"
            >
              + 학생 추가
            </button>
          </div>

          {/* CSV 업로드 */}
          <div className="mb-5 p-4 rounded-lg border border-dashed border-[#ccc] bg-[#fafafa]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-[#333]">CSV 파일로 일괄 등록</p>
              <button
                type="button"
                onClick={downloadTemplate}
                className="text-xs text-[#666] hover:text-[#111] underline underline-offset-2"
              >
                양식 다운로드
              </button>
            </div>
            <div className="flex items-center gap-3">
              <label className="btn btn-secondary text-sm px-4 py-1.5 cursor-pointer">
                CSV 파일 선택
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-[#999]">
                양식: 이름, 학년, 전화번호 (첫 행은 헤더)
              </span>
            </div>
            {csvError && (
              <p className="text-xs text-[#c00] mt-2">{csvError}</p>
            )}
            <div className="mt-3 text-xs text-[#999] bg-white rounded border border-[#eee] p-3 font-mono">
              <p className="text-[#666] mb-1">CSV 예시:</p>
              <p>이름,학년,전화번호</p>
              <p>홍길동,1,010-1234-5678</p>
              <p>김철수,2,010-9876-5432</p>
            </div>
          </div>

          <div className="space-y-3">
            {participants.map((p, i) => (
              <div key={i} className="p-3 bg-[#fafafa] rounded-lg border border-[#eee]">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-xs text-[#999] w-5 shrink-0">{i + 1}</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updateParticipant(i, 'name', e.target.value)}
                    required
                    placeholder="이름"
                    className="flex-1 min-w-0"
                  />
                  <select
                    value={p.grade}
                    onChange={e => updateParticipant(i, 'grade', e.target.value)}
                    required
                    className="w-20 sm:w-24"
                  >
                    <option value="">학년</option>
                    <option value="1">1학년</option>
                    <option value="2">2학년</option>
                    <option value="3">3학년</option>
                  </select>
                  <input
                    type="tel"
                    value={p.phone}
                    onChange={e => updateParticipant(i, 'phone', e.target.value)}
                    required
                    placeholder="전화번호"
                    className="flex-1 min-w-0 hidden sm:block"
                  />
                  <button
                    type="button"
                    onClick={() => removeParticipant(i)}
                    className="text-[#999] hover:text-[#c00] text-sm px-1 sm:px-2 shrink-0"
                    disabled={participants.length <= 1}
                  >
                    삭제
                  </button>
                </div>
                <input
                  type="tel"
                  value={p.phone}
                  onChange={e => updateParticipant(i, 'phone', e.target.value)}
                  required
                  placeholder="전화번호"
                  className="mt-2 w-full sm:hidden"
                />
              </div>
            ))}
          </div>
        </div>

        {/* 합계 & 제출 */}
        <div className="pt-4 border-t border-[#e5e5e5]">
          <div className="flex justify-between items-center mb-6">
            <span className="text-[#666]">총 참가비</span>
            <span className="text-2xl font-bold text-[#111]">
              {totalAmount.toLocaleString()}원
            </span>
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '접수 중...' : `단체 접수 (${participants.length}명)`}
          </button>
        </div>

        <p className="text-sm text-[#c00] text-center font-medium mt-4">
          신청 후 참가비 20,000원을 입금하셔야 접수가 완료됩니다.
        </p>
      </form>
    </div>
  );
}
