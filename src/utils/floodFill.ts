/**
 * High-performance scanline flood fill for HTML5 Canvas
 * Used by the Paint Bucket tool to fill enclosed shapes (e.g. drawn circles, outlines).
 */

export function hexToUint32(hex: string, alpha: number = 1): number {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  // Little-endian RGBA packing: Byte 0=R, Byte 1=G, Byte 2=B, Byte 3=A
  return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

export function colorsMatch(c1: number, c2: number, tolerance: number): boolean {
  if (c1 === c2) return true;
  if (tolerance <= 0) return false;

  const r1 = c1 & 0xff;
  const g1 = (c1 >> 8) & 0xff;
  const b1 = (c1 >> 16) & 0xff;
  const a1 = (c1 >> 24) & 0xff;

  const r2 = c2 & 0xff;
  const g2 = (c2 >> 8) & 0xff;
  const b2 = (c2 >> 16) & 0xff;
  const a2 = (c2 >> 24) & 0xff;

  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  const da = a1 - a2;

  // Multi-channel Euclidean distance
  return dr * dr + dg * dg + db * db + da * da <= tolerance * tolerance * 4;
}

/**
 * Executes a scanline flood fill on a canvas rendering context.
 * Replaces all contiguous pixels matching the target color at (startX, startY)
 * with the designated fillColorHex.
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  fillColorHex: string,
  opacity: number = 1.0,
  tolerance: number = 38
): boolean {
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;

  if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) {
    return false;
  }

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = new Uint32Array(imgData.data.buffer);

  const startIndex = y0 * width + x0;
  const targetColor = data[startIndex];
  const fillColor = hexToUint32(fillColorHex, opacity);

  // If already matches within minimal tolerance, no fill needed
  if (colorsMatch(targetColor, fillColor, 3)) {
    return false;
  }

  // Track visited pixels to avoid loops and redundant checks
  const visited = new Uint8Array(width * height);
  const stack: number[] = [x0, y0];

  while (stack.length > 0) {
    const curY = stack.pop()!;
    const curX = stack.pop()!;

    const lineOffset = curY * width;
    const idx = lineOffset + curX;

    if (visited[idx]) continue;

    // Scan left boundary
    let leftX = curX;
    while (
      leftX > 0 &&
      !visited[lineOffset + leftX - 1] &&
      colorsMatch(data[lineOffset + leftX - 1], targetColor, tolerance)
    ) {
      leftX--;
    }

    // Scan right boundary
    let rightX = curX;
    while (
      rightX < width - 1 &&
      !visited[lineOffset + rightX + 1] &&
      colorsMatch(data[lineOffset + rightX + 1], targetColor, tolerance)
    ) {
      rightX++;
    }

    // Fill the scanline segment
    for (let x = leftX; x <= rightX; x++) {
      const pIdx = lineOffset + x;
      data[pIdx] = fillColor;
      visited[pIdx] = 1;
    }

    // Check line above and line below for adjacent seed spans
    const checkLine = (checkY: number) => {
      if (checkY < 0 || checkY >= height) return;
      const checkOffset = checkY * width;
      let inSegment = false;

      for (let x = leftX; x <= rightX; x++) {
        const cIdx = checkOffset + x;
        const matches =
          !visited[cIdx] && colorsMatch(data[cIdx], targetColor, tolerance);

        if (!inSegment && matches) {
          stack.push(x, checkY);
          inSegment = true;
        } else if (inSegment && !matches) {
          inSegment = false;
        }
      }
    };

    checkLine(curY - 1);
    checkLine(curY + 1);
  }

  ctx.putImageData(imgData, 0, 0);
  return true;
}
