import { jsPDF } from 'jspdf';
import { NOTO_SANS_KR_REGULAR } from './pdfFont';
import { regionNameMap } from './regions';

interface Registration {
  id: string;
  name: string;
  school: string;
  grade: number;
  phone: string;
  email: string | null;
  region: string;
  registration_type: string;
  payment_status: string;
  payment_amount: number;
  created_at: string;
  birthdate: string | null;
  photo_url: string | null;
  class_name?: string | null;
}

const SCHOOL_SPECIAL: Record<string, string> = {
  '용인한국외국어대학교부설고등학교': '외대부고',
  '이화여자대학교사범대학부속이화금란고등학교': '이대부고',
  '이화여자외국어고등학교': '이화외고',
};

function shortenSchool(name: string): string {
  if (SCHOOL_SPECIAL[name]) return SCHOOL_SPECIAL[name];
  const sabu = name.match(/(?:국립)?(.+?)대학교사범대학부[설속].*고등학교/);
  if (sabu) return `${sabu[1]}사대부고`;
  if (name.includes('외국어')) return name.replace('외국어', '외').replace(/등학교$/, '');
  if (name.endsWith('여자고등학교')) return name.replace('여자고등학교', '여고');
  return name.replace(/등학교$/, '');
}

export interface ExamLocationInfo {
  school_name: string;
  address: string;
}

interface ExamTicketOptions {
  registrations: Registration[];
  examNumbers: Map<string, string>;
  examLocations: Record<string, ExamLocationInfo>;
}

