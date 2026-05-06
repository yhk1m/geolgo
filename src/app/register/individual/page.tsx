'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { REGIONS } from '@/lib/regions';
import { fetchPageContent } from '@/lib/pageContent';
import PhotoEditor from '@/components/PhotoEditor';
import Link from 'next/link';

export default function IndividualRegisterPage() {
  const [periodOpen, setPeriodOpen] = useState<boolean | null>(null);
  const [periodMessage, setPeriodMessage] = useState('');

  useEffect(() => {
    fetchPageContent().then(content => {
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
  const [form, setForm] = useState({
    name: '',
    school: '',
    grade: '',
    classNum: '',
    phone: '',
    email: '',
    region: '',
    teacherName: '',
    teacherPhone: '',
    teacherEmail: '',
  });
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [editingPhoto, setEditingPhoto] = useState<File | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const isDirty = Object.values(form).some(v => v !== '') || birthYear !== '' || birthMonth !== '' || birthDay !== '' || photoFile !== null || privacyConsent;

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('파일 크기는 10MB 이하여야 합니다.');
      return;
    }

    setEditingPhoto(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const applyEditedPhoto = (edited: File) => {
    setPhotoFile(edited);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(edited);
    setEditingPhoto(null);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoFile) {
      alert('증명사진을 첨부해주세요.');
      return;
    }
    setSubmitting(true);
    setResult(null);

    const birthdateStr = birthYear && birthMonth && birthDay
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : null;

    // 중복 신청 검사: 이름 + 생년월일 + 전화번호가 동일한 활성 신청이 있으면 차단
    if (birthdateStr) {
      const normalizePhone = (p: string) => p.replace(/[^0-9]/g, '');
      const { data: existing } = await supabase
        .from('registrations')
        .select('id, phone, school')
        .eq('name', form.name)
        .eq('birthdate', birthdateStr)
        .neq('payment_status', 'deleted');
      const dup = (existing || []).find(r => normalizePhone(r.phone) === normalizePhone(form.phone));
      if (dup) {
        setDuplicateAlert(
          `${form.name}님은 이미 신청 내역이 있습니다.\n(이름·생년월일·전화번호가 동일한 접수 확인)\n\n중복 신청을 방지하기 위해 접수가 차단되었습니다. 신청 내역 확인은 '접수 확인' 메뉴에서 가능합니다.`
        );
        setSubmitting(false);
        return;
      }
    }

    try {
      let photo_url: string | null = null;

      if (photoFile) {
        const ext = photoFile.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('photos')
          .upload(fileName, photoFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }

      const { error } = await supabase.from('registrations').insert({
        name: form.name,
        school: form.school,
        grade: parseInt(form.grade),
        class_name: form.classNum,
        phone: form.phone,
        email: form.email || null,
        region: form.region,
        birthdate: birthdateStr,
        photo_url,
        registration_type: 'individual',
        payment_status: 'pending',
        payment_amount: 20000,
        teacher_name: form.teacherName || null,
        teacher_phone: form.teacherPhone || null,
        teacher_email: form.teacherEmail || null,
      });

      if (error) throw error;

      setResult({
        success: true,
        message: `${form.name}님의 참가 신청이 완료되었습니다. 참가비 20,000원을 입금해주세요.`,
      });
      setForm({ name: '', school: '', grade: '', classNum: '', phone: '', email: '', region: '', teacherName: '', teacherPhone: '', teacherEmail: '' });
      setBirthYear(''); setBirthMonth(''); setBirthDay('');
      setPhotoFile(null);
      setPhotoPreview(null);
      setPrivacyConsent(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    } catch {
      setResult({
        success: false,
        message: '신청 중 오류가 발생했습니다. 다시 시도해주세요.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (periodOpen === null) {
    return <div className="text-center py-20 text-[#999]">로딩 중...</div>;
  }

  if (periodOpen === false) {
    return (
      <div className="max-w-xl mx-auto px-4 sm:px-6 py-20 text-center">
        <h1 className="text-2xl font-bold mb-4 text-[#111]">개인 참가 신청</h1>
        <p className="text-[#666] mb-6">{periodMessage}</p>
        <Link href="/" className="btn btn-secondary px-6 py-2">메인으로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="text-3xl font-bold mb-2 text-[#111]">개인 참가 신청</h1>
      <p className="text-[#666] mb-10">제26회 전국지리올림피아드 개인 접수</p>

      {duplicateAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={() => setDuplicateAlert(null)}>
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="w-12 h-12 bg-[#fff7e0] rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl text-[#c80]">!</span>
              </div>
              <h3 className="text-lg font-semibold text-[#c80]">중복 신청</h3>
            </div>
            <p className="text-sm text-[#333] mb-4 text-center whitespace-pre-line">{duplicateAlert}</p>
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
                  <p className="text-xs text-[#999] mt-2">입금자명: 소속고 이름 (예: ○○고 김○○)</p>
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            이름 <span className="text-[#c00]">*</span>
          </label>
          <input
            type="text"
            name="name"
            value={form.name}
            onChange={handleChange}
            required
            placeholder="홍길동"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            학교명(반드시 학교 전체 명칭을 기입해주세요) <span className="text-[#c00]">*</span>
          </label>
          <input
            type="text"
            name="school"
            value={form.school}
            onChange={handleChange}
            required
            placeholder="○○고등학교"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">
              학년 <span className="text-[#c00]">*</span>
            </label>
            <select name="grade" value={form.grade} onChange={handleChange} required>
              <option value="">선택</option>
              <option value="1">1학년</option>
              <option value="2">2학년</option>
              <option value="3">3학년</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#333] mb-1.5">
              반 <span className="text-[#c00]">*</span>
            </label>
            <input
              type="text"
              name="classNum"
              value={form.classNum}
              onChange={handleChange}
              required
              placeholder="예: 3, 가"
            />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label className="block text-sm font-medium text-[#333] mb-1.5">
              지역 <span className="text-[#c00]">*</span>
            </label>
            <select name="region" value={form.region} onChange={handleChange} required>
              <option value="">선택</option>
              {REGIONS.map(r => (
                <option key={r.code} value={r.nameEn}>{r.nameKo}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            생년월일 <span className="text-[#c00]">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2">
            <select value={birthYear} onChange={e => setBirthYear(e.target.value)} required>
              <option value="">년</option>
              {[2010, 2009, 2008, 2007, 2006, 2005, 2004, 2003].map(y => (
                <option key={y} value={String(y)}>{y}년</option>
              ))}
            </select>
            <select value={birthMonth} onChange={e => setBirthMonth(e.target.value)} required>
              <option value="">월</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={String(m)}>{m}월</option>
              ))}
            </select>
            <select value={birthDay} onChange={e => setBirthDay(e.target.value)} required>
              <option value="">일</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map(d => (
                <option key={d} value={String(d)}>{d}일</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            전화번호 <span className="text-[#c00]">*</span>
          </label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
            placeholder="010-1234-5678"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            이메일 <span className="text-[#c00]">*</span>
          </label>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={handleChange}
            required
            placeholder="example@email.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">
            증명사진 <span className="text-[#c00]">*</span>
          </label>
          <div className="flex items-start gap-4">
            <div>
              <label className="btn btn-secondary text-sm px-4 py-1.5 cursor-pointer inline-block">
                사진 선택
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoChange}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-[#999] mt-1">이미지 파일, 5MB 이하 권장 (편집 후 자동 압축)</p>
            </div>
            {photoPreview && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => photoFile && setEditingPhoto(photoFile)}
                  className="block p-0 cursor-pointer"
                  title="사진 편집"
                >
                  <img
                    src={photoPreview}
                    alt="미리보기"
                    className="w-[70px] h-[90px] object-cover rounded border border-[#ddd]"
                  />
                </button>
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute -top-2 -right-2 w-5 h-5 bg-[#111] text-white rounded-full text-xs flex items-center justify-center hover:bg-[#c00]"
                >
                  &times;
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-[#e5e5e5]">
          <h2 className="text-lg font-semibold text-[#111] mb-4">담당교사 정보</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1.5">
                교사 이름 <span className="text-[#c00]">*</span>
              </label>
              <input
                type="text"
                name="teacherName"
                value={form.teacherName}
                onChange={handleChange}
                required
                placeholder="홍길동"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1.5">
                교사 전화번호 <span className="text-[#c00]">*</span>
              </label>
              <input
                type="tel"
                name="teacherPhone"
                value={form.teacherPhone}
                onChange={handleChange}
                required
                placeholder="010-1234-5678"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#333] mb-1.5">
                교사 이메일 <span className="text-[#c00]">*</span>
              </label>
              <input
                type="email"
                name="teacherEmail"
                value={form.teacherEmail}
                onChange={handleChange}
                required
                placeholder="teacher@school.ac.kr"
              />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <div className="flex gap-2">
            <input
              type="checkbox"
              checked={privacyConsent}
              onChange={e => setPrivacyConsent(e.target.checked)}
              required
              id="privacy-individual"
              className="w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
            />
            <label htmlFor="privacy-individual" className="text-sm text-[#333] leading-relaxed cursor-pointer">
              <span className="text-[#c00]">[필수]</span> 전국지리올림피아드 참가 신청 및 대회 운영을 위한 개인정보를 수집 및 이용 동의 여부 (수집한 개인정보는 정보 주체의 동의 없이 수집한 목적 외로 사용하지 않으며, 대회 시상식 이후 폐기합니다.)
            </label>
          </div>
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? '신청 중...' : '참가 신청'}
          </button>
        </div>

        <p className="text-sm text-[#c00] text-center font-medium">
          신청 후 참가비 20,000원을 입금하셔야 접수가 완료됩니다.
        </p>
      </form>

      {editingPhoto && (
        <PhotoEditor
          file={editingPhoto}
          onCancel={() => setEditingPhoto(null)}
          onApply={applyEditedPhoto}
        />
      )}
    </div>
  );
}
