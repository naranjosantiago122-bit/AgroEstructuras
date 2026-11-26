/*
 * AgroEstructura - Cotización en PDF (ventana lista para imprimir o «Guardar como PDF»).
 * La usan el dueño (cotizador) y el cliente (Mis solicitudes, solo si la cotización fue liberada).
 * Incluye el dibujo de la estructura si simulador.js está cargado en la página.
 */
(function () {
  const fN = (n) => new Intl.NumberFormat('es-CO').format(n);

  /** Imagen PNG del diseño (o '' si no hay simulador en la página). */
  function imagenDiseno(params) {
    if (!window.AgroSimulador) return '';
    try {
      const c = document.createElement('canvas');
      AgroSimulador.dibujar(c, params);
      const ctx = c.getContext('2d');
      // Fondo oscuro detrás del dibujo (el canvas es transparente)
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#020617'; ctx.fillRect(0, 0, c.width, c.height); ctx.restore();
      return c.toDataURL('image/png');
    } catch (e) { return ''; }
  }

  /**
   * datos: { cliente, id, fechaIso, params, resultado, nota }
   * Devuelve false si el navegador bloqueó la ventana.
   */
  function abrir(datos) {
    const C = AgroCalculo, esc = AgroDatos.esc;
    const p = datos.params, r = datos.resultado;
    const img = imagenDiseno(p);
    const filas = r.filas.map((f) => f.tipo === 'seccion'
      ? `<tr><td colspan="4" style="background:#eee;font-weight:bold;text-transform:uppercase;font-size:11px">${esc(f.texto)}</td></tr>`
      : `<tr><td>${esc(f.nombre)}</td><td style="text-align:center">${esc(fN(f.cant))} ${esc(f.unidad)}</td><td style="text-align:right">${C.fCOP(f.pu)}</td><td style="text-align:right">${r.soloManoDeObra ? 'Lo aporta el cliente' : C.fCOP(f.st)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Cotización ${esc(datos.cliente)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}h1{margin:0 0 4px;font-size:22px}h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid #22c55e;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:6px 8px}th{background:#f1f5f9;text-align:left}.meta td{border:none;padding:2px 8px 2px 0}
.tot{margin-top:14px;margin-left:auto;width:320px;font-size:13px}.tot td{border:none;padding:3px 0}.gran td{font-size:16px;font-weight:bold;border-top:2px solid #111;padding-top:8px}
.diseno{width:100%;max-width:640px;border-radius:8px;display:block;margin:0 auto}.pie{margin-top:28px;font-size:11px;color:#555}
@media print{.diseno{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<h1>AgroEstructura V.2 PRO — Cotización</h1>
<table class="meta"><tr><td><b>Cliente / proyecto:</b></td><td>${esc(datos.cliente)}</td><td><b>Fecha:</b></td><td>${esc(AgroDatos.fechaLarga(datos.fechaIso))}</td></tr>
<tr><td><b>Presupuesto:</b></td><td>${esc(datos.id || 'Borrador (sin guardar)')}</td><td><b>Modalidad:</b></td><td>${esc(p.modalidad)}</td></tr></table>
<h2>Configuración estructural</h2>
<table><tr><th>Estructura</th><th>Largo</th><th>Ancho por nave</th><th>Naves</th><th>Dist. postes</th><th>Plástico</th><th>Canal</th></tr>
<tr><td>${esc(C.NOMBRE_TIPO[p.tipo])}</td><td>${esc(p.largo)} m</td><td>${esc(p.ancho)} m</td><td>${esc(p.naves)}</td><td>${esc(p.distancia)} m</td><td>Cal. ${esc(p.calibrePlastico)} · ${esc(p.anchoPlastico)} m</td><td>${p.anchoCanal === '0' ? 'No requiere' : esc(p.anchoCanal) + ' m · Cal. ' + esc(p.calibreCanal)}</td></tr></table>
${img ? `<h2>Diseño de la estructura</h2><img class="diseno" src="${img}" alt="Dibujo de la estructura">` : ''}
<h2>Desglose de materiales y costos</h2>
<table><tr><th>Ítem / componente</th><th style="text-align:center">Cant.</th><th style="text-align:right">Vr. unitario</th><th style="text-align:right">Subtotal (COP)</th></tr>${filas}</table>
<table class="tot"><tr><td>Costo materiales</td><td style="text-align:right">${C.fCOP(r.cMat)}</td></tr><tr><td>Mano de obra</td><td style="text-align:right">${C.fCOP(r.cObra)}</td></tr>
<tr class="gran"><td>TOTAL PRESUPUESTO</td><td style="text-align:right">${C.fCOP(r.total)}</td></tr></table>
<p class="pie">${esc(datos.nota || 'Valores en pesos colombianos (COP), calculados con los precios del inventario a la fecha de esta cotización. Es un estimado y puede variar.')}</p>
<script>window.onload=function(){window.print();}<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.open(); w.document.write(html); w.document.close();
    return true;
  }

  window.AgroPdf = { abrir };
})();