export async function downloadExamTicketPDF(options: ExamTicketOptions) {
  const { registrations, examNumbers, examLocations } = options;
  if (registrations.length === 0) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  doc.addFileToVFS('NotoSansKR-Regular.ttf', NOTO_SANS_KR_REGULAR);
  doc.addFont('NotoSansKR-Regular.ttf', 'NotoSansKR', 'normal');

  const pw = 210;
  const mx = 20;
  const tw = pw - mx * 2;

  const lineW = 0.3; // 표 테두리 통일 두께

  function cell(x: number, y: number, w: number, h: number, text: string, opts?: { fontSize?: number; bold?: boolean; align?: 'left' | 'center'; bg?: string }) {
    const fs = opts?.fontSize || 10;
    const align = opts?.align || 'left';
    doc.setLineWidth(lineW);
    if (opts?.bg) {
      doc.setFillColor(opts.bg);
      doc.rect(x, y, w, h, 'FD');
    } else {
      doc.rect(x, y, w, h);
    }
    doc.setFont('NotoSansKR', 'normal');
    doc.setFontSize(fs);
    doc.setTextColor(0);
    const tx = align === 'center' ? x + w / 2 : x + 3;
    doc.text(text, tx, y + h / 2 + fs * 0.12, { align, baseline: 'middle' });
  }

  for (let idx = 0; idx < registrations.length; idx++) {
    if (idx > 0) doc.addPage();
    const r = registrations[idx];
    const examNumber = examNumbers.get(r.id) || '';
    const loc = examLocations[r.region];
    const examLocationSchool = loc?.school_name || '';
    const examLocationAddress = loc?.address || '';

    doc.setDrawColor(0);
    doc.setLineWidth(lineW);

    // Title
    let y = 20;
    const title = '제26회 전국지리올림피아드 수험표';
    doc.setFont('NotoSansKR', 'normal');
    doc.setFontSize(18);
    doc.setTextColor(0);
    doc.text(title, pw / 2, y, { align: 'center', renderingMode: 'fillThenStroke' });
    doc.setLineWidth(lineW); // 타이틀 stroke 후 복원
    y += 10;

    const rowH = 10;
    const fs = 10; // 표 내 균일 글씨 크기
    const labelBg = '#d9d9d9'; // 레이블 음영

    const labelStyle = { bg: labelBg, fontSize: fs, align: 'center' as const };

    // ── 사진 + 인적사항 영역 ──
    const photoW = 30;
    const photoH = 40;
    const infoX = mx + photoW;
    const infoW = tw - photoW; // 140

    // Photo cell (spans 4 rows)
    doc.rect(mx, y, photoW, photoH);
    doc.setFontSize(7);
    doc.setTextColor(120);
    doc.text('사 진', mx + photoW / 2, y + 12, { align: 'center' });
    doc.text('*6개월 이내에 촬영한', mx + photoW / 2, y + 18, { align: 'center' });
    doc.text('탈모 상반신 사진', mx + photoW / 2, y + 23, { align: 'center' });
    doc.text('(3cm x 4cm)', mx + photoW / 2, y + 28, { align: 'center' });
    doc.setTextColor(0);

    if (r.photo_url) {
      try {
        const response = await fetch(r.photo_url);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        doc.addImage(base64, 'JPEG', mx + 2, y + 2, photoW - 4, photoH - 4);
      } catch {
        // photo load failed, keep placeholder text
      }
    }

    // 좌측 레이블/값, 우측 레이블/값 폭 설정
    const c1 = infoX;
    const lw = 25; // 좌측 레이블 폭
    const rlw = 22; // 우측 레이블 폭 (학년반/생년월일/수험번호)
    const leftValW = infoW - lw - rlw - 30; // 좌측 값 폭 (= 63)
    const rvw = 30; // 우측 값 폭
    const splitX = c1 + lw + leftValW;

    // Row 1: 학교 | (school) | 학년반 | (grade+class)
    cell(c1, y, lw, rowH, '학교', labelStyle);
    cell(c1 + lw, y, leftValW, rowH, r.school);
    cell(splitX, y, rlw, rowH, '학년반', labelStyle);
    cell(splitX + rlw, y, rvw, rowH, `${r.grade}학년 ${r.class_name || ''}반`);
    y += rowH;

    // Row 2: 성명 | (name) | 생년월일 | (birthdate)
    cell(c1, y, lw, rowH, '성명', labelStyle);
    cell(c1 + lw, y, leftValW, rowH, r.name);
    cell(splitX, y, rlw, rowH, '생년월일', labelStyle);
    cell(splitX + rlw, y, rvw, rowH, r.birthdate || '');
    y += rowH;

    // Row 3-4: 연락처 (왼쪽) | 수험번호 (오른쪽, 2행 병합)
    cell(c1, y, lw, rowH * 2, '연락처', labelStyle);
    cell(c1 + lw, y, leftValW, rowH, `전화 : ${r.phone}`);
    cell(splitX, y, rlw, rowH * 2, '수험번호', labelStyle);
    cell(splitX + rlw, y, rvw, rowH * 2, examNumber, { fontSize: 14, align: 'center' });
    y += rowH;
    cell(c1 + lw, y, leftValW, rowH, `E-mail : ${r.email || ''}`);
    y += rowH;

    // ── 시험장소 행 (학교명 + 주소, 2행) — 레이블 폭을 사진 칸(photoW)에 맞춤 ──
    cell(mx, y, photoW, rowH * 2, '시험장소', labelStyle);
    cell(mx + photoW, y, tw - photoW, rowH, examLocationSchool);
    y += rowH;
    cell(mx + photoW, y, tw - photoW, rowH, examLocationAddress);
    y += rowH;

    // ── 접수정보 표 ──
    const infoH = 10;
    const infoHalfW = tw / 2;
    const infoLW = photoW; // 레이블 폭을 사진 칸에 맞춤
    const infoValW = infoHalfW - infoLW;

    // Row: 지역 | (값) | 접수유형 | (값)
    cell(mx, y, infoLW, infoH, '지역', labelStyle);
    cell(mx + infoLW, y, infoValW, infoH, regionNameMap[r.region] || r.region);
    cell(mx + infoHalfW, y, infoLW, infoH, '접수유형', labelStyle);
    cell(mx + infoHalfW + infoLW, y, infoValW, infoH, r.registration_type === 'group' ? '단체' : '개인');
    y += infoH;

    // Row: 입금상태 | 체크박스 | 참가비 | (값)
    cell(mx, y, infoLW, infoH, '입금상태', labelStyle);
    doc.setLineWidth(lineW);
    doc.rect(mx + infoLW, y, infoValW, infoH);
    doc.setFont('NotoSansKR', 'normal');
    doc.setFontSize(fs);
    doc.setTextColor(0);
    const cbY = y + infoH / 2;
    const cbSize = 3;
    const cbX1 = mx + infoLW + 5;
    doc.rect(cbX1, cbY - cbSize / 2, cbSize, cbSize);
    if (r.payment_status === 'pending') {
      doc.line(cbX1 + 0.5, cbY, cbX1 + cbSize / 2, cbY + cbSize / 2 - 0.3);
      doc.line(cbX1 + cbSize / 2, cbY + cbSize / 2 - 0.3, cbX1 + cbSize - 0.3, cbY - cbSize / 2 + 0.3);
    }
    doc.text('입금 대기', cbX1 + cbSize + 2, cbY + 1, { baseline: 'middle' });
    const cbX2 = cbX1 + 30;
    doc.rect(cbX2, cbY - cbSize / 2, cbSize, cbSize);
    if (r.payment_status === 'confirmed') {
      doc.line(cbX2 + 0.5, cbY, cbX2 + cbSize / 2, cbY + cbSize / 2 - 0.3);
      doc.line(cbX2 + cbSize / 2, cbY + cbSize / 2 - 0.3, cbX2 + cbSize - 0.3, cbY - cbSize / 2 + 0.3);
    }
    doc.text('입금 확인', cbX2 + cbSize + 2, cbY + 1, { baseline: 'middle' });

    cell(mx + infoHalfW, y, infoLW, infoH, '참가비', labelStyle);
    cell(mx + infoHalfW + infoLW, y, infoValW, infoH, `${(r.payment_amount || 0).toLocaleString()}원`);
    y += infoH;

    // Spacer
    y += 5;

    // 참가 신청 문구
    const stmtH = 40;
    doc.setLineWidth(lineW);
    doc.rect(mx, y, tw, stmtH);
    doc.setFont('NotoSansKR', 'normal');
    doc.setFontSize(10);
    doc.text('위 본인은 전국지리교사연합회가 주관하여 시행하는', pw / 2, y + 10, { align: 'center' });
    doc.text('<제26회 전국지리올림피아드> 참가를 신청합니다.', pw / 2, y + 18, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`${new Date(r.created_at).getFullYear()}. ${new Date(r.created_at).getMonth() + 1}. ${new Date(r.created_at).getDate()}.`, pw / 2, y + 28, { align: 'center' });
    y += stmtH;

    // 신청인 서명란
    const signH = 15;
    doc.setLineWidth(lineW);
    doc.rect(mx, y, tw, signH);
    doc.setFontSize(10);
    doc.text(`신청인 : ${r.name}  (서명 또는 날인)`, pw / 2, y + signH / 2 + 1, { align: 'center' });
    y += signH;

    // 개인정보 수집 동의
    y += 5;
    const privH = 40;

    // 레이블 셀
    doc.setLineWidth(lineW);
    doc.setFillColor(labelBg);
    doc.rect(mx, y, photoW, privH, 'FD');
    doc.setFont('NotoSansKR', 'normal');
    doc.setFontSize(fs);
    doc.setTextColor(0);
    const labelGap = 5;
    const labelFirstY = y + (privH - labelGap) / 2;
    doc.text('개인정보', mx + photoW / 2, labelFirstY, { align: 'center', baseline: 'middle' });
    doc.text('수집·이용', mx + photoW / 2, labelFirstY + labelGap, { align: 'center', baseline: 'middle' });

    // 내용 셀
    doc.setLineWidth(lineW);
    doc.rect(mx + photoW, y, tw - photoW, privH);
    doc.setFontSize(8);
    const privLines = [
      '수집·이용 목적 : 전국지리올림피아드 운영관련 안내사항 통보',
      '수집·이용할 항목 : 학교명, 학년반, 성명, 생년월일, 연락처',
      '개인정보 보유·이용 기간 : 이용목적 달성시까지',
      '동의를 거부할 권리가 있으며, 거부할 경우 전국지리올림피아드와 관련한 서비스를 제공받을 수 없음.',
    ];
    const privLineGap = 6;
    const privBlockH = (privLines.length - 1) * privLineGap;
    const privFirstY = y + (privH - privBlockH) / 2;
    const px = mx + photoW + 3;
    for (let li = 0; li < privLines.length; li++) {
      doc.text(privLines[li], px, privFirstY + li * privLineGap, { baseline: 'middle' });
    }
    y += privH;

    // 하단 안내문
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(50, 50, 200);
    doc.text('※ 수집한 개인정보는 정보주체의 동의 없이 수집한 목적 외로 사용하지 않습니다.', mx, y);
    doc.setTextColor(0);
  }

  let fileName: string;
  if (registrations.length === 1) {
    const r = registrations[0];
    const date = new Date(r.created_at).toISOString().slice(0, 10);
    fileName = `수험표_${shortenSchool(r.school)}_${r.name}_${date}.pdf`;
  } else {
    fileName = `수험표_${registrations.length}명_${new Date().toISOString().slice(0, 10)}.pdf`;
  }
  doc.save(fileName);
}
