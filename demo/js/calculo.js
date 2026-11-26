/*
 * AgroEstructura - Validaciones y nombres compartidos por las páginas.
 * El CÁLCULO con precios ya no está aquí: lo hace el servidor (backend/calculo.py), para que
 * los precios no lleguen al navegador del cliente. Aquí solo quedan los rangos válidos, la
 * validación de los campos (para avisar antes de enviar) y los nombres de las estructuras.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AgroCalculo = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  // Separación máxima permitida entre postes / arcos (m)
  const LIMITE_DISTANCIA = { Tubular: 5, Guadua: 4, Cercha: 4, UnaAgua: 4, SaranCapilla: 4 }; // los 3 últimos: provisional (pendiente con el dueño)

  const NOMBRE_TIPO = { Tubular: 'Metálico Tubular', Guadua: 'Capilla de Guadua', Cercha: 'Capilla en cercha', UnaAgua: 'Una sola agua', SaranCapilla: 'Sarán capilla' };

  const fCOP = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);

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
        : p.tipo === 'Tubular'
          ? 'Alerta técnica: para Tubular los arcos no deben superar 5 m de separación.'
          : `Alerta técnica: para ${NOMBRE_TIPO[p.tipo]} los postes no deben superar ${lim} m de separación.` });
    }
    return errores;
  }
  /** Lista de mensajes de error (vacía si los datos son válidos). */
  const validar = (p) => validarCampos(p).map((e) => e.mensaje);

  /**
   * Qué incluye el valor total que se le entrega al cliente (texto definido por el dueño).
   * Se usa en el PDF, en la pantalla del cliente y en el mensaje de WhatsApp.
   */
  const INCLUYE = {
    todoCosto: ['Mano de obra', 'Precio de los materiales', 'Acarreo de los materiales hasta el punto de construcción'],
    soloManoDeObra: ['Mano de obra'],
  };
  const NOTA_SOLO_MANO_DE_OBRA = 'Los materiales los aporta el cliente.';
  /** Frase corta: «Incluye mano de obra, precio de los materiales y acarreo de los materiales hasta el punto de construcción». */
  function textoIncluye(soloManoDeObra) {
    const l = (soloManoDeObra ? INCLUYE.soloManoDeObra : INCLUYE.todoCosto).map((t) => t.charAt(0).toLowerCase() + t.slice(1));
    const frase = 'Incluye ' + (l.length > 1 ? l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1] : l[0]) + '.';
    return soloManoDeObra ? frase + ' ' + NOTA_SOLO_MANO_DE_OBRA : frase;
  }

  return { LIMITE_DISTANCIA, LIMITES, NOMBRE_TIPO, fCOP, validar, validarCampos, INCLUYE, NOTA_SOLO_MANO_DE_OBRA, textoIncluye };
});
