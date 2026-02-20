'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const adminNav = [
  { href: '/admin/dashboard', label: '대시보드' },
  { href: '/admin/payments', label: '참가자 관리' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_auth');
    if (saved === 'true') setAuthenticated(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple password check - in production, use proper auth
    if (password === 'admin1234') {
      setAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <form onSubmit={handleLogin} className="w-80 p-8 bg-white rounded-lg border border-[#e5e5e5]">
          <h1 className="text-xl font-bold mb-6 text-[#111] text-center">관리자 로그인</h1>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="mb-4"
          />
          <button type="submit" className="btn btn-primary w-full py-2.5">
            로그인
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="bg-[#111] text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/admin/dashboard" className="flex items-baseline gap-1.5 tracking-tight">
              <span className="font-bold">지올고(geolgo)</span>
              <span className="text-[13px] font-normal text-[#888]">관리자</span>
            </Link>
            <nav className="flex items-center gap-1">
              {adminNav.map(item => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded text-sm transition-colors ${
                    pathname === item.href
                      ? 'bg-white/20 text-white'
                      : 'text-[#999] hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-xs text-[#666] hover:text-white">
              사이트로 이동
            </Link>
            <button
              onClick={() => {
                sessionStorage.removeItem('admin_auth');
                setAuthenticated(false);
              }}
              className="text-xs text-[#666] hover:text-white"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  );
}
