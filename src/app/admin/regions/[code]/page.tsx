// © 2026 김용현
'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ParticipantManager from '@/components/ParticipantManager';
import { REGIONS, regionNameMap } from '@/lib/regions';

export default function RegionDetailPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const [readOnly, setReadOnly] = useState(false);

  useEffect(() => {
    setReadOnly(sessionStorage.getItem('admin_role') === 'viewer');
  }, []);

  const valid = REGIONS.some(r => r.nameEn === code);
  if (!valid) notFound();

  const regionKo = regionNameMap[code] || code;

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <Link
          href="/admin/regions"
          className="inline-flex items-center gap-1 text-sm text-[#666] hover:text-[#111]"
        >
          <span aria-hidden>←</span> 지역 선택
        </Link>
        <span className="text-[#ccc]">/</span>
        <h1 className="text-lg font-bold text-[#111]">{regionKo}</h1>
      </div>
      <ParticipantManager regionFilter={code} readOnly={readOnly} />
    </div>
  );
}
