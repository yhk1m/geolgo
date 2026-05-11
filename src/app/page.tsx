// © 2026 김용현
import Link from 'next/link';
import { fetchPageContent } from '@/lib/pageContent';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const content = await fetchPageContent();

  const regions = content.contact.regions;
  const rows: { region: string; email: string }[][] = [];
  for (let i = 0; i < regions.length; i += 3) {
    rows.push(regions.slice(i, i + 3));
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Hero Section */}
      <section className="text-center mb-14 sm:mb-20">
        <p className="text-sm font-medium tracking-widest text-[#999] uppercase mb-4">
          {content.hero.year}
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#111] mb-4">
          {content.hero.title}
        </h1>
        <p className="text-base sm:text-lg text-[#666] mb-8 sm:mb-10">
          {content.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <Link href="/register/individual" className="btn btn-primary text-base px-8 py-3">
            참가 신청하기
          </Link>
          <Link href="/check" className="btn btn-secondary text-base px-8 py-3">
            접수 확인
          </Link>
          {content.announcementImageUrl && (
            <a
              href="/2026 제26회 전국지리올림피아드.pdf"
              target="_blank"
              rel="noopener noreferrer"
              download
              className="btn btn-secondary text-base px-8 py-3"
            >
              대회 안내 포스터 저장
            </a>
          )}
        </div>
      </section>

      {/* 일정 안내 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 sm:mb-8 text-[#111]">대회 일정</h2>
        <div className="grid gap-3 sm:gap-4">
          {content.registrationPeriod?.startDate && content.registrationPeriod?.endDate && (() => {
            const s = content.registrationPeriod!.startDate;
            const e = content.registrationPeriod!.endDate;
            const fmt = (d: string) => {
              const [y, m, day] = d.split('-');
              const dt = new Date(Number(y), Number(m) - 1, Number(day));
              const weekday = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
              return `${y}. ${Number(m)}. ${Number(day)}.(${weekday})`;
            };
            return (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 p-4 sm:p-5 rounded-lg border-2 border-[#111] bg-white transition-all duration-200 hover:bg-[#111] hover:text-white group cursor-default">
                <span className="text-xs sm:text-sm font-bold sm:w-24 shrink-0 text-[#111] group-hover:text-[#ccc]">참가 신청</span>
                <span className="font-medium text-sm sm:text-base">{fmt(s)} ~ {fmt(e)}</span>
                <span className="text-xs sm:text-sm sm:ml-auto text-[#999] group-hover:text-[#aaa]">개인 접수 또는 단체 접수에서 신청</span>
              </div>
            );
          })()}
          {content.schedule.items.map((item, i) => (
            <div
              key={i}
              className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-6 p-4 sm:p-5 rounded-lg border-[1.5px] border-[#c8c8c8] bg-white transition-all duration-200 hover:bg-[#111] hover:border-[#111] hover:text-white group cursor-default"
            >
              <span className="text-xs sm:text-sm font-semibold sm:w-24 shrink-0 text-[#999] group-hover:text-[#ccc]">
                {item.period}
              </span>
              <span className="font-medium text-sm sm:text-base">{item.date}</span>
              <span className="text-xs sm:text-sm sm:ml-auto text-[#999] group-hover:text-[#aaa]">
                {item.note}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#999] mt-3">
          {content.schedule.footnote}
        </p>
      </section>

      {/* 대회 요강 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 sm:mb-8 text-[#111]">대회 요강</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {content.info.items.map((item, i) => (
            <div key={i} className="p-5 sm:p-6 rounded-lg border-[1.5px] border-[#c8c8c8] bg-[#fafafa] transition-all duration-200 hover:bg-[#111] hover:border-[#111] hover:text-white group cursor-default">
              <h3 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-3 group-hover:text-[#ccc]">
                {item.label}
              </h3>
              <p className="text-[#111] whitespace-pre-line leading-relaxed text-sm sm:text-base group-hover:text-white">
                {item.value}
              </p>
            </div>
          ))}
        </div>
        <p className="text-xs text-[#999] mt-4">
          {content.info.footnote}
        </p>
      </section>

      {/* 문의처 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 sm:mb-8 text-[#111]">문의처</h2>
        <div className="p-4 sm:p-6 rounded-lg border-[1.5px] border-[#c8c8c8] bg-[#fafafa] space-y-3 text-sm">
          {content.contact.general.map((item, i) => (
            <div key={i} className="flex flex-col sm:flex-row gap-1 sm:gap-4">
              <span className="text-[#999] sm:w-40 shrink-0">{item.label}</span>
              <span>{item.value}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 rounded-lg border-[1.5px] border-[#c8c8c8] overflow-hidden">
          {/* 모바일: 1열 리스트 (지역 → 이메일 세로 배치) */}
          <div className="sm:hidden">
            <div className="bg-[#111] text-white px-4 py-2 text-sm font-medium flex justify-between">
              <span>지역</span>
              <span>담당자 이메일</span>
            </div>
            {regions.map((r, i) => (
              <div key={i} className={`flex justify-between items-center px-4 py-2.5 text-sm ${i % 2 === 1 ? 'bg-[#f7f7f7]' : 'bg-white'}`}>
                <span className="font-medium text-[#111] whitespace-nowrap">{r.region}</span>
                <span className="text-[#666] text-xs">{r.email}</span>
              </div>
            ))}
          </div>
          {/* 데스크톱: 6열 테이블 */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr className="bg-[#111] text-white">
                <th className="px-4 py-2 text-left font-medium border-b-0 whitespace-nowrap">지역</th>
                <th className="px-4 py-2 text-left font-medium border-b-0 whitespace-nowrap">담당자 이메일</th>
                <th className="px-4 py-2 text-left font-medium border-b-0 whitespace-nowrap">지역</th>
                <th className="px-4 py-2 text-left font-medium border-b-0 whitespace-nowrap">담당자 이메일</th>
                <th className="px-4 py-2 text-left font-medium border-b-0 whitespace-nowrap">지역</th>
                <th className="px-4 py-2 text-left font-medium border-b-0 whitespace-nowrap">담당자 이메일</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-[#f7f7f7]' : 'bg-white'}>
                  {[0, 1, 2].map(j => (
                    <>
                      <td key={`${i}-r${j}`} className="px-4 py-2 font-medium text-[#111] whitespace-nowrap">{row[j]?.region || ''}</td>
                      <td key={`${i}-e${j}`} className="px-4 py-2 text-[#666]">{row[j]?.email || ''}</td>
                    </>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
