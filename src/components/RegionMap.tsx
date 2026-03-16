'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as echarts from 'echarts';
import { regionNameMap, regionStudentsMap } from '@/lib/regions';

interface RegionData {
  name: string;
  value: number;
}

interface RegionMapProps {
  data: RegionData[];
  onRegionClick?: (regionName: string | null) => void;
}

const QUANTILE_COLORS = ['#f0f0f0', '#cccccc', '#888888', '#444444', '#000000'];

function makeQuantilePieces(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const numClasses = QUANTILE_COLORS.length;
  const breaks: number[] = [];
  for (let i = 1; i < numClasses; i++) {
    const idx = Math.round((i / numClasses) * n) - 1;
    breaks.push(sorted[Math.min(idx, n - 1)]);
  }

  // 중복 경계를 제거하여 실제 구분되는 구간만 추출
  const rawPieces: { min: number; max: number }[] = [];
  for (let i = 0; i < numClasses; i++) {
    const min = i === 0 ? 0 : breaks[i - 1];
    const max = i === numClasses - 1 ? sorted[n - 1] + 1 : breaks[i];
    if (rawPieces.length > 0 && rawPieces[rawPieces.length - 1].max === max) continue;
    rawPieces.push({ min: rawPieces.length === 0 ? 0 : rawPieces[rawPieces.length - 1].max, max });
  }

  // 실제 구간 수에 맞춰 색상을 1~5단계에서 골고루 분배
  // 예: 2구간 → 1,5단계 / 3구간 → 1,3,5단계 / 4구간 → 1,2,4,5단계
  const distinctCount = rawPieces.length;
  const pieces = rawPieces.map((p, i) => {
    const colorIdx = distinctCount === 1 ? 0
      : Math.round(i * (numClasses - 1) / (distinctCount - 1));
    return {
      min: p.min,
      max: p.max,
      color: QUANTILE_COLORS[colorIdx],
      label: i === 0 ? `${p.max} 이하`
        : i === distinctCount - 1 ? `${p.min} 이상`
        : `${p.min} ~ ${p.max}`,
    };
  });
  return pieces;
}

