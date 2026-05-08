'use client';

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations } from '@/lib/mockdata';
import { REGIONS, regionNameMap, regionShortMap, regionStudentsMap } from '@/lib/regions';
import dynamic from 'next/dynamic';

const RegionMap = dynamic(() => import('@/components/RegionMap'), { ssr: false });

interface RegionStat {
  name: string;
  nameKo: string;
  count: number;
  students: number;
  rate: number;
}

type SortKey = 'count' | 'students' | 'rate' | 'ratio';
type SortDir = 'asc' | 'desc' | null;

export default function StatsPage() {
  const [regionStats, setRegionStats] = useState<RegionStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortKey(null);
      setSortDir(null);
    }
  };

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ' ↕';
    if (sortDir === 'asc') return ' ↑';
    return ' ↓';
  };

  useEffect(() => {
    loadStats();

    if (isSupabaseConfigured) {
      const channel = supabase
        .channel('stats_changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'registrations' }, () => {
          loadStats();
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, []);

  async function loadStats() {
    try {
      let regions: { region: string }[];

      if (isSupabaseConfigured) {
        const { data } = await supabase
          .from('registrations')
          .select('region')
          .neq('payment_status', 'deleted')
          .neq('payment_status', 'cancelled');
        regions = data || [];
      } else {
        regions = getMockRegistrations()
          .filter(r => r.payment_status !== 'deleted' && r.payment_status !== 'cancelled')
          .map(r => ({ region: r.region }));
      }

      setTotal(regions.length);

      const counts: Record<string, number> = {};
      regions.forEach(r => {
        counts[r.region] = (counts[r.region] || 0) + 1;
      });

      const stats = REGIONS.map(r => ({
        name: r.nameEn,
        nameKo: r.nameKo,
        count: counts[r.nameEn] || 0,
        students: r.students,
        rate: parseFloat((((counts[r.nameEn] || 0) / r.students) * 10000).toFixed(2)),
      }));

      setRegionStats(stats.sort((a, b) => b.count - a.count));
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  const mapData = regionStats.map(r => ({ name: r.name, value: r.count }));

  const sortedStats = (() => {
    if (!sortKey || !sortDir) return regionStats;
    const sorted = [...regionStats].sort((a, b) => {
      let aVal: number, bVal: number;
      if (sortKey === 'ratio') {
        aVal = total > 0 ? a.count / total : 0;
        bVal = total > 0 ? b.count / total : 0;
      } else {
        aVal = a[sortKey];
        bVal = b[sortKey];
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  })();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      <div className="text-center mb-8 sm:mb-12">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2 text-[#111]">지역별 신청 현황</h1>
        <p className="text-sm sm:text-base text-[#666]">
          전국 17개 광역자치단체별 신청자 수 및 고등학생 대비 신청률
        </p>
        <p className="text-2xl sm:text-3xl font-bold mt-4 text-[#111]">
          총 <span className="text-3xl sm:text-4xl">{total}</span>명 신청
        </p>
        {!isSupabaseConfigured && (
          <p className="text-xs text-[#999] mt-2 bg-[#f5f5f5] inline-block px-3 py-1 rounded">
            Mock 데이터 표시 중
          </p>
        )}
      </div>

      {loading ? (
        <div className="text-center py-20 text-[#999]">데이터 로딩 중...</div>
      ) : (
        <>
          <div className="mb-12 p-6 bg-white rounded-lg border border-[#e5e5e5]">
            <RegionMap data={mapData} onRegionClick={setSelectedRegion} />
          </div>

          <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-x-auto">
            <table>
              <thead>
                <tr className="bg-[#111] text-white">
                  <th>순위</th>
                  <th>지역</th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('count')}>
                    <span className="sm:hidden">신청{sortIndicator('count')}</span>
                    <span className="hidden sm:inline">신청자 수{sortIndicator('count')}</span>
                  </th>
                  <th className="cursor-pointer select-none hidden sm:table-cell" onClick={() => toggleSort('students')}>
                    전체 고등학생 수*{sortIndicator('students')}
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('rate')}>
                    <span className="sm:hidden">만명당{sortIndicator('rate')}</span>
                    <span className="hidden sm:inline">만명당 신청자 수{sortIndicator('rate')}</span>
                  </th>
                  <th className="cursor-pointer select-none" onClick={() => toggleSort('ratio')}>
                    비율{sortIndicator('ratio')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedStats.map((r, i) => (
                  <tr key={r.name} className={selectedRegion === r.name ? 'bg-yellow-100' : ''}>
                    <td className="text-[#999]">{i + 1}</td>
                    <td className="font-medium text-[#111] whitespace-nowrap">
                      <span className="sm:hidden">{regionShortMap[r.name] || r.nameKo}</span>
                      <span className="hidden sm:inline">{r.nameKo}</span>
                    </td>
                    <td className="font-semibold">{r.count}명</td>
                    <td className="text-[#999] hidden sm:table-cell">{r.students.toLocaleString()}명</td>
                    <td>{r.rate}명</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-[#f0f0f0] rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-[#111] rounded-full"
                            style={{
                              width: `${total > 0 ? (r.count / total) * 100 : 0}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs text-[#999]">
                          {total > 0 ? ((r.count / total) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-[#999] mt-3">
            * 기준 : 광역자치단체별 만 15~17세 인구(2025.04.01.)  |  출처 : 교육통계서비스 KESS
          </p>
        </>
      )}
    </div>
  );
}
