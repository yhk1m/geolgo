// © 2026 김용현
'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

// Free Plan 한도 (바이트 단위는 1024 기반)
const LIMIT_DB_BYTES = 500 * 1024 * 1024;          // 500 MB
const LIMIT_STORAGE_BYTES = 1 * 1024 * 1024 * 1024; // 1 GB
const LIMIT_EGRESS_BYTES = 5 * 1024 * 1024 * 1024;  // 5 GB
const LIMIT_MAU = 50000;
const LIMIT_EDGE_INVOCATIONS = 500000;
const LIMIT_REALTIME_MESSAGES = 2000000;
const LIMIT_REALTIME_PEAK = 200;

// 행당 평균 크기(추정) — 인덱스/메타데이터 포함
const AVG_BYTES_PER_REGISTRATION = 800;
const AVG_BYTES_PER_GROUP = 350;
const AVG_BYTES_PER_EXAM_LOCATION = 250;
const AVG_BYTES_PER_EDIT_LOG = 600;
const AVG_BYTES_PER_PAGE_CONTENT = 4000;
const POSTGRES_BASE_OVERHEAD_BYTES = 9 * 1024 * 1024; // Supabase 시스템 스키마 등 기본 점유

// 클라이언트 SDK로 직접 조회 불가능한 항목 — 최근 수동 확인값 (Supabase 대시보드 기준)
const REPORT_DATE = '2026-05-09';
const REFERENCE_EGRESS_MB = 43;
const REFERENCE_CACHED_EGRESS_MB = 555;
const REFERENCE_MAU = 0;
const REFERENCE_EDGE_INVOCATIONS = 0;
const REFERENCE_REALTIME_MESSAGES = 65;
const REFERENCE_REALTIME_PEAK = 7;

// 청구 주기 (Free Plan은 매월 28일 리셋)
const BILLING_CYCLE = '2026-04-28 ~ 2026-05-28';
const NEXT_RESET_DATE = '2026-05-28';

interface UsageState {
  loading: boolean;
  error: string | null;
  storageBytes: number;
  storageFiles: number;
  registrations: number;
  groups: number;
  examLocations: number;
  editLogs: number;
  pageContent: number;
  dbEstimateBytes: number;
  measuredAt: string;
}

