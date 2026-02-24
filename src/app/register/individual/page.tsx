'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { REGIONS } from '@/lib/regions';

export default function IndividualRegisterPage() {
  const [form, setForm] = useState({
    name: '',
    school: '',
    grade: '',
    classNum: '',
    phone: '',
    email: '',
    region: '',
  });
  const [birthYear, setBirthYear] = useState('');
  const [birthMonth, setBirthMonth] = useState('');
  const [birthDay, setBirthDay] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
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
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하여야 합니다.');
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
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
        birthdate: birthYear && birthMonth && birthDay ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}` : null,
        photo_url,
        registration_type: 'individual',
        payment_status: 'pending',
        payment_amount: 20000,
      });

      if (error) throw error;

      setResult({
        success: true,
        message: `${form.name}님의 참가 신청이 완료되었습니다. 참가비 20,000원을 입금해주세요.`,
      });
      setForm({ name: '', school: '', grade: '', classNum: '', phone: '', email: '', region: '' });
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

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="text-3xl font-bold mb-2 text-[#111]">개인 참가 신청</h1>
      <p className="text-[#666] mb-10">제26회 전국지리올림피아드 개인 접수</p>

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
              <p className="text-xs text-[#999] mt-1">이미지 파일, 5MB 이하</p>
            </div>
            {photoPreview && (
              <div className="relative">
                <img
                  src={photoPreview}
                  alt="미리보기"
                  className="w-[70px] h-[90px] object-cover rounded border border-[#ddd]"
                />
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
    </div>
  );
}
