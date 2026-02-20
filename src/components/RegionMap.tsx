'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import * as echarts from 'echarts';
import { regionNameMap, regionStudentsMap } from '@/lib/regions';

interface RegionData {
  name: string;
  value: number;
}

interface RegionMapProps {
  data: RegionData[];
}

export default function RegionMap({ data }: RegionMapProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [viewMode, setViewMode] = useState<'map-count' | 'map-rate' | 'bar'>('map-count');
  const [geoLoaded, setGeoLoaded] = useState(false);

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

  // 차트 옵션 적용
  useEffect(() => {
    if (!chartInstance.current || !geoLoaded) return;

    const maxCount = Math.max(...sortedData.map(d => d.value), 1);
    const maxRate = Math.max(...rateData.map(d => d.value), 1);

    const mapBaseConfig = {
      roam: true,
      map: 'Korea',
      nameProperty: 'name',
      label: {
        show: true,
        formatter: (params: unknown) => {
          const p = params as { name: string };
          return regionNameMap[p.name] || p.name;
        },
        fontSize: 10,
        color: '#666',
      },
      itemStyle: {
        borderColor: '#fff',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: { areaColor: '#333' },
        label: { color: '#fff' },
      },
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
        left: 'right',
        min: 0,
        max: maxCount,
        inRange: {
          color: ['#f5f5f5', '#d9d9d9', '#bfbfbf', '#999999', '#737373', '#4d4d4d', '#1a1a1a'],
        },
        text: ['많음', '적음'],
        textStyle: { color: '#666' },
        calculable: true,
      },
      series: [
        {
          ...mapBaseConfig,
          id: 'region-stat',
          type: 'map',
          animationDurationUpdate: 1000,
          universalTransition: true,
          data: sortedData,
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
        left: 'right',
        min: 0,
        max: maxRate,
        inRange: {
          color: ['#f5f5f5', '#d9d9d9', '#bfbfbf', '#999999', '#737373', '#4d4d4d', '#1a1a1a'],
        },
        text: ['높음', '낮음'],
        textStyle: { color: '#666' },
        calculable: true,
      },
      series: [
        {
          ...mapBaseConfig,
          id: 'region-stat',
          type: 'map',
          animationDurationUpdate: 1000,
          universalTransition: true,
          data: rateData,
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

    // 차트 완전 초기화 후 새 옵션 적용
    chartInstance.current.clear();
    chartInstance.current.setOption(options[viewMode]);
  }, [viewMode, geoLoaded, sortedData, rateData]);

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

      <div
        ref={chartRef}
        style={{ width: '100%', height: viewMode === 'bar' ? '600px' : '500px' }}
      />
    </div>
  );
}
