'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations, updateMockPaymentStatus } from '@/lib/mockdata';
import { regionNameMap, regionShortMap } from '@/lib/regions';
import * as XLSX from 'xlsx';

interface Registration {
  id: string;
  name: string;
  school: string;
  grade: number;
  phone: string;
  email: string | null;
  region: string;
  registration_type: string;
  payment_status: string;
  payment_amount: number;
  created_at: string;
}

type Tab = 'all' | 'pending' | 'confirmed';
type SortKey = 'type' | 'date';
type SortDir = 'asc' | 'desc' | 'default';

export default function PaymentsPage() {
  const [data, setData] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('default');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    if (isSupabaseConfigured) {
      const { data: registrations } = await supabase
        .from('registrations')
        .select('*')
        .order('created_at', { ascending: false });
      setData(registrations || []);
    } else {
      const mock = getMockRegistrations().sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setData(mock);
    }
    setLoading(false);
  }

  async function confirmPayment(id: string) {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: 'confirmed' })
        .eq('id', id);
      if (error) return;
    } else {
      updateMockPaymentStatus([id], 'confirmed');
    }
    setData(prev => prev.map(r => r.id === id ? { ...r, payment_status: 'confirmed' } : r));
  }

  async function revertPayment(id: string) {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: 'pending' })
        .eq('id', id);
      if (error) return;
    } else {
      updateMockPaymentStatus([id], 'pending');
    }
    setData(prev => prev.map(r => r.id === id ? { ...r, payment_status: 'pending' } : r));
  }

  async function bulkConfirm(ids: string[]) {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: 'confirmed' })
        .in('id', ids);
      if (error) return;
    } else {
      updateMockPaymentStatus(ids, 'confirmed');
    }
    setData(prev => prev.map(r => ids.includes(r.id) ? { ...r, payment_status: 'confirmed' } : r));
    setSelected(new Set());
  }

  async function bulkRevert(ids: string[]) {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: 'pending' })
        .in('id', ids);
      if (error) return;
    } else {
      updateMockPaymentStatus(ids, 'pending');
    }
    setData(prev => prev.map(r => ids.includes(r.id) ? { ...r, payment_status: 'pending' } : r));
    setSelected(new Set());
  }

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else {
      const next: Record<SortDir, SortDir> = { default: 'asc', asc: 'desc', desc: 'default' };
      const nextDir = next[sortDir];
      setSortDir(nextDir);
      if (nextDir === 'default') setSortKey(null);
    }
    setPage(1);
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ' ↕';
    if (sortDir === 'asc') return ' ↑';
    if (sortDir === 'desc') return ' ↓';
    return ' ↕';
  }

  const pending = data.filter(r => r.payment_status === 'pending');
  const confirmed = data.filter(r => r.payment_status === 'confirmed');

  const filtered = useMemo(() => {
    const base = tab === 'all' ? data : tab === 'pending' ? pending : confirmed;

    let result = base;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.school.toLowerCase().includes(q) ||
        (regionNameMap[r.region] || r.region).toLowerCase().includes(q)
      );
    }

    if (sortKey && sortDir !== 'default') {
      result = [...result].sort((a, b) => {
        if (sortKey === 'type') {
          const cmp = a.registration_type.localeCompare(b.registration_type);
          return sortDir === 'asc' ? cmp : -cmp;
        }
        if (sortKey === 'date') {
          const cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          return sortDir === 'asc' ? cmp : -cmp;
        }
        return 0;
      });
    }

    return result;
  }, [tab, data, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const showCheckbox = tab !== 'all';

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === paged.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paged.map(r => r.id)));
    }
  };

  const changeTab = (t: Tab) => {
    setTab(t);
    setPage(1);
    setSelected(new Set());
  };

  function downloadExcel(target: 'all' | 'pending' | 'confirmed') {
    const base = target === 'all' ? data : target === 'pending' ? pending : confirmed;
    const label = target === 'all' ? '전체명단' : target === 'pending' ? '입금대기' : '입금확인';
    const rows = base.map(r => ({
      '이름': r.name,
      '학교': r.school,
      '학년': r.grade,
      '전화번호': r.phone,
      '이메일': r.email || '',
      '지역': regionNameMap[r.region] || r.region,
      '접수유형': r.registration_type === 'group' ? '단체' : '개인',
      '입금상태': r.payment_status === 'confirmed' ? '확인' : '대기',
      '참가비': r.payment_amount,
      '신청일': new Date(r.created_at).toLocaleDateString('ko-KR'),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, label);
    XLSX.writeFile(wb, `지리올림피아드_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  if (loading) return <div className="text-center py-20 text-[#999]">로딩 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-end mb-6">
        <div className="flex items-center border border-[#e5e5e5] rounded-lg overflow-hidden">
          <span className="px-3 py-1.5 text-sm font-medium text-[#999] bg-[#fafafa] hidden sm:inline">엑셀 다운로드</span>
          <button onClick={() => downloadExcel('all')} className="px-3 py-1.5 text-xs sm:text-sm text-[#666] bg-white hover:bg-[#f5f5f5] sm:border-l border-[#e5e5e5]">
            전체
          </button>
          <button onClick={() => downloadExcel('pending')} className="px-3 py-1.5 text-xs sm:text-sm text-[#666] bg-white hover:bg-[#f5f5f5] border-l border-[#e5e5e5]">
            대기
          </button>
          <button onClick={() => downloadExcel('confirmed')} className="px-3 py-1.5 text-xs sm:text-sm text-[#666] bg-white hover:bg-[#f5f5f5] border-l border-[#e5e5e5]">
            확인
          </button>
        </div>
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 rounded-lg border border-[#e5e5e5] bg-white">
          <span className="text-sm text-[#999]">대기 중</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-[#111]">{pending.length}명</span>
            <span className="text-xs text-[#999]">{(pending.length * 20000).toLocaleString()}원</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 rounded-lg border border-[#e5e5e5] bg-white">
          <span className="text-sm text-[#999]">입금 확인</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl sm:text-2xl font-bold text-[#111]">{confirmed.length}명</span>
            <span className="text-xs text-[#999]">{(confirmed.length * 20000).toLocaleString()}원</span>
          </div>
        </div>
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 rounded-lg border border-[#111] bg-[#111] text-white">
          <span className="text-sm text-[#888]">확인율</span>
          <span className="text-xl sm:text-2xl font-bold">
            {data.length > 0 ? Math.round((confirmed.length / data.length) * 100) : 0}%
          </span>
        </div>
      </div>

      {/* 탭 + 검색 + 일괄 버튼 */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
        <div className="flex items-center border border-[#e5e5e5] rounded-lg overflow-hidden shrink-0">
          <button
            onClick={() => changeTab('all')}
            className={`px-3 sm:px-4 py-[10px] text-xs sm:text-sm font-medium whitespace-nowrap ${
              tab === 'all' ? 'bg-[#111] text-white' : 'bg-white text-[#666]'
            }`}
          >
            전체 ({data.length})
          </button>
          <button
            onClick={() => changeTab('pending')}
            className={`px-3 sm:px-4 py-[10px] text-xs sm:text-sm font-medium whitespace-nowrap ${
              tab === 'pending' ? 'bg-[#111] text-white' : 'bg-white text-[#666]'
            }`}
          >
            대기 ({pending.length})
          </button>
          <button
            onClick={() => changeTab('confirmed')}
            className={`px-3 sm:px-4 py-[10px] text-xs sm:text-sm font-medium whitespace-nowrap ${
              tab === 'confirmed' ? 'bg-[#111] text-white' : 'bg-white text-[#666]'
            }`}
          >
            확인 ({confirmed.length})
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="이름, 학교, 지역 검색"
          className="flex-1 min-w-0 text-sm"
        />

        {showCheckbox && selected.size > 0 && (
          <button
            onClick={() =>
              tab === 'pending'
                ? bulkConfirm(Array.from(selected))
                : bulkRevert(Array.from(selected))
            }
            className="btn btn-primary text-xs sm:text-sm px-4 py-1.5 sm:ml-auto"
          >
            {tab === 'pending'
              ? `선택 입금 확인 (${selected.size}명)`
              : `선택 입금 취소 (${selected.size}명)`}
          </button>
        )}
      </div>

      {/* 테이블 */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-x-auto">
        <table>
          <thead>
            <tr>
              {showCheckbox && (
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === paged.length && paged.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4"
                  />
                </th>
              )}
              <th>이름</th>
              <th>학교</th>
              <th>지역</th>
              <th
                onClick={() => toggleSort('type')}
                className="cursor-pointer select-none hover:text-[#111]"
              >
                유형{sortIndicator('type')}
              </th>
              {tab === 'all' && <th>입금</th>}
              <th className="hidden sm:table-cell">금액</th>
              <th
                onClick={() => toggleSort('date')}
                className="cursor-pointer select-none hover:text-[#111]"
              >
                신청일{sortIndicator('date')}
              </th>
              {tab !== 'all' && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map(r => (
              <tr key={r.id}>
                {showCheckbox && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="w-4 h-4"
                    />
                  </td>
                )}
                <td className="font-medium text-[#111] whitespace-nowrap">{r.name}</td>
                <td>
                  <span className="sm:hidden">{r.school.replace(/등학교$/, '')}</span>
                  <span className="hidden sm:inline">{r.school}</span>
                </td>
                <td>
                  <span className="sm:hidden">{regionShortMap[r.region] || r.region}</span>
                  <span className="hidden sm:inline">{regionNameMap[r.region] || r.region}</span>
                </td>
                <td>{r.registration_type === 'group' ? '단체' : '개인'}</td>
                {tab === 'all' && (
                  <td>
                    <span className={`badge ${
                      r.payment_status === 'confirmed' ? 'badge-confirmed' : 'badge-pending'
                    }`}>
                      {r.payment_status === 'confirmed' ? '확인' : '대기'}
                    </span>
                  </td>
                )}
                <td className="hidden sm:table-cell">{r.payment_amount?.toLocaleString()}원</td>
                <td className="text-[#999] text-sm whitespace-nowrap">
                  <span className="sm:hidden">
                    {`${new Date(r.created_at).getMonth() + 1}.${new Date(r.created_at).getDate()}.`}
                  </span>
                  <span className="hidden sm:inline">
                    {new Date(r.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </td>
                {tab !== 'all' && (
                  <td>
                    {r.payment_status === 'pending' ? (
                      <button
                        onClick={() => confirmPayment(r.id)}
                        className="text-sm text-[#111] font-medium hover:underline"
                      >
                        입금 확인
                      </button>
                    ) : (
                      <button
                        onClick={() => revertPayment(r.id)}
                        className="text-sm text-[#999] hover:underline"
                      >
                        취소
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={showCheckbox ? 9 : 8} className="text-center py-8 text-[#999]">
                  {search ? '검색 결과가 없습니다.' : '데이터가 없습니다.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* 페이지네이션 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-[#999]">페이지당</span>
          {[10, 20, 50].map(size => (
            <button
              key={size}
              onClick={() => { setPageSize(size); setPage(1); }}
              className={`px-2.5 sm:px-3 py-1 rounded text-xs sm:text-sm ${
                pageSize === size
                  ? 'bg-[#111] text-white'
                  : 'bg-white text-[#666] border border-[#e5e5e5] hover:bg-[#f5f5f5]'
              }`}
            >
              {size}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="px-2.5 sm:px-3 py-1 rounded text-xs sm:text-sm border border-[#e5e5e5] bg-white text-[#666] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            이전
          </button>
          <span className="text-xs sm:text-sm text-[#666]">
            {safePage} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="px-2.5 sm:px-3 py-1 rounded text-xs sm:text-sm border border-[#e5e5e5] bg-white text-[#666] hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            다음
          </button>
        </div>
      </div>
    </div>
  );
}
