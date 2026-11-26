/*
 * AgroEstructura - Vista 3D de las estructuras (Three.js, se puede girar con el mouse o el dedo).
 *
 * Tipos (según los videos de referencia de Libardo, carpeta referencia_estructuras/):
 *   Guadua        Capilla de guadua: postes laterales y CENTRALES, alfardas, cumbrera, plástico a dos aguas.
 *   Cercha        Capilla en cercha: igual por fuera, pero SIN postes centrales; el techo lo sostiene una cercha.
 *   Tubular       Metálica: columnas, arcos curvos con ventana cenital, tirantes con refuerzos y canales.
 *   UnaAgua       Una sola agua: postes altos y bajos, alfardas inclinadas, plástico.
 *   SaranCapilla  Sarán / polisombra tipo capilla: SIN alfardas, postes altos y bajos, cables a lo largo
 *                 del invernadero que siguen 5 m por cada extremo hasta el anclaje (10 m de más), malla negra.
 *
 * Todo se arma a partir de un DISEÑO (naves una al lado de la otra, cada una con su tipo y medidas):
 *   { distancia, anchoCanal, naves: [{ tipo, ancho, largo, inicio, alturaPostes, cenital, cortinas }],
 *     canales: [bool por cada línea entre naves, de 0 (costado izquierdo) a N (costado derecho)],
 *     puertas: [{ nave, lado: 'frente'|'fondo', posicion, ancho }], terreno: [[x, z], ...] }
 *   x = a lo ancho (0 = costado izquierdo de la nave 1), z = a lo largo (0 = frente). Metros.
 * El modo simple del cotizador ({ tipo, largo, ancho, naves, distancia, anchoCanal }) es un diseño de naves iguales.
 *
 * Uso:
 *   const vista = AgroVista3D.crear(div);   // null si el navegador no tiene WebGL (se usa el dibujo 2D)
 *   vista.actualizar(params o { diseno })
 *   AgroVista3D.imagen(params o { diseno }, { ancho, alto }) -> 'data:image/png;base64,...' (para el PDF)
 *
 * Las ALTURAS son aproximadas (tomadas de los videos): ajustarlas con las medidas reales de Libardo.
 */
import * as THREE from 'three';
import { OrbitControls } from './vendor/three/OrbitControls.js';

/* ---------------------------------------------------------------- medidas aproximadas (m) */
export const ALTURAS = {
  Guadua: { canal: 3.0, subida: (A) => Math.min(Math.max(A * 0.25, 1.5), 4.5) },
  Cercha: { canal: 3.0, subida: (A) => Math.min(Math.max(A * 0.25, 1.5), 4.5) },
  Tubular: { canal: 4.0, subida: (A) => Math.min(Math.max(A * 0.24, 1.6), 3.5) },
  UnaAgua: { canal: 2.8, subida: (A) => Math.min(Math.max(A * 0.22, 1.2), 3.5) }, // canal = lado bajo
  SaranCapilla: { canal: 2.3, subida: () => 1.5, anclaje: 5 },                      // canal = postes bajos
  ventanaCenital: 0.6,
  puerta: 2.4,
};
export const NOMBRES = {
  Guadua: 'Capilla de guadua', Cercha: 'Capilla en cercha', Tubular: 'Metálica tubular',
  UnaAgua: 'Una sola agua', SaranCapilla: 'Sarán / polisombra tipo capilla',
};

const COLORES = {
  guadua: 0xc9a66b, metal: 0xaab4bf, cable: 0x2b2b2b, canal: 0x3f8f4f, canalMetal: 0x8e99a4, puerta: 0xd97706,
  plastico: 0xf2f6f0, saran: 0x16181a, suelo: 0x6f8f55, cielo: 0xdfe8ef, terreno: 0xfacc15,
};
const MAX_LINEAS = 160; // si una nave tiene más líneas de postes, se dibuja una de cada k (la vista no se vuelve lenta)
const GROSOR = 1.7;     // postes y vigas un poco más gruesos que en la realidad para que se distingan

/* ---------------------------------------------------------------- normalizar (simple o diseño) */
const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : d);
const entre = (v, a, b) => Math.min(Math.max(v, a), b);

