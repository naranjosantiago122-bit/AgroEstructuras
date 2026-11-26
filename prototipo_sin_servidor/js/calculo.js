/*
 * AgroEstructura - Motor de cálculo (BOM: lista de materiales y costos)
 * Fórmulas tomadas del index.html original (V.2). No toca el DOM: recibe datos y devuelve resultados.
 * Se puede usar en el navegador (window.AgroCalculo) y en Node (require) para pruebas.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgroCalculo = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Precios por defecto de los materiales base (COP)
  const PRECIOS_BASE = { tubo: 45000, guadua: 15000, carevaca_s: 17000, carevaca_r: 22000 };

  // Precio del plástico por m² según el ancho del rollo
  const PRECIO_PLASTICO = { '5.80': 3200, '6.00': 4200, '6.50': 5200, '8.00': 7200, '10.00': 8200 };

  // Precio del rollo de canal (100 m) según el ancho del canal
  const PRECIO_CANAL = { '0.90': 350000, '1.20': 355000, '1.50': 360000, '2.00': 365000 };

  // Separación máxima permitida entre postes / arcos (m)
  const LIMITE_DISTANCIA = { Tubular: 5, Guadua: 4 };

  const NOMBRE_TIPO = { Tubular: 'Metálico Tubular', Guadua: 'Capilla de Guadua' };

  const fCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

  /** Devuelve la lista de problemas de los datos (vacía si todo está bien). */
  // Rangos aceptados en los campos (evitan valores vacíos, negativos o absurdos)
  const LIMITES = { largo: [2, 500], ancho: [2, 100], distancia: [0.5, 5], naves: [1, 20] };

  /** Errores por campo: [{ campo, mensaje }]. Sirve para marcar cada campo en pantalla. */
  function validarCampos(p) {
    const errores = [];
    const fuera = (v, [min, max]) => !(v >= min && v <= max);
    if (!(p.largo > 0)) errores.push({ campo: 'largo', mensaje: 'Escribe el largo en metros (un número mayor que 0).' });
    else if (fuera(p.largo, LIMITES.largo)) errores.push({ campo: 'largo', mensaje: `El largo debe estar entre ${LIMITES.largo[0]} y ${LIMITES.largo[1]} m.` });
    if (!(p.ancho > 0)) errores.push({ campo: 'ancho', mensaje: 'Escribe el ancho por nave en metros (un número mayor que 0).' });
    else if (fuera(p.ancho, LIMITES.ancho)) errores.push({ campo: 'ancho', mensaje: `El ancho por nave debe estar entre ${LIMITES.ancho[0]} y ${LIMITES.ancho[1]} m.` });
    if (!(p.distancia > 0)) errores.push({ campo: 'distancia', mensaje: 'Escribe la distancia entre postes en metros (mayor que 0).' });
    else if (p.distancia < LIMITES.distancia[0]) errores.push({ campo: 'distancia', mensaje: `La distancia entre postes debe ser de al menos ${LIMITES.distancia[0]} m.` });
    if (!(Number.isInteger(p.naves) && p.naves >= LIMITES.naves[0] && p.naves <= LIMITES.naves[1])) {
      errores.push({ campo: 'naves', mensaje: `El número de naves debe ser un número entero entre ${LIMITES.naves[0]} y ${LIMITES.naves[1]}.` });
    }
    const lim = LIMITE_DISTANCIA[p.tipo];
    if (lim && p.distancia > lim) {
      errores.push({ campo: 'distancia', mensaje: p.tipo === 'Guadua'
        ? 'Alerta técnica: para Guadua los postes no deben superar 4 m de separación.'
        : 'Alerta técnica: para Tubular los arcos no deben superar 5 m de separación.' });
    }
    return errores;
  }
  /** Lista de mensajes de error (vacía si los datos son válidos). */
  const validar = (p) => validarCampos(p).map((e) => e.mensaje);

  /**
   * Calcula el proyecto.
   * p: { tipo, largo, ancho, distancia, naves, calibrePlastico, anchoPlastico, anchoCanal, calibreCanal, modalidad }
   * precios: { tubo, guadua, carevaca_s, carevaca_r }
   * insumos: [{ nombre, precio, cantidad }]  (insumos libres del proyecto)
   */
  function calcular(p, precios, insumos) {
    const errores = validar(p);
    if (errores.length) return { ok: false, errores };

    const pre = Object.assign({}, PRECIOS_BASE, precios || {});
    const extras = insumos || [];
    const soloMO = p.modalidad !== 'Todo Costo';
    const naves = p.naves;

    const precioPlastico = PRECIO_PLASTICO[p.anchoPlastico] || 3200;

    const secciones = Math.ceil(p.largo / p.distancia);
    const arcosPorNave = secciones + 1;
    const postesLaterales = (arcosPorNave * 2) * naves;
    const postesCentrales = (p.tipo === 'Guadua') ? (arcosPorNave * Math.max(1, Math.floor(p.ancho / 8))) * naves : 0;
    const totalCareS = (secciones * 20) * naves;
    const totalCareR = (secciones * 3) * naves;
    const areaTecho = (p.largo * p.ancho * 1.05) * naves;

    const filas = [];
    let cMat = 0;
    const item = (nombre, cant, unidad, pu) => {
      const st = cant * pu;
      cMat += st;
      filas.push({ tipo: 'item', nombre, cant, unidad, pu, st });
    };

    if (naves > 1) filas.push({ tipo: 'seccion', texto: `Ingeniería para ${naves} naves acopladas`, color: 'amber' });

    if (p.tipo === 'Tubular') {
      const totalTubos = postesLaterales + ((arcosPorNave * (p.ancho / 3)) * naves);
      item('Tubo Galvanizado 2"x6m', Math.ceil(totalTubos), 'un', pre.tubo);
    } else {
      const totalGua = postesLaterales + postesCentrales + ((arcosPorNave * (p.ancho / 3)) * naves);
      item('Poste Guadua Tratada 6m', Math.ceil(totalGua), 'un', pre.guadua);
    }

    item('Carevaca Sencilla', totalCareS, 'un', pre.carevaca_s);
    item('Carevaca Reforzada (calibre grueso)', totalCareR, 'un', pre.carevaca_r);
    item(`Plástico Lechoso UV6+ Cal.${p.calibrePlastico} (${p.anchoPlastico} m)`, Math.ceil(areaTecho), 'm²', precioPlastico);

    if (p.anchoCanal !== '0') {
      const pCanal = PRECIO_CANAL[p.anchoCanal] || 350000;
      const lineas = 2 + (naves - 1);
      const rollos = Math.ceil((p.largo * lineas) / 100);
      item(`Canal Cal.${p.calibreCanal} (${p.anchoCanal} m) - Rollo 100 m`, rollos, 'rollos', pCanal);
    }

    if (!soloMO && extras.length > 0) {
      filas.push({ tipo: 'seccion', texto: 'Insumos adicionales', color: 'blue' });
      extras.forEach((i) => item(i.nombre, i.cantidad, 'un', i.precio));
    }

    const cObra = ((arcosPorNave * 120000) + (p.largo * 25000)) * naves;
    if (soloMO) cMat = 0;

    return {
      ok: true,
      soloManoDeObra: soloMO,
      filas,
      cMat,
      cObra,
      total: cMat + cObra,
      area: p.largo * p.ancho * naves,
      resumen: { secciones, arcosPorNave, postesLaterales, postesCentrales, areaTecho },
    };
  }

  return { PRECIOS_BASE, PRECIO_PLASTICO, PRECIO_CANAL, LIMITE_DISTANCIA, LIMITES, NOMBRE_TIPO, fCOP, validar, validarCampos, calcular };
});
