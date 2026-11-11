// Fotografije s mobitela su često 5–10 MB; prije slanja se smanje (najviše 1600 px).

export async function shrinkImage(file: File, max = 1600, quality = 0.85): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const keepPng = file.type === 'image/png' && file.size < 1024 * 1024;
    const type = keepPng ? 'image/png' : 'image/jpeg';
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, keepPng ? '.png' : '.jpg'), { type });
  } catch {
    return file;
  }
}
