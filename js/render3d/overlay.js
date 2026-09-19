// -----------------------------------------------------------------------------
// Bastion Line — camada 2D sobre a cena 3D
// Barras de vida, números de dano e galões de veterania continuam em canvas 2D:
// é o que mantém esses elementos nítidos e legíveis em qualquer distância.
// -----------------------------------------------------------------------------

export function createOverlay(container) {
  const canvas = document.createElement('canvas');
  canvas.className = 'layer3d overlay';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let w = 1, h = 1, dpr = 1;

  function resize(cssW, cssH, pixelRatio) {
    dpr = pixelRatio;
    w = cssW; h = cssH;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    canvas.style.width = cssW + 'px';
    canvas.style.height = cssH + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function begin() {
    ctx.clearRect(0, 0, w, h);
  }

  /** Barra de vida do inimigo, com cor por faixa de HP. */
  function healthBar(x, y, width, pct) {
    const bw = Math.max(14, width);
    const bh = Math.max(3, Math.min(5, bw * 0.13));
    const bx = x - bw / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(bx - 1, y - 1, bw + 2, bh + 2);
    ctx.fillStyle = 'rgba(30,34,22,0.9)';
    ctx.fillRect(bx, y, bw, bh);
    ctx.fillStyle = pct > 0.5 ? '#6fae63' : pct > 0.25 ? '#d9992f' : '#c1503d';
    ctx.fillRect(bx, y, bw * Math.max(0, Math.min(1, pct)), bh);
  }

  /** Galões de veterania sob a torre. */
  function chevrons(x, y, level, scale) {
    const s = Math.max(3, 5 * scale);
    ctx.fillStyle = '#f2c15a';
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i < level; i++) {
      const cx = x - (level - 1) * s * 0.9 + i * s * 1.8;
      ctx.beginPath();
      ctx.moveTo(cx - s, y + s * 0.6);
      ctx.lineTo(cx + s, y + s * 0.6);
      ctx.lineTo(cx, y - s * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  /** Número flutuante de dano/ouro. */
  function floatText(x, y, text, color, alpha, scale) {
    const size = Math.max(9, Math.min(20, 13 * scale));
    ctx.font = '600 ' + size.toFixed(1) + 'px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.globalAlpha = alpha;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(8,10,6,0.75)';
    ctx.strokeText(text, x, y);
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    ctx.globalAlpha = 1;
  }

  function dispose() {
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  return {
    canvas: canvas,
    resize: resize,
    begin: begin,
    healthBar: healthBar,
    chevrons: chevrons,
    floatText: floatText,
    dispose: dispose
  };
}
