import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-16">
      {/* Hero Section */}
      <section className="text-center mb-14 sm:mb-20">
        <p className="text-sm font-medium tracking-widest text-[#999] uppercase mb-4">
          2026년
        </p>
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-[#111] mb-4">
          제26회 전국지리올림피아드
        </h1>
        <p className="text-base sm:text-lg text-[#666] mb-8 sm:mb-10">
          대한지리학회 · 국토연구원 주최 | 전국지리교사연합회 주관
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
          <Link href="/register/individual" className="btn btn-primary text-base px-8 py-3">
            참가 신청하기
          </Link>
          <Link href="/check" className="btn btn-secondary text-base px-8 py-3">
            접수 확인
          </Link>
        </div>
      </section>

      {/* 일정 안내 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 sm:mb-8 text-[#111]">대회 일정</h2>
        <div className="grid gap-3 sm:gap-4">
          {[
            { period: '참가 신청', date: '2026. 4. 27.(월) ~ 5. 16.(토)', note: '참가등록페이지에서 신청' },
            { period: '대회', date: '2026. 5. 23.(토) 14:00 ~ 15:30', note: '선택형 및 서술형 시험 · 지역 시험장' },
            { period: '결과 발표', date: '2026. 6. 11.(목)', note: '전국지리교사연합회 · 대한지리학회 홈페이지' },
            { period: '시상식', date: '2026. 7. 11.(토)', note: '전국 부문 입상자 (서울대학교 예정)' },
          ].map((item, i) => (
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
          * 위 일정은 대회 사정에 따라 변경될 수 있습니다.
        </p>
      </section>

      {/* 대회 요강 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 sm:mb-8 text-[#111]">대회 요강</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {[
            { label: '대회 방식', value: '선택형 27문항, 서술형 3세트' },
            { label: '참가 자격', value: '고등학교 재학생 중 희망 학생\n학교별 참가인원 제한 없음' },
            { label: '참가비', value: '20,000원\n(사)대한지리학회\n국민은행 477401-01-176602' },
            { label: '접수 방법', value: '본 사이트에서 참가신청서 제출\n참가비 입금 시 소속 고등학교와\n본인 이름으로 입금 (○○고 김○○)' },
          ].map((item, i) => (
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
          * 접수 기간 내에 신청서 제출과 참가비 납부 모두 완료한 건에 한해서만 등록 유효
        </p>
      </section>

      {/* 문의처 */}
      <section className="mb-16">
        <h2 className="text-2xl font-bold mb-6 sm:mb-8 text-[#111]">문의처</h2>
        <div className="p-4 sm:p-6 rounded-lg border-[1.5px] border-[#c8c8c8] bg-[#fafafa] space-y-3 text-sm">
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
            <span className="text-[#999] sm:w-40 shrink-0">접수 및 참가비 관련</span>
            <span>전국지리교사연합회 총무 (ilovejos@korea.kr)</span>
          </div>
          <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
            <span className="text-[#999] sm:w-40 shrink-0">대회 장소 관련</span>
            <span>각 지역 지리올림피아드 담당자</span>
          </div>
        </div>

        <div className="mt-6 rounded-lg border-[1.5px] border-[#c8c8c8] overflow-hidden overflow-x-auto">
          {/* 모바일: 2열 리스트 */}
          <div className="sm:hidden">
            {[
              ['서울', 'rokmc807@gmail.com'],
              ['인천', 'rokmc807@gmail.com'],
              ['경기', 'ilovejos@korea.kr'],
              ['강원', 'sky89526@naver.com'],
              ['충북', 'geolee0401@korea.kr'],
              ['충남', 'swf9519@ai.cne.go.kr'],
              ['광주', 'christin092@gmail.com'],
              ['전남', 'yatmotakeshi@naver.com'],
              ['대구', 'obiwan@yeungnam.ms.kr'],
              ['경북', 'chui5222@naver.com'],
              ['대전', 'loverlckd@naver.com'],
              ['세종', 'xodn0109@naver.com'],
              ['부산', 'narayou1@naver.com'],
              ['울산', 'geoedtr@gmail.com'],
              ['경남', 'geo9835@naver.com'],
              ['전북', 'ikarroce@hanmail.net'],
              ['제주', 'gtow@naver.com'],
            ].map(([region, email], i) => (
              <div key={i} className={`flex justify-between px-4 py-2.5 text-sm ${i % 2 === 1 ? 'bg-[#f7f7f7]' : 'bg-white'}`}>
                <span className="font-medium text-[#111]">{region}</span>
                <span className="text-[#666] text-xs">{email}</span>
              </div>
            ))}
          </div>
          {/* 데스크톱: 6열 테이블 */}
          <table className="hidden sm:table w-full text-sm">
            <thead>
              <tr className="bg-[#111] text-white">
                <th className="px-4 py-2 text-left font-medium border-b-0">지역</th>
                <th className="px-4 py-2 text-left font-medium border-b-0">담당자 이메일</th>
                <th className="px-4 py-2 text-left font-medium border-b-0">지역</th>
                <th className="px-4 py-2 text-left font-medium border-b-0">담당자 이메일</th>
                <th className="px-4 py-2 text-left font-medium border-b-0">지역</th>
                <th className="px-4 py-2 text-left font-medium border-b-0">담당자 이메일</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['서울', 'rokmc807@gmail.com', '광주', 'christin092@gmail.com', '부산', 'narayou1@naver.com'],
                ['인천', 'rokmc807@gmail.com', '전남', 'yatmotakeshi@naver.com', '울산', 'geoedtr@gmail.com'],
                ['경기', 'ilovejos@korea.kr', '대구', 'obiwan@yeungnam.ms.kr', '경남', 'geo9835@naver.com'],
                ['강원', 'sky89526@naver.com', '경북', 'chui5222@naver.com', '전북', 'ikarroce@hanmail.net'],
                ['충북', 'geolee0401@korea.kr', '대전', 'loverlckd@naver.com', '제주', 'gtow@naver.com'],
                ['충남', 'swf9519@ai.cne.go.kr', '세종', 'xodn0109@naver.com', '', ''],
              ].map((row, i) => (
                <tr key={i} className={i % 2 === 1 ? 'bg-[#f7f7f7]' : 'bg-white'}>
                  <td className="px-4 py-2 font-medium text-[#111]">{row[0]}</td>
                  <td className="px-4 py-2 text-[#666]">{row[1]}</td>
                  <td className="px-4 py-2 font-medium text-[#111]">{row[2]}</td>
                  <td className="px-4 py-2 text-[#666]">{row[3]}</td>
                  <td className="px-4 py-2 font-medium text-[#111]">{row[4]}</td>
                  <td className="px-4 py-2 text-[#666]">{row[5]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
