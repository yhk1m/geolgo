import { jsPDF } from 'jspdf';
import { NOTO_SANS_KR_REGULAR } from './pdfFont';

export interface RosterEntry {
  examNumber: string;
  school: string;
  name: string;
  birthdate: string;
  photo_url: string | null;
}

export async function downloadPhotoRosterPDF(
  entries: RosterEntry[],
  regionName: string,
  onProgress?: (current: number, total: number) => void,
) {
  if (entries.length === 0) return;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('NotoSansKR-Regular.ttf', NOTO_SANS_KR_REGULAR);
  doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');

  const pw = 297;
  const ph = 210;
  const mx = 8;
  const my = 6;
  const titleH = 14;

  const labelW = 22;
  const cols = 8;
  const colW = (pw - mx * 2 - labelW) / cols;

  const contentTop = my + titleH;
  const textRowH = 8;
  const photoH = colW * 4 / 3; // 3:4 비율
  const groupH = photoH + textRowH * 4;
  const rowsPerPage = Math.floor((ph - contentTop - my) / groupH);
  const groupGap = (ph - contentTop - my - rowsPerPage * groupH) / (rowsPerPage + 1);

  const lineW = 0.3;
  const labelFs = 12;
  const dataFs = 12;
  const examNumFs = 13;

  const studentsPerPage = cols * rowsPerPage;
  const totalPages = Math.ceil(entries.length / studentsPerPage);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) doc.addPage();

    doc.setFont('NotoSansKR', 'normal');
    doc.setDrawColor(0);
    doc.setLineWidth(lineW);
    doc.setTextColor(0);

    // 제목
    doc.setFontSize(16);
    doc.text(
      `[${regionName}] 지역 명렬표(${pageIdx + 1}/${totalPages})`,
      pw / 2,
      my + titleH / 2 + 1,
      { align: 'center', baseline: 'middle', renderingMode: 'fillThenStroke' }
    );
    doc.setLineWidth(lineW);

    for (let rowIdx = 0; rowIdx < rowsPerPage; rowIdx++) {
      const startIdx = pageIdx * studentsPerPage + rowIdx * cols;
      if (startIdx >= entries.length) break;

      const groupY = contentTop + groupGap * (rowIdx + 1) + rowIdx * groupH;

      // ── 사진 행 ──
      doc.setLineWidth(lineW);
      doc.rect(mx, groupY, labelW, photoH);
      doc.setFontSize(labelFs);
      doc.text('사진', mx + labelW / 2, groupY + photoH / 2, { align: 'center', baseline: 'middle' });

      for (let c = 0; c < cols; c++) {
        const x = mx + labelW + c * colW;
        const idx = startIdx + c;

        if (idx < entries.length) {
          doc.setLineWidth(lineW);
          doc.rect(x, groupY, colW, photoH);
          if (entries[idx].photo_url) {
            try {
              const response = await fetch(entries[idx].photo_url!);
              const blob = await response.blob();
              const base64 = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(blob);
              });
              doc.addImage(base64, 'JPEG', x + 0.5, groupY + 0.5, colW - 1, photoH - 1);
            } catch {
              // photo load failed
            }
          }
          onProgress?.(idx + 1, entries.length);
        } else {
          doc.setFillColor(240, 240, 240);
          doc.setLineWidth(lineW);
          doc.rect(x, groupY, colW, photoH, 'FD');
        }
      }

      // ── 텍스트 행: 수험번호, 소속교, 이름, 생년월일 ──
      const labels = ['수험번호', '소속교', '이름', '생년월일'];
      const getters: ((e: RosterEntry) => string)[] = [
        e => e.examNumber,
        e => e.school,
        e => e.name,
        e => e.birthdate,
      ];

      for (let r = 0; r < 4; r++) {
        const rowY = groupY + photoH + r * textRowH;

        // 레이블 셀
        doc.setLineWidth(lineW);
        doc.rect(mx, rowY, labelW, textRowH);
        doc.setFontSize(labelFs);
        doc.text(labels[r], mx + labelW / 2, rowY + textRowH / 2, { align: 'center', baseline: 'middle' });

        // 데이터 셀
        for (let c = 0; c < cols; c++) {
          const x = mx + labelW + c * colW;
          const idx = startIdx + c;

          if (idx < entries.length) {
            doc.setLineWidth(lineW);
            doc.rect(x, rowY, colW, textRowH);
            const value = getters[r](entries[idx]);

            if (r === 0) {
              // 수험번호 - 굵게
              doc.setFontSize(examNumFs);
              doc.text(value, x + colW / 2, rowY + textRowH / 2, {
                align: 'center',
                baseline: 'middle',
                renderingMode: 'fillThenStroke',
              });
              doc.setLineWidth(lineW);
            } else {
              doc.setFontSize(dataFs);
              doc.text(value, x + colW / 2, rowY + textRowH / 2, { align: 'center', baseline: 'middle' });
            }
          } else {
            doc.setFillColor(240, 240, 240);
            doc.setLineWidth(lineW);
            doc.rect(x, rowY, colW, textRowH, 'FD');
          }
        }
      }
    }
  }

  const fileName = `사진명렬표_${regionName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
