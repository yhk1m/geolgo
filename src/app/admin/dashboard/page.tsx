'use client';

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations } from '@/lib/mockdata';
import { regionNameMap } from '@/lib/regions';

interface Stats {
  total: number;
  confirmed: number;
  pending: number;
  individual: number;
  group: number;
  totalAmount: number;
  confirmedAmount: number;
  byRegion: { region: string; count: number }[];
  recent: { name: string; school: string; created_at: string; payment_status: string }[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('registrations_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
          loadStats();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, []);

  async function loadStats() {
    try {
      let all: { region: string; payment_status: string; registration_type: string; payment_amount: number; name: string; school: string; created_at: string }[];

      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('registrations')
          .select('*')
          .neq('payment_status', 'deleted')
          .order('created_at', { ascending: false });
        all = data || [];
      } else {
        all = getMockRegistrations()
          .filter(r => r.payment_status !== 'deleted')
          .sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          );
      }

      const confirmed = all.filter(r => r.payment_status === 'confirmed');
      const pending = all.filter(r => r.payment_status === 'pending');

      const regionCounts: Record<string, number> = {};
      all.forEach(r => {
        regionCounts[r.region] = (regionCounts[r.region] || 0) + 1;
      });
      const byRegion = Object.entries(regionCounts)
        .map(([region, count]) => ({ region, count }))
        .sort((a, b) => b.count - a.count);

      setStats({
        total: all.length,
        confirmed: confirmed.length,
        pending: pending.length,
        individual: all.filter(r => r.registration_type === 'individual').length,
        group: all.filter(r => r.registration_type === 'group').length,
        totalAmount: all.reduce((sum, r) => sum + (r.payment_amount || 0), 0),
        confirmedAmount: confirmed.reduce((sum, r) => sum + (r.payment_amount || 0), 0),
        byRegion,
        recent: all.slice(0, 15),
      });
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div className="text-center py-20 text-[#999]">로딩 중...</div>;
  }

  if (!stats) {
    return <div className="text-center py-20 text-[#999]">데이터를 불러올 수 없습니다.</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        {/* 왼쪽: 총 신청자 + 입금 확인/대기 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 rounded-lg bg-[#111] text-white border border-[#111]">
            <span className="text-sm text-[#888]">총 신청자</span>
            <span className="text-xl sm:text-2xl font-bold">{stats.total}<span className="text-sm font-normal ml-1">명</span></span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-sm text-[#999]">입금 확인</span>
              <span className="text-xl sm:text-2xl font-bold text-[#111]">{stats.confirmed}<span className="text-sm font-normal ml-1">명</span></span>
            </div>
            <div className="flex items-center justify-between px-4 sm:px-5 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-sm text-[#999]">입금 대기</span>
              <span className="text-xl sm:text-2xl font-bold text-[#111]">{stats.pending}<span className="text-sm font-normal ml-1">명</span></span>
            </div>
          </div>
        </div>
        {/* 오른쪽: 확인된 금액 + 개인/단체/미확인 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-4 sm:px-5 py-3 rounded-lg bg-[#111] text-white border border-[#111]">
            <span className="text-sm text-[#888]">확인된 금액</span>
            <span className="text-xl sm:text-2xl font-bold">{stats.confirmedAmount.toLocaleString()}<span className="text-sm font-normal ml-1">원</span></span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-sm text-[#999]">개인</span>
              <span className="text-xl sm:text-2xl font-bold text-[#111]">{stats.individual}<span className="text-sm font-normal ml-1">명</span></span>
            </div>
            <div className="flex items-center justify-between px-3 sm:px-4 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-sm text-[#999]">단체</span>
              <span className="text-xl sm:text-2xl font-bold text-[#111]">{stats.group}<span className="text-sm font-normal ml-1">명</span></span>
            </div>
            <div className="col-span-2 flex items-center justify-between px-3 sm:px-4 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-sm text-[#999]">미확인</span>
              <span className="text-xl sm:text-2xl font-bold text-[#111]">{(stats.totalAmount - stats.confirmedAmount).toLocaleString()}<span className="text-sm font-normal ml-1">원</span></span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">
            지역별 신청 현황
          </h2>
          <div>
            {stats.byRegion.map((r, i) => (
              <div key={i} className={`flex items-center justify-between text-sm px-3 py-1.5 rounded ${i % 2 === 1 ? 'bg-[#f7f7f7]' : ''}`}>
                <span className="text-[#111]">{regionNameMap[r.region] || r.region}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#111] rounded-full"
                      style={{ width: `${(r.count / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[#666] w-8 text-right">{r.count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">
            최근 신청 (최근 15명)
          </h2>
          <div>
            {stats.recent.map((r, i) => (
              <div key={i} className={`flex items-center justify-between text-sm px-3 py-[7px] rounded ${i % 2 === 1 ? 'bg-[#f7f7f7]' : ''}`}>
                <div className="min-w-0 flex-1">
                  <span className="text-[#111] font-medium">{r.name}</span>
                  <span className="text-[#999] ml-2 text-xs sm:text-sm">{r.school}</span>
                </div>
                <div className="flex items-center gap-2 sm:gap-6 shrink-0 ml-2">
                  <span className="text-[#999] text-xs hidden sm:inline">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
                  <span className={`badge ${
                    r.payment_status === 'confirmed' ? 'badge-confirmed' : 'badge-pending'
                  }`}>
                    {r.payment_status === 'confirmed' ? '확인' : '대기'}
                  </span>
                </div>
              </div>
            ))}
            {stats.recent.length === 0 && (
              <p className="text-[#999] text-sm text-center py-4">신청 내역이 없습니다.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