/** Convierte lo que llegue (parámetros simples o un diseño) en un diseño válido. */
export function normalizar(entrada) {
  const e = entrada || {};
  const d = e.diseno;
  const distancia = entre(num(d ? d.distancia : e.distancia, 2.5), 0.5, 10);
  const anchoCanal = (d ? d.anchoCanal : e.anchoCanal);
  const canal = anchoCanal && anchoCanal !== '0' ? entre(num(anchoCanal, 0.9), 0.3, 2) : 0;
  let naves, canales, puertas = [], terreno = [];
  if (d && Array.isArray(d.naves) && d.naves.length) {
    naves = d.naves.slice(0, 20).map((n) => ({
      tipo: NOMBRES[n.tipo] ? n.tipo : 'Guadua',
      ancho: entre(num(n.ancho, 9), 2, 100), largo: entre(num(n.largo, 30), 2, 500),
      inicio: entre(Number(n.inicio) || 0, -500, 500),
      alturaPostes: n.alturaPostes ? entre(num(n.alturaPostes, 3), 1.5, 8) : null,
      cenital: !!n.cenital, cortinas: n.cortinas !== false,
    }));
    canales = Array.from({ length: naves.length + 1 }, (_, i) => !!(d.canales && d.canales[i]));
    puertas = (d.puertas || []).slice(0, 60).filter((p) => naves[p.nave]).map((p) => ({
      nave: p.nave, lado: p.lado === 'fondo' ? 'fondo' : 'frente',
      posicion: entre(Number(p.posicion) || 0, 0, naves[p.nave].ancho), ancho: entre(num(p.ancho, 3), 0.8, 10),
    }));
    terreno = (d.terreno || []).slice(0, 60).filter((v) => Array.isArray(v) && v.length === 2 && v.every(Number.isFinite));
  } else {
    const tipo = NOMBRES[e.tipo] ? e.tipo : 'Tubular';
    const N = entre(Math.round(num(e.naves, 1)), 1, 20);
    const nave = { tipo, ancho: entre(num(e.ancho, 24), 2, 100), largo: entre(num(e.largo, 50), 2, 500), inicio: 0, alturaPostes: null, cenital: tipo === 'Tubular', cortinas: true };
    naves = Array.from({ length: N }, () => Object.assign({}, nave));
    canales = Array.from({ length: N + 1 }, () => canal > 0); // como la fórmula: costados + entre naves
  }
  let x = 0;
  naves.forEach((n) => { n.x0 = x; x += n.ancho; });
  return { distancia, canal, naves, canales, puertas, terreno, anchoTotal: x };
}

