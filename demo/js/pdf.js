/*
 * AgroEstructura - Cotización en PDF (ventana lista para imprimir o «Guardar como PDF»).
 *
 * Dos versiones:
 *  - PARA EL CLIENTE (la normal): configuración, diseño, cantidades de materiales y SOLO el valor total.
 *    No lleva precio unitario, subtotales ni la separación materiales / mano de obra
 *    (decisión del dueño: el cliente no debe saber cuánto cuesta cada material).
 *  - INTERNA (datos.interno = true, solo el dueño): con todos los precios, marcada «USO INTERNO».
 *
 * Incluye el dibujo de la estructura si simulador.js está cargado en la página.
 */
(function () {
  const fN = (n) => new Intl.NumberFormat('es-CO').format(n);

  /** Imagen PNG del diseño (o '' si no hay simulador en la página). */
  function imagenDiseno(params, diseno) {
    // Primero la vista 3D (la misma que ve el usuario en pantalla); si el navegador no tiene 3D, el dibujo plano
    if (window.AgroVista3D && AgroVista3D.disponible) {
      const url = AgroVista3D.imagen(diseno ? { diseno } : params, { ancho: 1280, alto: 640 });
      if (url) return url;
    }
    if (!window.AgroSimulador || diseno) return '';
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

  /** Diseño a medida: una fila por nave con su tipo, medidas y opciones (sin precios). */
  function tablaDiseno(d, p, esc) {
    const C = AgroCalculo, N = d.naves.length;
    const filas = d.naves.map((n, i) => {
      const extra = [n.cenital ? 'ventana cenital' : '', n.cortinas ? 'cortinas' : '', n.alturaPostes ? 'postes de ' + n.alturaPostes + ' m' : '',
        d.puertas.filter((q) => q.nave === i).map((q) => 'puerta ' + q.lado + ' (' + q.ancho + ' m)').join(', ')].filter(Boolean).join(' · ');
      return '<tr><td>Nave ' + (i + 1) + '</td><td>' + esc(C.NOMBRE_TIPO[n.tipo] || n.tipo) + '</td><td>' + esc(n.ancho) + ' m</td><td>' + esc(n.largo) + ' m</td><td>' + esc(n.inicio) + ' m</td><td>' + esc(extra || '—') + '</td></tr>';
    }).join('');
    const canales = d.canales.map((c, i) => (c ? (i === 0 ? 'costado izquierdo' : i === N ? 'costado derecho' : 'entre nave ' + i + ' y ' + (i + 1)) : '')).filter(Boolean);
    return '<h2>Diseño a medida</h2><table><tr><th>Nave</th><th>Estructura</th><th>Ancho</th><th>Largo</th><th>Empieza a</th><th>Opciones</th></tr>' + filas + '</table>' +
      '<p style="font-size:12px;margin:6px 0 0">Postes cada ' + esc(d.distancia) + ' m · plástico cal. ' + esc(p.calibrePlastico) + ' (' + esc(p.anchoPlastico) + ' m) · canales: ' + esc(canales.length ? canales.join(', ') + ' (' + d.anchoCanal + ' m)' : 'no') + (d.terreno.length >= 3 ? ' · terreno de ' + d.terreno.length + ' esquinas' : '') + '</p>';
  }

  /** Tabla de materiales: con precios (interna) o solo cantidades (cliente). */
  function tablaMateriales(r, interno, esc) {
    const C = AgroCalculo;
    if (!r.filas || !r.filas.length) return '';
    const columnas = interno ? 4 : 2;
    const filas = r.filas.map((f) => {
      if (f.tipo === 'seccion') return `<tr><td colspan="${columnas}" style="background:#eee;font-weight:bold;text-transform:uppercase;font-size:11px">${esc(f.texto)}</td></tr>`;
      const base = `<td>${esc(f.nombre)}</td><td style="text-align:center">${esc(fN(f.cant))} ${esc(f.unidad)}</td>`;
      if (!interno) return `<tr>${base}</tr>`;
      return `<tr>${base}<td style="text-align:right">${C.fCOP(f.pu)}</td><td style="text-align:right">${r.soloManoDeObra ? 'Lo aporta el cliente' : C.fCOP(f.st)}</td></tr>`;
    }).join('');
    const cabecera = interno
      ? '<tr><th>Ítem / componente</th><th style="text-align:center">Cant.</th><th style="text-align:right">Vr. unitario</th><th style="text-align:right">Subtotal (COP)</th></tr>'
      : '<tr><th>Material</th><th style="text-align:center">Cantidad</th></tr>';
    const titulo = interno ? 'Desglose de materiales y costos' : (r.soloManoDeObra ? 'Materiales que debe aportar el cliente (referencia)' : 'Materiales incluidos');
    return `<h2>${titulo}</h2><table>${cabecera}${filas}</table>`;
  }

  /**
   * datos: { cliente, id, fechaIso, params, resultado, interno?, nota? }
   * Devuelve false si el navegador bloqueó la ventana.
   */
  function abrir(datos) {
    const C = AgroCalculo, esc = AgroDatos.esc;
    const p = datos.params, r = datos.resultado;
    // La versión interna solo es posible si llegaron los precios (el servidor no se los envía al cliente).
    // Así nunca sale «$ NaN»: sin precios, siempre se arma la versión del cliente.
    const conPrecios = typeof r.cMat === 'number' && (r.filas || []).every((f) => f.tipo !== 'item' || typeof f.pu === 'number');
    const interno = datos.interno === true && conPrecios;
    const img = imagenDiseno(p, datos.diseno);
    const verCantidades = interno || AgroDatos.CLIENTE_VE_CANTIDADES;
    // Observación de lo que incluye el valor total (en vez de las columnas de precio)
    const lista = r.soloManoDeObra ? C.INCLUYE.soloManoDeObra : C.INCLUYE.todoCosto;
    const observacion = `<div class="obs"><b>Observación:</b> dentro de esta cotización está incluido:<ul>${lista.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>${r.soloManoDeObra ? `<p>${esc(C.NOTA_SOLO_MANO_DE_OBRA)}</p>` : ''}</div>`;
    const totales = interno
      ? `<table class="tot"><tr><td>Costo materiales</td><td style="text-align:right">${C.fCOP(r.cMat)}</td></tr><tr><td>Mano de obra</td><td style="text-align:right">${C.fCOP(r.cObra)}</td></tr>
         <tr class="gran"><td>TOTAL PRESUPUESTO</td><td style="text-align:right">${C.fCOP(r.total)}</td></tr></table>`
      : `<div class="total"><span>VALOR TOTAL DE LA COTIZACIÓN</span><b>${C.fCOP(r.total)}</b></div>${observacion}`;
    const nota = datos.nota || (interno
      ? 'Documento interno con precios por material. No lo envíes al cliente: para él usa «PDF para el cliente».'
      : 'Valor en pesos colombianos (COP).');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>${interno ? '[INTERNO] ' : ''}Cotización ${esc(datos.cliente)}</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px}h1{margin:0 0 4px;font-size:22px}h2{font-size:14px;margin:22px 0 8px;border-bottom:2px solid #22c55e;padding-bottom:4px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #bbb;padding:6px 8px}th{background:#f1f5f9;text-align:left}.meta td{border:none;padding:2px 8px 2px 0}
.tot{margin-top:14px;margin-left:auto;width:320px;font-size:13px}.tot td{border:none;padding:3px 0}.gran td{font-size:16px;font-weight:bold;border-top:2px solid #111;padding-top:8px}
.total{margin:22px 0 0 auto;max-width:360px;border:2px solid #16a34a;border-radius:10px;padding:14px 18px;text-align:right}
.total span{display:block;font-size:12px;letter-spacing:.06em;color:#14532d;font-weight:bold}.total b{display:block;font-size:26px;margin:4px 0}
.obs{margin-top:16px;border:1px solid #bbb;border-left:4px solid #16a34a;border-radius:6px;padding:10px 14px;font-size:13px;background:#f8fafc}
.obs ul{margin:6px 0 0;padding-left:20px}.obs li{margin:2px 0}.obs p{margin:6px 0 0;color:#555}
.interno{background:#b91c1c;color:#fff;font-weight:bold;text-align:center;padding:6px;margin:-8px 0 14px;border-radius:6px;letter-spacing:.08em}
.diseno{width:100%;max-width:640px;border-radius:8px;display:block;margin:0 auto}.plano svg{width:100%;max-height:380px;display:block;border-radius:8px}.pie{margin-top:28px;font-size:11px;color:#555}
@media print{.diseno,.interno{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
${interno ? '<div class="interno">USO INTERNO · CON PRECIOS POR MATERIAL · NO ENVIAR AL CLIENTE</div>' : ''}
<h1>AgroEstructura V.2 PRO — Cotización</h1>
<table class="meta"><tr><td><b>Cliente / proyecto:</b></td><td>${esc(datos.cliente)}</td><td><b>Fecha:</b></td><td>${esc(AgroDatos.fechaLarga(datos.fechaIso))}</td></tr>
<tr><td><b>Cotización:</b></td><td>${esc(datos.id || 'Borrador (sin guardar)')}</td><td><b>Modalidad:</b></td><td>${esc(p.modalidad)}</td></tr></table>
${datos.diseno ? tablaDiseno(datos.diseno, p, esc) : `<h2>Configuración estructural</h2>
<table><tr><th>Estructura</th><th>Largo</th><th>Ancho por nave</th><th>Naves</th><th>Dist. postes</th><th>Plástico</th><th>Canal</th></tr>
<tr><td>${esc(C.NOMBRE_TIPO[p.tipo])}</td><td>${esc(p.largo)} m</td><td>${esc(p.ancho)} m</td><td>${esc(p.naves)}</td><td>${esc(p.distancia)} m</td><td>Cal. ${esc(p.calibrePlastico)} · ${esc(p.anchoPlastico)} m</td><td>${p.anchoCanal === '0' ? 'No requiere' : esc(p.anchoCanal) + ' m · Cal. ' + esc(p.calibreCanal)}</td></tr></table>`}
${img ? `<h2>Diseño de la estructura</h2><img class="diseno" src="${img}" alt="Dibujo de la estructura">` : ''}
${datos.diseno && window.AgroDisenador ? `<h2>Plano (visto desde arriba)</h2><div class="plano">${AgroDisenador.svgPlano(datos.diseno)}</div>` : ''}
${verCantidades ? tablaMateriales(r, interno, esc) : ''}
${totales}
<p class="pie">${esc(nota)}</p>
<script>window.onload=function(){window.print();}<\/script></body></html>`;
    const w = window.open('', '_blank');
    if (!w) return false;
    w.document.open(); w.document.write(html); w.document.close();
    return true;
  }

  window.AgroPdf = { abrir };
})();
