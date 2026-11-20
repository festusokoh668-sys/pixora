import { Point, ShapeFillStyle, ShapeOutlineStyle, ShapeType } from '../types';

export interface ShapeDefinition {
  id: ShapeType;
  label: string;
}

export const PAINT_SHAPES: ShapeDefinition[] = [
  { id: 'line', label: 'Line' },
  { id: 'curve', label: 'Curve' },
  { id: 'oval', label: 'Oval' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'rounded-rectangle', label: 'Rounded rectangle' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'right-triangle', label: 'Right triangle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'pentagon', label: 'Pentagon' },
  { id: 'hexagon', label: 'Hexagon' },
  { id: 'arrow-right', label: 'Right arrow' },
  { id: 'arrow-left', label: 'Left arrow' },
  { id: 'arrow-up', label: 'Up arrow' },
  { id: 'arrow-down', label: 'Down arrow' },
  { id: 'star-4', label: 'Four-point star' },
  { id: 'star-5', label: 'Five-point star' },
  { id: 'star-6', label: 'Six-point star' },
  { id: 'heart', label: 'Heart' },
  { id: 'callout', label: 'Rounded rectangular callout' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'lightning', label: 'Lightning bolt' },
];

export const QUICK_SHAPES: ShapeDefinition[] = [
  { id: 'heart', label: 'Heart' },
  { id: 'star-5', label: '5-Point Star' },
  { id: 'callout', label: 'Speech Bubble' },
  { id: 'star-4', label: '4-Point Star' },
  { id: 'star-6', label: '6-Point Star' },
  { id: 'cloud', label: 'Cloud' },
  { id: 'lightning', label: 'Lightning' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'arrow-right', label: 'Right Arrow' },
];

/**
 * Generates polygon vertices inside a normalized bounding box (x, y, width, height).
 */
export function getShapeVertices(
  shapeType: ShapeType,
  pStart: Point,
  pEnd: Point
): Point[] {
  const minX = Math.min(pStart.x, pEnd.x);
  const minY = Math.min(pStart.y, pEnd.y);
  const maxX = Math.max(pStart.x, pEnd.x);
  const maxY = Math.max(pStart.y, pEnd.y);
  const w = maxX - minX;
  const h = maxY - minY;
  const cx = minX + w / 2;
  const cy = minY + h / 2;

  switch (shapeType) {
    case 'triangle':
      return [
        { x: cx, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY },
      ];
    case 'right-triangle':
      return [
        { x: minX, y: minY },
        { x: minX, y: maxY },
        { x: maxX, y: maxY },
      ];
    case 'diamond':
      return [
        { x: cx, y: minY },
        { x: maxX, y: cy },
        { x: cx, y: maxY },
        { x: minX, y: cy },
      ];
    case 'pentagon':
      return generateRegularPolygonVertices(cx, cy, w / 2, h / 2, 5, -Math.PI / 2);
    case 'hexagon':
      return generateRegularPolygonVertices(cx, cy, w / 2, h / 2, 6, -Math.PI / 2);
    case 'star-4':
      return generateStarVertices(cx, cy, w / 2, h / 2, 4, 0.36);
    case 'star-5':
      return generateStarVertices(cx, cy, w / 2, h / 2, 5, 0.4);
    case 'star-6':
      return generateStarVertices(cx, cy, w / 2, h / 2, 6, 0.45);
    case 'arrow-right':
      return [
        { x: minX, y: minY + h * 0.28 },
        { x: minX + w * 0.55, y: minY + h * 0.28 },
        { x: minX + w * 0.55, y: minY },
        { x: maxX, y: cy },
        { x: minX + w * 0.55, y: maxY },
        { x: minX + w * 0.55, y: minY + h * 0.72 },
        { x: minX, y: minY + h * 0.72 },
      ];
    case 'arrow-left':
      return [
        { x: maxX, y: minY + h * 0.28 },
        { x: minX + w * 0.45, y: minY + h * 0.28 },
        { x: minX + w * 0.45, y: minY },
        { x: minX, y: cy },
        { x: minX + w * 0.45, y: maxY },
        { x: minX + w * 0.45, y: minY + h * 0.72 },
        { x: maxX, y: minY + h * 0.72 },
      ];
    case 'arrow-up':
      return [
        { x: minX + w * 0.28, y: maxY },
        { x: minX + w * 0.28, y: minY + h * 0.45 },
        { x: minX, y: minY + h * 0.45 },
        { x: cx, y: minY },
        { x: maxX, y: minY + h * 0.45 },
        { x: minX + w * 0.72, y: minY + h * 0.45 },
        { x: minX + w * 0.72, y: maxY },
      ];
    case 'arrow-down':
      return [
        { x: minX + w * 0.28, y: minY },
        { x: minX + w * 0.28, y: minY + h * 0.55 },
        { x: minX, y: minY + h * 0.55 },
        { x: cx, y: maxY },
        { x: maxX, y: minY + h * 0.55 },
        { x: minX + w * 0.72, y: minY + h * 0.55 },
        { x: minX + w * 0.72, y: minY },
      ];
    case 'lightning':
      return [
        { x: minX + w * 0.58, y: minY },
        { x: minX + w * 0.16, y: minY + h * 0.54 },
        { x: minX + w * 0.48, y: minY + h * 0.54 },
        { x: minX + w * 0.36, y: maxY },
        { x: minX + w * 0.84, y: minY + h * 0.42 },
        { x: minX + w * 0.52, y: minY + h * 0.42 },
      ];
    default:
      return [];
  }
}

function generateRegularPolygonVertices(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
  startAngle: number
): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < sides; i++) {
    const angle = startAngle + (i * Math.PI * 2) / sides;
    pts.push({
      x: cx + rx * Math.cos(angle),
      y: cy + ry * Math.sin(angle),
    });
  }
  return pts;
}