export default function RegionMap({ data, onRegionClick }: RegionMapProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [viewMode, setViewMode] = useState<'map-count' | 'map-rate' | 'bar'>('map-count');
  const [geoLoaded, setGeoLoaded] = useState(false);
  const [scaleBar, setScaleBar] = useState({ width: 60, label: '100 km' });

  const sortedData = useMemo(
    () => [...data].sort((a, b) => a.value - b.value),
    [data]
  );

  const rateData = useMemo(
    () =>
      sortedData.map(d => ({
        name: d.name,
        value: parseFloat(((d.value / (regionStudentsMap[d.name] || 1)) * 10000).toFixed(2)),
      })),
    [sortedData]
  );

  const updateScaleBar = useCallback(() => {
    const chart = chartInstance.current;
    if (!chart) return;

    try {
      const p1 = chart.convertToPixel({ seriesIndex: 0 }, [127, 36]);
      const p2 = chart.convertToPixel({ seriesIndex: 0 }, [128, 36]);
      if (!p1 || !p2) return;

      const pixelPerDegree = Math.abs(p2[0] - p1[0]);
      const kmPerPixel = 90 / pixelPerDegree;

      const targetKm = kmPerPixel * 80;
      const niceNumbers = [5, 10, 20, 50, 100, 200, 500];
      const niceKm = niceNumbers.reduce((prev, curr) =>
        Math.abs(curr - targetKm) < Math.abs(prev - targetKm) ? curr : prev
      );

      const barWidth = Math.round(niceKm / kmPerPixel);
      setScaleBar({ width: barWidth, label: `${niceKm} km` });
    } catch {
      // ignore
    }
  }, []);

  // 초기화 & GeoJSON 로드
  useEffect(() => {
    if (!chartRef.current) return;

    chartInstance.current = echarts.init(chartRef.current);

    fetch('/geo/korea_sido_final.geojson')
      .then(res => res.json())
      .then(geoJson => {
        echarts.registerMap('Korea', geoJson);
        setGeoLoaded(true);
      });

    const handleResize = () => chartInstance.current?.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chartInstance.current?.dispose();
    };
  }, []);

  // 메인 차트 옵션 적용
  useEffect(() => {
    if (!chartInstance.current || !geoLoaded) return;

    const chart = chartInstance.current;

    const graticuleMarkLine = {
      silent: true,
      symbol: 'none',
      lineStyle: { type: 'dashed' as const, color: 'rgba(0,0,0,0.12)', width: 0.8 },
      label: { show: true, fontSize: 9, color: '#aaa', position: 'start' as const },
      data: [
        [{ name: '34°N', coord: [123, 34] }, { coord: [133, 34] }],
        [{ name: '36°N', coord: [123, 36] }, { coord: [133, 36] }],
        [{ name: '38°N', coord: [123, 38] }, { coord: [133, 38] }],
        [{ name: '126°E', coord: [126, 32] }, { coord: [126, 40] }],
        [{ name: '128°E', coord: [128, 32] }, { coord: [128, 40] }],
        [{ name: '130°E', coord: [130, 32] }, { coord: [130, 40] }],
      ],
    };

    const mapBaseConfig = {
      roam: true,
      map: 'Korea',
      nameProperty: 'name',
      label: {
        show: false,
      },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: { areaColor: '#333' },
        label: {
          show: true,
          color: '#fff',
          formatter: (params: unknown) => {
            const p = params as { name: string };
            return regionNameMap[p.name] || p.name;
          },
        },
      },
      select: {
        itemStyle: { areaColor: '#facc15' },
        label: {
          show: true,
          color: '#111',
          formatter: (params: unknown) => {
            const p = params as { name: string };
            return regionNameMap[p.name] || p.name;
          },
        },
      },
      selectedMode: 'single' as const,
      markLine: graticuleMarkLine,
    };

    const makeDokdoMarkPoint = (tooltipText: string) => ({
      symbol: 'circle',
      symbolSize: 6,
      itemStyle: { color: '#555', borderColor: '#fff', borderWidth: 1 },
      emphasis: {
        itemStyle: { color: '#333', borderColor: '#fff', borderWidth: 2 },
        label: { color: '#fff', fontSize: 10, fontWeight: 'bold' as const },
      },
      tooltip: { formatter: () => tooltipText },
      data: [
        {
          coord: [131.87, 37.24],
          label: {
            show: true,
            formatter: '독도',
            fontSize: 9,
            color: '#333',
            position: 'right' as const,
            distance: 4,
          },
        },
      ],
    });

    const countPieces = makeQuantilePieces(sortedData.map(d => d.value));
    const ratePieces = makeQuantilePieces(rateData.map(d => d.value));

    // 1~2단계는 짙은 테두리, 3~5단계는 옅은 테두리
    const LIGHT_COLORS = new Set([QUANTILE_COLORS[0], QUANTILE_COLORS[1]]);
    function addBorderStyle(
      dataList: { name: string; value: number }[],
      pieces: { min: number; max: number; color: string }[],
    ) {
      return dataList.map(d => {
        const piece = pieces.find(p => d.value >= p.min && d.value < p.max);
        const isLight = piece && LIGHT_COLORS.has(piece.color);
        return {
          ...d,
          itemStyle: isLight
            ? { borderColor: '#999', borderWidth: 1 }
            : { borderColor: '#fff', borderWidth: 1 },
        };
      });
    }

    const visualMapBase = {
      type: 'piecewise' as const,
      right: 10,
      bottom: 50,
      textStyle: { color: '#666', fontSize: 11 },
      selectedMode: false as const,
    };

    const mapCountOption: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number };
          const koName = regionNameMap[p.name] || p.name;
          return `<strong>${koName}</strong><br/>신청자: ${p.value || 0}명`;
        },
      },
      visualMap: {
        ...visualMapBase,
        pieces: countPieces,
        text: ['많음', '적음'],
      },
      series: [
        {
          ...mapBaseConfig,
          id: 'region-stat',
          type: 'map',
          animationDurationUpdate: 1000,
          universalTransition: true,
          data: addBorderStyle(sortedData, countPieces),
          markPoint: makeDokdoMarkPoint(
            `<strong>경상북도</strong><br/>신청자: ${sortedData.find(d => d.name === 'Gyeongsangbuk-do')?.value || 0}명`
          ),
        },
      ],
    };

    const mapRateOption: echarts.EChartsOption = {
      tooltip: {
        trigger: 'item',
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number };
          const koName = regionNameMap[p.name] || p.name;
          return `<strong>${koName}</strong><br/>만명당 신청률: ${p.value || 0}명`;
        },
      },
      visualMap: {
        ...visualMapBase,
        pieces: ratePieces,
        text: ['높음', '낮음'],
      },
      series: [
        {
          ...mapBaseConfig,
          id: 'region-stat',
          type: 'map',
          animationDurationUpdate: 1000,
          universalTransition: true,
          data: addBorderStyle(rateData, ratePieces),
          markPoint: makeDokdoMarkPoint(
            `<strong>경상북도</strong><br/>만명당 신청률: ${rateData.find(d => d.name === 'Gyeongsangbuk-do')?.value || 0}명`
          ),
        },
      ],
    };

    const barOption: echarts.EChartsOption = {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: unknown) => {
          const p = (params as { name: string; value: number }[])[0];
          const koName = regionNameMap[p.name] || p.name;
          return `<strong>${koName}</strong><br/>신청자: ${p.value}명`;
        },
      },
      visualMap: undefined,
      grid: {
        left: '3%',
        right: '10%',
        top: '3%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'value',
        axisLine: { lineStyle: { color: '#e5e5e5' } },
        axisLabel: { color: '#999' },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      yAxis: {
        type: 'category',
        data: sortedData.map(d => d.name),
        axisLine: { lineStyle: { color: '#e5e5e5' } },
        axisLabel: {
          color: '#333',
          formatter: (value: string) => regionNameMap[value] || value,
        },
      },
      series: {
        type: 'bar',
        id: 'region-stat',
        data: sortedData.map(d => d.value),
        universalTransition: true,
        animationDurationUpdate: 1000,
        itemStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#999' },
            { offset: 1, color: '#1a1a1a' },
          ]),
          borderRadius: [0, 3, 3, 0],
        },
        label: {
          show: true,
          position: 'right',
          formatter: '{c}명',
          fontSize: 11,
          color: '#666',
        },
      },
    };

    const options = {
      'map-count': mapCountOption,
      'map-rate': mapRateOption,
      'bar': barOption,
    };

    chart.clear();
    chart.setOption(options[viewMode]);

    if (viewMode !== 'bar') {
      setTimeout(updateScaleBar, 100);
      chart.on('georoam', updateScaleBar);
    }

    if (onRegionClick && viewMode !== 'bar') {
      chart.on('selectchanged', (params: unknown) => {
        const p = params as { fromAction: string; selected: { dataIndex: number[] }[] };
        const selectedIndices = p.selected?.[0]?.dataIndex || [];
        if (selectedIndices.length > 0) {
          const idx = selectedIndices[0];
          const currentData = viewMode === 'map-rate' ? rateData : sortedData;
          onRegionClick(currentData[idx]?.name || null);
        } else {
          onRegionClick(null);
        }
      });
    }

    return () => {
      chart.off('georoam');
      chart.off('selectchanged');
    };
  }, [viewMode, geoLoaded, sortedData, rateData, updateScaleBar, onRegionClick]);

  return (
    <div>
      <div className="flex justify-center gap-2 mb-6">
        {[
          { key: 'map-count' as const, label: '지도 (신청자 수)' },
          { key: 'map-rate' as const, label: '지도 (만명당 신청률)' },
          { key: 'bar' as const, label: '막대 그래프' },
        ].map(btn => (
          <button
            key={btn.key}
            onClick={() => setViewMode(btn.key)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === btn.key
                ? 'bg-[#111] text-white'
                : 'bg-white text-[#666] border border-[#e5e5e5] hover:bg-[#f5f5f5]'
            }`}
          >
            {btn.label}
          </button>
        ))}
      </div>

      <div className="relative">
        <div
          ref={chartRef}
          style={{ width: '100%', height: viewMode === 'bar' ? '600px' : '500px' }}
        />
        {viewMode !== 'bar' && (
          <>
            {/* 방위표 (North Arrow) */}
            <div className="absolute top-3 left-3 flex flex-col items-center bg-white/80 rounded px-2 py-1.5 border border-[#ddd]">
              <span className="text-[11px] font-bold text-[#333] leading-none">N</span>
              <svg width="14" height="24" viewBox="0 0 14 24" className="mt-0.5">
                <polygon points="7,0 3,10 7,8 11,10" fill="#333" />
                <polygon points="7,8 3,10 7,24 11,10" fill="#aaa" stroke="#999" strokeWidth="0.5" />
              </svg>
            </div>

            {/* 축척 (Scale Bar) */}
            <div className="absolute right-2 bottom-3 bg-white/80 rounded px-2 py-1.5 border border-[#ddd]">
              <div className="flex items-end gap-0">
                <div
                  className="h-[4px] bg-[#333]"
                  style={{
                    width: `${scaleBar.width}px`,
                    borderLeft: '1px solid #333',
                    borderRight: '1px solid #333',
                  }}
                />
              </div>
              <span className="text-[10px] text-[#666] mt-0.5 block text-center">{scaleBar.label}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
