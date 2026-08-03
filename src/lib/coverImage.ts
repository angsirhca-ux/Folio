/**
 * Compress an image for card covers / small bible art (localStorage-friendly).
 */

export type CoverImagePrepareResult = {
  dataUrl: string;
  width: number;
  height: number;
  name: string;
};

const COVER_MAX_EDGE = 900;
const COVER_MAX_CHARS = 1_200_000;

export async function prepareCoverImage(
  file: File,
): Promise<CoverImagePrepareResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Choose an image file (PNG, JPEG, or WebP).");
  }
  if (file.size > 12 * 1024 * 1024) {
    throw new Error("That image is too large — try one under 12 MB.");
  }

  const bitmap = await loadImageElement(file);
  const scale = Math.min(
    1,
    COVER_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmapClose(bitmap);
    throw new Error("Could not prepare the image.");
  }
  ctx.fillStyle = "#F3EEE4";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmapClose(bitmap);

  let dataUrl = canvas.toDataURL("image/jpeg", 0.78);
  if (dataUrl.length > COVER_MAX_CHARS * 0.7) {
    dataUrl = canvas.toDataURL("image/jpeg", 0.62);
  }
  if (dataUrl.length > COVER_MAX_CHARS) {
    throw new Error(
      "That image is still too large after compressing. Try a smaller file.",
    );
  }

  const name = (file.name || "Cover").replace(/\.[^.]+$/, "") || "Cover";
  return { dataUrl, width, height, name };
}

function loadImageElement(
  file: File,
): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    img.src = url;
  });
}

function bitmapClose(bitmap: HTMLImageElement | ImageBitmap) {
  if ("close" in bitmap && typeof bitmap.close === "function") {
    bitmap.close();
  }
}
