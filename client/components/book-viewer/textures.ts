import * as THREE from "three";

// Canvas-drawn textures, so the viewer needs no image or font assets.

const PAGE_PX = { w: 512, h: 700 };

function canvasTexture(draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement("canvas");
  canvas.width = PAGE_PX.w;
  canvas.height = PAGE_PX.h;
  const ctx = canvas.getContext("2d");
  if (ctx) draw(ctx);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function makeCoverTexture(title: string, author: string) {
  return canvasTexture((ctx) => {
    const { w, h } = PAGE_PX;
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#3b2f63");
    bg.addColorStop(1, "#171329");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(214, 180, 106, 0.8)";
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, w - 56, h - 56);

    // Lines are placed by their vertical middle so the DOM copy of this cover
    // in BookViewer (which morphs into it) can line up with plain CSS.
    ctx.fillStyle = "#e8cf8f";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 44px Georgia, 'Times New Roman', serif";
    const lines = wrapLines(ctx, title, w - 120);
    const lineH = 54;
    lines.forEach((l, i) =>
      ctx.fillText(l, w / 2, h * 0.4 + (i - (lines.length - 1) / 2) * lineH),
    );

    ctx.font = "italic 24px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = "rgba(232, 207, 143, 0.8)";
    wrapLines(ctx, author, w - 140).forEach((l, i) =>
      ctx.fillText(l, w / 2, h * 0.78 + i * 32),
    );
  });
}

/**
 * A cover from an image file, cropped to the cover's proportions the way CSS
 * `background-size: cover` would — so it matches the DOM copy that morphs into it.
 */
export function loadImageCoverTexture(src: string): Promise<THREE.CanvasTexture> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () =>
      resolve(
        canvasTexture((ctx) => {
          const { w, h } = PAGE_PX;
          const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
          const dw = image.naturalWidth * scale;
          const dh = image.naturalHeight * scale;
          ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
        }),
      );
    image.onerror = () => reject(new Error(`Could not load cover image: ${src}`));
    image.src = src;
  });
}

export function makeTitlePageTexture(title: string, author: string) {
  return canvasTexture((ctx) => {
    const { w, h } = PAGE_PX;
    ctx.fillStyle = "#f6efdf";
    ctx.fillRect(0, 0, w, h);

    ctx.fillStyle = "#2a2238";
    ctx.textAlign = "center";
    ctx.font = "600 36px Georgia, 'Times New Roman', serif";
    const lines = wrapLines(ctx, title, w - 110);
    lines.forEach((l, i) => ctx.fillText(l, w / 2, h * 0.34 + i * 46));

    ctx.fillStyle = "#8a7a9c";
    ctx.fillRect(w / 2 - 40, h * 0.34 + lines.length * 46, 80, 2);

    ctx.font = "italic 22px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = "#4a4058";
    wrapLines(ctx, author, w - 120).forEach((l, i) =>
      ctx.fillText(l, w / 2, h * 0.34 + lines.length * 46 + 50 + i * 30),
    );
  });
}

/** A page of greyed-out "text" lines. `seed` varies the line lengths. */
export function makeTextPageTexture(seed: number) {
  return canvasTexture((ctx) => {
    const { w, h } = PAGE_PX;
    ctx.fillStyle = "#f6efdf";
    ctx.fillRect(0, 0, w, h);

    let s = seed * 9301 + 49297;
    const rand = () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };

    ctx.fillStyle = "rgba(60, 50, 70, 0.5)";
    const marginX = 56;
    let y = 70;
    while (y < h - 60) {
      const paragraphEnd = rand() < 0.12;
      const lineW = (w - marginX * 2) * (paragraphEnd ? 0.35 + rand() * 0.4 : 0.94 + rand() * 0.06);
      ctx.fillRect(marginX, y, lineW, 7);
      y += paragraphEnd ? 34 : 22;
    }
  });
}
