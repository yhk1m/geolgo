// © 2026 김용현
'use client';

import { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { getCroppedFile } from '@/lib/cropImage';
import { resizeImage } from '@/lib/resizeImage';

interface PhotoEditorProps {
  file: File;
  onCancel: () => void;
  onApply: (file: File) => void;
}

export default function PhotoEditor({ file, onCancel, onApply }: PhotoEditorProps) {
  const [imageSrc, setImageSrc] = useState<string>('');
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels || !imageSrc) return;
    setProcessing(true);
    try {
      const cropped = await getCroppedFile(imageSrc, croppedAreaPixels, rotation, file.name.replace(/\.[^.]+$/, '.jpg'));
      const resized = await resizeImage(cropped);
      onApply(resized);
    } finally {
      setProcessing(false);
    }
  };

  if (!imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl w-full max-w-md flex flex-col max-h-[95vh] overflow-hidden">
        <div className="p-4 border-b border-[#eee]">
          <h3 className="text-lg font-semibold text-[#111]">사진 편집</h3>
          <p className="text-xs text-[#666] mt-0.5">증명사진 비율(3:4)에 맞춰 영역을 조정해주세요</p>
        </div>

        <div className="relative w-full bg-black" style={{ height: 360 }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={3 / 4}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            showGrid
          />
        </div>

        <div className="p-4 space-y-3 border-t border-[#eee]">
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#666] w-10 shrink-0">확대</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1"
              style={{ width: 'auto', padding: 0 }}
            />
            <span className="text-xs text-[#999] w-10 text-right tabular-nums">{zoom.toFixed(1)}x</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
              className="btn btn-secondary text-sm flex-1 py-2"
            >
              ↺ 왼쪽 회전
            </button>
            <button
              type="button"
              onClick={() => setRotation((r) => (r + 90) % 360)}
              className="btn btn-secondary text-sm flex-1 py-2"
            >
              ↻ 오른쪽 회전
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-[#eee] flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="btn btn-secondary flex-1 py-2 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={processing || !croppedAreaPixels}
            className="btn btn-primary flex-1 py-2 disabled:opacity-50"
          >
            {processing ? '처리 중...' : '적용'}
          </button>
        </div>
      </div>
    </div>
  );
}