function generateStarVertices(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  pointsCount: number,
  innerRatio: number
): Point[] {
  const pts: Point[] = [];
  const total = pointsCount * 2;
  const startAngle = -Math.PI / 2;
  for (let i = 0; i < total; i++) {
    const angle = startAngle + (i * Math.PI) / pointsCount;
    const mult = i % 2 === 0 ? 1 : innerRatio;
    pts.push({
      x: cx + rx * mult * Math.cos(angle),
      y: cy + ry * mult * Math.sin(angle),
    });
  }
  return pts;
}

/**
 * Traces the Canvas2D subpath for the given geometric shape & control points.
 */
export function traceShapePath(
  ctx: CanvasRenderingContext2D,
  shapeType: ShapeType,
  points: Point[]
): { isClosed: boolean } {
  if (points.length === 0) return { isClosed: false };
  const p0 = points[0];
  const pLast = points[points.length - 1];

  const minX = Math.min(p0.x, pLast.x);
  const minY = Math.min(p0.y, pLast.y);
  const maxX = Math.max(p0.x, pLast.x);
  const maxY = Math.max(p0.y, pLast.y);
  const w = maxX - minX;
  const h = maxY - minY;
  const cx = minX + w / 2;
  const cy = minY + h / 2;

  ctx.beginPath();

  if (shapeType === 'line') {
    ctx.moveTo(p0.x, p0.y);
    ctx.lineTo(pLast.x, pLast.y);
    return { isClosed: false };
  }

  if (shapeType === 'curve') {
    if (points.length >= 3) {
      const pEnd = points[1];
      const ctrl1 = points[2];
      const ctrl2 = points[3] ?? ctrl1;
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(ctrl1.x, ctrl1.y, ctrl2.x, ctrl2.y, pEnd.x, pEnd.y);
    } else {
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(pLast.x, pLast.y);
    }
    return { isClosed: false };
  }

  if (shapeType === 'polygon') {
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    if (points.length >= 3) {
      ctx.closePath();
      return { isClosed: true };
    }
    return { isClosed: false };
  }

  if (shapeType === 'rectangle') {
    ctx.rect(minX, minY, w, h);
    return { isClosed: true };
  }

  if (shapeType === 'rounded-rectangle') {
    const r = Math.min(18, Math.min(w, h) * 0.22);
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(minX, minY, w, h, r);
    } else {
      ctx.moveTo(minX + r, minY);
      ctx.lineTo(maxX - r, minY);
      ctx.quadraticCurveTo(maxX, minY, maxX, minY + r);
      ctx.lineTo(maxX, maxY - r);
      ctx.quadraticCurveTo(maxX, maxY, maxX - r, maxY);
      ctx.lineTo(minX + r, maxY);
      ctx.quadraticCurveTo(minX, maxY, minX, maxY - r);
      ctx.lineTo(minX, minY + r);
      ctx.quadraticCurveTo(minX, minY, minX + r, minY);
    }
    return { isClosed: true };
  }

  if (shapeType === 'oval') {
    ctx.ellipse(cx, cy, Math.max(0.5, w / 2), Math.max(0.5, h / 2), 0, 0, Math.PI * 2);
    return { isClosed: true };
  }

  if (shapeType === 'heart') {
    const topY = minY + h * 0.3;
    ctx.moveTo(cx, maxY);
    ctx.bezierCurveTo(minX - w * 0.05, minY + h * 0.65, minX, minY, cx, topY);
    ctx.bezierCurveTo(maxX, minY, maxX + w * 0.05, minY + h * 0.65, cx, maxY);
    ctx.closePath();
    return { isClosed: true };
  }

  if (shapeType === 'callout') {
    const boxBottom = minY + h * 0.78;
    const boxH = boxBottom - minY;
    const r = Math.min(12, Math.min(w, boxH) * 0.2);
    ctx.moveTo(minX + r, minY);
    ctx.lineTo(maxX - r, minY);
    ctx.quadraticCurveTo(maxX, minY, maxX, minY + r);
    ctx.lineTo(maxX, boxBottom - r);
    ctx.quadraticCurveTo(maxX, boxBottom, maxX - r, boxBottom);
    ctx.lineTo(minX + w * 0.42, boxBottom);
    ctx.lineTo(minX + w * 0.2, maxY);
    ctx.lineTo(minX + w * 0.28, boxBottom);
    ctx.lineTo(minX + r, boxBottom);
    ctx.quadraticCurveTo(minX, boxBottom, minX, boxBottom - r);
    ctx.lineTo(minX, minY + r);
    ctx.quadraticCurveTo(minX, minY, minX + r, minY);
    ctx.closePath();
    return { isClosed: true };
  }

  if (shapeType === 'cloud') {
    ctx.moveTo(minX + w * 0.25, minY + h * 0.85);
    ctx.bezierCurveTo(
      minX + w * 0.04,
      minY + h * 0.85,
      minX + w * 0.04,
      minY + h * 0.48,
      minX + w * 0.24,
      minY + h * 0.46
    );
    ctx.bezierCurveTo(
      minX + w * 0.24,
      minY + h * 0.16,
      minX + w * 0.58,
      minY + h * 0.12,
      minX + w * 0.66,
      minY + h * 0.36
    );
    ctx.bezierCurveTo(
      minX + w * 0.88,
      minY + h * 0.32,
      minX + w * 0.96,
      minY + h * 0.62,
      minX + w * 0.82,
      minY + h * 0.78
    );
    ctx.bezierCurveTo(
      minX + w * 0.8,
      minY + h * 0.85,
      minX + w * 0.7,
      minY + h * 0.85,
      minX + w * 0.25,
      minY + h * 0.85
    );
    ctx.closePath();
    return { isClosed: true };
  }

  const verts = getShapeVertices(shapeType, p0, pLast);
  if (verts.length > 0) {
    ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x, verts[i].y);
    }
    ctx.closePath();
    return { isClosed: true };
  }

  return { isClosed: false };
}