/* ---------------------------------------------------------------- piezas */
/** Junta barras (postes, vigas, cables) y las dibuja con InstancedMesh: miles de piezas sin volverse lenta. */
class Barras {
  constructor() { this.grupos = new Map(); }
  agregar(material, a, b, radio) {
    if (!this.grupos.has(material)) this.grupos.set(material, []);
    this.grupos.get(material).push([a, b, radio]);
  }
  construir(destino) {
    const cil = new THREE.CylinderGeometry(1, 1, 1, 8, 1, false);
    const arriba = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3(), q = new THREE.Quaternion();
    const m = new THREE.Matrix4(), pos = new THREE.Vector3(), esc = new THREE.Vector3();
    for (const [material, lista] of this.grupos) {
      const malla = new THREE.InstancedMesh(cil, material, lista.length);
      lista.forEach(([a, b, r], i) => {
        dir.subVectors(b, a); const largo = dir.length() || 0.001;
        q.setFromUnitVectors(arriba, dir.normalize());
        pos.addVectors(a, b).multiplyScalar(0.5); esc.set(r * GROSOR, largo, r * GROSOR);
        malla.setMatrixAt(i, m.compose(pos, q, esc));
      });
      malla.instanceMatrix.needsUpdate = true;
      destino.add(malla);
    }
  }
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

/** Superficie a partir de un perfil (lista de [x, y]) estirado a lo largo del eje Z, de z0 a z1. */
function superficie(perfil, z0, z1, material) {
  const pos = [], idx = [];
  perfil.forEach(([x, y]) => { pos.push(x, y, z0, x, y, z1); });
  for (let i = 0; i < perfil.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return new THREE.Mesh(g, material);
}
/** Cara plana (polígono en el plano XY a la altura z): culatas y frentes. */
function cara(perfil, z, material) {
  const forma = new THREE.Shape(perfil.map(([x, y]) => new THREE.Vector2(x, y)));
  const m = new THREE.Mesh(new THREE.ShapeGeometry(forma), material); m.position.z = z; return m;
}

function materiales() {
  const std = (color, extra) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.75, metalness: 0.05 }, extra));
  return {
    guadua: std(COLORES.guadua), metal: std(COLORES.metal, { metalness: 0.6, roughness: 0.35 }),
    cable: std(COLORES.cable, { roughness: 0.9 }), canal: std(COLORES.canal, { roughness: 0.6 }),
    canalMetal: std(COLORES.canalMetal, { metalness: 0.5, roughness: 0.4 }), puerta: std(COLORES.puerta, { roughness: 0.6 }),
    plastico: std(COLORES.plastico, { transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false, roughness: 0.3 }),
    cortina: std(COLORES.plastico, { transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }),
    saran: std(COLORES.saran, { transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false, roughness: 1 }),
    hoja: std(COLORES.puerta, { transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    suelo: std(COLORES.suelo, { roughness: 1 }),
  };
}

/** Líneas de postes a lo largo de una nave, cada «distancia» desde z0 hasta z0 + largo. */
function lineasZ(z0, largo, distancia) {
  const secciones = Math.ceil(largo / distancia);
  const k = Math.max(1, Math.ceil((secciones + 1) / MAX_LINEAS));
  const zs = [];
  for (let i = 0; i <= secciones; i += k) zs.push(z0 + Math.min(i * distancia, largo));
  if (zs[zs.length - 1] !== z0 + largo) zs.push(z0 + largo);
  return zs;
}

/* ---------------------------------------------------------------- una nave de cada tipo
 * n: { tipo, x0, ancho (A), inicio (z0), largo (L), hC (altura a la canal), cenital }
 */
function naveCapilla(n, d, M, grupo, b, conCercha) {
  const A = n.ancho, x0 = n.x0, x1 = x0 + A, xm = x0 + A / 2, z0 = n.inicio, z1 = z0 + n.largo;
  const hC = n.hC, hR = hC + ALTURAS.Guadua.subida(A);
  const vent = n.cenital ? ALTURAS.ventanaCenital : 0;
  const techo = (x) => hC + (hR - hC) * (1 - Math.abs(x - xm) / (A / 2));
  const centrales = Math.max(1, Math.floor(A / 8)); // fórmula de la capilla: postes centrales por arco
  for (const z of lineasZ(z0, n.largo, d.distancia)) {
    b.agregar(M.guadua, V(x0, 0, z), V(x0, hC, z), 0.075);
    b.agregar(M.guadua, V(x1, 0, z), V(x1, hC, z), 0.075);
    if (conCercha) {
      // Cercha: tirante abajo + montantes y diagonales hasta las alfardas (sin postes al piso)
      b.agregar(M.guadua, V(x0, hC, z), V(x1, hC, z), 0.05);
      const paneles = Math.max(4, Math.round(A / 2) * 2);
      for (let k = 1; k < paneles; k++) {
        const x = x0 + (A * k) / paneles; b.agregar(M.guadua, V(x, hC, z), V(x, techo(x), z), 0.035);
        const xd = x0 + (A * (k + (x < xm ? -1 : 1))) / paneles;
        if (k !== paneles / 2) b.agregar(M.guadua, V(x, hC, z), V(xd, techo(xd), z), 0.03);
      }
    } else {
      for (let k = 1; k <= centrales; k++) { const x = x0 + (A * k) / (centrales + 1); b.agregar(M.guadua, V(x, 0, z), V(x, techo(x), z), 0.07); }
    }
    b.agregar(M.guadua, V(x0, hC, z), V(xm + (vent ? A * 0.06 : 0), hR + vent, z), 0.06); // alfardas
    b.agregar(M.guadua, V(xm, hR, z), V(x1, hC, z), 0.06);
    if (vent) b.agregar(M.guadua, V(xm, hR, z), V(xm + A * 0.06, hR + vent, z), 0.04);
  }
  b.agregar(M.guadua, V(x0, hC, z0), V(x0, hC, z1), 0.06);
  b.agregar(M.guadua, V(x1, hC, z0), V(x1, hC, z1), 0.06);
  b.agregar(M.guadua, V(xm, hR, z0), V(xm, hR, z1), 0.065); // cumbrera
  if (vent) b.agregar(M.guadua, V(xm + A * 0.06, hR + vent, z0), V(xm + A * 0.06, hR + vent, z1), 0.05);
  const izq = [[x0, hC], [xm + (vent ? A * 0.06 : 0), hR + vent]], der = [[xm, hR], [x1, hC]];
  grupo.add(superficie(izq, z0, z1, M.plastico), superficie(der, z0, z1, M.plastico));
  const culata = [[x0, hC], [xm, hR], [x1, hC]];
  grupo.add(cara(culata, z0, M.plastico), cara(culata, z1, M.plastico));
  return hR + vent;
}

/** Perfil del arco metálico (casi ojival). t de 0 a 1 = de un canal al otro. */
function perfilArco(x0, A, hC, flecha, t) { return [x0 + t * A, hC + flecha * Math.pow(Math.max(0, 1 - Math.pow(2 * t - 1, 2)), 0.62)]; }

function naveMetalica(n, d, M, grupo, b) {
  const A = n.ancho, x0 = n.x0, z0 = n.inicio, z1 = z0 + n.largo, hC = n.hC, f = ALTURAS.Tubular.subida(A);
  const vent = n.cenital ? ALTURAS.ventanaCenital : 0, PASOS = 14;
  const izq = []; for (let i = 0; i <= PASOS; i++) izq.push(perfilArco(x0, A, hC, f, (i / PASOS) * 0.5));
  if (vent) { const [xa, ya] = izq[izq.length - 1]; izq.push([xa + A * 0.06, ya + vent]); }
  const der = []; for (let i = 0; i <= PASOS; i++) der.push(perfilArco(x0, A, hC, f, 0.5 + (i / PASOS) * 0.5));
  for (const z of lineasZ(z0, n.largo, d.distancia)) {
    b.agregar(M.metal, V(x0, 0, z), V(x0, hC, z), 0.05);
    b.agregar(M.metal, V(x0 + A, 0, z), V(x0 + A, hC, z), 0.05);
    for (const tramo of [izq, der]) for (let i = 0; i < tramo.length - 1; i++) b.agregar(M.metal, V(tramo[i][0], tramo[i][1], z), V(tramo[i + 1][0], tramo[i + 1][1], z), 0.035);
    b.agregar(M.metal, V(x0, hC, z), V(x0 + A, hC, z), 0.03); // tirante
    for (const t of [0.25, 0.75]) {
      const [xa, ya] = perfilArco(x0, A, hC, f, t);
      b.agregar(M.metal, V(xa - A * 0.06, hC, z), V(xa, ya, z), 0.022);
      b.agregar(M.metal, V(xa + A * 0.06, hC, z), V(xa, ya, z), 0.022);
    }
  }
  for (const t of [0.2, 0.35, 0.65, 0.8]) { const [x, y] = perfilArco(x0, A, hC, f, t); b.agregar(M.metal, V(x, y, z0), V(x, y, z1), 0.025); }
  grupo.add(superficie(izq, z0, z1, M.plastico), superficie(der, z0, z1, M.plastico));
  const frente = [[x0, hC], ...izq.slice(0, vent ? -1 : undefined), ...der.slice(1)];
  grupo.add(cara(frente, z0, M.plastico), cara(frente, z1, M.plastico));
  return hC + f + vent;
}

function naveUnaAgua(n, d, M, grupo, b) {
  const A = n.ancho, x0 = n.x0, x1 = x0 + A, z0 = n.inicio, z1 = z0 + n.largo;
  const hB = n.hC, hA = hB + ALTURAS.UnaAgua.subida(A);
  const intermedios = Math.max(0, Math.ceil(A / 8) - 1);
  const alt = (x) => hA - (hA - hB) * ((x - x0) / A); // baja del lado alto (x0) al bajo (x1)
  for (const z of lineasZ(z0, n.largo, d.distancia)) {
    b.agregar(M.guadua, V(x0, 0, z), V(x0, hA, z), 0.075);
    b.agregar(M.guadua, V(x1, 0, z), V(x1, hB, z), 0.075);
    for (let k = 1; k <= intermedios; k++) { const x = x0 + (A * k) / (intermedios + 1); b.agregar(M.guadua, V(x, 0, z), V(x, alt(x), z), 0.07); }
    b.agregar(M.guadua, V(x0, hA, z), V(x1, hB, z), 0.06);
  }
  b.agregar(M.guadua, V(x0, hA, z0), V(x0, hA, z1), 0.06);
  b.agregar(M.guadua, V(x1, hB, z0), V(x1, hB, z1), 0.06);
  grupo.add(superficie([[x0, hA], [x1, hB]], z0, z1, M.plastico));
  const lado = [[x0, 0], [x0, hA], [x1, hB], [x1, 0]];
  grupo.add(cara(lado, z0, M.cortina), cara(lado, z1, M.cortina));
  return hA;
}

function naveSaran(n, d, M, grupo, b) {
  const A = n.ancho, x0 = n.x0, z0 = n.inicio, z1 = z0 + n.largo;
  const hB = n.hC, hA = hB + ALTURAS.SaranCapilla.subida(A), anclaje = ALTURAS.SaranCapilla.anclaje;
  const lineas = [[x0, hB], [x0 + A / 2, hA], [x0 + A, hB]]; // bajos en los bordes, altos en el centro
  for (const z of lineasZ(z0, n.largo, d.distancia)) for (const [x, h] of lineas) b.agregar(M.guadua, V(x, 0, z), V(x, h, z), h === hA ? 0.075 : 0.065);
  for (const [x, h] of lineas) {
    b.agregar(M.cable, V(x, h, z0), V(x, h, z1), 0.012);                     // cable del largo del invernadero
    b.agregar(M.cable, V(x, h, z0), V(x, 0, z0 - anclaje), 0.012);           // baja al anclaje (5 m por extremo)
    b.agregar(M.cable, V(x, h, z1), V(x, 0, z1 + anclaje), 0.012);
    for (const zz of [z0 - anclaje, z1 + anclaje]) b.agregar(M.cable, V(x, -0.2, zz), V(x, 0.25, zz), 0.05);
  }
  grupo.add(superficie(lineas, z0, z1, M.saran)); // malla negra en «V» invertida
  return hA;
}

const NAVE = {
  Guadua: (n, d, M, g, b) => naveCapilla(n, d, M, g, b, false),
  Cercha: (n, d, M, g, b) => naveCapilla(n, d, M, g, b, true),
  Tubular: naveMetalica, UnaAgua: naveUnaAgua, SaranCapilla: naveSaran,
};

/* ---------------------------------------------------------------- escena */
function armarEscena(entrada) {
  const d = normalizar(entrada);
  const M = materiales();
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(COLORES.cielo);
  escena.add(new THREE.HemisphereLight(0xffffff, 0x6f8f55, 1.6));
  const sol = new THREE.DirectionalLight(0xffffff, 1.5); sol.position.set(-40, 80, -30); escena.add(sol);

  const estructura = new THREE.Group(), b = new Barras();
  let alto = 0, zMin = Infinity, zMax = -Infinity;
  d.naves.forEach((n) => {
    n.hC = n.alturaPostes || ALTURAS[n.tipo].canal;
    alto = Math.max(alto, NAVE[n.tipo](n, d, M, estructura, b));
    zMin = Math.min(zMin, n.inicio); zMax = Math.max(zMax, n.inicio + n.largo);
  });
  // Cortinas laterales: en el costado exterior de cada nave (o donde la nave vecina es más corta)
  d.naves.forEach((n, i) => {
    if (!n.cortinas || n.tipo === 'SaranCapilla') return;
    for (const [lado, x] of [[i - 1, n.x0], [i + 1, n.x0 + n.ancho]]) {
      const vecina = d.naves[lado];
      const alto = n.tipo === 'UnaAgua' && x === n.x0 ? n.hC + ALTURAS.UnaAgua.subida(n.ancho) : n.hC;
      if (!vecina) { estructura.add(superficie([[x, 0], [x, alto]], n.inicio, n.inicio + n.largo, M.cortina)); continue; }
      const a0 = Math.max(n.inicio, vecina.inicio), a1 = Math.min(n.inicio + n.largo, vecina.inicio + vecina.largo);
      if (a0 > n.inicio) estructura.add(superficie([[x, 0], [x, alto]], n.inicio, a0, M.cortina));
      if (a1 < n.inicio + n.largo) estructura.add(superficie([[x, 0], [x, alto]], Math.max(a1, n.inicio), n.inicio + n.largo, M.cortina));
    }
  });
  // Canales en las líneas elegidas (0 = costado izquierdo … N = costado derecho). La metálica siempre lleva canal.
  const xs = d.naves.map((n) => n.x0).concat(d.anchoTotal);
  xs.forEach((x, i) => {
    const izq = d.naves[i - 1], der = d.naves[i];
    const metalica = (izq && izq.tipo === 'Tubular') || (der && der.tipo === 'Tubular');
    if (!d.canales[i] && !metalica) return;
    if ((izq && izq.tipo === 'SaranCapilla') && (!der || der.tipo === 'SaranCapilla')) return;
    const tramos = [izq, der].filter(Boolean);
    const z0 = Math.min(...tramos.map((n) => n.inicio)), z1 = Math.max(...tramos.map((n) => n.inicio + n.largo));
    const h = Math.max(...tramos.map((n) => n.hC));
    const c = new THREE.Mesh(new THREE.BoxGeometry(d.canales[i] ? d.canal || 0.9 : 0.35, 0.18, z1 - z0), d.canales[i] ? M.canal : M.canalMetal);
    c.position.set(x, h - 0.1, (z0 + z1) / 2); estructura.add(c);
  });
  // Puertas: marco y hoja en el frente o el fondo de la nave
  d.puertas.forEach((p) => {
    const n = d.naves[p.nave]; const z = p.lado === 'frente' ? n.inicio : n.inicio + n.largo;
    const xa = n.x0 + entre(p.posicion, 0, n.ancho - p.ancho), xb = xa + p.ancho, h = Math.min(ALTURAS.puerta, n.hC);
    b.agregar(M.puerta, V(xa, 0, z), V(xa, h, z), 0.07); b.agregar(M.puerta, V(xb, 0, z), V(xb, h, z), 0.07);
    b.agregar(M.puerta, V(xa, h, z), V(xb, h, z), 0.06);
    estructura.add(cara([[xa, 0], [xb, 0], [xb, h], [xa, h]], z + (p.lado === 'frente' ? -0.02 : 0.02), M.hoja));
  });
  b.construir(estructura);

  // Centrar todo (estructura y terreno) en el origen
  const W = d.anchoTotal;
  let minX = 0, maxX = W, minZ = zMin, maxZ = zMax;
  d.terreno.forEach(([x, z]) => { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); });
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  estructura.position.set(-cx, 0, -cz);
  escena.add(estructura);
  if (d.terreno.length >= 3) {
    const pts = d.terreno.map(([x, z]) => new THREE.Vector3(x - cx, 0.05, z - cz));
    const linea = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: COLORES.terreno }));
    escena.add(linea);
  }
  const anclaje = d.naves.some((n) => n.tipo === 'SaranCapilla') ? ALTURAS.SaranCapilla.anclaje : 0;
  const margen = 8 + anclaje, anchoS = maxX - minX, largoS = maxZ - minZ;
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(anchoS + margen * 2, largoS + margen * 2), M.suelo);
  suelo.rotation.x = -Math.PI / 2; escena.add(suelo);

  const radio = Math.sqrt(anchoS * anchoS + largoS * largoS + alto * alto) / 2;
  const cubiertas = []; estructura.traverse((o) => { if (o.material === M.plastico || o.material === M.saran || o.material === M.cortina) cubiertas.push(o); });
  return { escena, radio, alto, cubiertas, d, liberar: () => { escena.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); Object.values(M).forEach((m) => m.dispose()); } };
}

