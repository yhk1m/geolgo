'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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

const RECENT_PAGE_SIZE = 15;

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentPage, setRecentPage] = useState(1);

  useEffect(() => {
    loadStats();

    if (isSupabaseConfigured) {
      const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2분

      const interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          loadStats();
        }
      }, POLL_INTERVAL_MS);

      const onVisible = () => {
        if (document.visibilityState === 'visible') loadStats();
      };
      document.addEventListener('visibilitychange', onVisible);

      return () => {
        clearInterval(interval);
        document.removeEventListener('visibilitychange', onVisible);
      };
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
          .neq('payment_status', 'cancelled')
          .order('created_at', { ascending: false });
        all = data || [];
      } else {
        all = getMockRegistrations()
          .filter(r => r.payment_status !== 'deleted' && r.payment_status !== 'cancelled')
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

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recent = all.filter(r => new Date(r.created_at).getTime() >= oneDayAgo);

      setStats({
        total: all.length,
        confirmed: confirmed.length,
        pending: pending.length,
        individual: all.filter(r => r.registration_type === 'individual').length,
        group: all.filter(r => r.registration_type === 'group').length,
        totalAmount: all.reduce((sum, r) => sum + (r.payment_amount || 0), 0),
        confirmedAmount: confirmed.reduce((sum, r) => sum + (r.payment_amount || 0), 0),
        byRegion,
        recent,
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
        {/* 왼쪽: 총 신청자 + 개인/단체 */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2 sm:px-2.5 py-3 rounded-lg bg-[#111] text-white border border-[#111]">
            <span className="text-xs text-[#888]">총 신청자</span>
            <span className="text-lg sm:text-xl font-bold">{stats.total}<span className="text-sm font-normal ml-1">명</span></span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between px-2 sm:px-2.5 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-xs text-[#999]">개인</span>
              <span className="text-lg sm:text-xl font-bold text-[#111]">{stats.individual}<span className="text-sm font-normal ml-1">명</span></span>
            </div>
            <div className="flex items-center justify-between px-2 sm:px-2.5 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-xs text-[#999]">단체</span>
              <span className="text-lg sm:text-xl font-bold text-[#111]">{stats.group}<span className="text-sm font-normal ml-1">명</span></span>
            </div>
          </div>
        </div>
        {/* 오른쪽: 확인된 금액/미확인 + 입금 확인/대기 */}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between px-2 sm:px-2.5 py-3 rounded-lg bg-[#111] text-white border border-[#111]">
              <span className="text-xs text-[#888]">확인</span>
              <span className="text-lg sm:text-xl font-bold">{stats.confirmedAmount.toLocaleString()}<span className="text-sm font-normal ml-1">원</span></span>
            </div>
            <div className="flex items-center justify-between px-2 sm:px-2.5 py-3 rounded-lg bg-[#111] text-white border border-[#111]">
              <span className="text-xs text-[#888]">미확인</span>
              <span className="text-lg sm:text-xl font-bold">{(stats.totalAmount - stats.confirmedAmount).toLocaleString()}<span className="text-sm font-normal ml-1">원</span></span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center justify-between px-2 sm:px-2.5 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-xs text-[#999]">입금 확인</span>
              <span className="text-lg sm:text-xl font-bold text-[#111]">{stats.confirmed}<span className="text-sm font-normal ml-1">명</span></span>
            </div>
            <div className="flex items-center justify-between px-2 sm:px-2.5 py-3 rounded-lg border border-[#e5e5e5] bg-white">
              <span className="text-xs text-[#999]">입금 대기</span>
              <span className="text-lg sm:text-xl font-bold text-[#111]">{stats.pending}<span className="text-sm font-normal ml-1">명</span></span>
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
              <Link
                key={i}
                href={`/admin/regions/${r.region}`}
                className={`group flex items-center justify-between text-sm px-3 py-1.5 rounded transition-colors ${i % 2 === 1 ? 'bg-[#f7f7f7]' : ''} hover:bg-[#eef]`}
              >
                <span className="text-[#111] group-hover:underline">{regionNameMap[r.region] || r.region}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#111] rounded-full"
                      style={{ width: `${(r.count / stats.total) * 100}%` }}
                    />
                  </div>
                  <span className="text-[#666] w-8 text-right">{r.count}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {(() => {
          const totalRecent = stats.recent.length;
          const totalPages = Math.max(1, Math.ceil(totalRecent / RECENT_PAGE_SIZE));
          const safePage = Math.min(recentPage, totalPages);
          const startIdx = (safePage - 1) * RECENT_PAGE_SIZE;
          const pageItems = stats.recent.slice(startIdx, startIdx + RECENT_PAGE_SIZE);
          return (
            <div className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider">
                  최근 신청 (24시간 이내 {totalRecent}명)
                </h2>
                {totalRecent > RECENT_PAGE_SIZE && (
                  <span className="text-xs text-[#999]">{safePage} / {totalPages}</span>
                )}
              </div>
              <div>
                {pageItems.map((r, i) => (
                  <div key={startIdx + i} className={`flex items-center justify-between text-sm px-3 py-[7px] rounded ${i % 2 === 1 ? 'bg-[#f7f7f7]' : ''}`}>
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
                {totalRecent === 0 && (
                  <p className="text-[#999] text-sm text-center py-4">신청 내역이 없습니다.</p>
                )}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-4 pt-3 border-t border-[#f0f0f0]">
                  <button
                    type="button"
                    onClick={() => setRecentPage(Math.max(1, safePage - 1))}
                    disabled={safePage === 1}
                    className="px-3 py-1 text-xs rounded border border-[#e5e5e5] text-[#666] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <span className="text-xs text-[#666] tabular-nums">{safePage} / {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setRecentPage(Math.min(totalPages, safePage + 1))}
                    disabled={safePage === totalPages}
                    className="px-3 py-1 text-xs rounded border border-[#e5e5e5] text-[#666] hover:bg-[#fafafa] disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
