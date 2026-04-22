// © 2026 김용현
'use client';

import { useState, useEffect } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase';
import { uploadToCloudinary, isCloudinaryConfigured } from '@/lib/cloudinary';
import { PageContent, DEFAULT_CONTENT, fetchPageContent, savePageContent } from '@/lib/pageContent';

export default function AdminContentPage() {
  const [content, setContent] = useState<PageContent>(DEFAULT_CONTENT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [infoDragIndex, setInfoDragIndex] = useState<number | null>(null);
  const [infoDragOverIndex, setInfoDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchPageContent().then(c => {
      setContent(c);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    if (!isSupabaseConfigured) {
      alert('Supabase가 설정되지 않아 저장할 수 없습니다.');
      return;
    }
    setSaving(true);
    const { error } = await savePageContent(content);
    setSaving(false);
    if (error) {
      alert('저장 실패: ' + error.message);
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const updateHero = (key: keyof PageContent['hero'], value: string) => {
    setContent(prev => ({ ...prev, hero: { ...prev.hero, [key]: value } }));
  };

  const updateScheduleItem = (index: number, key: string, value: string) => {
    setContent(prev => {
      const items = [...prev.schedule.items];
      items[index] = { ...items[index], [key]: value };
      return { ...prev, schedule: { ...prev.schedule, items } };
    });
  };

  const addScheduleItem = () => {
    setContent(prev => ({
      ...prev,
      schedule: { ...prev.schedule, items: [...prev.schedule.items, { period: '', date: '', note: '' }] },
    }));
  };

  const removeScheduleItem = (index: number) => {
    setContent(prev => ({
      ...prev,
      schedule: { ...prev.schedule, items: prev.schedule.items.filter((_, i) => i !== index) },
    }));
  };

  const updateInfoItem = (index: number, key: string, value: string) => {
    setContent(prev => {
      const items = [...prev.info.items];
      items[index] = { ...items[index], [key]: value };
      return { ...prev, info: { ...prev.info, items } };
    });
  };

  const addInfoItem = () => {
    setContent(prev => ({
      ...prev,
      info: { ...prev.info, items: [...prev.info.items, { label: '', value: '' }] },
    }));
  };

  const removeInfoItem = (index: number) => {
    setContent(prev => ({
      ...prev,
      info: { ...prev.info, items: prev.info.items.filter((_, i) => i !== index) },
    }));
  };

  const updateGeneralContact = (index: number, key: string, value: string) => {
    setContent(prev => {
      const general = [...prev.contact.general];
      general[index] = { ...general[index], [key]: value };
      return { ...prev, contact: { ...prev.contact, general } };
    });
  };

  const addGeneralContact = () => {
    setContent(prev => ({
      ...prev,
      contact: { ...prev.contact, general: [...prev.contact.general, { label: '', value: '' }] },
    }));
  };

  const removeGeneralContact = (index: number) => {
    setContent(prev => ({
      ...prev,
      contact: { ...prev.contact, general: prev.contact.general.filter((_, i) => i !== index) },
    }));
  };

  const updateRegion = (index: number, key: string, value: string) => {
    setContent(prev => {
      const regions = [...prev.contact.regions];
      regions[index] = { ...regions[index], [key]: value };
      return { ...prev, contact: { ...prev.contact, regions } };
    });
  };

  const addRegion = () => {
    setContent(prev => ({
      ...prev,
      contact: { ...prev.contact, regions: [...prev.contact.regions, { region: '', email: '' }] },
    }));
  };

  const removeRegion = (index: number) => {
    setContent(prev => ({
      ...prev,
      contact: { ...prev.contact, regions: prev.contact.regions.filter((_, i) => i !== index) },
    }));
  };

  if (loading) {
    return <div className="text-center py-20 text-[#999]">로딩 중...</div>;
  }

  return (
    <div>
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-[#111]">대회 안내 관리</h1>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-green-600">저장되었습니다</span>}
          <button onClick={handleSave} disabled={saving} className="btn btn-primary px-6 py-2">
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      {!isSupabaseConfigured && (
        <div className="mb-6 p-4 rounded-lg bg-yellow-50 border border-yellow-200 text-sm text-yellow-800">
          Supabase가 설정되지 않았습니다. 기본값을 표시하며 저장은 불가합니다.
        </div>
      )}

      <div className="space-y-6">
        {/* 히어로 섹션 */}
        <section className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">히어로 섹션</h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">연도</label>
              <input value={content.hero.year} onChange={e => updateHero('year', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">제목</label>
              <input value={content.hero.title} onChange={e => updateHero('title', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">부제</label>
              <input value={content.hero.subtitle} onChange={e => updateHero('subtitle', e.target.value)} />
            </div>
          </div>
        </section>

        {/* 대회 안내 이미지 */}
        <section className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">대회 안내 이미지</h2>
          <p className="text-xs text-[#999] mb-3">업로드된 이미지가 메인 페이지의 &quot;대회 안내 이미지 저장&quot; 버튼에 연결됩니다.</p>
          {content.announcementImageUrl && (
            <div className="mb-3 flex items-center gap-3">
              <img src={content.announcementImageUrl} alt="대회 안내" className="h-24 object-contain rounded border border-[#e5e5e5]" />
              <div className="flex flex-col gap-1">
                <a href={content.announcementImageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline truncate max-w-xs">
                  현재 이미지 보기
                </a>
                <button
                  onClick={() => setContent(prev => ({ ...prev, announcementImageUrl: undefined }))}
                  className="text-red-500 hover:text-red-700 text-sm text-left"
                >
                  이미지 제거
                </button>
              </div>
            </div>
          )}
          <label className={`btn btn-secondary text-sm px-4 py-1.5 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? '업로드 중...' : '이미지 업로드'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!isCloudinaryConfigured) {
                  alert('Cloudinary가 설정되지 않아 업로드할 수 없습니다.');
                  return;
                }
                setUploading(true);
                try {
                  const result = await uploadToCloudinary(file, { folder: 'unigeo/announcement' });
                  setContent(prev => ({ ...prev, announcementImageUrl: result.secureUrl }));
                } catch (err) {
                  alert('업로드 실패: ' + (err instanceof Error ? err.message : String(err)));
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </section>

        {/* 단체 접수 안내 PDF */}
        <section className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">단체 접수 업로드 방법 안내 PDF</h2>
          <p className="text-xs text-[#999] mb-3">단체 접수 페이지의 &quot;업로드 방법 안내&quot; 버튼에 연결됩니다.</p>
          {content.groupGuideUrl && (
            <div className="mb-3 flex items-center gap-3">
              <span className="text-2xl">📄</span>
              <div className="flex flex-col gap-1">
                <a href={content.groupGuideUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline truncate max-w-xs">
                  현재 PDF 보기
                </a>
                <button
                  onClick={() => setContent(prev => ({ ...prev, groupGuideUrl: undefined }))}
                  className="text-red-500 hover:text-red-700 text-sm text-left"
                >
                  PDF 제거
                </button>
              </div>
            </div>
          )}
          <label className={`btn btn-secondary text-sm px-4 py-1.5 cursor-pointer ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            {uploading ? '업로드 중...' : 'PDF 업로드'}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={async e => {
                const file = e.target.files?.[0];
                if (!file) return;
                if (!isCloudinaryConfigured) {
                  alert('Cloudinary가 설정되지 않아 업로드할 수 없습니다.');
                  return;
                }
                setUploading(true);
                try {
                  const result = await uploadToCloudinary(file, { folder: 'unigeo/guides', resourceType: 'raw' });
                  setContent(prev => ({ ...prev, groupGuideUrl: result.secureUrl }));
                } catch (err) {
                  alert('업로드 실패: ' + (err instanceof Error ? err.message : String(err)));
                } finally {
                  setUploading(false);
                }
              }}
            />
          </label>
        </section>

        {/* 참가 신청 기간 */}
        <section className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">참가 신청 기간</h2>
          <p className="text-xs text-[#999] mb-3">이 기간에만 개인 접수와 단체 접수가 활성화됩니다.</p>
          <div className="flex gap-3 items-center">
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">시작일</label>
              <input
                type="date"
                className="!w-44"
                value={content.registrationPeriod?.startDate || ''}
                onChange={e => setContent(prev => ({
                  ...prev,
                  registrationPeriod: {
                    startDate: e.target.value,
                    endDate: prev.registrationPeriod?.endDate || '',
                  },
                }))}
              />
            </div>
            <span className="mt-6 text-[#999]">~</span>
            <div>
              <label className="block text-sm font-medium text-[#666] mb-1">종료일</label>
              <input
                type="date"
                className="!w-44"
                value={content.registrationPeriod?.endDate || ''}
                onChange={e => setContent(prev => ({
                  ...prev,
                  registrationPeriod: {
                    startDate: prev.registrationPeriod?.startDate || '',
                    endDate: e.target.value,
                  },
                }))}
              />
            </div>
          </div>
          {content.registrationPeriod?.startDate && content.registrationPeriod?.endDate && (
            <p className="text-sm text-[#666] mt-3">
              {(() => {
                const now = new Date();
                const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const start = content.registrationPeriod!.startDate;
                const end = content.registrationPeriod!.endDate;
                if (today < start) return `접수 시작 전 (${start} 부터 활성화)`;
                if (today > end) return '접수 기간 종료';
                return '현재 접수 기간 중 (접수 활성화 상태)';
              })()}
            </p>
          )}
        </section>

        {/* 대회 일정 */}
        <section className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">대회 일정</h2>
          <div className="space-y-3">
            {content.schedule.items.map((item, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={e => { e.preventDefault(); setDragOverIndex(i); }}
                onDragLeave={() => setDragOverIndex(null)}
                onDrop={() => {
                  if (dragIndex === null || dragIndex === i) return;
                  setContent(prev => {
                    const items = [...prev.schedule.items];
                    const [moved] = items.splice(dragIndex, 1);
                    items.splice(i, 0, moved);
                    return { ...prev, schedule: { ...prev.schedule, items } };
                  });
                  setDragIndex(null);
                  setDragOverIndex(null);
                }}
                onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
                className={`flex gap-2 items-start transition-all ${
                  dragOverIndex === i ? 'border-t-2 border-[#111]' : ''
                } ${dragIndex === i ? 'opacity-40' : ''}`}
              >
                <span className="cursor-grab active:cursor-grabbing text-[#999] hover:text-[#666] py-2 select-none">☰</span>
                <input
                  className="!w-28 shrink-0"
                  placeholder="구분"
                  value={item.period}
                  onChange={e => updateScheduleItem(i, 'period', e.target.value)}
                />
                <input
                  className="flex-1"
                  placeholder="일시"
                  value={item.date}
                  onChange={e => updateScheduleItem(i, 'date', e.target.value)}
                />
                <input
                  className="flex-1"
                  placeholder="비고"
                  value={item.note}
                  onChange={e => updateScheduleItem(i, 'note', e.target.value)}
                />
                <button onClick={() => removeScheduleItem(i)} className="text-red-500 hover:text-red-700 text-sm shrink-0 px-2 py-2">
                  삭제
                </button>
              </div>
            ))}
            <button onClick={addScheduleItem} className="btn btn-secondary text-sm px-4 py-1.5">
              + 항목 추가
            </button>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#666] mb-1">하단 주석</label>
            <input
              value={content.schedule.footnote}
              onChange={e => setContent(prev => ({ ...prev, schedule: { ...prev.schedule, footnote: e.target.value } }))}
            />
          </div>
        </section>

        {/* 대회 요강 */}
        <section className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">대회 요강</h2>
          <div className="space-y-4">
            {content.info.items.map((item, i) => (
              <div
                key={i}
                draggable
                onDragStart={() => setInfoDragIndex(i)}
                onDragOver={e => { e.preventDefault(); setInfoDragOverIndex(i); }}
                onDragLeave={() => setInfoDragOverIndex(null)}
                onDrop={() => {
                  if (infoDragIndex === null || infoDragIndex === i) return;
                  setContent(prev => {
                    const items = [...prev.info.items];
                    const [moved] = items.splice(infoDragIndex, 1);
                    items.splice(i, 0, moved);
                    return { ...prev, info: { ...prev.info, items } };
                  });
                  setInfoDragIndex(null);
                  setInfoDragOverIndex(null);
                }}
                onDragEnd={() => { setInfoDragIndex(null); setInfoDragOverIndex(null); }}
                className={`flex gap-2 items-start transition-all ${
                  infoDragOverIndex === i ? 'border-t-2 border-[#111]' : ''
                } ${infoDragIndex === i ? 'opacity-40' : ''}`}
              >
                <span className="cursor-grab active:cursor-grabbing text-[#999] hover:text-[#666] py-2 select-none">☰</span>
                <input
                  className="!w-32 shrink-0"
                  placeholder="항목명"
                  value={item.label}
                  onChange={e => updateInfoItem(i, 'label', e.target.value)}
                />
                <textarea
                  className="flex-1 min-h-[60px]"
                  placeholder="내용 (줄바꿈 가능)"
                  value={item.value}
                  onChange={e => updateInfoItem(i, 'value', e.target.value)}
                />
                <button onClick={() => removeInfoItem(i)} className="text-red-500 hover:text-red-700 text-sm shrink-0 px-2 py-2">
                  삭제
                </button>
              </div>
            ))}
            <button onClick={addInfoItem} className="btn btn-secondary text-sm px-4 py-1.5">
              + 항목 추가
            </button>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-[#666] mb-1">하단 주석</label>
            <input
              value={content.info.footnote}
              onChange={e => setContent(prev => ({ ...prev, info: { ...prev.info, footnote: e.target.value } }))}
            />
          </div>
        </section>

        {/* 문의처 - 일반 */}
        <section className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider mb-4">문의처 - 일반</h2>
          <div className="space-y-3">
            {content.contact.general.map((item, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input
                  className="!w-40 shrink-0"
                  placeholder="구분"
                  value={item.label}
                  onChange={e => updateGeneralContact(i, 'label', e.target.value)}
                />
                <input
                  className="flex-1"
                  placeholder="내용"
                  value={item.value}
                  onChange={e => updateGeneralContact(i, 'value', e.target.value)}
                />
                <button onClick={() => removeGeneralContact(i)} className="text-red-500 hover:text-red-700 text-sm shrink-0 px-2 py-2">
                  삭제
                </button>
              </div>
            ))}
            <button onClick={addGeneralContact} className="btn btn-secondary text-sm px-4 py-1.5">
              + 항목 추가
            </button>
          </div>
        </section>

        {/* 문의처 - 지역 담당자 */}
        <section className="p-5 rounded-lg border border-[#e5e5e5] bg-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#999] uppercase tracking-wider">문의처 - 지역 담당자</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const csv = '\uFEFF지역,이메일\n' + content.contact.regions.map(r => `${r.region},${r.email}`).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = '지역담당자.csv';
                  a.click();
                }}
                className="btn btn-secondary text-xs px-3 py-1"
              >
                CSV 다운로드
              </button>
              <button
                onClick={() => {
                  const csv = '\uFEFF지역,이메일\n서울,example@email.com\n부산,example@email.com';
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = '지역담당자_양식.csv';
                  a.click();
                }}
                className="btn btn-secondary text-xs px-3 py-1"
              >
                양식 다운로드
              </button>
              <label className="btn btn-secondary text-xs px-3 py-1 cursor-pointer">
                CSV 업로드
                <input
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const text = ev.target?.result as string;
                      const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                      const regions: { region: string; email: string }[] = [];
                      for (let i = 0; i < lines.length; i++) {
                        const cols = lines[i].split(',').map(c => c.trim());
                        if (cols.length >= 2 && cols[0] !== '지역') {
                          regions.push({ region: cols[0], email: cols[1] });
                        }
                      }
                      if (regions.length > 0) {
                        setContent(prev => ({
                          ...prev,
                          contact: { ...prev.contact, regions },
                        }));
                      } else {
                        alert('유효한 데이터가 없습니다. CSV 양식을 확인해 주세요.');
                      }
                    };
                    reader.readAsText(file, 'UTF-8');
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>
          <div className="space-y-2">
            {content.contact.regions.map((item, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  className="!w-20 shrink-0"
                  placeholder="지역"
                  value={item.region}
                  onChange={e => updateRegion(i, 'region', e.target.value)}
                />
                <input
                  className="flex-1"
                  placeholder="이메일"
                  value={item.email}
                  onChange={e => updateRegion(i, 'email', e.target.value)}
                />
                <button onClick={() => removeRegion(i)} className="text-red-500 hover:text-red-700 text-sm shrink-0 px-2 py-2">
                  삭제
                </button>
              </div>
            ))}
            <button onClick={addRegion} className="btn btn-secondary text-sm px-4 py-1.5">
              + 지역 추가
            </button>
          </div>
        </section>
      </div>

      {/* 하단 저장 버튼 */}
      <div className="mt-8 flex justify-end">
        <button onClick={handleSave} disabled={saving} className="btn btn-primary px-8 py-2.5">
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