/**
 * Renders a geometric shape onto a Canvas2D context using Paint's Outline and Fill styles.
 */
export function renderShapeToContext(
  ctx: CanvasRenderingContext2D,
  shapeType: ShapeType,
  points: Point[],
  outlineColor: string,
  fillColor: string,
  lineWidth: number,
  opacity: number,
  outlineStyle: ShapeOutlineStyle = 'solid',
  fillStyle: ShapeFillStyle = 'none'
): void {
  if (points.length === 0) return;

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const { isClosed } = traceShapePath(ctx, shapeType, points);

  // 1. Fill interior if closed shape and fillStyle !== 'none'
  if (isClosed && fillStyle !== 'none') {
    ctx.save();
    let fillAlpha = opacity;
    if (fillStyle === 'marker') fillAlpha = opacity * 0.45;
    else if (fillStyle === 'watercolor') fillAlpha = opacity * 0.65;
    else if (fillStyle === 'crayon') fillAlpha = opacity * 0.85;
    else if (fillStyle === 'pencil') fillAlpha = opacity * 0.72;
    ctx.globalAlpha = fillAlpha;
    ctx.fillStyle = fillColor || '#FFFFFF';
    ctx.fill();
    ctx.restore();
  }

  // 2. Stroke outline if outlineStyle !== 'none'
  if (outlineStyle !== 'none') {
    ctx.save();
    ctx.strokeStyle = outlineColor;
    let strokeAlpha = opacity;
    let strokeWidth = Math.max(1, lineWidth);

    if (outlineStyle === 'marker') {
      strokeAlpha = opacity * 0.55;
      strokeWidth = lineWidth * 1.3;
    } else if (outlineStyle === 'watercolor') {
      strokeAlpha = opacity * 0.72;
      ctx.shadowColor = outlineColor;
      ctx.shadowBlur = Math.max(1.5, lineWidth * 0.35);
    } else if (outlineStyle === 'oil') {
      strokeWidth = lineWidth * 1.15;
      ctx.shadowColor = outlineColor;
      ctx.shadowBlur = Math.max(1, lineWidth * 0.2);
    } else if (outlineStyle === 'crayon') {
      strokeAlpha = opacity * 0.88;
      ctx.setLineDash([Math.max(2, lineWidth * 0.7), 1.5]);
    } else if (outlineStyle === 'pencil') {
      strokeAlpha = opacity * 0.82;
    }

    ctx.globalAlpha = strokeAlpha;
    ctx.lineWidth = strokeWidth;
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

function r(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Generates an SVG path `d` attribute string matching traceShapePath geometry.
 */
export function shapeToSvgPathData(
  shapeType: ShapeType,
  points: Point[]
): { d: string; isClosed: boolean } {
  if (points.length === 0) return { d: '', isClosed: false };
  const p0 = points[0];
  const pLast = points[points.length - 1];

  const minX = Math.min(p0.x, pLast.x);
  const minY = Math.min(p0.y, pLast.y);
  const maxX = Math.max(p0.x, pLast.x);
  const maxY = Math.max(p0.y, pLast.y);
  const w = maxX - minX;
  const h = maxY - minY;
  const cx = minX + w / 2;
  const cy = minY + h / 2;

  if (shapeType === 'line') {
    return { d: `M ${r(p0.x)} ${r(p0.y)} L ${r(pLast.x)} ${r(pLast.y)}`, isClosed: false };
  }

  if (shapeType === 'curve') {
    if (points.length >= 3) {
      const pEnd = points[1];
      const ctrl1 = points[2];
      const ctrl2 = points[3] ?? ctrl1;
      return {
        d: `M ${r(p0.x)} ${r(p0.y)} C ${r(ctrl1.x)} ${r(ctrl1.y)} ${r(ctrl2.x)} ${r(ctrl2.y)} ${r(pEnd.x)} ${r(pEnd.y)}`,
        isClosed: false,
      };
    }
    return { d: `M ${r(p0.x)} ${r(p0.y)} L ${r(pLast.x)} ${r(pLast.y)}`, isClosed: false };
  }

  if (shapeType === 'polygon') {
    const segs = [`M ${r(p0.x)} ${r(p0.y)}`];
    for (let i = 1; i < points.length; i++) {
      segs.push(`L ${r(points[i].x)} ${r(points[i].y)}`);
    }
    if (points.length >= 3) {
      segs.push('Z');
      return { d: segs.join(' '), isClosed: true };
    }
    return { d: segs.join(' '), isClosed: false };
  }

  if (shapeType === 'rectangle') {
    return {
      d: `M ${r(minX)} ${r(minY)} H ${r(maxX)} V ${r(maxY)} H ${r(minX)} Z`,
      isClosed: true,
    };
  }

  if (shapeType === 'rounded-rectangle') {
    const rad = Math.min(18, Math.min(w, h) * 0.22);
    return {
      d: `M ${r(minX + rad)} ${r(minY)} L ${r(maxX - rad)} ${r(minY)} Q ${r(maxX)} ${r(minY)} ${r(maxX)} ${r(minY + rad)} L ${r(maxX)} ${r(maxY - rad)} Q ${r(maxX)} ${r(maxY)} ${r(maxX - rad)} ${r(maxY)} L ${r(minX + rad)} ${r(maxY)} Q ${r(minX)} ${r(maxY)} ${r(minX)} ${r(maxY - rad)} L ${r(minX)} ${r(minY + rad)} Q ${r(minX)} ${r(minY)} ${r(minX + rad)} ${r(minY)} Z`,
      isClosed: true,
    };
  }

  if (shapeType === 'oval') {
    const rx = Math.max(0.5, w / 2);
    const ry = Math.max(0.5, h / 2);
    return {
      d: `M ${r(cx - rx)} ${r(cy)} A ${r(rx)} ${r(ry)} 0 1 0 ${r(cx + rx)} ${r(cy)} A ${r(rx)} ${r(ry)} 0 1 0 ${r(cx - rx)} ${r(cy)} Z`,
      isClosed: true,
    };
  }

  if (shapeType === 'heart') {
    const topY = minY + h * 0.3;
    return {
      d: `M ${r(cx)} ${r(maxY)} C ${r(minX - w * 0.05)} ${r(minY + h * 0.65)} ${r(minX)} ${r(minY)} ${r(cx)} ${r(topY)} C ${r(maxX)} ${r(minY)} ${r(maxX + w * 0.05)} ${r(minY + h * 0.65)} ${r(cx)} ${r(maxY)} Z`,
      isClosed: true,
    };
  }

  if (shapeType === 'callout') {
    const boxBottom = minY + h * 0.78;
    const boxH = boxBottom - minY;
    const rad = Math.min(12, Math.min(w, boxH) * 0.2);
    return {
      d: `M ${r(minX + rad)} ${r(minY)} L ${r(maxX - rad)} ${r(minY)} Q ${r(maxX)} ${r(minY)} ${r(maxX)} ${r(minY + rad)} L ${r(maxX)} ${r(boxBottom - rad)} Q ${r(maxX)} ${r(boxBottom)} ${r(maxX - rad)} ${r(boxBottom)} L ${r(minX + w * 0.42)} ${r(boxBottom)} L ${r(minX + w * 0.2)} ${r(maxY)} L ${r(minX + w * 0.28)} ${r(boxBottom)} L ${r(minX + rad)} ${r(boxBottom)} Q ${r(minX)} ${r(boxBottom)} ${r(minX)} ${r(boxBottom - rad)} L ${r(minX)} ${r(minY + rad)} Q ${r(minX)} ${r(minY)} ${r(minX + rad)} ${r(minY)} Z`,
      isClosed: true,
    };
  }

  if (shapeType === 'cloud') {
    return {
      d: `M ${r(minX + w * 0.25)} ${r(minY + h * 0.85)} C ${r(minX + w * 0.04)} ${r(minY + h * 0.85)} ${r(minX + w * 0.04)} ${r(minY + h * 0.48)} ${r(minX + w * 0.24)} ${r(minY + h * 0.46)} C ${r(minX + w * 0.24)} ${r(minY + h * 0.16)} ${r(minX + w * 0.58)} ${r(minY + h * 0.12)} ${r(minX + w * 0.66)} ${r(minY + h * 0.36)} C ${r(minX + w * 0.88)} ${r(minY + h * 0.32)} ${r(minX + w * 0.96)} ${r(minY + h * 0.62)} ${r(minX + w * 0.82)} ${r(minY + h * 0.78)} C ${r(minX + w * 0.8)} ${r(minY + h * 0.85)} ${r(minX + w * 0.7)} ${r(minY + h * 0.85)} ${r(minX + w * 0.25)} ${r(minY + h * 0.85)} Z`,
      isClosed: true,
    };
  }

  const verts = getShapeVertices(shapeType, p0, pLast);
  if (verts.length > 0) {
    const segs = verts.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${r(pt.x)} ${r(pt.y)}`);
    segs.push('Z');
    return { d: segs.join(' '), isClosed: true };
  }

  return { d: '', isClosed: false };
}

