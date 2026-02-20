'use client';

import { useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations } from '@/lib/mockdata';
import { regionNameMap } from '@/lib/regions';

interface Registration {
  id: string;
  name: string;
  school: string;
  grade: number;
  region: string;
  registration_type: string;
  payment_status: string;
  payment_amount: number;
  created_at: string;
}

export default function CheckPage() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [results, setResults] = useState<Registration[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');

  // Mock 모드일 때 샘플 3개 추출
  const mockSamples = !isSupabaseConfigured
    ? getMockRegistrations().slice(0, 3)
    : [];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setError('');
    setResults(null);

    const normalize = (p: string) => p.replace(/-/g, '');

    try {
      let matched: Registration[];

      if (isSupabaseConfigured) {
        // 하이픈 포함/미포함 모두 검색
        const { data, error: queryError } = await supabase
          .from('registrations')
          .select('*')
          .eq('name', name);
        if (queryError) throw queryError;
        matched = (data || []).filter(
          r => normalize(r.phone) === normalize(phone)
        );
      } else {
        matched = getMockRegistrations().filter(
          r => r.name === name && normalize(r.phone) === normalize(phone)
        );
      }

      setResults(matched);
    } catch {
      setError('조회 중 오류가 발생했습니다.');
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <h1 className="text-3xl font-bold mb-2 text-[#111]">접수 확인</h1>
      <p className="text-[#666] mb-10">이름과 전화번호로 접수 상태를 확인하세요.</p>

      {mockSamples.length > 0 && (
        <div className="mb-8 p-4 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-sm">
          <p className="text-[#999] mb-2">Mock 데이터 테스트용 샘플:</p>
          {mockSamples.map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { setName(s.name); setPhone(s.phone); }}
              className="block w-full text-left px-3 py-1.5 rounded hover:bg-[#eee] transition-colors"
            >
              <span className="text-[#111] font-medium">{s.name}</span>
              <span className="text-[#999] ml-2">{s.phone}</span>
              <span className="text-[#ccc] ml-2">({s.school})</span>
            </button>
          ))}
        </div>
      )}

      <form onSubmit={handleSearch} className="space-y-4 mb-10">
        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">이름</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="홍길동"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#333] mb-1.5">전화번호</label>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            required
            placeholder="010-1234-5678"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="btn btn-primary w-full py-3 disabled:opacity-50"
        >
          {searching ? '조회 중...' : '접수 확인'}
        </button>
      </form>

      {error && (
        <div className="p-4 rounded-lg bg-[#fff0f0] border border-[#e5c5c5] text-[#c00] text-sm">
          {error}
        </div>
      )}

      {results !== null && (
        <div>
          {results.length === 0 ? (
            <div className="text-center py-12 text-[#999]">
              <p className="text-lg mb-2">접수 내역이 없습니다.</p>
              <p className="text-sm">이름과 전화번호를 다시 확인해주세요.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider">
                조회 결과 ({results.length}건)
              </h2>
              {results.map(reg => (
                <div key={reg.id} className="p-5 rounded-lg border border-[#e5e5e5] bg-[#fafafa]">
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-semibold text-[#111]">{reg.name}</span>
                    <span className={`badge ${
                      reg.payment_status === 'confirmed' ? 'badge-confirmed' : 'badge-pending'
                    }`}>
                      {reg.payment_status === 'confirmed' ? '입금 확인' : '입금 대기'}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-[#999]">학교</span>
                      <p className="text-[#111]">{reg.school}</p>
                    </div>
                    <div>
                      <span className="text-[#999]">학년</span>
                      <p className="text-[#111]">{reg.grade}학년</p>
                    </div>
                    <div>
                      <span className="text-[#999]">지역</span>
                      <p className="text-[#111]">{regionNameMap[reg.region] || reg.region}</p>
                    </div>
                    <div>
                      <span className="text-[#999]">접수 유형</span>
                      <p className="text-[#111]">{reg.registration_type === 'group' ? '단체' : '개인'}</p>
                    </div>
                    <div>
                      <span className="text-[#999]">참가비</span>
                      <p className="text-[#111]">{reg.payment_amount?.toLocaleString()}원</p>
                    </div>
                    <div>
                      <span className="text-[#999]">신청일</span>
                      <p className="text-[#111]">
                        {new Date(reg.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
