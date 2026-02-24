'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations, updateMockPaymentStatus, softDeleteMockRegistrations, restoreMockRegistrations, permanentDeleteMockRegistrations, getMockExamLocations, setMockExamLocations } from '@/lib/mockdata';
import type { ExamLocation } from '@/lib/mockdata';
import { regionNameMap, regionShortMap, REGIONS } from '@/lib/regions';
import { computeExamNumbers } from '@/lib/examNumber';
import { downloadExamTicketPDF } from '@/lib/examTicket';
import type { ExamLocationInfo } from '@/lib/examTicket';
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
  birthdate: string | null;
  photo_url: string | null;
  class_name?: string | null;
}

type Tab = 'all' | 'pending' | 'confirmed' | 'trash';
type SortKey = 'type' | 'date';
type SortDir = 'asc' | 'desc' | 'default';

const SCHOOL_SPECIAL: Record<string, string> = {
  '용인한국외국어대학교부설고등학교': '외대부고',
  '이화여자대학교사범대학부속이화금란고등학교': '이대부고',
  '이화여자외국어고등학교': '이화외고',
};

function shortenSchool(name: string): string {
  if (SCHOOL_SPECIAL[name]) return SCHOOL_SPECIAL[name];
  const sabu = name.match(/(?:국립)?(.+?)대학교사범대학부[설속].*고등학교/);
  if (sabu) return `${sabu[1]}사대부고`;
  if (name.includes('외국어')) return name.replace('외국어', '외').replace(/등학교$/, '');
  if (name.endsWith('여자고등학교')) return name.replace('여자고등학교', '여고');
  return name.replace(/등학교$/, '');
}

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
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [deleteMode, setDeleteMode] = useState<'trash' | 'permanent'>('trash');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [examLocations, setExamLocations] = useState<Record<string, ExamLocationInfo>>({});
  const [locationDraft, setLocationDraft] = useState<Record<string, ExamLocationInfo>>({});

  useEffect(() => {
    loadData();
    loadExamLocations();
  }, []);

  async function loadData() {
    try {
      if (isSupabaseConfigured) {
        const { data: registrations, error } = await supabase
          .from('registrations')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && registrations) {
          setData(registrations);
        }
      } else {
        const mock = getMockRegistrations().sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        setData(mock as Registration[]);
      }
    } catch {
      // 에러 시 기존 데이터 유지
    }
    setLoading(false);
  }

  async function loadExamLocations() {
    if (isSupabaseConfigured) {
      const { data: locations } = await supabase
        .from('exam_locations')
        .select('region, school_name, address');
      if (locations) {
        const map: Record<string, ExamLocationInfo> = {};
        for (const loc of locations) {
          map[loc.region] = { school_name: loc.school_name || '', address: loc.address || '' };
        }
        setExamLocations(map);
      }
    } else {
      setExamLocations(getMockExamLocations());
    }
  }

  async function saveExamLocations() {
    if (isSupabaseConfigured) {
      for (const [region, loc] of Object.entries(locationDraft)) {
        await supabase
          .from('exam_locations')
          .upsert({ region, school_name: loc.school_name, address: loc.address }, { onConflict: 'region' });
      }
    } else {
      setMockExamLocations(locationDraft as Record<string, ExamLocation>);
    }
    const copy: Record<string, ExamLocationInfo> = {};
    for (const [k, v] of Object.entries(locationDraft)) {
      copy[k] = { ...v };
    }
    setExamLocations(copy);
    setShowLocationModal(false);
  }

  function openLocationModal() {
    const copy: Record<string, ExamLocationInfo> = {};
    for (const [k, v] of Object.entries(examLocations)) {
      copy[k] = { ...v };
    }
    setLocationDraft(copy);
    setShowLocationModal(true);
  }

  // 한글 지역명 → 영문명 역매핑 (CSV 파싱용)
  const korToEngMap: Record<string, string> = {};
  for (const region of REGIONS) {
    const short = regionShortMap[region.nameEn] || region.nameKo;
    korToEngMap[short] = region.nameEn;
    korToEngMap[region.nameKo] = region.nameEn;
  }

  function downloadCsvTemplate() {
    const bom = '\uFEFF';
    const header = '지역,학교명,주소';
    const rows = REGIONS.map(r => `${regionShortMap[r.nameEn] || r.nameKo},,`);
    const csv = bom + header + '\n' + rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '시험장소_양식.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      if (!text) return;
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      // 헤더 건너뛰기
      const dataLines = lines.slice(1);
      const draft = { ...locationDraft };
      for (const line of dataLines) {
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 3) continue;
        const [regionKo, schoolName, address] = cols;
        const regionEn = korToEngMap[regionKo];
        if (!regionEn) continue;
        draft[regionEn] = { school_name: schoolName, address };
      }
      setLocationDraft(draft);
    };
    reader.readAsText(file, 'UTF-8');
    // input 초기화
    e.target.value = '';
  }

  // 수험번호 계산 (전체 데이터 기준 - 삭제된 항목 포함)
  const examNumbers = useMemo(() => computeExamNumbers(data), [data]);

  function requestDelete(ids: string[], mode: 'trash' | 'permanent' = 'trash') {
    setDeleteTargetIds(ids);
    setDeleteMode(mode);
    setPasswordInput('');
    setPasswordError('');
    setShowPasswordModal(true);
  }

  async function executeDelete() {
    if (passwordInput !== 'admin0220') {
      setPasswordError('비밀번호가 올바르지 않습니다.');
      return;
    }
    setShowPasswordModal(false);

    const idsToDelete = [...deleteTargetIds];

    if (deleteMode === 'trash') {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('registrations')
          .update({ payment_status: 'deleted' })
          .in('id', idsToDelete);
        if (error) { alert('삭제에 실패했습니다: ' + error.message); return; }
      } else {
        softDeleteMockRegistrations(idsToDelete);
      }
      setData(prev => prev.map(r =>
        idsToDelete.includes(r.id) ? { ...r, payment_status: 'deleted' } : r
      ));
    } else {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('registrations')
          .delete()
          .in('id', idsToDelete);
        if (error) { alert('삭제에 실패했습니다: ' + error.message); return; }
      } else {
        permanentDeleteMockRegistrations(idsToDelete);
      }
      setData(prev => prev.filter(r => !idsToDelete.includes(r.id)));
    }
    setSelected(new Set());
    setDeleteTargetIds([]);
  }

  async function restoreFromTrash(ids: string[]) {
    const idsToRestore = [...ids];
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('registrations')
        .update({ payment_status: 'pending' })
        .in('id', idsToRestore);
      if (error) return;
    } else {
      restoreMockRegistrations(idsToRestore);
    }
    setData(prev => prev.map(r =>
      idsToRestore.includes(r.id) ? { ...r, payment_status: 'pending' } : r
    ));
    setSelected(new Set());
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

  const activeData = data.filter(r => r.payment_status !== 'deleted');
  const trashed = data.filter(r => r.payment_status === 'deleted');
  const pending = activeData.filter(r => r.payment_status === 'pending');
  const confirmed = activeData.filter(r => r.payment_status === 'confirmed');

  const filtered = useMemo(() => {
    const base = tab === 'trash' ? trashed : tab === 'all' ? activeData : tab === 'pending' ? pending : confirmed;

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
  }, [tab, data, activeData, trashed, search, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const showCheckbox = tab === 'pending' || tab === 'confirmed';
  const isTrashTab = tab === 'trash';

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

  const allPageSelected = paged.length > 0 && paged.every(r => selected.has(r.id));
  const allFilteredSelected = filtered.length > 0 && filtered.every(r => selected.has(r.id));

  const selectAllFiltered = () => {
    setSelected(new Set(filtered.map(r => r.id)));
  };

  const clearSelection = () => {
    setSelected(new Set());
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

  async function handleDownloadPDF(targets?: Registration[]) {
    const list = targets || data;
    if (list.length === 0) return;
    await downloadExamTicketPDF({
      registrations: list,
      examNumbers,
      examLocations,
    });
  }

  if (loading) return <div className="text-center py-20 text-[#999]">로딩 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-6 flex-wrap">
        <button
          onClick={openLocationModal}
          className="px-3 py-1.5 text-xs sm:text-sm text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg"
        >
          시험장소 설정
        </button>
        {selected.size > 0 && !isTrashTab && (
          <button
            onClick={() => {
              const targets = data.filter(r => selected.has(r.id));
              handleDownloadPDF(targets);
            }}
            className="px-3 py-1.5 text-xs sm:text-sm text-white bg-[#111] hover:bg-[#333] border border-[#111] rounded-lg"
          >
            수험표 PDF 선택 다운로드 ({selected.size}명)
          </button>
        )}
        <button
          onClick={() => handleDownloadPDF()}
          className="px-3 py-1.5 text-xs sm:text-sm text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg"
        >
          수험표 PDF 일괄 다운로드
        </button>
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
          <button
            onClick={() => changeTab('trash')}
            className={`px-3 sm:px-4 py-[10px] text-xs sm:text-sm font-medium whitespace-nowrap ${
              tab === 'trash' ? 'bg-[#c00] text-white' : 'bg-white text-[#999]'
            }`}
          >
            휴지통 ({trashed.length})
          </button>
        </div>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="이름, 학교, 지역 검색"
          className="flex-1 min-w-0 text-sm"
          autoComplete="off"
        />

        {showCheckbox && selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() =>
                tab === 'pending'
                  ? bulkConfirm(Array.from(selected))
                  : bulkRevert(Array.from(selected))
              }
              className="btn btn-primary text-xs sm:text-sm px-4 py-1.5"
            >
              {tab === 'pending'
                ? `선택 입금 확인 (${selected.size}명)`
                : `선택 입금 취소 (${selected.size}명)`}
            </button>
            <button
              onClick={() => requestDelete(Array.from(selected))}
              className="text-xs sm:text-sm px-4 py-1.5 text-white bg-[#c00] hover:bg-[#a00] rounded-md"
            >
              선택 삭제 ({selected.size}명)
            </button>
          </div>
        )}
        {tab === 'all' && selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => requestDelete(Array.from(selected))}
              className="text-xs sm:text-sm px-4 py-1.5 text-white bg-[#c00] hover:bg-[#a00] rounded-md"
            >
              선택 삭제 ({selected.size}명)
            </button>
          </div>
        )}
        {isTrashTab && selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => restoreFromTrash(Array.from(selected))}
              className="text-xs sm:text-sm px-4 py-1.5 text-white bg-[#111] hover:bg-[#333] rounded-md"
            >
              선택 복원 ({selected.size}명)
            </button>
            <button
              onClick={() => requestDelete(Array.from(selected), 'permanent')}
              className="text-xs sm:text-sm px-4 py-1.5 text-white bg-[#c00] hover:bg-[#a00] rounded-md"
            >
              영구 삭제 ({selected.size}명)
            </button>
          </div>
        )}
      </div>

      {/* 전체 선택 안내 배너 */}
      {allPageSelected && filtered.length > paged.length && (
        <div className="bg-[#f8f8f8] border border-[#e5e5e5] rounded-lg px-4 py-2.5 mb-3 text-sm text-center">
          {allFilteredSelected ? (
            <span className="text-[#333]">
              필터된 전체 <strong>{filtered.length}명</strong>이 선택되었습니다.{' '}
              <button onClick={clearSelection} className="text-[#c00] hover:underline font-medium ml-1">
                선택 해제
              </button>
            </span>
          ) : (
            <span className="text-[#333]">
              현재 페이지의 <strong>{paged.length}명</strong>이 선택되었습니다.{' '}
              <button onClick={selectAllFiltered} className="text-[#111] hover:underline font-bold ml-1">
                필터된 전체 {filtered.length}명 모두 선택
              </button>
            </span>
          )}
        </div>
      )}

      {/* 테이블 */}
      <div className="bg-white rounded-lg border border-[#e5e5e5] overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  checked={selected.size === paged.length && paged.length > 0}
                  onChange={toggleAll}
                  className="w-4 h-4"
                />
              </th>
              <th>수험번호</th>
              <th>이름</th>
              <th>학교</th>
              <th>지역</th>
              <th
                onClick={() => toggleSort('type')}
                className="cursor-pointer select-none hover:text-[#111]"
              >
                유형{sortIndicator('type')}
              </th>
              {(tab === 'all' || isTrashTab) && <th>입금</th>}
              <th className="hidden sm:table-cell">금액</th>
              <th
                onClick={() => toggleSort('date')}
                className="cursor-pointer select-none hover:text-[#111]"
              >
                신청일{sortIndicator('date')}
              </th>
              {!isTrashTab && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map(r => (
              <tr key={r.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.has(r.id)}
                    onChange={() => toggleSelect(r.id)}
                    className="w-4 h-4"
                  />
                </td>
                <td className="text-xs text-[#666] font-mono whitespace-nowrap">{examNumbers.get(r.id) || '-'}</td>
                <td className="font-medium text-[#111] whitespace-nowrap">{r.name}</td>
                <td>
                  <span className="sm:hidden">{shortenSchool(r.school)}</span>
                  <span className="hidden sm:inline">{r.school}</span>
                </td>
                <td>
                  <span className="sm:hidden">{regionShortMap[r.region] || r.region}</span>
                  <span className="hidden sm:inline">{regionNameMap[r.region] || r.region}</span>
                </td>
                <td>{r.registration_type === 'group' ? '단체' : '개인'}</td>
                {(tab === 'all' || isTrashTab) && (
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
                {!isTrashTab && (
                  <td>
                    <div className="flex items-center gap-4">
                      {showCheckbox && (
                        <>
                          {r.payment_status === 'pending' ? (
                            <button
                              onClick={() => confirmPayment(r.id)}
                              className="px-3 py-1 text-xs font-medium text-white bg-[#111] hover:bg-[#333] rounded"
                            >
                              입금 확인
                            </button>
                          ) : (
                            <button
                              onClick={() => revertPayment(r.id)}
                              className="px-3 py-1 text-xs font-medium text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#ddd] rounded"
                            >
                              취소
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => requestDelete([r.id])}
                        className="px-3 py-1 text-xs font-medium text-[#c00] bg-white hover:bg-[#fff0f0] border border-[#e5c5c5] rounded"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center py-8 text-[#999]">
                  {search ? '검색 결과가 없습니다.' : isTrashTab ? '휴지통이 비어 있습니다.' : '데이터가 없습니다.'}
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

      {/* 비밀번호 확인 모달 */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[360px] shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-[#111]">
              {deleteMode === 'permanent' ? '영구 삭제 확인' : '삭제 확인'}
            </h3>
            <p className="text-sm text-[#666] mb-4">
              {deleteMode === 'permanent'
                ? `${deleteTargetIds.length}건을 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
                : `${deleteTargetIds.length}건을 휴지통으로 이동합니다.`}
              <br />관리자 비밀번호를 입력해주세요.
            </p>
            <input
              type="password"
              value={passwordInput}
              onChange={e => { setPasswordInput(e.target.value); setPasswordError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') executeDelete(); }}
              placeholder="비밀번호"
              className="w-full mb-2"
              autoFocus
              autoComplete="new-password"
            />
            {passwordError && (
              <p className="text-xs text-[#c00] mb-2">{passwordError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowPasswordModal(false)}
                className="px-4 py-2 text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-md hover:bg-[#f5f5f5]"
              >
                취소
              </button>
              <button
                onClick={executeDelete}
                className="px-4 py-2 text-sm text-white bg-[#c00] rounded-md hover:bg-[#a00]"
              >
                {deleteMode === 'permanent' ? '영구 삭제' : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 시험장소 설정 모달 */}
      {showLocationModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[700px] max-h-[85vh] shadow-xl flex flex-col">
            <h3 className="text-lg font-bold mb-2 text-[#111]">시험장소 설정</h3>
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={downloadCsvTemplate}
                className="px-3 py-1.5 text-xs text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#e5e5e5] rounded-md"
              >
                CSV 양식 다운로드
              </button>
              <label className="px-3 py-1.5 text-xs text-white bg-[#111] hover:bg-[#333] rounded-md cursor-pointer">
                CSV 업로드
                <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
              </label>
            </div>
            {/* 헤더 */}
            <div className="flex items-center gap-2 px-1 pb-2 border-b border-[#e5e5e5] text-xs font-semibold text-[#999]">
              <span className="w-16 shrink-0">지역</span>
              <span className="flex-1">학교명</span>
              <span className="flex-1">주소</span>
            </div>
            <div className="overflow-y-auto flex-1 space-y-2 pr-2 mt-2">
              {REGIONS.map(region => {
                const loc = locationDraft[region.nameEn] || { school_name: '', address: '' };
                return (
                  <div key={region.nameEn} className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#333] w-16 shrink-0">
                      {regionShortMap[region.nameEn] || region.nameKo}
                    </span>
                    <input
                      type="text"
                      value={loc.school_name}
                      onChange={e => setLocationDraft(prev => ({
                        ...prev,
                        [region.nameEn]: { ...prev[region.nameEn] || { school_name: '', address: '' }, school_name: e.target.value }
                      }))}
                      placeholder="학교명"
                      className="flex-1 text-sm"
                    />
                    <input
                      type="text"
                      value={loc.address}
                      onChange={e => setLocationDraft(prev => ({
                        ...prev,
                        [region.nameEn]: { ...prev[region.nameEn] || { school_name: '', address: '' }, address: e.target.value }
                      }))}
                      placeholder="주소"
                      className="flex-1 text-sm"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-[#e5e5e5]">
              <button
                onClick={() => setShowLocationModal(false)}
                className="px-4 py-2 text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-md hover:bg-[#f5f5f5]"
              >
                취소
              </button>
              <button
                onClick={saveExamLocations}
                className="px-4 py-2 text-sm text-white bg-[#111] rounded-md hover:bg-[#333]"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