function encuadrar(camara, controles, radio, alto, aspecto) {
  camara.aspect = aspecto; camara.near = 0.1; camara.far = radio * 20 + 200;
  const dist = radio / Math.sin(THREE.MathUtils.degToRad(camara.fov / 2)) * (aspecto < 1 ? 1.05 : 0.7);
  const dir = new THREE.Vector3(-0.95, 0.3, 1).normalize(); // de frente y desde la esquina, poco elevada (como en los videos)
  const objetivo = new THREE.Vector3(0, alto * 0.45, 0);
  camara.position.copy(objetivo).addScaledVector(dir, dist);
  camara.lookAt(objetivo); camara.updateProjectionMatrix();
  if (controles) { controles.target.copy(objetivo); controles.maxDistance = dist * 3; controles.minDistance = Math.max(3, radio * 0.15); controles.update(); }
}

function webglDisponible() {
  try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; }
}

function describir(d) {
  const n = d.naves; const area = n.reduce((s, x) => s + x.ancho * x.largo, 0);
  const tipos = [...new Set(n.map((x) => NOMBRES[x.tipo]))].join(' + ');
  return `Vista 3D: ${tipos}, ${n.length} nave${n.length > 1 ? 's' : ''}, ${Math.round(area).toLocaleString('es-CO')} m²` +
    (n.length && n.every((x) => x.ancho === n[0].ancho && x.largo === n[0].largo) ? `, ${n[0].largo} m de largo, ${n[0].ancho} m por nave` : '');
}

