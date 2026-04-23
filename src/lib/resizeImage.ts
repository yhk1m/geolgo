// © 2026 김용현
const MAX_WIDTH = 400;
const MAX_HEIGHT = 500;
const JPEG_QUALITY = 0.75;
const TARGET_ASPECT = MAX_WIDTH / MAX_HEIGHT;

interface ResizeOptions {
  centerCrop?: boolean;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로드 실패')); };
    img.src = url;
  });
}

function canvasToFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob!], fileName, { type: 'image/jpeg' })),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

export async function resizeImage(file: File, options: ResizeOptions = {}): Promise<File> {
  try {
    const img = await loadImage(file);
    const { naturalWidth: srcW, naturalHeight: srcH } = img;

    let sx = 0, sy = 0, sw = srcW, sh = srcH;

    if (options.centerCrop) {
      const imgAspect = srcW / srcH;
      if (imgAspect > TARGET_ASPECT) {
        sw = srcH * TARGET_ASPECT;
        sx = (srcW - sw) / 2;
      } else if (imgAspect < TARGET_ASPECT) {
        sh = srcW / TARGET_ASPECT;
        sy = (srcH - sh) / 2;
      }
    }

    if (!options.centerCrop && sw <= MAX_WIDTH && sh <= MAX_HEIGHT) {
      return file;
    }

    const scale = Math.min(MAX_WIDTH / sw, MAX_HEIGHT / sh, 1);
    const newW = Math.round(sw * scale);
    const newH = Math.round(sh * scale);

    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, newW, newH);

    const newName = file.name.replace(/\.[^.]+$/, '.jpg');
    return await canvasToFile(canvas, newName);
  } catch {
    return file;
  }
}
