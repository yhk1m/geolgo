// © 2026 김용현
'use client';

import { useState, useEffect, useMemo } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { getMockRegistrations, updateMockPaymentStatus, softDeleteMockRegistrations, restoreMockRegistrations, permanentDeleteMockRegistrations, cancelMockRegistrations, uncancelMockRegistrations, getMockExamLocations, setMockExamLocations } from '@/lib/mockdata';
import type { ExamLocation } from '@/lib/mockdata';
import { regionNameMap, regionShortMap, REGIONS } from '@/lib/regions';
import { computeExamNumbers } from '@/lib/examNumber';
import { downloadExamTicketPDF } from '@/lib/examTicket';
import type { ExamLocationInfo } from '@/lib/examTicket';
import { resizeImage } from '@/lib/resizeImage';
import PhotoEditor from '@/components/PhotoEditor';
import { downloadPhotoRosterPDF } from '@/lib/photoRoster';
import type { RosterEntry } from '@/lib/photoRoster';
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
  group_id?: string | null;
  teacher_name?: string | null;
  teacher_phone?: string | null;
  teacher_email?: string | null;
}

interface TeacherInfo {
  teacher_name: string;
  teacher_phone: string;
  teacher_email: string | null;
}

interface GroupInfo {
  teacher_name: string;
  teacher_phone: string;
  teacher_email: string | null;
  region: string;
  school_name: string;
}

interface TeacherDetail {
  name: string;
  region: string;
  school: string;
  phone: string;
  email: string | null;
}

interface EditLog {
  id: string;
  changed_fields: Record<string, { old: string; new: string }>;
  created_at: string;
}

interface EditDraft {
  name: string;
  school: string;
  grade: string;
  class_name: string;
  phone: string;
  email: string;
  birthdate: string;
  region: string;
  teacher_name: string;
  teacher_phone: string;
  teacher_email: string;
}

type Tab = 'all' | 'pending' | 'confirmed' | 'trash' | 'cancelled';
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

interface ParticipantManagerProps {
  regionFilter?: string;
  readOnly?: boolean;
}

