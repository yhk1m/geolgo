'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations, updateMockPaymentStatus, softDeleteMockRegistrations, restoreMockRegistrations, permanentDeleteMockRegistrations } from '@/lib/mockdata';
import { regionNameMap, regionShortMap } from '@/lib/regions';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { NOTO_SANS_KR_REGULAR } from '@/lib/pdfFont';

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
  // 사대부고: (국립)XX대학교사범대학부설/부속...고등학교 → XX사대부고
  const sabu = name.match(/(?:국립)?(.+?)대학교사범대학부[설속].*고등학교/);
  if (sabu) return `${sabu[1]}사대부고`;
  // 외국어고: XX외국어고등학교 → XX외고
  if (name.includes('외국어')) return name.replace('외국어', '외').replace(/등학교$/, '');
  // 여자고: XX여자고등학교 → XX여고
  if (name.endsWith('여자고등학교')) return name.replace('여자고등학교', '여고');
  // 기본: 등학교 제거
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

  useEffect(() => {
    loadData();
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

  async function downloadPDF(targets?: Registration[]) {
    const list = targets || data;
    if (list.length === 0) return;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.addFileToVFS('NotoSansKR-Regular.ttf', NOTO_SANS_KR_REGULAR);
    doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');

    const pw = 210;
    const mx = 20; // margin x
    const tw = pw - mx * 2; // table width

    // Helper: draw cell with border and text
    function cell(x: number, y: number, w: number, h: number, text: string, opts?: { fontSize?: number; bold?: boolean; align?: 'left' | 'center'; bg?: string }) {
      const fs = opts?.fontSize || 10;
      const align = opts?.align || 'left';
      if (opts?.bg) {
        doc.setFillColor(opts.bg);
        doc.rect(x, y, w, h, 'FD');
      } else {
        doc.rect(x, y, w, h);
      }
      doc.setFont('NotoSansKR', 'normal');
      doc.setFontSize(fs);
      doc.setTextColor(0);
      const tx = align === 'center' ? x + w / 2 : x + 3;
      doc.text(text, tx, y + h / 2 + fs * 0.12, { align, baseline: 'middle' });
    }

    for (let idx = 0; idx < list.length; idx++) {
      if (idx > 0) doc.addPage();
      const r = list[idx];

      doc.setDrawColor(0);
      doc.setLineWidth(0.3);

      // Title (굵게: stroke로 테두리 두껍게)
      let y = 20;
      const title = '제26회 전국지리올림피아드 참가 신청서';
      doc.setFont('NotoSansKR', 'normal');
      doc.setFontSize(18);
      doc.setTextColor(0);
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      (doc as unknown as Record<string, unknown>).setTextRenderingMode = undefined;
      doc.text(title, pw / 2, y, { align: 'center', renderingMode: 'fillThenStroke' });
      y += 10;

      // Main info table
      const photoW = 30;
      const photoH = 40;
      const labelW = 25;
      const rowH = 10;
      const infoX = mx + photoW;
      const infoW = tw - photoW;

      // Photo cell (spans 4 rows)
      doc.rect(mx, y, photoW, photoH);
      doc.setFontSize(7);
      doc.setTextColor(120);
      doc.text('사 진', mx + photoW / 2, y + 12, { align: 'center' });
      doc.text('*6개월 이내에 촬영한', mx + photoW / 2, y + 18, { align: 'center' });
      doc.text('탈모 상반신 사진', mx + photoW / 2, y + 23, { align: 'center' });
      doc.text('(3cm x 4cm)', mx + photoW / 2, y + 28, { align: 'center' });
      doc.setTextColor(0);

      if (r.photo_url) {
        try {
          const response = await fetch(r.photo_url);
          const blob = await response.blob();
          const base64 = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
          doc.addImage(base64, 'JPEG', mx + 2, y + 2, photoW - 4, photoH - 4);
        } catch {
          // photo load failed, keep placeholder text
        }
      }

      // Row 1: 학교 | (school) | 학년반 | (grade+class)
      const c1 = infoX;
      const lw = labelW;
      const leftValW = 50;
      const splitX = c1 + lw + leftValW;
      const rightValW = infoW - lw - leftValW - lw;

      const labelStyle = { bg: '#f5f5f5', fontSize: 9, align: 'center' as const };

      cell(c1, y, lw, rowH, '학교', labelStyle);
      cell(c1 + lw, y, leftValW, rowH, r.school);
      cell(splitX, y, lw, rowH, '학년반', labelStyle);
      cell(splitX + lw, y, rightValW, rowH, `${r.grade}학년 ${r.class_name || ''}반`);
      y += rowH;

      // Row 2: 성명 | (name) | 생년월일 | (birthdate)
      cell(c1, y, lw, rowH, '성명', labelStyle);
      cell(c1 + lw, y, leftValW, rowH, r.name);
      cell(splitX, y, lw, rowH, '생년월일', labelStyle);
      cell(splitX + lw, y, rightValW, rowH, r.birthdate || '');
      y += rowH;

      // Row 3: 연락처 | phone / email
      cell(c1, y, lw, rowH * 2, '연락처', labelStyle);
      cell(c1 + lw, y, infoW - lw, rowH, `전화 : ${r.phone}`);
      y += rowH;
      cell(c1 + lw, y, infoW - lw, rowH, `E-mail : ${r.email || ''}`);
      y += rowH;

      // Spacer
      y += 5;

      // 참가 신청 문구
      const stmtH = 40;
      doc.rect(mx, y, tw, stmtH);
      doc.setFont('NotoSansKR', 'normal');
      doc.setFontSize(10);
      doc.text('위 본인은 전국지리교사연합회가 주관하여 시행하는', pw / 2, y + 10, { align: 'center' });
      doc.text('<제26회 전국지리올림피아드> 참가를 신청합니다.', pw / 2, y + 18, { align: 'center' });
      doc.setFontSize(11);
      doc.text(`${new Date(r.created_at).getFullYear()}. ${new Date(r.created_at).getMonth() + 1}. ${new Date(r.created_at).getDate()}.`, pw / 2, y + 28, { align: 'center' });
      y += stmtH;

      // 신청인 서명란
      const signH = 15;
      doc.rect(mx, y, tw, signH);
      doc.setFontSize(10);
      doc.text(`신청인 : ${r.name}  (서명 또는 날인)`, pw / 2, y + signH / 2 + 1, { align: 'center' });
      y += signH;

      // 접수정보 표 (레이블 왼쪽, 값 오른쪽)
      const infoH = 10;
      const infoLW = lw; // 레이블 너비 = 다른 칸과 동일
      const infoHalfW = tw / 2;
      const infoValW = infoHalfW - infoLW;

      // Row 1: 지역 | (값) | 접수유형 | (값)
      cell(mx, y, infoLW, infoH, '지역', labelStyle);
      cell(mx + infoLW, y, infoValW, infoH, regionNameMap[r.region] || r.region);
      cell(mx + infoHalfW, y, infoLW, infoH, '접수유형', labelStyle);
      cell(mx + infoHalfW + infoLW, y, infoValW, infoH, r.registration_type === 'group' ? '단체' : '개인');
      y += infoH;

      // Row 2: 입금상태 | 체크박스 | 참가비 | (값)
      cell(mx, y, infoLW, infoH, '입금상태', labelStyle);
      // 입금상태 값: 체크박스 2개
      doc.rect(mx + infoLW, y, infoValW, infoH);
      doc.setFont('NotoSansKR', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(0);
      const cbY = y + infoH / 2;
      const cbSize = 3;
      const cbX1 = mx + infoLW + 5;
      // 입금 대기 체크박스
      doc.rect(cbX1, cbY - cbSize / 2, cbSize, cbSize);
      if (r.payment_status === 'pending') {
        doc.setLineWidth(0.5);
        doc.line(cbX1 + 0.5, cbY, cbX1 + cbSize / 2, cbY + cbSize / 2 - 0.3);
        doc.line(cbX1 + cbSize / 2, cbY + cbSize / 2 - 0.3, cbX1 + cbSize - 0.3, cbY - cbSize / 2 + 0.3);
        doc.setLineWidth(0.3);
      }
      doc.text('입금 대기', cbX1 + cbSize + 2, cbY + 1, { baseline: 'middle' });
      const cbX2 = cbX1 + 30;
      // 입금 확인 체크박스
      doc.rect(cbX2, cbY - cbSize / 2, cbSize, cbSize);
      if (r.payment_status === 'confirmed') {
        doc.setLineWidth(0.5);
        doc.line(cbX2 + 0.5, cbY, cbX2 + cbSize / 2, cbY + cbSize / 2 - 0.3);
        doc.line(cbX2 + cbSize / 2, cbY + cbSize / 2 - 0.3, cbX2 + cbSize - 0.3, cbY - cbSize / 2 + 0.3);
        doc.setLineWidth(0.3);
      }
      doc.text('입금 확인', cbX2 + cbSize + 2, cbY + 1, { baseline: 'middle' });

      cell(mx + infoHalfW, y, infoLW, infoH, '참가비', labelStyle);
      cell(mx + infoHalfW + infoLW, y, infoValW, infoH, `${(r.payment_amount || 0).toLocaleString()}원`);
      y += infoH;

      // 개인정보 수집 동의
      y += 5;
      const privH = 40;
      const privLabelW = 30;
      cell(mx, y, privLabelW, privH, '개인정보\n수집·이용', { bg: '#f5f5f5', fontSize: 9, align: 'center' });
      doc.rect(mx + privLabelW, y, tw - privLabelW, privH);
      doc.setFontSize(8);
      const px = mx + privLabelW + 3;
      let py = y + 8;
      doc.text('수집·이용 목적 : 전국지리올림피아드 운영관련 안내사항 통보', px, py);
      py += 6;
      doc.text('수집·이용할 항목 : 학교명, 학년반, 성명, 생년월일, 연락처', px, py);
      py += 6;
      doc.text('개인정보 보유·이용 기간 : 이용목적 달성시까지', px, py);
      py += 6;
      doc.text('동의를 거부할 권리가 있으며, 거부할 경우 전국지리올림피아드와 관련한 서비스를 제공받을 수 없음.', px, py);
      y += privH;

      // 하단 안내문
      y += 5;
      doc.setFontSize(8);
      doc.setTextColor(50, 50, 200);
      doc.text('※ 수집한 개인정보는 정보주체의 동의 없이 수집한 목적 외로 사용하지 않습니다.', mx, y);
      doc.setTextColor(0);

    }

    let fileName: string;
    if (list.length === 1) {
      const r = list[0];
      const date = new Date(r.created_at).toISOString().slice(0, 10);
      fileName = `${shortenSchool(r.school)}_${r.name}_${date}.pdf`;
    } else {
      fileName = `참가신청서_${list.length}명_${new Date().toISOString().slice(0, 10)}.pdf`;
    }
    doc.save(fileName);
  }

  if (loading) return <div className="text-center py-20 text-[#999]">로딩 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-6 flex-wrap">
        {selected.size > 0 && !isTrashTab && (
          <button
            onClick={() => {
              const targets = data.filter(r => selected.has(r.id));
              downloadPDF(targets);
            }}
            className="px-3 py-1.5 text-xs sm:text-sm text-white bg-[#111] hover:bg-[#333] border border-[#111] rounded-lg"
          >
            신청서 PDF 선택 다운로드 ({selected.size}명)
          </button>
        )}
        <button
          onClick={() => downloadPDF()}
          className="px-3 py-1.5 text-xs sm:text-sm text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg"
        >
          신청서 PDF 일괄 다운로드
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
    </div>
  );
}
