'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { REGIONS } from '@/lib/regions';

export default function IndividualRegisterPage() {
  const [form, setForm] = useState({
    name: '',
    school: '',
    grade: '',
    phone: '',
    email: '',
    region: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const { error } = await supabase.from('registrations').insert({
        name: form.name,
        school: form.school,
        grade: parseInt(form.grade),
        phone: form.phone,
        email: form.email || null,
        region: form.region,
        registration_type: 'individual',
        payment_status: 'pending',
        payment_amount: 20000,
      });

      if (error) throw error;

      setResult({
        success: true,
        message: `${form.name}님의 참가 신청이 완료되었습니다. 참가비 20,000원을 입금해주세요.`,
      });
      setForm({ name: '', school: '', grade: '', phone: '', email: '', region: '' });
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
        <div className={`p-4 rounded-lg mb-8 text-sm ${
          result.success
            ? 'bg-[#f0f0f0] border border-[#ccc] text-[#111]'
            : 'bg-[#fff0f0] border border-[#e5c5c5] text-[#c00]'
        }`}>
          {result.success && (
            <div className="mb-3">
              <p className="font-semibold mb-2">{result.message}</p>
              <div className="p-3 bg-white rounded border border-[#ddd]">
                <p className="text-xs text-[#999] mb-1">입금 계좌</p>
                <p className="font-medium">(사)대한지리학회 국민은행 477401-01-176602</p>
                <p className="text-xs text-[#999] mt-2">입금자명: 소속고 이름 (예: ○○고 김○○)</p>
              </div>
            </div>
          )}
          {!result.success && result.message}
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

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        <div className="pt-4">
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
