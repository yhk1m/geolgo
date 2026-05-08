// © 2026 김용현
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations } from '@/lib/mockdata';
import { REGIONS, regionShortMap } from '@/lib/regions';

export default function RegionsPage() {
  const [counts, setCounts] = useState<Record<string, { total: number; pending: number; confirmed: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      let rows: { region: string; payment_status: string }[] = [];
      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('registrations')
          .select('region, payment_status');
        if (data) rows = data;
      } else {
        rows = getMockRegistrations().map(r => ({ region: r.region, payment_status: r.payment_status }));
      }
      const map: Record<string, { total: number; pending: number; confirmed: number }> = {};
      for (const r of rows) {
        if (r.payment_status === 'deleted' || r.payment_status === 'cancelled') continue;
        if (!map[r.region]) map[r.region] = { total: 0, pending: 0, confirmed: 0 };
        map[r.region].total += 1;
        if (r.payment_status === 'confirmed') map[r.region].confirmed += 1;
        else if (r.payment_status === 'pending') map[r.region].pending += 1;
      }
      setCounts(map);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="text-center py-20 text-[#999]">로딩 중...</div>;

  const totalAll = Object.values(counts).reduce((s, c) => s + c.total, 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[#111] mb-1">지역별 대시보드</h1>
        <p className="text-sm text-[#999]">광역자치단체를 선택하면 해당 지역 참가자만 조회할 수 있습니다. (총 {totalAll}명)</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {REGIONS.map(r => {
          const c = counts[r.nameEn] || { total: 0, pending: 0, confirmed: 0 };
          return (
            <Link
              key={r.nameEn}
              href={`/admin/regions/${r.nameEn}`}
              className="group p-4 rounded-lg border border-[#e5e5e5] bg-white hover:border-[#111] hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-[#111] group-hover:text-[#000]">
                  {r.nameKo}
                </span>
                <span className="text-[10px] text-[#999] bg-[#f5f5f5] px-1.5 py-0.5 rounded">
                  {regionShortMap[r.nameEn]}
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-[#111]">{c.total}</span>
                <span className="text-xs text-[#999]">명</span>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[11px]">
                <span className="text-[#666]">확인 <strong className="text-[#111]">{c.confirmed}</strong></span>
                <span className="text-[#ccc]">|</span>
                <span className="text-[#666]">대기 <strong className="text-[#111]">{c.pending}</strong></span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