/** Vista interactiva dentro de un contenedor. Devuelve null si no hay WebGL (se usa el dibujo 2D). */
function crear(contenedor) {
  if (!contenedor || !webglDisponible()) return null;
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.domElement.style.display = 'block'; renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%';
  renderer.domElement.setAttribute('role', 'img');
  contenedor.appendChild(renderer.domElement);
  const camara = new THREE.PerspectiveCamera(40, 1, 0.1, 2000);
  const controles = new OrbitControls(camara, renderer.domElement);
  controles.enableDamping = true; controles.dampingFactor = 0.08; controles.maxPolarAngle = Math.PI / 2 - 0.03;
  let actual = null, pedido = false, temporizador = null, verCubierta = true, ultimaClave = '', ultimaForma = '';

  const dibujar = () => { pedido = false; if (controles.update()) pedir(); if (actual) renderer.render(actual.escena, camara); };
  const pedir = () => { if (!pedido) { pedido = true; requestAnimationFrame(dibujar); } };
  controles.addEventListener('change', pedir);
  const medir = () => {
    const w = contenedor.clientWidth || 600, h = contenedor.clientHeight || 300;
    renderer.setSize(w, h, false); camara.aspect = w / h; camara.updateProjectionMatrix(); pedir();
  };
  const ro = new ResizeObserver(medir); ro.observe(contenedor);

  return {
    /** Redibuja (espera 120 ms para no rehacerla en cada tecla). Reencuadra la cámara solo si cambia el tamaño o la forma. */
    actualizar(entrada) {
      clearTimeout(temporizador);
      temporizador = setTimeout(() => {
        const d = normalizar(entrada);
        const clave = JSON.stringify(d);
        if (clave === ultimaClave) return;
        const forma = JSON.stringify(d.naves.map((n) => [n.tipo, n.ancho, n.largo, n.inicio])) + JSON.stringify(d.terreno);
        const nuevo = armarEscena(entrada);
        if (actual) actual.liberar();
        actual = nuevo; ultimaClave = clave;
        actual.cubiertas.forEach((c) => { c.visible = verCubierta; });
        renderer.domElement.setAttribute('aria-label', describir(actual.d));
        if (forma !== ultimaForma) { ultimaForma = forma; encuadrar(camara, controles, actual.radio, actual.alto, (contenedor.clientWidth || 600) / (contenedor.clientHeight || 300)); }
        pedir();
      }, actual ? 120 : 0);
    },
    vistaInicial() { if (actual) { encuadrar(camara, controles, actual.radio, actual.alto, camara.aspect); pedir(); } },
    /** Muestra u oculta el plástico / la malla para ver el esqueleto de la estructura. */
    cubierta(visible) { verCubierta = !!visible; if (actual) actual.cubiertas.forEach((c) => { c.visible = verCubierta; }); pedir(); return verCubierta; },
    foto() { if (actual) renderer.render(actual.escena, camara); return renderer.domElement.toDataURL('image/png'); },
    destruir() { ro.disconnect(); controles.dispose(); if (actual) actual.liberar(); renderer.dispose(); renderer.domElement.remove(); },
  };
}

/** Imagen PNG de la estructura (sin pantalla): para el PDF y el correo. */
function imagen(entrada, opciones) {
  if (!webglDisponible()) return '';
  const o = Object.assign({ ancho: 1200, alto: 640 }, opciones);
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  try {
    renderer.setPixelRatio(1); renderer.setSize(o.ancho, o.alto, false);
    const e = armarEscena(entrada);
    const camara = new THREE.PerspectiveCamera(40, o.ancho / o.alto, 0.1, 2000);
    encuadrar(camara, null, e.radio, e.alto, o.ancho / o.alto);
    renderer.render(e.escena, camara);
    const url = renderer.domElement.toDataURL('image/png');
    e.liberar();
    return url;
  } catch (err) { return ''; } finally { renderer.dispose(); renderer.forceContextLoss(); }
}

window.AgroVista3D = { crear, imagen, normalizar, NOMBRES, ALTURAS, disponible: webglDisponible() };
document.dispatchEvent(new Event('agro:3d-listo'));
