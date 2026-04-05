'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const adminNav = [
  { href: '/admin/dashboard', label: '대시보드' },
  { href: '/admin/payments', label: '참가자 관리' },
  { href: '/admin/content', label: '대회 안내 관리' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_auth');
    if (saved === 'true') setAuthenticated(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'admin0220') {
      setAuthenticated(true);
      sessionStorage.setItem('admin_auth', 'true');
    } else {
      alert('비밀번호가 올바르지 않습니다.');
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] px-4">
        <form onSubmit={handleLogin} className="w-full max-w-xs p-8 bg-white rounded-lg border border-[#e5e5e5]">
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
    <div className="min-h-screen bg-[#fafafa] flex flex-col">
      <header className="bg-[#111] text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <Link href="/admin/dashboard" className="flex items-center gap-1.5 tracking-tight">
              <img src="/favicon.svg" alt="" className="w-6 h-6 invert" />
              <span className="font-bold">Unigeo</span>
              <span className="text-[13px] font-normal text-[#888]">관리자</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-1">
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
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/" className="hidden sm:inline text-xs text-[#666] hover:text-white">
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
            <button
              className="sm:hidden p-1 text-[#999] hover:text-white"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="메뉴"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {menuOpen ? (
                  <path d="M6 6l12 12M6 18L18 6" />
                ) : (
                  <path d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="sm:hidden border-t border-white/10 px-4 pb-3 pt-1">
            {adminNav.map(item => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2 rounded text-sm transition-colors ${
                  pathname === item.href
                    ? 'bg-white/20 text-white'
                    : 'text-[#999] hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="block px-3 py-2 rounded text-sm text-[#999] hover:text-white"
            >
              사이트로 이동
            </Link>
          </nav>
        )}
      </header>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-8 flex-1">
        {children}
      </div>
    </div>
  );
}
