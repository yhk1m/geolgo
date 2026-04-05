export default function Footer() {
  return (
    <footer className="bg-[#f0f0f0] border-t border-[#e5e5e5] mt-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-8">
          {/* 왼쪽: 주최/주관 */}
          <div className="space-y-3 shrink-0">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-[#444] shrink-0 border-l-2 border-r-2 border-[#444] px-2 text-base">주최</span>
              <div className="flex items-center gap-3">
                <img src="/KGEO.png" alt="KGEO" className="h-9 sm:h-[43px] object-contain" />
                <img src="/KRIHS.svg" alt="KRIHS 국토연구원" className="h-9 sm:h-[43px] object-contain" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-[#444] shrink-0 border-l-2 border-r-2 border-[#444] px-2 text-base">주관</span>
              <div className="flex items-center gap-3">
                <img src="/UNIGEO.png" alt="UNIGEO" className="h-9 sm:h-[43px] object-contain" />
                <span className="font-bold text-[#444]" style={{ fontSize: "20px" }}>지리올림피아드특별위원회</span>
              </div>
            </div>
          </div>
          {/* 오른쪽: 문의 및 저작권 */}
          <div className="text-left text-sm text-[#666] space-y-1 pt-1">
            <table style={{ borderCollapse: "collapse", borderSpacing: 0 }} className="text-sm text-[#666]">
              <tbody>
                <tr>
                  <td style={{ padding: "0 6px 0 0", textAlign: "justify", textAlignLast: "justify", width: "7.5em" }}>접수 및 시험 문의</td>
                  <td style={{ padding: 0 }}><a href="mailto:ilovejos@korea.kr" className="underline hover:text-[#333] font-bold">ilovejos@korea.kr</a></td>
                </tr>
                <tr>
                  <td style={{ padding: "0 6px 0 0", textAlign: "justify", textAlignLast: "justify", width: "7.5em" }}>신청 시스템 문의</td>
                  <td style={{ padding: 0 }}><a href="mailto:bgmlkim@gmail.com" className="underline hover:text-[#333] font-bold">bgmlkim@gmail.com</a></td>
                </tr>
              </tbody>
            </table>
            <div className="h-2.5" />
            <p>Copyright 2026. 양정고등학교 김용현. All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