export default function ParticipantManager({ regionFilter, readOnly = false }: ParticipantManagerProps) {
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
  const [deleteMode, setDeleteMode] = useState<'trash' | 'permanent' | 'cancel'>('trash');
  const [restoreTargetIds, setRestoreTargetIds] = useState<string[]>([]);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restorePasswordInput, setRestorePasswordInput] = useState('');
  const [restorePasswordError, setRestorePasswordError] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [examLocations, setExamLocations] = useState<Record<string, ExamLocationInfo>>({});
  const [locationDraft, setLocationDraft] = useState<Record<string, ExamLocationInfo>>({});
  const [showRosterModal, setShowRosterModal] = useState(false);
  const [rosterRegion, setRosterRegion] = useState('');
  const [rosterProgress, setRosterProgress] = useState<{ current: number; total: number } | null>(null);
  const [teacherInfo, setTeacherInfo] = useState<TeacherInfo | null>(null);
  const [detailTarget, setDetailTarget] = useState<Registration | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [editLogs, setEditLogs] = useState<EditLog[]>([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Registration | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editingPhotoSource, setEditingPhotoSource] = useState<File | null>(null);
  const [groupsMap, setGroupsMap] = useState<Record<string, GroupInfo>>({});
  const [teacherDetail, setTeacherDetail] = useState<TeacherDetail | null>(null);
  const [groupTeacherConfirm, setGroupTeacherConfirm] = useState<{ count: number; teacherName: string } | null>(null);

  useEffect(() => {
    loadData();
    loadExamLocations();
    loadGroups();
  }, []);

  async function loadGroups() {
    if (!isSupabaseConfigured) return;
    const { data: groups } = await supabase
      .from('groups')
      .select('id, teacher_name, teacher_phone, teacher_email, region, school_name');
    if (groups) {
      const map: Record<string, GroupInfo> = {};
      for (const g of groups) {
        map[g.id] = {
          teacher_name: g.teacher_name || '',
          teacher_phone: g.teacher_phone || '',
          teacher_email: g.teacher_email || null,
          region: g.region || '',
          school_name: g.school_name || '',
        };
      }
      setGroupsMap(map);
    }
  }

  function getTeacherDetail(r: Registration): TeacherDetail | null {
    // 단체 신청: groups 테이블에서 교사 정보
    if (r.registration_type === 'group' && r.group_id && groupsMap[r.group_id]) {
      const g = groupsMap[r.group_id];
      return {
        name: g.teacher_name,
        region: g.region || r.region,
        school: g.school_name || r.school,
        phone: g.teacher_phone,
        email: g.teacher_email,
      };
    }
    // 개인 신청 (또는 mock 단체): registrations 행의 teacher_* 필드 사용
    if (r.teacher_name) {
      return {
        name: r.teacher_name,
        region: r.region,
        school: r.school,
        phone: r.teacher_phone || '',
        email: r.teacher_email || null,
      };
    }
    return null;
  }

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
    const bom = '﻿';
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
    e.target.value = '';
  }

  // 수험번호는 전체 데이터 기준으로 계산 (지역 필터링과 무관하게 일관성 유지)
  const examNumbers = useMemo(() => computeExamNumbers(data), [data]);

  // 지역 필터를 거친 기준 데이터
  const scopedData = useMemo(
    () => (regionFilter ? data.filter(r => r.region === regionFilter) : data),
    [data, regionFilter]
  );

  function requestDelete(ids: string[], mode: 'trash' | 'permanent' | 'cancel' = 'trash') {
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
    } else if (deleteMode === 'cancel') {
      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('registrations')
          .update({ payment_status: 'cancelled' })
          .in('id', idsToDelete);
        if (error) { alert('신청 취소 처리에 실패했습니다: ' + error.message); return; }
      } else {
        cancelMockRegistrations(idsToDelete);
      }
      setData(prev => prev.map(r =>
        idsToDelete.includes(r.id) ? { ...r, payment_status: 'cancelled' } : r
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

  function requestRestore(ids: string[]) {
    setRestoreTargetIds(ids);
    setRestorePasswordInput('');
    setRestorePasswordError('');
    setShowRestoreModal(true);
  }

  async function executeRestore() {
    if (restorePasswordInput !== 'admin0220') {
      setRestorePasswordError('비밀번호가 올바르지 않습니다.');
      return;
    }
    setShowRestoreModal(false);

    const idsToRestore = [...restoreTargetIds];
    // 휴지통(deleted) 복구는 created_at을 갱신해 맨 뒤에 붙임
    // → 기존 활성 신청자들의 수험번호가 한 칸씩 밀리는 문제 방지
    const deletedIds = idsToRestore.filter(id => data.find(r => r.id === id)?.payment_status === 'deleted');
    const cancelledIds = idsToRestore.filter(id => data.find(r => r.id === id)?.payment_status === 'cancelled');
    const restoreTime = new Date().toISOString();

    if (isSupabaseConfigured) {
      if (deletedIds.length > 0) {
        const { error } = await supabase
          .from('registrations')
          .update({ payment_status: 'pending', created_at: restoreTime })
          .in('id', deletedIds);
        if (error) { alert('복원에 실패했습니다: ' + error.message); return; }
      }
      if (cancelledIds.length > 0) {
        const { error } = await supabase
          .from('registrations')
          .update({ payment_status: 'pending' })
          .in('id', cancelledIds);
        if (error) { alert('복원에 실패했습니다: ' + error.message); return; }
      }
    } else {
      if (cancelledIds.length > 0) uncancelMockRegistrations(cancelledIds);
      if (deletedIds.length > 0) restoreMockRegistrations(deletedIds);
    }
    setData(prev => prev.map(r => {
      if (deletedIds.includes(r.id)) return { ...r, payment_status: 'pending', created_at: restoreTime };
      if (cancelledIds.includes(r.id)) return { ...r, payment_status: 'pending' };
      return r;
    }));
    setSelected(new Set());
    setRestoreTargetIds([]);
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

  const activeData = scopedData.filter(r => r.payment_status !== 'deleted' && r.payment_status !== 'cancelled');
  const trashed = scopedData.filter(r => r.payment_status === 'deleted');
  const cancelledList = scopedData.filter(r => r.payment_status === 'cancelled');
  const pending = activeData.filter(r => r.payment_status === 'pending');
  const confirmed = activeData.filter(r => r.payment_status === 'confirmed');

  const filtered = useMemo(() => {
    const base = tab === 'trash' ? trashed
      : tab === 'cancelled' ? cancelledList
      : tab === 'all' ? activeData
      : tab === 'pending' ? pending
      : confirmed;

    let result = base;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r => {
        const teacherName = r.registration_type === 'group' && r.group_id && groupsMap[r.group_id]
          ? groupsMap[r.group_id].teacher_name
          : r.teacher_name || '';
        return (
          r.name.toLowerCase().includes(q) ||
          r.school.toLowerCase().includes(q) ||
          (regionNameMap[r.region] || r.region).toLowerCase().includes(q) ||
          (teacherName || '').toLowerCase().includes(q)
        );
      });
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
  }, [tab, scopedData, activeData, trashed, cancelledList, pending, confirmed, search, sortKey, sortDir, groupsMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  const showCheckbox = (tab === 'pending' || tab === 'confirmed') && !readOnly;
  const isTrashTab = tab === 'trash';
  const isCancelTab = tab === 'cancelled';

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
    const base = target === 'all' ? activeData : target === 'pending' ? pending : confirmed;
    const label = target === 'all' ? '전체명단' : target === 'pending' ? '입금대기' : '입금확인';
    const rows = base.map(r => ({
      '수험번호': examNumbers.get(r.id) || '-',
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
    const fileScope = regionFilter ? `_${regionShortMap[regionFilter] || regionFilter}` : '';
    XLSX.writeFile(wb, `지리올림피아드${fileScope}_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function downloadCancelledExcel() {
    const rows = cancelledList.map(r => ({
      '이름': r.name,
      '학교': r.school,
      '생년월일': r.birthdate || '',
      '연락처': r.phone,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '신청취소');
    const fileScope = regionFilter ? `_${regionShortMap[regionFilter] || regionFilter}` : '';
    XLSX.writeFile(wb, `지리올림피아드${fileScope}_신청취소_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  async function handleDownloadRoster() {
    if (!rosterRegion) return;
    const regionStudents = confirmed
      .filter(r => r.region === rosterRegion)
      .sort((a, b) => {
        const numA = examNumbers.get(a.id) || '';
        const numB = examNumbers.get(b.id) || '';
        return numA.localeCompare(numB);
      });

    const entries: RosterEntry[] = regionStudents.map(r => ({
      examNumber: examNumbers.get(r.id) || '',
      school: shortenSchool(r.school),
      name: r.name,
      birthdate: r.birthdate || '',
      photo_url: r.photo_url,
    }));

    const name = regionShortMap[rosterRegion] || regionNameMap[rosterRegion] || rosterRegion;
    setRosterProgress({ current: 0, total: entries.length });
    await downloadPhotoRosterPDF(entries, name, (current, total) => {
      setRosterProgress({ current, total });
    });
    setRosterProgress(null);
    setShowRosterModal(false);
  }

  async function deleteEditLog(logId: string) {
    const target = editLogs.find(l => l.id === logId);
    if (!target) return;
    const when = new Date(target.created_at).toLocaleString('ko-KR');
    if (!window.confirm(`${when}\n에 기록된 이 수정이력을 삭제하시겠습니까?\n(되돌릴 수 없습니다)`)) return;
    if (isSupabaseConfigured) {
      const { error } = await supabase.from('edit_logs').delete().eq('id', logId);
      if (error) { alert('삭제 실패: ' + error.message); return; }
    }
    setEditLogs(prev => prev.filter(l => l.id !== logId));
  }

  async function handleShowDetail(r: Registration) {
    setDetailTarget(r);
    setShowDetailModal(true);
    setTeacherInfo(null);
    setEditLogs([]);
    if (isSupabaseConfigured) {
      try {
        const { data: logs } = await supabase
          .from('edit_logs')
          .select('*')
          .eq('registration_id', r.id)
          .order('created_at', { ascending: false });
        if (logs) setEditLogs(logs);
      } catch { /* ignore */ }
    }
    if (r.registration_type === 'group' && r.group_id) {
      setTeacherLoading(true);
      try {
        if (isSupabaseConfigured) {
          const { data } = await supabase
            .from('groups')
            .select('teacher_name, teacher_phone, teacher_email')
            .eq('id', r.group_id)
            .single();
          if (data) setTeacherInfo(data);
        }
      } catch {
        // error
      } finally {
        setTeacherLoading(false);
      }
    }
  }

  function openEditModal(r: Registration) {
    setEditTarget(r);
    const t = getTeacherDetail(r);
    setEditDraft({
      name: r.name,
      school: r.school,
      grade: String(r.grade),
      class_name: r.class_name || '',
      phone: r.phone,
      email: r.email || '',
      birthdate: r.birthdate || '',
      region: r.region,
      teacher_name: t?.name || '',
      teacher_phone: t?.phone || '',
      teacher_email: t?.email || '',
    });
    setEditPhotoFile(null);
    setEditPhotoPreview(r.photo_url || null);
    setShowEditModal(true);
  }

  function handleEditPhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('이미지 파일만 업로드 가능합니다.'); return; }
    if (file.size > 10 * 1024 * 1024) { alert('파일 크기는 10MB 이하여야 합니다.'); return; }
    setEditingPhotoSource(file);
    e.target.value = '';
  }

  function applyEditedAdminPhoto(edited: File) {
    setEditPhotoFile(edited);
    const reader = new FileReader();
    reader.onload = (ev) => setEditPhotoPreview(ev.target?.result as string);
    reader.readAsDataURL(edited);
    setEditingPhotoSource(null);
  }

  async function handleSaveEdit(confirmed = false) {
    if (!editTarget || !editDraft) return;

    // 단체 신청 + 지도교사 필드 변경 시 사전 확인 모달
    if (!confirmed && editTarget.registration_type === 'group') {
      const current = getTeacherDetail(editTarget);
      const teacherChanged =
        (editDraft.teacher_name || '') !== (current?.name || '') ||
        (editDraft.teacher_phone || '') !== (current?.phone || '') ||
        (editDraft.teacher_email || '') !== (current?.email || '');
      if (teacherChanged) {
        const groupCount = editTarget.group_id
          ? data.filter(r => r.group_id === editTarget.group_id && r.payment_status !== 'deleted').length
          : 0;
        setGroupTeacherConfirm({
          count: groupCount,
          teacherName: editDraft.teacher_name || current?.name || '',
        });
        return;
      }
    }

    setEditSaving(true);
    try {
      const fieldLabels: Record<string, string> = {
        name: '이름', school: '학교', grade: '학년', class_name: '반',
        phone: '전화번호', email: '이메일', birthdate: '생년월일', region: '지역',
        teacher_name: '지도교사 이름', teacher_phone: '지도교사 전화번호', teacher_email: '지도교사 이메일',
      };
      const TEACHER_KEYS: (keyof EditDraft)[] = ['teacher_name', 'teacher_phone', 'teacher_email'];
      const isGroup = editTarget.registration_type === 'group';
      const currentTeacher = getTeacherDetail(editTarget);
      const oldTeacherMap: Record<string, string> = {
        teacher_name: currentTeacher?.name || '',
        teacher_phone: currentTeacher?.phone || '',
        teacher_email: currentTeacher?.email || '',
      };

      const changes: Record<string, { old: string; new: string }> = {};
      const updates: Record<string, string | number | null> = {};
      const groupUpdates: Record<string, string | null> = {};

      for (const key of Object.keys(editDraft) as (keyof EditDraft)[]) {
        const oldVal = TEACHER_KEYS.includes(key) ? oldTeacherMap[key]
          : key === 'grade' ? String(editTarget.grade)
          : key === 'class_name' ? (editTarget.class_name || '')
          : key === 'email' ? (editTarget.email || '')
          : key === 'birthdate' ? (editTarget.birthdate || '')
          : (editTarget as unknown as Record<string, string>)[key] || '';
        const newVal = editDraft[key];
        if (oldVal !== newVal) {
          changes[fieldLabels[key] || key] = { old: oldVal, new: newVal };
          if (TEACHER_KEYS.includes(key)) {
            // Supabase 모드의 단체: groups 테이블; 그 외(개인/Mock): registrations 행
            if (isGroup && isSupabaseConfigured) {
              groupUpdates[key] = newVal || null;
            } else {
              updates[key] = newVal || null;
            }
          } else if (key === 'grade') updates[key] = parseInt(newVal);
          else if (key === 'email' || key === 'birthdate' || key === 'class_name') updates[key] = newVal || null;
          else updates[key] = newVal;
        }
      }

      if (editPhotoFile && isSupabaseConfigured) {
        const resized = await resizeImage(editPhotoFile);
        const ext = resized.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('photos').upload(fileName, resized);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
        updates.photo_url = urlData.publicUrl;
        changes['사진'] = { old: editTarget.photo_url ? '(기존 사진)' : '(없음)', new: '(새 사진)' };
      }

      if (Object.keys(changes).length === 0) {
        setShowEditModal(false);
        return;
      }

      if (isSupabaseConfigured) {
        if (Object.keys(updates).length > 0) {
          const { error } = await supabase
            .from('registrations')
            .update(updates)
            .eq('id', editTarget.id);
          if (error) throw error;
        }

        if (Object.keys(groupUpdates).length > 0 && editTarget.group_id) {
          const { error: groupErr } = await supabase
            .from('groups')
            .update(groupUpdates)
            .eq('id', editTarget.group_id);
          if (groupErr) throw groupErr;
        }

        await supabase.from('edit_logs').insert({
          registration_id: editTarget.id,
          changed_fields: changes,
        });

        // 단체 + 지도교사 변경 시, 같은 단체의 다른 학생에게도 지도교사 변경 이력 기록
        if (isGroup && editTarget.group_id) {
          const teacherChangeEntries = Object.entries(changes).filter(([k]) =>
            ['지도교사 이름', '지도교사 전화번호', '지도교사 이메일'].includes(k)
          );
          if (teacherChangeEntries.length > 0) {
            const otherStudents = data.filter(r =>
              r.group_id === editTarget.group_id &&
              r.id !== editTarget.id &&
              r.payment_status !== 'deleted'
            );
            if (otherStudents.length > 0) {
              const teacherOnlyChanges = Object.fromEntries(teacherChangeEntries);
              await supabase.from('edit_logs').insert(
                otherStudents.map(s => ({
                  registration_id: s.id,
                  changed_fields: teacherOnlyChanges,
                }))
              );
            }
          }
        }
      }

      setData(prev => prev.map(r => r.id === editTarget.id ? { ...r, ...updates } as Registration : r));

      if (Object.keys(groupUpdates).length > 0 && editTarget.group_id) {
        setGroupsMap(prev => ({
          ...prev,
          [editTarget.group_id!]: {
            ...(prev[editTarget.group_id!] || { teacher_name: '', teacher_phone: '', teacher_email: null, region: editTarget.region, school_name: editTarget.school }),
            ...(groupUpdates.teacher_name !== undefined ? { teacher_name: (groupUpdates.teacher_name as string) || '' } : {}),
            ...(groupUpdates.teacher_phone !== undefined ? { teacher_phone: (groupUpdates.teacher_phone as string) || '' } : {}),
            ...(groupUpdates.teacher_email !== undefined ? { teacher_email: groupUpdates.teacher_email } : {}),
          },
        }));
      }

      setShowEditModal(false);
      alert('수정이 완료되었습니다.');
    } catch {
      alert('수정 중 오류가 발생했습니다.');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDownloadPDF(targets?: Registration[]) {
    const list = targets || scopedData;
    const confirmedList = list.filter(r => r.payment_status === 'confirmed');
    if (confirmedList.length === 0) {
      alert('입금 확인된 참가자가 없습니다.');
      return;
    }
    await downloadExamTicketPDF({
      registrations: confirmedList,
      examNumbers,
      examLocations,
    });
  }

  if (loading) return <div className="text-center py-20 text-[#999]">로딩 중...</div>;

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-6 flex-wrap">
        <button
          onClick={() => { setRosterRegion(regionFilter || ''); setShowRosterModal(true); }}
          className="px-3 py-1.5 text-xs sm:text-sm text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg"
        >
          명렬표 저장
        </button>
        {!readOnly && (
          <button
            onClick={openLocationModal}
            className="px-3 py-1.5 text-xs sm:text-sm text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#e5e5e5] rounded-lg"
          >
            시험장소 설정
          </button>
        )}
        {selected.size > 0 && !isTrashTab && (
          <button
            onClick={() => {
              const targets = scopedData.filter(r => selected.has(r.id));
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
            {activeData.length > 0 ? Math.round((confirmed.length / activeData.length) * 100) : 0}%
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
            전체 ({activeData.length})
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
          {!readOnly && (
            <button
              onClick={() => changeTab('trash')}
              className={`px-3 sm:px-4 py-[10px] text-xs sm:text-sm font-medium whitespace-nowrap ${
                tab === 'trash' ? 'bg-[#c00] text-white' : 'bg-white text-[#999]'
              }`}
            >
              휴지통 ({trashed.length})
            </button>
          )}
          {!readOnly && (
            <button
              onClick={() => changeTab('cancelled')}
              className={`px-3 sm:px-4 py-[10px] text-xs sm:text-sm font-medium whitespace-nowrap ${
                tab === 'cancelled' ? 'bg-[#c80] text-white' : 'bg-white text-[#999]'
              }`}
            >
              신청 취소 ({cancelledList.length})
            </button>
          )}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          placeholder="이름, 학교, 지역, 지도교사 검색"
          className="flex-1 min-w-0 text-sm"
          autoComplete="off"
        />

        {!readOnly && showCheckbox && selected.size > 0 && (
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
        {!readOnly && tab === 'all' && selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => requestDelete(Array.from(selected))}
              className="text-xs sm:text-sm px-4 py-1.5 text-white bg-[#c00] hover:bg-[#a00] rounded-md"
            >
              선택 삭제 ({selected.size}명)
            </button>
          </div>
        )}
        {!readOnly && isTrashTab && selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => requestRestore(Array.from(selected))}
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
        {!readOnly && isTrashTab && selected.size === 0 && trashed.length > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => requestDelete(trashed.map(r => r.id), 'permanent')}
              className="text-xs sm:text-sm px-4 py-1.5 text-white bg-[#c00] hover:bg-[#a00] rounded-md"
            >
              휴지통 비우기 ({trashed.length}건)
            </button>
          </div>
        )}
        {!readOnly && isCancelTab && selected.size > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={() => requestRestore(Array.from(selected))}
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
        {!readOnly && isCancelTab && selected.size === 0 && cancelledList.length > 0 && (
          <div className="flex items-center gap-2 sm:ml-auto">
            <button
              onClick={downloadCancelledExcel}
              className="text-xs sm:text-sm px-4 py-1.5 text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#e5e5e5] rounded-md"
            >
              엑셀 다운로드 ({cancelledList.length}명)
            </button>
          </div>
        )}
      </div>

      {/* 전체 선택 안내 배너 */}
      {!readOnly && allPageSelected && filtered.length > paged.length && (
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
              {!readOnly && (
                <th className="w-10">
                  <input
                    type="checkbox"
                    checked={selected.size === paged.length && paged.length > 0}
                    onChange={toggleAll}
                    className="w-4 h-4"
                  />
                </th>
              )}
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
              <th>지도교사</th>
              {(tab === 'all' || isTrashTab || isCancelTab) && <th>입금</th>}
              <th className="hidden sm:table-cell">금액</th>
              <th
                onClick={() => toggleSort('date')}
                className="cursor-pointer select-none hover:text-[#111]"
              >
                신청일{sortIndicator('date')}
              </th>
              {!readOnly && !isTrashTab && !isCancelTab && <th>관리</th>}
              {!readOnly && isCancelTab && <th>관리</th>}
            </tr>
          </thead>
          <tbody>
            {paged.map(r => (
              <tr key={r.id}>
                {!readOnly && (
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="w-4 h-4"
                    />
                  </td>
                )}
                <td className="text-xs text-[#666] font-mono whitespace-nowrap">
                  <button type="button" onClick={() => handleShowDetail(r)} className="hover:underline hover:text-blue-600 cursor-pointer">{examNumbers.get(r.id) || '-'}</button>
                </td>
                <td className="font-medium text-[#111] whitespace-nowrap">
                  <button type="button" onClick={() => handleShowDetail(r)} className="hover:underline hover:text-blue-600 cursor-pointer">{r.name}</button>
                </td>
                <td>
                  <button type="button" onClick={() => handleShowDetail(r)} className="hover:underline hover:text-blue-600 cursor-pointer text-left">
                    <span className="sm:hidden">{shortenSchool(r.school)}</span>
                    <span className="hidden sm:inline">{r.school}</span>
                  </button>
                </td>
                <td>
                  <span className="sm:hidden">{regionShortMap[r.region] || r.region}</span>
                  <span className="hidden sm:inline">{regionNameMap[r.region] || r.region}</span>
                </td>
                <td>{r.registration_type === 'group' ? '단체' : '개인'}</td>
                <td className="whitespace-nowrap">
                  {(() => {
                    const t = getTeacherDetail(r);
                    if (!t || !t.name) return <span className="text-[#bbb]">-</span>;
                    return (
                      <button
                        type="button"
                        onClick={() => setTeacherDetail(t)}
                        className="hover:underline hover:text-blue-600 cursor-pointer text-[#111]"
                      >
                        {t.name}
                      </button>
                    );
                  })()}
                </td>
                {(tab === 'all' || isTrashTab || isCancelTab) && (
                  <td>
                    <span className={`badge ${
                      r.payment_status === 'confirmed' ? 'badge-confirmed'
                        : r.payment_status === 'cancelled' ? 'badge-pending'
                        : 'badge-pending'
                    }`}>
                      {r.payment_status === 'confirmed' ? '확인'
                        : r.payment_status === 'cancelled' ? '취소'
                        : r.payment_status === 'deleted' ? '삭제'
                        : '대기'}
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
                {!readOnly && !isTrashTab && !isCancelTab && (
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
                              입금 확인 취소
                            </button>
                          )}
                        </>
                      )}
                      <button
                        onClick={() => openEditModal(r)}
                        className="px-3 py-1 text-xs font-medium text-blue-600 bg-white hover:bg-blue-50 border border-blue-200 rounded"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => requestDelete([r.id])}
                        className="px-3 py-1 text-xs font-medium text-[#c00] bg-white hover:bg-[#fff0f0] border border-[#e5c5c5] rounded"
                      >
                        삭제
                      </button>
                      <button
                        onClick={() => requestDelete([r.id], 'cancel')}
                        className="px-3 py-1 text-xs font-medium text-[#c80] bg-white hover:bg-[#fff7e6] border border-[#e8c896] rounded"
                      >
                        신청 취소
                      </button>
                    </div>
                  </td>
                )}
                {!readOnly && isCancelTab && (
                  <td>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => requestRestore([r.id])}
                        className="px-3 py-1 text-xs font-medium text-[#111] bg-white hover:bg-[#f5f5f5] border border-[#ddd] rounded"
                      >
                        복원
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
            {paged.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center py-8 text-[#999]">
                  {search ? '검색 결과가 없습니다.' : isTrashTab ? '휴지통이 비어 있습니다.' : isCancelTab ? '신청 취소된 참가자가 없습니다.' : '데이터가 없습니다.'}
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
      {!readOnly && showPasswordModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[360px] shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-[#111]">
              {deleteMode === 'permanent' ? '영구 삭제 확인'
                : deleteMode === 'cancel' ? '신청 취소 확인'
                : '삭제 확인'}
            </h3>
            <p className="text-sm text-[#666] mb-4">
              {deleteMode === 'permanent'
                ? `${deleteTargetIds.length}건을 영구 삭제합니다. 이 작업은 되돌릴 수 없습니다.`
                : deleteMode === 'cancel'
                ? `${deleteTargetIds.length}건의 신청을 취소 처리합니다. 환불 명단에서 확인할 수 있습니다.`
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
                className={`px-4 py-2 text-sm text-white rounded-md ${
                  deleteMode === 'cancel'
                    ? 'bg-[#c80] hover:bg-[#a60]'
                    : 'bg-[#c00] hover:bg-[#a00]'
                }`}
              >
                {deleteMode === 'permanent' ? '영구 삭제'
                  : deleteMode === 'cancel' ? '신청 취소'
                  : '삭제'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 복원 확인 모달 */}
      {!readOnly && showRestoreModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[360px] shadow-xl">
            <h3 className="text-lg font-bold mb-2 text-[#111]">복원 확인</h3>
            <p className="text-sm text-[#666] mb-4">
              {restoreTargetIds.length}건을 복원합니다.
              <br />관리자 비밀번호를 입력해주세요.
            </p>
            <input
              type="password"
              value={restorePasswordInput}
              onChange={e => { setRestorePasswordInput(e.target.value); setRestorePasswordError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') executeRestore(); }}
              placeholder="비밀번호"
              className="w-full mb-2"
              autoFocus
              autoComplete="new-password"
            />
            {restorePasswordError && (
              <p className="text-xs text-[#c00] mb-2">{restorePasswordError}</p>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowRestoreModal(false)}
                className="px-4 py-2 text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-md hover:bg-[#f5f5f5]"
              >
                취소
              </button>
              <button
                onClick={executeRestore}
                className="px-4 py-2 text-sm text-white bg-[#111] rounded-md hover:bg-[#333]"
              >
                복원
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 참가자 상세 모달 */}
      {showDetailModal && detailTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white rounded-xl p-6 w-[360px] shadow-xl mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-[#111]">참가자 정보</h3>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">수험번호</span>
                <span className="text-[#111] font-mono font-medium">{examNumbers.get(detailTarget.id) || '-'}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">이름</span>
                <span className="text-[#111] font-medium">{detailTarget.name}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">생년월일</span>
                <span className="text-[#111]">{detailTarget.birthdate || '-'}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">전화번호</span>
                <span className="text-[#111]">{detailTarget.phone}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">이메일</span>
                <span className="text-[#111]">{detailTarget.email || '-'}</span>
              </div>
            </div>
            {detailTarget.registration_type === 'group' && (
              <div className="mt-4 pt-4 border-t border-[#e5e5e5]">
                <h4 className="text-lg font-semibold text-[#111] mb-3">지도교사 정보</h4>
                {teacherLoading ? (
                  <p className="text-sm text-[#999]">로딩 중...</p>
                ) : teacherInfo ? (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-[72px_1fr] gap-1">
                      <span className="text-[#999]">이름</span>
                      <span className="text-[#111] font-medium">{teacherInfo.teacher_name}</span>
                    </div>
                    <div className="grid grid-cols-[72px_1fr] gap-1">
                      <span className="text-[#999]">전화번호</span>
                      <span className="text-[#111]">{teacherInfo.teacher_phone}</span>
                    </div>
                    <div className="grid grid-cols-[72px_1fr] gap-1">
                      <span className="text-[#999]">이메일</span>
                      <span className="text-[#111]">{teacherInfo.teacher_email || '-'}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#999]">교사 정보를 불러올 수 없습니다.</p>
                )}
              </div>
            )}
            {editLogs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[#e5e5e5]">
                <h4 className="text-lg font-semibold text-[#111] mb-3">수정 이력</h4>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {editLogs.map(log => {
                    const editedBy = log.changed_fields._edited_by?.new;
                    const fields = Object.entries(log.changed_fields).filter(([k]) => k !== '_edited_by');
                    return (
                      <div key={log.id} className="relative p-2 bg-[#fafafa] rounded border border-[#eee] text-xs">
                        <button
                          type="button"
                          onClick={() => deleteEditLog(log.id)}
                          title="이 수정이력 삭제"
                          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center text-[#aaa] hover:text-[#c00] hover:bg-[#fee] rounded"
                        >
                          ×
                        </button>
                        <p className="text-[#999] mb-1 pr-5">
                          {new Date(log.created_at).toLocaleString('ko-KR')}
                          {editedBy && <span className="ml-2 px-1.5 py-0.5 rounded bg-[#e5e5e5] text-[#666]">{editedBy}</span>}
                        </p>
                        {fields.map(([field, val]) => (
                          <p key={field} className="text-[#333]">
                            <span className="font-medium">{field}</span>: <span className="text-[#c00] line-through">{val.old || '(없음)'}</span> → <span className="text-blue-600">{val.new || '(없음)'}</span>
                          </p>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => setShowDetailModal(false)}
              className="mt-5 w-full py-2 text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-lg hover:bg-[#f5f5f5]"
            >
              닫기
            </button>
          </div>
        </div>
      )}

      {/* 수정 모달 */}
      {!readOnly && showEditModal && editDraft && editTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl mx-4 max-h-[85vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4 text-[#111]">참가자 정보 수정</h3>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-[#999] mb-1">이름</label>
                <input type="text" value={editDraft.name} onChange={e => setEditDraft({ ...editDraft, name: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-[#999] mb-1">학교</label>
                <input type="text" value={editDraft.school} onChange={e => setEditDraft({ ...editDraft, school: e.target.value })} className="w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#999] mb-1">학년</label>
                  <select value={editDraft.grade} onChange={e => setEditDraft({ ...editDraft, grade: e.target.value })} className="w-full">
                    <option value="1">1학년</option>
                    <option value="2">2학년</option>
                    <option value="3">3학년</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#999] mb-1">반</label>
                  <input type="text" value={editDraft.class_name} onChange={e => setEditDraft({ ...editDraft, class_name: e.target.value })} className="w-full" />
                </div>
              </div>
              <div>
                <label className="block text-[#999] mb-1">전화번호</label>
                <input type="tel" value={editDraft.phone} onChange={e => setEditDraft({ ...editDraft, phone: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-[#999] mb-1">이메일</label>
                <input type="email" value={editDraft.email} onChange={e => setEditDraft({ ...editDraft, email: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-[#999] mb-1">생년월일</label>
                <input type="date" value={editDraft.birthdate} onChange={e => setEditDraft({ ...editDraft, birthdate: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="block text-[#999] mb-1">지역</label>
                <select value={editDraft.region} onChange={e => setEditDraft({ ...editDraft, region: e.target.value })} className="w-full">
                  {REGIONS.map(r => (
                    <option key={r.nameEn} value={r.nameEn}>{regionNameMap[r.nameEn] || r.nameKo}</option>
                  ))}
                </select>
              </div>

              {/* 지도교사 정보 */}
              <div className="pt-3 mt-1 border-t border-[#e5e5e5]">
                <p className="text-[#111] font-semibold text-sm mb-2">지도교사 정보</p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[#999] mb-1">이름</label>
                    <input type="text" value={editDraft.teacher_name} onChange={e => setEditDraft({ ...editDraft, teacher_name: e.target.value })} className="w-full" placeholder="지도교사 이름" />
                  </div>
                  <div>
                    <label className="block text-[#999] mb-1">전화번호</label>
                    <input type="tel" value={editDraft.teacher_phone} onChange={e => setEditDraft({ ...editDraft, teacher_phone: e.target.value })} className="w-full" placeholder="010-0000-0000" />
                  </div>
                  <div>
                    <label className="block text-[#999] mb-1">이메일</label>
                    <input type="email" value={editDraft.teacher_email} onChange={e => setEditDraft({ ...editDraft, teacher_email: e.target.value })} className="w-full" placeholder="(선택) 지도교사 이메일" />
                  </div>
                  <p className="text-xs text-[#999]">지도교사의 지역·학교명은 참가자(또는 단체)의 정보를 따릅니다.</p>
                </div>
              </div>

              <div>
                <label className="block text-[#999] mb-1">사진</label>
                <div className="flex items-center gap-3">
                  {editPhotoPreview ? (
                    <div className="relative w-[45px] h-[60px] rounded border border-[#ddd] overflow-hidden shrink-0">
                      {editPhotoFile ? (
                        <button
                          type="button"
                          onClick={() => setEditingPhotoSource(editPhotoFile)}
                          className="block w-full h-full p-0 cursor-pointer"
                          title="사진 편집"
                        >
                          <img src={editPhotoPreview} alt="사진" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <img src={editPhotoPreview} alt="사진" className="w-full h-full object-cover" />
                      )}
                      <button
                        type="button"
                        onClick={() => { setEditPhotoFile(null); setEditPhotoPreview(null); }}
                        className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#111] text-white rounded-full text-[10px] flex items-center justify-center hover:bg-[#c00]"
                      >
                        &times;
                      </button>
                    </div>
                  ) : (
                    <div className="w-[45px] h-[60px] rounded border border-dashed border-[#ccc] flex items-center justify-center text-[10px] text-[#999] shrink-0">
                      없음
                    </div>
                  )}
                  <label className="px-3 py-1.5 text-xs text-[#666] bg-white hover:bg-[#f5f5f5] border border-[#e5e5e5] rounded cursor-pointer">
                    사진 변경
                    <input type="file" accept="image/*" onChange={handleEditPhotoChange} className="hidden" />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="flex-1 py-2 text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-lg hover:bg-[#f5f5f5]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => handleSaveEdit()}
                disabled={editSaving}
                className="flex-1 py-2 text-sm text-white bg-[#111] rounded-lg hover:bg-[#333] disabled:opacity-50"
              >
                {editSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 명렬표 저장 모달 */}
      {showRosterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl">
            <h3 className="text-lg font-bold mb-4 text-[#111]">명렬표 저장</h3>
            <label className="block text-sm font-medium text-[#333] mb-1.5">지역 선택</label>
            <select
              value={rosterRegion}
              onChange={e => setRosterRegion(e.target.value)}
              disabled={!!regionFilter}
              className="w-full text-sm mb-4 disabled:bg-[#f5f5f5]"
            >
              <option value="">지역을 선택하세요</option>
              {REGIONS.map(r => {
                const count = confirmed.filter(reg => reg.region === r.nameEn).length;
                return (
                  <option key={r.nameEn} value={r.nameEn}>
                    {regionShortMap[r.nameEn] || r.nameKo} ({count}명)
                  </option>
                );
              })}
            </select>
            {rosterRegion && !rosterProgress && (
              <p className="text-sm text-[#666] mb-4">
                입금 확인된 {confirmed.filter(r => r.region === rosterRegion).length}명의 명렬표를 생성합니다.
              </p>
            )}
            {rosterProgress && (
              <div className="mb-4">
                <div className="flex justify-between text-sm text-[#666] mb-1.5">
                  <span>명렬표 생성 중...</span>
                  <span>{rosterProgress.current} / {rosterProgress.total}</span>
                </div>
                <div className="w-full h-2 bg-[#e5e5e5] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#111] rounded-full transition-all duration-150"
                    style={{ width: `${(rosterProgress.current / rosterProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-[#999] mt-1.5">사진을 불러오고 있습니다. 잠시만 기다려주세요.</p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRosterModal(false)}
                disabled={!!rosterProgress}
                className="px-4 py-2 text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-md hover:bg-[#f5f5f5] disabled:opacity-40"
              >
                취소
              </button>
              <button
                onClick={handleDownloadRoster}
                disabled={!rosterRegion || !!rosterProgress}
                className="px-4 py-2 text-sm text-white bg-[#111] rounded-md hover:bg-[#333] disabled:opacity-40"
              >
                {rosterProgress ? '생성 중...' : '다운로드'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 시험장소 설정 모달 */}
      {!readOnly && showLocationModal && (
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

      {!readOnly && editingPhotoSource && (
        <PhotoEditor
          file={editingPhotoSource}
          onCancel={() => setEditingPhotoSource(null)}
          onApply={applyEditedAdminPhoto}
        />
      )}

      {/* 단체 지도교사 일괄 수정 확인 모달 */}
      {groupTeacherConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-[380px] shadow-xl mx-4">
            <h3 className="text-lg font-semibold mb-3 text-[#111]">지도교사 정보 일괄 수정</h3>
            <p className="text-sm text-[#333] leading-relaxed mb-4">
              해당 지도교사가 단체 접수한
              {groupTeacherConfirm.count > 0 && (
                <> <strong className="text-[#111]">{groupTeacherConfirm.count}명</strong>의</>
              )}
              {' '}모든 학생의 지도교사 정보가 함께 수정됩니다.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGroupTeacherConfirm(null)}
                className="flex-1 py-2 text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-lg hover:bg-[#f5f5f5]"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => { setGroupTeacherConfirm(null); handleSaveEdit(true); }}
                className="flex-1 py-2 text-sm text-white bg-[#111] rounded-lg hover:bg-[#333]"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 지도교사 정보 모달 */}
      {teacherDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setTeacherDetail(null)}>
          <div className="bg-white rounded-xl p-6 w-[360px] shadow-xl mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4 text-[#111]">지도교사 정보</h3>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">이름</span>
                <span className="text-[#111] font-medium">{teacherDetail.name}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">지역</span>
                <span className="text-[#111]">{regionNameMap[teacherDetail.region] || teacherDetail.region || '-'}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">학교명</span>
                <span className="text-[#111]">{teacherDetail.school || '-'}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">전화번호</span>
                <span className="text-[#111]">{teacherDetail.phone || '-'}</span>
              </div>
              <div className="grid grid-cols-[72px_1fr] gap-1">
                <span className="text-[#999]">이메일</span>
                <span className="text-[#111] break-all">{teacherDetail.email || '-'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setTeacherDetail(null)}
              className="mt-5 w-full py-2 text-sm text-[#666] bg-white border border-[#e5e5e5] rounded-lg hover:bg-[#f5f5f5]"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
