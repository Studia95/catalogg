type ImageCompressionPreset = 'photo' | 'logo';
type CompressionOptions = {
  maxSizeMB: number;
  maxWidthOrHeight: number;
  initialQuality: number;
  useWebWorker: boolean;
};

const compressionOptions = {
  photo: {
    maxSizeMB: 0.35,
    maxWidthOrHeight: 1200,
    initialQuality: 0.78,
    useWebWorker: true
  },
  logo: {
    maxSizeMB: 0.15,
    maxWidthOrHeight: 512,
    initialQuality: 0.9,
    useWebWorker: true
  }
} satisfies Record<ImageCompressionPreset, CompressionOptions>;

export async function compressImage(file: File, preset: ImageCompressionPreset = 'photo') {
  if (!file.type.startsWith('image/')) {
    return file;
  }

  try {
    const { default: imageCompression } = await import('browser-image-compression');
    return await imageCompression(file, {
      ...compressionOptions[preset],
      fileType: file.type
    });
  } catch (error) {
    console.warn('Image compression failed, using original file', error);
    return file;
  }
}

export function fileToDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function imageFileToDataUrl(file: File, preset: ImageCompressionPreset = 'photo') {
  const compressed = await compressImage(file, preset);
  return fileToDataUrl(compressed);
}
