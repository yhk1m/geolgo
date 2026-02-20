'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: '대회 안내' },
  { href: '/register/individual', label: '개인 접수' },
  { href: '/register/group', label: '단체 접수' },
  { href: '/check', label: '접수 확인' },
  { href: '/stats', label: '지역별 현황' },
];

export default function Navigation() {
  const pathname = usePathname();

  // 관리자 페이지에서는 별도 네비게이션 사용
  if (pathname?.startsWith('/admin')) return null;

  return (
    <header className="border-b border-[#e5e5e5] bg-white sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-baseline gap-1.5 tracking-tight text-[#111]">
          <span className="text-lg font-bold">Geolgo</span>
          <span className="text-[14px] font-normal text-[#999]">전국지리올림피아드 신청 시스템</span>
        </Link>
        <nav className="flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'bg-[#111] text-white'
                  : 'text-[#555] hover:text-[#111] hover:bg-[#f5f5f5]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
