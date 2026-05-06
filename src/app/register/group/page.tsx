'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { REGIONS } from '@/lib/regions';
import { resizeImage } from '@/lib/resizeImage';
import { fetchPageContent } from '@/lib/pageContent';
import PhotoEditor from '@/components/PhotoEditor';
import Link from 'next/link';

interface Participant {
  name: string;
  grade: string;
  classNum: string;
  phone: string;
  email: string;
  birthdate: string;
  photoFile: File | null;
  photoPreview: string | null;
}

interface PhotoConflict {
  file: File;
  preview: string;
  name: string;
  matchingIndices: number[];
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

function normalizeBirthdate(raw: string): string {
  if (!raw) return '';
  // YYYY-MM-DD, YYYY/MM/DD, YYYY.MM.DD
  const match = raw.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (match) {
    return `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
  }
  // YYYYMMDD
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    return `${compact[1]}-${compact[2]}-${compact[3]}`;
  }
  return '';
}

function parseCSV(text: string): Participant[] {
  const lines = text.split(/\r?\n/).filter(line => line.trim());
  const results: Participant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    // 헤더행 스킵
    if (i === 0 && (cols[0] === '이름' || cols[0].toLowerCase() === 'name')) continue;
    if (cols.length < 4) continue;

    const name = cols[0];
    const grade = cols[1];
    const classNum = cols[2] || '';
    const phone = cols[3];
    const birthdate = normalizeBirthdate(cols[4] || '');
    const email = cols[5] || '';
    if (!name || !grade || !phone) continue;

    const gradeNum = grade.replace(/[^0-9]/g, '');
    if (!['1', '2', '3'].includes(gradeNum)) continue;

    results.push({ name, grade: gradeNum, classNum: classNum.trim(), phone, email: email.trim(), birthdate, photoFile: null, photoPreview: null });
  }
  return results;
}

export default function GroupRegisterPage() {
  const [periodOpen, setPeriodOpen] = useState<boolean | null>(null);
  const [periodMessage, setPeriodMessage] = useState('');
  const [groupGuideUrl, setGroupGuideUrl] = useState<string | undefined>();

  useEffect(() => {
    fetchPageContent().then(content => {
      setGroupGuideUrl(content.groupGuideUrl);
      const period = content.registrationPeriod;
      if (!period?.startDate || !period?.endDate) {
        setPeriodOpen(true);
        return;
      }
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      if (today < period.startDate) {
        setPeriodOpen(false);
        setPeriodMessage(`참가 신청 기간이 아닙니다. (${period.startDate} 부터 접수 가능)`);
      } else if (today > period.endDate) {
        setPeriodOpen(false);
        setPeriodMessage(`참가 신청이 마감되었습니다. (${period.endDate} 마감)`);
      } else {
        setPeriodOpen(true);
      }
    });
  }, []);

  const [teacher, setTeacher] = useState({
    name: '',
    phone: '',
    email: '',
    school: '',
    region: '',
  });
  const [participants, setParticipants] = useState<Participant[]>([
    { name: '', grade: '', classNum: '', phone: '', email: '', birthdate: '', photoFile: null, photoPreview: null },
  ]);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<{ name: string; reason: string }[] | null>(null);
  const [csvError, setCsvError] = useState('');
  const [photoConflicts, setPhotoConflicts] = useState<PhotoConflict[]>([]);
  const [showPhotoConflictModal, setShowPhotoConflictModal] = useState(false);
  const [editingParticipantPhoto, setEditingParticipantPhoto] = useState<{ index: number; file: File } | null>(null);
  const [bulkSummary, setBulkSummary] = useState<{ total: number; matched: number; conflict: number; oversize: number; nomatch: number; nonImage: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkPhotoRef = useRef<HTMLInputElement>(null);

  const isDirty = Object.values(teacher).some(v => v !== '') || participants.some(p => p.name !== '' || p.grade !== '' || p.phone !== '' || p.birthdate !== '' || p.photoFile !== null) || privacyConsent;

  useEffect(() => {
    if (!isDirty || result?.success) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    const handleLinkClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor?.href) return;
      try {
        if (new URL(anchor.href).origin !== window.location.origin) return;
      } catch { return; }
      if (!window.confirm('작성한 데이터가 지워집니다. 페이지를 떠나시겠습니까?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleLinkClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleLinkClick, true);
    };
  }, [isDirty, result]);

  const addParticipant = () => {
    setParticipants(prev => [...prev, { name: '', grade: '', classNum: '', phone: '', email: '', birthdate: '', photoFile: null, photoPreview: null }]);
  };

  const removeParticipant = (index: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== index));
  };

  const updateParticipant = (index: number, field: 'name' | 'grade' | 'classNum' | 'phone' | 'email' | 'birthdate', value: string) => {
    setParticipants(prev =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const updateParticipantPhoto = (index: number, file: File | null) => {
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('이미지 파일만 업로드 가능합니다.');
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert('파일 크기는 10MB 이하여야 합니다.');
        return;
      }
      setEditingParticipantPhoto({ index, file });
    } else {
      setParticipants(prev =>
        prev.map((p, i) => i === index ? { ...p, photoFile: null, photoPreview: null } : p)
      );
    }
  };

  const applyParticipantPhoto = (edited: File) => {
    if (!editingParticipantPhoto) return;
    const { index } = editingParticipantPhoto;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setParticipants(prev =>
        prev.map((p, i) => i === index ? { ...p, photoFile: edited, photoPreview: ev.target?.result as string } : p)
      );
    };
    reader.readAsDataURL(edited);
    setEditingParticipantPhoto(null);
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

  const handleBulkPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const conflicts: PhotoConflict[] = [];
    const newParticipants = [...participants];
    let matched = 0, oversize = 0, nomatch = 0, nonImage = 0;
    const total = files.length;

    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) { nonImage++; continue; }
      if (file.size > 10 * 1024 * 1024) { oversize++; continue; }

      const resized = await resizeImage(file, { centerCrop: true });
      const name = file.name.replace(/\.[^.]+$/, '').trim();
      const matchingIndices = newParticipants
        .map((p, i) => p.name.trim() === name ? i : -1)
        .filter(i => i !== -1);

      if (matchingIndices.length === 1) {
        const preview = await readFileAsDataURL(resized);
        newParticipants[matchingIndices[0]] = {
          ...newParticipants[matchingIndices[0]],
          photoFile: resized,
          photoPreview: preview,
        };
        matched++;
      } else if (matchingIndices.length > 1) {
        const preview = await readFileAsDataURL(resized);
        conflicts.push({ file: resized, preview, name, matchingIndices });
      } else {
        nomatch++;
      }
    }

    setParticipants(newParticipants);

    if (conflicts.length > 0) {
      setPhotoConflicts(conflicts);
      setShowPhotoConflictModal(true);
    }

    setBulkSummary({ total, matched, conflict: conflicts.length, oversize, nomatch, nonImage });

    if (bulkPhotoRef.current) bulkPhotoRef.current.value = '';
  };

  const resolvePhotoConflict = (conflictIndex: number, participantIndex: number) => {
    const conflict = photoConflicts[conflictIndex];
    setParticipants(prev =>
      prev.map((p, i) => i === participantIndex ? { ...p, photoFile: conflict.file, photoPreview: conflict.preview } : p)
    );
    const remaining = photoConflicts.filter((_, i) => i !== conflictIndex);
    setPhotoConflicts(remaining);
    if (remaining.length === 0) {
      setShowPhotoConflictModal(false);
    }
  };

  const downloadTemplate = () => {
    const bom = '\uFEFF';
    const content = bom + '이름,학년,반,전화번호,생년월일,이메일\n홍길동,1,3,010-1234-5678,2008-03-15,hong@email.com\n김철수,2,가,010-9876-5432,2007-11-20,kim@email.com\n';
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
    const missingPhoto = participants.filter(p => !p.photoFile);
    if (missingPhoto.length > 0) {
      alert(`사진이 첨부되지 않은 학생이 ${missingPhoto.length}명 있습니다. 모든 학생의 사진을 첨부해주세요.`);
      return;
    }
    setSubmitting(true);
    setResult(null);

    // 중복 신청 검사
    const normalizePhone = (p: string) => p.replace(/[^0-9]/g, '');
    const dupList: { name: string; reason: string }[] = [];

    // 1) 입력 내 자체 중복 검사 (이름 + 생년월일 + 전화번호)
    const seen = new Map<string, number>();
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      if (!p.name || !p.birthdate || !p.phone) continue;
      const key = `${p.name}|${p.birthdate}|${normalizePhone(p.phone)}`;
      if (seen.has(key)) {
        dupList.push({ name: p.name, reason: `입력 목록 ${seen.get(key)! + 1}번과 ${i + 1}번이 동일 정보입니다.` });
      } else {
        seen.set(key, i);
      }
    }

    // 2) DB 내 기존 신청과 중복 검사
    if (dupList.length === 0) {
      const names = Array.from(new Set(participants.map(p => p.name).filter(Boolean)));
      if (names.length > 0) {
        const { data: existing } = await supabase
          .from('registrations')
          .select('id, name, birthdate, phone, school')
          .in('name', names)
          .neq('payment_status', 'deleted');
        for (let i = 0; i < participants.length; i++) {
          const p = participants[i];
          if (!p.birthdate) continue;
          const dup = (existing || []).find(r =>
            r.name === p.name &&
            r.birthdate === p.birthdate &&
            normalizePhone(r.phone) === normalizePhone(p.phone)
          );
          if (dup) {
            dupList.push({
              name: p.name,
              reason: `이미 신청 내역이 존재합니다${dup.school ? ` (${dup.school})` : ''}.`,
            });
          }
        }
      }
    }

    if (dupList.length > 0) {
      setDuplicateAlert(dupList);
      setSubmitting(false);
      return;
    }

    try {
      // Upload all participant photos in parallel
      const photoUrls = await Promise.all(
        participants.map(async (p) => {
          if (!p.photoFile) return null;
          const ext = p.photoFile.name.split('.').pop();
          const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('photos')
            .upload(fileName, p.photoFile, {
              contentType: p.photoFile.type,
            });
          if (uploadError) throw uploadError;
          const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
          return urlData.publicUrl;
        })
      );

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

      const registrations = participants.map((p, i) => ({
        name: p.name,
        school: teacher.school,
        grade: parseInt(p.grade),
        class_name: p.classNum,
        phone: p.phone,
        email: p.email || null,
        birthdate: p.birthdate || null,
        photo_url: photoUrls[i],
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
      setParticipants([{ name: '', grade: '', classNum: '', phone: '', email: '', birthdate: '', photoFile: null, photoPreview: null }]);
      setPrivacyConsent(false);
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

  if (periodOpen === null) {
    return <div className="text-center py-20 text-[#999]">로딩 중...</div>;
  }

  if (periodOpen === false) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-[#111]">학교 단체 접수</h1>
        <p className="text-[#666] mb-6">{periodMessage}</p>
        <Link href="/" className="btn btn-secondary px-6 py-2">메인으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-[#111]">학교 단체 접수</h1>
        {groupGuideUrl && (
          <a
            href={groupGuideUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary text-sm px-4 py-1.5"
          >
            업로드 방법 안내
          </a>
        )}
      </div>
      <p className="text-[#666] mb-10">지도교사가 학생들을 일괄 신청합니다.</p>

      {duplicateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDuplicateAlert(null)}>
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-[#fff7e0] rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl text-[#c80]">!</span>
              </div>
              <h3 className="text-lg font-semibold text-[#c80]">중복 신청 감지</h3>
            </div>
            <p className="text-sm text-[#333] mb-3 text-center">
              아래 학생들은 이미 신청 내역이 있거나 입력이 중복됩니다.<br />
              해당 학생을 제외한 후 다시 시도해주세요.
            </p>
            <ul className="mb-4 space-y-2 text-sm">
              {duplicateAlert.map((d, i) => (
                <li key={i} className="p-3 rounded border border-[#eee] bg-[#fafafa]">
                  <span className="font-semibold text-[#111]">{d.name}</span>
                  <span className="block text-xs text-[#666] mt-0.5">{d.reason}</span>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setDuplicateAlert(null)}
              className="btn btn-secondary w-full py-2.5"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => !result.success && setResult(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            {result.success ? (
              <>
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-[#f0f0f0] rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl">&#10003;</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#111]">접수 완료</h3>
                </div>
                <p className="text-sm text-[#333] mb-4 text-center">{result.message}</p>
                <div className="p-3 bg-[#fafafa] rounded-lg border border-[#eee] mb-4">
                  <p className="text-xs text-[#999] mb-1">입금 계좌</p>
                  <p className="font-medium text-sm">(사)대한지리학회 국민은행 477401-01-176602</p>
                  <p className="text-xs text-[#999] mt-2">입금자명: 학교명 (예: ○○고)</p>
                </div>
                <p className="text-xs font-bold text-[#111] text-center mb-4">입금 확인까지 1~2일 정도 소요될 수 있습니다.</p>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="btn btn-primary w-full py-2.5"
                >
                  확인
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <div className="w-12 h-12 bg-[#fff0f0] rounded-full flex items-center justify-center mx-auto mb-3">
                    <span className="text-2xl text-[#c00]">!</span>
                  </div>
                  <h3 className="text-lg font-semibold text-[#c00]">오류 발생</h3>
                </div>
                <p className="text-sm text-[#333] mb-4 text-center">{result.message}</p>
                <button
                  type="button"
                  onClick={() => setResult(null)}
                  className="btn btn-secondary w-full py-2.5"
                >
                  닫기
                </button>
              </>
            )}
          </div>
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
            <div className="flex items-center gap-3 flex-wrap">
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
              <label className="btn btn-secondary text-sm px-4 py-1.5 cursor-pointer">
                사진 일괄 업로드
                <input
                  ref={bulkPhotoRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleBulkPhotoUpload}
                  className="hidden"
                />
              </label>
              <span className="text-xs text-[#999]">
                양식: 이름, 학년, 반, 전화번호, 생년월일, 이메일 (첫 행은 헤더)
              </span>
            </div>
            {csvError && (
              <p className="text-xs text-[#c00] mt-2">{csvError}</p>
            )}
            <div className="mt-3 text-xs text-[#999] bg-white rounded border border-[#eee] p-3 font-mono">
              <p className="text-[#666] mb-1">CSV 예시:</p>
              <p>이름,학년,반,전화번호,생년월일,이메일</p>
              <p>홍길동,1,3,010-1234-5678,2008-03-15,hong@email.com</p>
              <p>김철수,2,가,010-9876-5432,2007-11-20,kim@email.com</p>
            </div>
            {bulkSummary && (
              <div className="mt-3 p-3 rounded border border-[#ddd] bg-white text-xs flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-[#111] font-medium">사진 일괄 업로드 결과: {bulkSummary.total}장 중 {bulkSummary.matched}장 적용</p>
                  {(bulkSummary.conflict + bulkSummary.oversize + bulkSummary.nomatch + bulkSummary.nonImage) > 0 && (
                    <ul className="text-[#666] space-y-0.5">
                      {bulkSummary.conflict > 0 && <li>· 동명이인 매칭 대기: {bulkSummary.conflict}장</li>}
                      {bulkSummary.oversize > 0 && <li className="text-[#c00]">· 용량 초과(10MB 초과)로 누락: {bulkSummary.oversize}장</li>}
                      {bulkSummary.nomatch > 0 && <li className="text-[#c00]">· 이름 불일치로 누락: {bulkSummary.nomatch}장 (파일명이 학생 이름과 정확히 같아야 함)</li>}
                      {bulkSummary.nonImage > 0 && <li className="text-[#c00]">· 이미지 아님: {bulkSummary.nonImage}장</li>}
                    </ul>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setBulkSummary(null)}
                  className="text-[#999] hover:text-[#111] shrink-0"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>
            )}
          </div>

          <div className="space-y-3">
            {participants.map((p, i) => (
              <div key={i} className="p-3 bg-[#fafafa] rounded-lg border border-[#eee]">
                {/* 1행: 번호, 이름, 학년, 반, 전화번호, 이메일, 삭제 */}
                <div className="grid grid-cols-[20px_1fr_72px_56px_auto] sm:grid-cols-[20px_1fr_80px_50px_1fr_1fr_auto] gap-2 items-center">
                  <span className="text-xs text-[#999]">{i + 1}</span>
                  <input
                    type="text"
                    value={p.name}
                    onChange={e => updateParticipant(i, 'name', e.target.value)}
                    required
                    placeholder="이름"
                  />
                  <select
                    value={p.grade}
                    onChange={e => updateParticipant(i, 'grade', e.target.value)}
                    required
                  >
                    <option value="">학년</option>
                    <option value="1">1학년</option>
                    <option value="2">2학년</option>
                    <option value="3">3학년</option>
                  </select>
                  <input
                    type="text"
                    value={p.classNum}
                    onChange={e => updateParticipant(i, 'classNum', e.target.value)}
                    required
                    placeholder="반"
                  />
                  <input
                    type="tel"
                    value={p.phone}
                    onChange={e => updateParticipant(i, 'phone', e.target.value)}
                    required
                    placeholder="010-0000-0000"
                    className="hidden sm:block"
                  />
                  <input
                    type="email"
                    value={p.email}
                    onChange={e => updateParticipant(i, 'email', e.target.value)}
                    placeholder="이메일"
                    className="hidden sm:block text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => removeParticipant(i)}
                    className="text-[#999] hover:text-[#c00] text-sm px-1"
                  >
                    삭제
                  </button>
                </div>
                {/* 모바일: 전화번호 + 이메일 */}
                <div className="mt-2 grid grid-cols-2 gap-2 sm:hidden">
                  <input
                    type="tel"
                    value={p.phone}
                    onChange={e => updateParticipant(i, 'phone', e.target.value)}
                    required
                    placeholder="010-0000-0000"
                  />
                  <input
                    type="email"
                    value={p.email}
                    onChange={e => updateParticipant(i, 'email', e.target.value)}
                    placeholder="이메일"
                    className="text-sm"
                  />
                </div>
                {/* 3행: 생년월일 + 사진 */}
                <div className="mt-2 grid grid-cols-[3fr_3fr_3fr_2fr] gap-1 items-center">
                  <select
                    value={p.birthdate ? p.birthdate.split('-')[0] : ''}
                    onChange={e => {
                      const parts = p.birthdate ? p.birthdate.split('-') : ['', '', ''];
                      updateParticipant(i, 'birthdate', `${e.target.value}-${parts[1] || ''}-${parts[2] || ''}`);
                    }}
                    required
                    className="text-sm"
                  >
                    <option value="">년</option>
                    {[2010, 2009, 2008, 2007, 2006, 2005, 2004, 2003].map(y => (
                      <option key={y} value={String(y)}>{y}</option>
                    ))}
                  </select>
                  <select
                    value={p.birthdate ? p.birthdate.split('-')[1] : ''}
                    onChange={e => {
                      const parts = p.birthdate ? p.birthdate.split('-') : ['', '', ''];
                      updateParticipant(i, 'birthdate', `${parts[0] || ''}-${e.target.value}-${parts[2] || ''}`);
                    }}
                    required
                    className="text-sm"
                  >
                    <option value="">월</option>
                    {Array.from({ length: 12 }, (_, j) => j + 1).map(m => (
                      <option key={m} value={String(m).padStart(2, '0')}>{m}월</option>
                    ))}
                  </select>
                  <select
                    value={p.birthdate ? p.birthdate.split('-')[2] : ''}
                    onChange={e => {
                      const parts = p.birthdate ? p.birthdate.split('-') : ['', '', ''];
                      updateParticipant(i, 'birthdate', `${parts[0] || ''}-${parts[1] || ''}-${e.target.value}`);
                    }}
                    required
                    className="text-sm"
                  >
                    <option value="">일</option>
                    {Array.from({ length: 31 }, (_, j) => j + 1).map(d => (
                      <option key={d} value={String(d).padStart(2, '0')}>{d}일</option>
                    ))}
                  </select>
                  <div className="relative">
                    {p.photoPreview ? (
                      <div className="relative w-[35px] h-[45px] rounded border border-[#ddd] overflow-hidden">
                        <button
                          type="button"
                          onClick={() => p.photoFile && setEditingParticipantPhoto({ index: i, file: p.photoFile })}
                          className="block w-full h-full p-0 cursor-pointer"
                          title="사진 편집"
                        >
                          <img src={p.photoPreview} alt="사진" className="w-full h-full object-cover" />
                        </button>
                        <button
                          type="button"
                          onClick={() => updateParticipantPhoto(i, null)}
                          className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#111] text-white rounded-full text-[10px] flex items-center justify-center hover:bg-[#c00]"
                        >
                          &times;
                        </button>
                      </div>
                    ) : (
                      <label className="block text-center text-[11px] text-[#888] bg-white border border-dashed border-[#ccc] rounded px-1 py-2.5 cursor-pointer hover:border-[#999] hover:text-[#666]">
                        사진 첨부
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => updateParticipantPhoto(i, e.target.files?.[0] || null)}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                </div>
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

          <div className="flex gap-2 mb-4">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={e => setPrivacyConsent(e.target.checked)}
              required
              id="privacy-group"
              className="w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
            />
            <label htmlFor="privacy-group" className="text-sm text-[#333] leading-relaxed cursor-pointer">
              <span className="text-[#c00]">[필수]</span> 전국지리올림피아드 참가 신청 및 대회 운영을 위한 개인정보를 수집 및 이용 동의 여부 (수집한 개인정보는 정보 주체의 동의 없이 수집한 목적 외로 사용하지 않으며, 대회 시상식 이후 폐기합니다.)
            </label>
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

      {/* 동명이인 사진 매칭 모달 */}
      {showPhotoConflictModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-2">동명이인 사진 매칭</h3>
            <p className="text-sm text-[#666] mb-4">
              같은 이름의 학생이 여러 명입니다. 사진을 매칭할 학생을 선택해주세요.
            </p>
            {photoConflicts.map((conflict, ci) => (
              <div key={ci} className="mb-4 p-3 border rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <img src={conflict.preview} alt="" className="w-10 h-[53px] object-cover rounded border" />
                  <span className="font-medium">{conflict.name}</span>
                </div>
                <div className="space-y-1">
                  {conflict.matchingIndices.map(idx => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => resolvePhotoConflict(ci, idx)}
                      className="w-full text-left px-3 py-2 rounded border hover:bg-[#f0f0f0] text-sm"
                    >
                      {participants[idx].name} - {participants[idx].grade}학년 {participants[idx].classNum}반 / {participants[idx].birthdate || '생년월일 미입력'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => { setShowPhotoConflictModal(false); setPhotoConflicts([]); }}
              className="w-full mt-2 btn btn-secondary py-2"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {editingParticipantPhoto && (
        <PhotoEditor
          file={editingParticipantPhoto.file}
          onCancel={() => setEditingParticipantPhoto(null)}
          onApply={applyParticipantPhoto}
        />
      )}
    </div>
  );
}
