const MAX_WIDTH = 400;
const MAX_HEIGHT = 500;
const JPEG_QUALITY = 0.75;

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

export async function resizeImage(file: File): Promise<File> {
  try {
    const img = await loadImage(file);
    const { naturalWidth: width, naturalHeight: height } = img;

    if (width <= MAX_WIDTH && height <= MAX_HEIGHT) {
      return file;
    }

    const scale = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
    const newW = Math.round(width * scale);
    const newH = Math.round(height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = newW;
    canvas.height = newH;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0, newW, newH);

    const newName = file.name.replace(/\.[^.]+$/, '.jpg');
    return await canvasToFile(canvas, newName);
  } catch {
    return file;
  }
}