const initialState: UsageState = {
  loading: true,
  error: null,
  storageBytes: 0,
  storageFiles: 0,
  registrations: 0,
  groups: 0,
  examLocations: 0,
  editLogs: 0,
  pageContent: 0,
  dbEstimateBytes: 0,
  measuredAt: '',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatRemaining(used: number, limit: number, unit: 'bytes' | 'count'): string {
  const remaining = Math.max(0, limit - used);
  if (unit === 'bytes') return `약 ${formatBytes(remaining)}`;
  return `${remaining.toLocaleString('ko-KR')}`;
}

function formatPct(used: number, limit: number): { text: string; level: 'zero' | 'low' | 'mid' | 'high' } {
  if (used === 0) return { text: '0%', level: 'zero' };
  const pct = (used / limit) * 100;
  let text: string;
  if (pct < 0.01) text = '< 0.01%';
  else if (pct < 1) text = `${pct.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')}%`;
  else text = `${pct.toFixed(1)}%`;
  let level: 'low' | 'mid' | 'high' = 'low';
  if (pct >= 50) level = 'high';
  else if (pct >= 5) level = 'mid';
  return { text, level };
}

const PCT_CLASS: Record<string, string> = {
  zero: 'text-[#999] border-[#ddd] bg-white',
  low: 'text-[#444] border-[#ddd] bg-white',
  mid: 'text-[#111] border-[#444] bg-[#fafafa]',
  high: 'text-white border-[#111] bg-[#111]',
};

export default function AdminUsagePage() {
  const [state, setState] = useState<UsageState>(initialState);

  const loadUsage = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    if (!isSupabaseConfigured) {
      setState({
        ...initialState,
        loading: false,
        error: 'Supabase가 연결되어 있지 않습니다. 환경변수(NEXT_PUBLIC_SUPABASE_URL/ANON_KEY)를 확인하세요.',
        measuredAt: new Date().toLocaleString('ko-KR'),
      });
      return;
    }

    try {
      // Storage 'photos' 버킷 — 모든 파일 목록 조회 후 크기 합산
      let storageBytes = 0;
      let storageFiles = 0;

      async function listAllInPath(path: string) {
        let offset = 0;
        const pageSize = 100;
        while (true) {
          const { data, error } = await supabase.storage
            .from('photos')
            .list(path, { limit: pageSize, offset });
          if (error) throw error;
          if (!data || data.length === 0) break;

          for (const item of data) {
            if (item.id === null) {
              // 폴더 — 재귀 탐색
              const subPath = path ? `${path}/${item.name}` : item.name;
              await listAllInPath(subPath);
            } else {
              const size = (item.metadata as { size?: number } | null)?.size ?? 0;
              storageBytes += size;
              storageFiles += 1;
            }
          }

          if (data.length < pageSize) break;
          offset += pageSize;
        }
      }

      await listAllInPath('');

      // 테이블 row 수 — head: true + count: 'exact' 로 데이터는 가져오지 않고 개수만
      const [reg, grp, loc, log, pc] = await Promise.all([
        supabase.from('registrations').select('*', { head: true, count: 'exact' }),
        supabase.from('groups').select('*', { head: true, count: 'exact' }),
        supabase.from('exam_locations').select('*', { head: true, count: 'exact' }),
        supabase.from('edit_logs').select('*', { head: true, count: 'exact' }),
        supabase.from('page_content').select('*', { head: true, count: 'exact' }),
      ]);

      const registrations = reg.count ?? 0;
      const groups = grp.count ?? 0;
      const examLocations = loc.count ?? 0;
      const editLogs = log.count ?? 0;
      const pageContent = pc.count ?? 0;

      const dbEstimateBytes =
        POSTGRES_BASE_OVERHEAD_BYTES +
        registrations * AVG_BYTES_PER_REGISTRATION +
        groups * AVG_BYTES_PER_GROUP +
        examLocations * AVG_BYTES_PER_EXAM_LOCATION +
        editLogs * AVG_BYTES_PER_EDIT_LOG +
        pageContent * AVG_BYTES_PER_PAGE_CONTENT;

      setState({
        loading: false,
        error: null,
        storageBytes,
        storageFiles,
        registrations,
        groups,
        examLocations,
        editLogs,
        pageContent,
        dbEstimateBytes,
        measuredAt: new Date().toLocaleString('ko-KR'),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류';
      setState(prev => ({
        ...prev,
        loading: false,
        error: `사용량 조회 중 오류: ${msg}`,
        measuredAt: new Date().toLocaleString('ko-KR'),
      }));
    }
  }, []);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const dbPct = formatPct(state.dbEstimateBytes, LIMIT_DB_BYTES);
  const storagePct = formatPct(state.storageBytes, LIMIT_STORAGE_BYTES);
  const egressPct = formatPct(REFERENCE_EGRESS_MB * 1024 * 1024, LIMIT_EGRESS_BYTES);
  const cachedEgressPct = formatPct(REFERENCE_CACHED_EGRESS_MB * 1024 * 1024, LIMIT_EGRESS_BYTES);
  const mauPct = formatPct(REFERENCE_MAU, LIMIT_MAU);
  const edgePct = formatPct(REFERENCE_EDGE_INVOCATIONS, LIMIT_EDGE_INVOCATIONS);
  const rtMsgPct = formatPct(REFERENCE_REALTIME_MESSAGES, LIMIT_REALTIME_MESSAGES);
  const rtPeakPct = formatPct(REFERENCE_REALTIME_PEAK, LIMIT_REALTIME_PEAK);

  return (
    <div className="bg-white border border-[#e5e5e5]">
      {/* Header */}
      <div className="bg-[#111] text-white px-8 py-10 sm:px-14 sm:py-12">
        <div className="text-[11px] tracking-[0.25em] font-medium text-[#c8c8c8] uppercase mb-4">
          Infrastructure Usage Report
        </div>
        <h1 className="text-2xl sm:text-[28px] font-bold leading-snug tracking-tight mb-4">
          Supabase 사용량 현황
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 mt-4 pt-4 border-t border-[#444] text-[13px] text-[#c8c8c8]">
          <div className="flex gap-2.5">
            <span className="text-[#999] font-medium min-w-[70px] text-[11.5px] tracking-[0.08em] uppercase pt-0.5">조직</span>
            <span className="text-white font-medium">전국지리교사연합회</span>
          </div>
          <div className="flex gap-2.5">
            <span className="text-[#999] font-medium min-w-[70px] text-[11.5px] tracking-[0.08em] uppercase pt-0.5">프로젝트</span>
            <span className="text-white font-medium">전국지리올림피아드</span>
          </div>
          <div className="flex gap-2.5">
            <span className="text-[#999] font-medium min-w-[70px] text-[11.5px] tracking-[0.08em] uppercase pt-0.5">요금제</span>
            <span className="text-white font-medium">Free Plan</span>
          </div>
          <div className="flex gap-2.5">
            <span className="text-[#999] font-medium min-w-[70px] text-[11.5px] tracking-[0.08em] uppercase pt-0.5">청구 주기</span>
            <span className="text-white font-medium">{BILLING_CYCLE}</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="px-8 py-10 sm:px-14 sm:py-12">

        {/* Refresh bar */}
        <div className="flex items-center justify-between mb-10 pb-4 border-b border-[#e5e5e5]">
          <div className="text-[12px] text-[#666]">
            {state.loading
              ? '실시간 사용량 조회 중...'
              : state.error
              ? <span className="text-[#c00]">{state.error}</span>
              : <>마지막 측정: <strong className="text-[#111]">{state.measuredAt}</strong></>
            }
          </div>
          <button
            onClick={loadUsage}
            disabled={state.loading}
            className="btn btn-secondary text-[13px] px-4 py-2 disabled:opacity-50"
          >
            {state.loading ? '조회 중...' : '새로고침'}
          </button>
        </div>

        {/* Section 01 — Summary */}
        <section className="mb-11">
          <div className="text-[11px] tracking-[0.25em] font-semibold text-[#666] uppercase mb-2">Section 01</div>
          <h2 className="text-[19px] font-bold text-[#111] tracking-tight pb-3.5 border-b-2 border-[#111] mb-5">핵심 요약</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 border-[1.5px] border-[#111]">
            <div className="px-5 py-5 sm:border-r border-b sm:border-b-0 border-[#e5e5e5] bg-white">
              <div className="text-[11px] tracking-[0.18em] text-[#666] uppercase font-semibold mb-2.5">Database (추정)</div>
              <div className="text-2xl font-bold text-[#111] tracking-tight leading-none mb-1.5">
                {formatBytes(state.dbEstimateBytes)}
              </div>
              <div className="text-[12px] text-[#666]">한도 500 MB · {dbPct.text}</div>
            </div>
            <div className="px-5 py-5 sm:border-r border-b sm:border-b-0 border-[#e5e5e5] bg-white">
              <div className="text-[11px] tracking-[0.18em] text-[#666] uppercase font-semibold mb-2.5">Storage</div>
              <div className="text-2xl font-bold text-[#111] tracking-tight leading-none mb-1.5">
                {formatBytes(state.storageBytes)}
              </div>
              <div className="text-[12px] text-[#666]">한도 1 GB · {storagePct.text}</div>
            </div>
            <div className="px-5 py-5 bg-white">
              <div className="text-[11px] tracking-[0.18em] text-[#666] uppercase font-semibold mb-2.5">월간 Egress</div>
              <div className="text-2xl font-bold text-[#111] tracking-tight leading-none mb-1.5">
                {REFERENCE_EGRESS_MB} MB
              </div>
              <div className="text-[12px] text-[#666]">한도 5 GB · {egressPct.text}</div>
            </div>
          </div>
          <p className="text-[13px] text-[#666] mt-4 pt-3.5 border-t border-[#e5e5e5]">
            Database / Storage는 실시간 측정값, Egress는 {REPORT_DATE} Supabase 대시보드 확인값입니다.
          </p>
        </section>

        {/* Section 02 — Detail Table */}
        <section className="mb-11">
          <div className="text-[11px] tracking-[0.25em] font-semibold text-[#666] uppercase mb-2">Section 02</div>
          <h2 className="text-[19px] font-bold text-[#111] tracking-tight pb-3.5 border-b-2 border-[#111] mb-5">항목별 사용량 / 잔여량</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px] border-t-[1.5px] border-b-[1.5px] border-[#111]">
              <thead>
                <tr className="bg-[#111] text-white">
                  <th className="text-left px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase">항목</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase">사용량</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase whitespace-nowrap">Free 한도</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase">잔여량</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase">사용률</th>
                  <th className="text-center px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase">출처</th>
                </tr>
              </thead>
              <tbody>
                <UsageRow
                  label="Database Size (추정)"
                  used={formatBytes(state.dbEstimateBytes)}
                  limit="500 MB / 프로젝트"
                  remaining={formatRemaining(state.dbEstimateBytes, LIMIT_DB_BYTES, 'bytes')}
                  pct={dbPct}
                  source="실시간"
                />
                <UsageRow
                  label="Storage Size"
                  used={`${formatBytes(state.storageBytes)} (${state.storageFiles.toLocaleString('ko-KR')}개 파일)`}
                  limit="1 GB"
                  remaining={formatRemaining(state.storageBytes, LIMIT_STORAGE_BYTES, 'bytes')}
                  pct={storagePct}
                  source="실시간"
                />
                <UsageRow
                  label="Egress (uncached)"
                  used={`${REFERENCE_EGRESS_MB} MB`}
                  limit="5 GB / 월"
                  remaining={`약 ${((LIMIT_EGRESS_BYTES - REFERENCE_EGRESS_MB * 1024 * 1024) / (1024 * 1024 * 1024)).toFixed(2)} GB`}
                  pct={egressPct}
                  source={REPORT_DATE}
                />
                <UsageRow
                  label="Cached Egress"
                  used={`${REFERENCE_CACHED_EGRESS_MB} MB`}
                  limit="5 GB / 월"
                  remaining={`약 ${((LIMIT_EGRESS_BYTES - REFERENCE_CACHED_EGRESS_MB * 1024 * 1024) / (1024 * 1024 * 1024)).toFixed(2)} GB`}
                  pct={cachedEgressPct}
                  source={REPORT_DATE}
                />
                <UsageRow
                  label="Monthly Active Users"
                  used={`${REFERENCE_MAU.toLocaleString('ko-KR')} 명`}
                  limit="50,000 명"
                  remaining={`${(LIMIT_MAU - REFERENCE_MAU).toLocaleString('ko-KR')} 명`}
                  pct={mauPct}
                  source={REPORT_DATE}
                />
                <UsageRow
                  label="Edge Function Invocations"
                  used={`${REFERENCE_EDGE_INVOCATIONS.toLocaleString('ko-KR')} 회`}
                  limit="500,000 회 / 월"
                  remaining={`${(LIMIT_EDGE_INVOCATIONS - REFERENCE_EDGE_INVOCATIONS).toLocaleString('ko-KR')} 회`}
                  pct={edgePct}
                  source={REPORT_DATE}
                />
                <UsageRow
                  label="Realtime Messages"
                  used={`${REFERENCE_REALTIME_MESSAGES.toLocaleString('ko-KR')} 개`}
                  limit="2,000,000 개 / 월"
                  remaining={`약 ${(LIMIT_REALTIME_MESSAGES - REFERENCE_REALTIME_MESSAGES).toLocaleString('ko-KR')} 개`}
                  pct={rtMsgPct}
                  source={REPORT_DATE}
                />
                <UsageRow
                  label="Realtime Peak Connections"
                  used={`${REFERENCE_REALTIME_PEAK}`}
                  limit="200 동시"
                  remaining={`${LIMIT_REALTIME_PEAK - REFERENCE_REALTIME_PEAK}`}
                  pct={rtPeakPct}
                  source={REPORT_DATE}
                />
              </tbody>
            </table>
          </div>
          <div className="text-[12px] text-[#555] bg-[#fafafa] border-l-2 border-[#111] px-3.5 py-2.5 mt-4">
            ※ <strong className="text-[#111]">Database Size</strong>는 row 수 기반 추정값(테이블당 평균 크기 + 시스템 오버헤드)이며, 실제 dashboard 값과 ±10% 정도 차이 날 수 있습니다.
            Egress / MAU / Edge Function / Realtime은 클라이언트 SDK로 조회 불가능한 항목으로, <strong className="text-[#111]">{REPORT_DATE}</strong> Supabase 대시보드 확인값을 기준으로 표시됩니다.
          </div>
        </section>

        {/* Section 03 — DB Breakdown */}
        <section className="mb-11">
          <div className="text-[11px] tracking-[0.25em] font-semibold text-[#666] uppercase mb-2">Section 03</div>
          <h2 className="text-[19px] font-bold text-[#111] tracking-tight pb-3.5 border-b-2 border-[#111] mb-5">데이터베이스 테이블별 row 수</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px] border-t-[1.5px] border-b-[1.5px] border-[#111]">
              <thead>
                <tr className="bg-[#111] text-white">
                  <th className="text-left px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase">테이블</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase">Row 수</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold tracking-[0.1em] uppercase">추정 크기</th>
                </tr>
              </thead>
              <tbody>
                <BreakdownRow name="registrations" rows={state.registrations} bytes={state.registrations * AVG_BYTES_PER_REGISTRATION} />
                <BreakdownRow name="groups" rows={state.groups} bytes={state.groups * AVG_BYTES_PER_GROUP} />
                <BreakdownRow name="exam_locations" rows={state.examLocations} bytes={state.examLocations * AVG_BYTES_PER_EXAM_LOCATION} />
                <BreakdownRow name="edit_logs" rows={state.editLogs} bytes={state.editLogs * AVG_BYTES_PER_EDIT_LOG} />
                <BreakdownRow name="page_content" rows={state.pageContent} bytes={state.pageContent * AVG_BYTES_PER_PAGE_CONTENT} />
                <tr className="bg-[#fafafa] font-semibold">
                  <td className="px-4 py-3 text-[#111]">시스템 오버헤드 (auth/storage 스키마 등)</td>
                  <td className="px-4 py-3 text-right text-[#111] tabular-nums">—</td>
                  <td className="px-4 py-3 text-right text-[#111] tabular-nums">{formatBytes(POSTGRES_BASE_OVERHEAD_BYTES)}</td>
                </tr>
                <tr className="bg-[#111] text-white font-bold">
                  <td className="px-4 py-3">합계 (추정)</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {(state.registrations + state.groups + state.examLocations + state.editLogs + state.pageContent).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatBytes(state.dbEstimateBytes)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 04 — Reset cycle */}
        <section className="mb-11">
          <div className="text-[11px] tracking-[0.25em] font-semibold text-[#666] uppercase mb-2">Section 04</div>
          <h2 className="text-[19px] font-bold text-[#111] tracking-tight pb-3.5 border-b-2 border-[#111] mb-5">청구 주기 갱신({NEXT_RESET_DATE}) 영향</h2>
          <p className="text-[13.5px] text-[#444] mb-4">
            매월 28일은 <strong className="text-[#111]">월간 사용량 카운터가 리셋되는 날</strong>이며, 저장된 데이터가 삭제되는 시점이 아닙니다.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 border-[1.5px] border-[#111]">
            <div className="px-6 py-5 bg-[#fafafa] sm:border-r border-b sm:border-b-0 border-[#e5e5e5]">
              <h4 className="text-[11.5px] font-bold text-[#111] tracking-[0.18em] uppercase pb-2.5 mb-3.5 border-b border-[#ddd]">월간 카운터 리셋 항목</h4>
              <ul className="space-y-0">
                {[
                  'Egress (월 5 GB 한도) — 0 GB부터 재집계',
                  'Cached Egress — 0 GB부터 재집계',
                  'Edge Function Invocations — 0회부터 재집계',
                  'Realtime Messages — 0개부터 재집계',
                  'Monthly Active Users — 0명부터 재집계',
                ].map((t, i, arr) => (
                  <li key={i} className={`relative pl-3.5 py-1.5 text-[13px] text-[#222] ${i < arr.length - 1 ? 'border-b border-dashed border-[#e5e5e5]' : ''}`}>
                    <span className="absolute left-0 top-[15px] w-1.5 h-px bg-[#111]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-5 bg-white">
              <h4 className="text-[11.5px] font-bold text-[#111] tracking-[0.18em] uppercase pb-2.5 mb-3.5 border-b border-[#ddd]">그대로 유지되는 항목</h4>
              <ul className="space-y-0">
                {[
                  `Database 데이터 (${formatBytes(state.dbEstimateBytes)})`,
                  `Storage 파일 (${formatBytes(state.storageBytes)})`,
                  'Auth 사용자 계정 정보',
                  '모든 테이블 / 스키마 / 정책 설정',
                  '프로젝트 환경 변수 및 키',
                ].map((t, i, arr) => (
                  <li key={i} className={`relative pl-3.5 py-1.5 text-[13px] text-[#222] ${i < arr.length - 1 ? 'border-b border-dashed border-[#e5e5e5]' : ''}`}>
                    <span className="absolute left-0 top-[15px] w-1.5 h-px bg-[#111]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Section 05 — Verdict */}
        <section className="mb-0">
          <div className="text-[11px] tracking-[0.25em] font-semibold text-[#666] uppercase mb-2">Section 05</div>
          <h2 className="text-[19px] font-bold text-[#111] tracking-tight pb-3.5 border-b-2 border-[#111] mb-5">종합 진단</h2>
          <div className="border-[1.5px] border-[#111] px-7 py-6 bg-[#fafafa]">
            <span className={`inline-block px-3 py-1 text-[11px] tracking-[0.22em] font-semibold uppercase mb-3.5 ${
              dbPct.level === 'high' || storagePct.level === 'high'
                ? 'bg-[#c00] text-white'
                : 'bg-[#111] text-white'
            }`}>
              Status · {dbPct.level === 'high' || storagePct.level === 'high' ? 'Warning' : 'Stable'}
            </span>
            <h3 className="text-[17px] font-bold text-[#111] tracking-tight mb-2.5">
              현재 상태: {dbPct.level === 'high' || storagePct.level === 'high' ? '주의' : '안정'}
            </h3>
            <p className="text-[13.5px] text-[#444] leading-[1.75]">
              실시간 측정 결과 Database는 <strong className="text-[#111]">{dbPct.text}</strong>, Storage는 <strong className="text-[#111]">{storagePct.text}</strong> 사용 중입니다.
              {dbPct.level === 'high' || storagePct.level === 'high'
                ? ' 한도 50%를 초과한 항목이 있습니다. 데이터/파일 정리 또는 유료 플랜 전환을 검토하세요.'
                : ' Free Plan 한도 대비 안정적인 운영 범위 내에 있습니다.'}
            </p>
          </div>
        </section>

      </div>

      {/* Footer */}
      <div className="bg-[#111] text-[#c8c8c8] px-8 sm:px-14 py-5 text-[11.5px] tracking-[0.05em] flex justify-between flex-wrap gap-2">
        <span className="font-semibold text-white tracking-[0.08em] uppercase">전국지리교사연합회 · 전국지리올림피아드 운영팀</span>
        <span>실시간 측정: {state.measuredAt || '-'} · 출처 Supabase JS Client + 대시보드</span>
      </div>
    </div>
  );
}

function UsageRow({
  label, used, limit, remaining, pct, source,
}: {
  label: string;
  used: string;
  limit: string;
  remaining: string;
  pct: { text: string; level: 'zero' | 'low' | 'mid' | 'high' };
  source: string;
}) {
  return (
    <tr className="hover:bg-[#fafafa]">
      <td className="px-4 py-3 border-b border-[#e5e5e5] font-semibold text-[#111]">{label}</td>
      <td className="px-4 py-3 border-b border-[#e5e5e5] text-right tabular-nums text-[#111]">{used}</td>
      <td className="px-4 py-3 border-b border-[#e5e5e5] text-right tabular-nums text-[#444]">{limit}</td>
      <td className="px-4 py-3 border-b border-[#e5e5e5] text-right tabular-nums text-[#444]">{remaining}</td>
      <td className="px-4 py-3 border-b border-[#e5e5e5] text-right">
        <span className={`inline-block px-2.5 py-0.5 border text-[11.5px] font-semibold ${PCT_CLASS[pct.level]}`}>{pct.text}</span>
      </td>
      <td className="px-4 py-3 border-b border-[#e5e5e5] text-center text-[11.5px] text-[#666] whitespace-nowrap">{source}</td>
    </tr>
  );
}

function BreakdownRow({ name, rows, bytes }: { name: string; rows: number; bytes: number }) {
  return (
    <tr className="hover:bg-[#fafafa]">
      <td className="px-4 py-3 border-b border-[#e5e5e5] font-mono text-[13px] text-[#111]">{name}</td>
      <td className="px-4 py-3 border-b border-[#e5e5e5] text-right tabular-nums text-[#111]">{rows.toLocaleString('ko-KR')}</td>
      <td className="px-4 py-3 border-b border-[#e5e5e5] text-right tabular-nums text-[#444]">{formatBytes(bytes)}</td>
    </tr>
  );
}
