// © 2026 김용현
import type { Area } from 'react-easy-crop';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('이미지 로드 실패'));
    img.src = src;
  });
}

function rotatedSize(width: number, height: number, rotation: number) {
  const rad = (rotation * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

export async function getCroppedFile(
  imageSrc: string,
  pixelCrop: Area,
  rotation: number,
  fileName = 'cropped.jpg',
): Promise<File> {
  const image = await loadImage(imageSrc);
  const { width: bw, height: bh } = rotatedSize(image.width, image.height, rotation);

  const rotated = document.createElement('canvas');
  rotated.width = bw;
  rotated.height = bh;
  const rctx = rotated.getContext('2d')!;
  rctx.translate(bw / 2, bh / 2);
  rctx.rotate((rotation * Math.PI) / 180);
  rctx.drawImage(image, -image.width / 2, -image.height / 2);

  const cropped = document.createElement('canvas');
  cropped.width = pixelCrop.width;
  cropped.height = pixelCrop.height;
  const cctx = cropped.getContext('2d')!;
  cctx.drawImage(
    rotated,
    pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
    0, 0, pixelCrop.width, pixelCrop.height,
  );

  return new Promise((resolve) => {
    cropped.toBlob(
      (blob) => resolve(new File([blob!], fileName, { type: 'image/jpeg' })),
      'image/jpeg',
      0.95,
    );
  });
}
