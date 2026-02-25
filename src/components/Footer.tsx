export default function Footer() {
  return (
    <footer className="bg-[#f0f0f0] border-t border-[#e5e5e5] mt-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 shrink-0">
            <img src="/UNIGEO.png" alt="UNIGEO" className="h-9 sm:h-[43px] object-contain" />
            <img src="/KGEO.png" alt="KGEO" className="h-9 sm:h-[43px] object-contain" />
            <img src="/KERIS.png" alt="KERIS" className="h-9 sm:h-[43px] object-contain" />
          </div>
          <div className="text-left text-xs text-[#666] space-y-1">
            <p>문의 : bgmlkim@gmail.com</p>
            <p>Copyright 2026 김용현(양정고등학교) All Rights Reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
