export default function Footer() {
  return (
    <footer className="bg-[#f0f0f0] border-t border-[#e5e5e5] mt-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 sm:gap-8">
          {/* 주최/주관 */}
          <div className="space-y-2.5 sm:space-y-3 shrink-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-semibold text-[#444] shrink-0 border-l-2 border-r-2 border-[#444] px-2 text-sm sm:text-base">주최</span>
              <div className="flex items-center gap-2 sm:gap-3">
                <img src="/KGEO.png" alt="KGEO" className="h-8 sm:h-[43px] object-contain" />
                <img src="/KRIHS.svg" alt="KRIHS 국토연구원" className="h-8 sm:h-[43px] object-contain" />
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <span className="font-semibold text-[#444] shrink-0 border-l-2 border-r-2 border-[#444] px-2 text-sm sm:text-base">주관</span>
              <div className="flex items-center gap-2 sm:gap-3">
                <img src="/UNIGEO.png" alt="UNIGEO" className="h-8 sm:h-[43px] object-contain" />
                <span className="font-bold text-[#444] text-[15px] sm:text-[20px]">지리올림피아드특별위원회</span>
              </div>
            </div>
            {/* 모바일: 문의/저작권을 주최·주관 아래에 표시 */}
            <div className="sm:hidden text-left text-xs text-[#666] space-y-1 pt-2 border-t border-[#ddd] mt-1">
              <div className="space-y-0.5">
                <p><span className="whitespace-nowrap">접수 및 시험 문의</span> <a href="mailto:ilovejos@korea.kr" className="underline hover:text-[#333] font-bold">ilovejos@korea.kr</a></p>
                <p><span className="whitespace-nowrap">신청 시스템 문의</span> <a href="mailto:bgnlkim@gmail.com" className="underline hover:text-[#333] font-bold">bgnlkim@gmail.com</a></p>
              </div>
              <div className="h-1.5" />
              <p>Copyright 2026. 전국지리교사연합회. All Right Reserved.</p>
              <p>Powered by 양정고등학교 김용현</p>
            </div>
          </div>
          {/* PC: 문의/저작권을 오른쪽에 표시 */}
          <div className="hidden sm:block text-left text-sm text-[#666] space-y-1 pt-1">
            <div className="space-y-0.5">
              <p><span className="whitespace-nowrap">접수 및 시험 문의</span> <a href="mailto:ilovejos@korea.kr" className="underline hover:text-[#333] font-bold">ilovejos@korea.kr</a></p>
              <p><span className="whitespace-nowrap">신청 시스템 문의</span> <a href="mailto:bgnlkim@gmail.com" className="underline hover:text-[#333] font-bold">bgnlkim@gmail.com</a></p>
            </div>
            <div className="h-2" />
            <p>Copyright 2026. 전국지리교사연합회. All Right Reserved.</p>
            <p>Powered by 양정고등학교 김용현</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
