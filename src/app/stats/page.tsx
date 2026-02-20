'use client';

import { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations } from '@/lib/mockdata';
import { REGIONS, regionNameMap, regionStudentsMap } from '@/lib/regions';
import dynamic from 'next/dynamic';

const RegionMap = dynamic(() => import('@/components/RegionMap'), { ssr: false });

interface RegionStat {
  name: string;
  nameKo: string;
  count: number;
  students: number;
  rate: number;
}

export default function StatsPage() {
  const [regionStats, setRegionStats] = useState<RegionStat[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

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
        const { data } = await supabase.from('registrations').select('region');
        regions = data || [];
      } else {
        regions = getMockRegistrations().map(r => ({ region: r.region }));
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

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl font-bold mb-2 text-[#111]">지역별 신청 현황</h1>
        <p className="text-[#666]">
          전국 17개 광역자치단체별 신청자 수 및 고등학생 대비 신청률
        </p>
        <p className="text-3xl font-bold mt-4 text-[#111]">
          총 <span className="text-4xl">{total}</span>명 신청
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
            <RegionMap data={mapData} />
          </div>

          <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>순위</th>
                  <th>지역</th>
                  <th>신청자 수</th>
                  <th>고등학생 수</th>
                  <th>만명당 신청률</th>
                  <th>비율</th>
                </tr>
              </thead>
              <tbody>
                {regionStats.map((r, i) => (
                  <tr key={r.name}>
                    <td className="text-[#999]">{i + 1}</td>
                    <td className="font-medium text-[#111]">{r.nameKo}</td>
                    <td className="font-semibold">{r.count}명</td>
                    <td className="text-[#999]">{r.students.toLocaleString()}명</td>
                    <td>{r.rate}명</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
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
        </>
      )}
    </div>
  );
}
