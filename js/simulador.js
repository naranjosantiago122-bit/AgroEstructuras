/*
 * AgroEstructura - Simulador de estructura (canvas en perspectiva).
 * Dibujo tomado del index.html original: arcos/capillas hacia el fondo según la distancia entre postes,
 * naves acopladas y canales marcados en verde.
 */
(function () {
  const W = 600, H = 260; // tamaño lógico del dibujo

  /** p: { tipo: 'Tubular'|'Guadua', naves, distancia, anchoCanal, largo, ancho }  ->  { ok, mensaje } */
  function dibujar(canvas, p) {
    if (!canvas) return { ok: false, mensaje: '' };
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    if (canvas.width !== W * dpr) { canvas.width = W * dpr; canvas.height = H * dpr; }
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    const tipo = p.tipo;
    const distancia = p.distancia > 0 ? p.distancia : 2.5;
    const limite = AgroCalculo.LIMITE_DISTANCIA[tipo];
    if (distancia > limite) {
      ctx.fillStyle = '#ef4444'; ctx.font = 'bold 14px "Work Sans", sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('ALERTA TÉCNICA: LA DISTANCIA ENTRE POSTES SUPERA EL LÍMITE', W / 2, H / 2 - 8);
      ctx.fillStyle = '#94a3b8'; ctx.font = '12px "Work Sans", sans-serif';
      ctx.fillText(`Máximo permitido para ${AgroCalculo.NOMBRE_TIPO[tipo]}: ${limite} m`, W / 2, H / 2 + 14);
      return { ok: false, mensaje: `La distancia entre postes supera el máximo permitido (${limite} m).` };
    }

    const naves = Math.min(Math.max(parseInt(p.naves, 10) || 1, 1), 5); // se dibujan hasta 5 naves
    const hayCanal = p.anchoCanal && p.anchoCanal !== '0';
    const margenH = 50;
    const anchoDisp = (W - 100) - (margenH * 1.5);
    const anchoNave = anchoDisp / naves;
    const pasos = distancia <= 2.5 ? 4 : (distancia <= 4 ? 3 : 2);

    for (let j = pasos - 1; j >= 0; j--) { // de atrás hacia adelante
      const dx = j * 22, dy = j * -16;
      const op = 1 - (j * (1 / pasos));
      ctx.lineWidth = j === 0 ? 3 : 1.5;
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';

      ctx.strokeStyle = `rgba(71, 85, 105, ${op * 0.5})`;
      ctx.beginPath(); ctx.moveTo(10 + dx, 220 + dy); ctx.lineTo(W - 50 + dx, 220 + dy); ctx.stroke();

      for (let i = 0; i < naves; i++) {
        const x0 = margenH + (i * anchoNave) + dx;
        const xc = x0 + anchoNave / 2;
        const x1 = x0 + anchoNave;
        const yBase = 220 + dy, yPared = 140 + dy;

        if (tipo === 'Tubular') {
          ctx.strokeStyle = `rgba(96, 165, 250, ${op})`;
          ctx.beginPath(); ctx.moveTo(x0, yPared); ctx.quadraticCurveTo(xc - 4, yPared - 55, xc - 4, yPared - 55); ctx.stroke();   // arco izquierdo
          ctx.beginPath(); ctx.moveTo(xc + 6, yPared - 62); ctx.quadraticCurveTo(xc + 6, yPared - 55, x1, yPared); ctx.stroke();      // arco derecho (ventana cenital)
          ctx.beginPath(); ctx.moveTo(x0, yBase); ctx.lineTo(x0, yPared); ctx.moveTo(x1, yBase); ctx.lineTo(x1, yPared); ctx.stroke(); // columnas
        } else {
          ctx.strokeStyle = `rgba(217, 119, 6, ${op})`;
          ctx.beginPath(); ctx.moveTo(x0, yPared); ctx.lineTo(xc, yPared - 45); ctx.lineTo(x1, yPared); ctx.stroke();                 // dos aguas
          ctx.beginPath(); ctx.moveTo(x0, yBase); ctx.lineTo(x0, yPared); ctx.moveTo(x1, yBase); ctx.lineTo(x1, yPared); ctx.stroke(); // columnas
          ctx.strokeStyle = `rgba(245, 158, 11, ${op})`;
          ctx.beginPath(); ctx.moveTo(xc, yBase); ctx.lineTo(xc, yPared - 45); ctx.stroke();                                          // poste central
        }

        if (j < pasos - 1) { // correas longitudinales hacia el fondo
          const xs = margenH + (i * anchoNave) + (j + 1) * 22;
          const ys = 140 + (j + 1) * -16;
          ctx.strokeStyle = `rgba(148, 163, 184, ${op * 0.3})`;
          ctx.beginPath(); ctx.moveTo(x0, yPared); ctx.lineTo(xs, ys); ctx.stroke();
        }

        if (j === 0 && hayCanal) { // canales frontales
          ctx.fillStyle = '#22c55e';
          ctx.beginPath(); ctx.arc(x0, yPared, 5, 0, Math.PI * 2); ctx.arc(x1, yPared, 5, 0, Math.PI * 2); ctx.fill();
        }
      }
    }

    // Cotas
    ctx.textAlign = 'center'; ctx.fillStyle = '#94a3b8'; ctx.font = '600 11px "Space Grotesk", sans-serif';
    if (p.largo > 0 && p.ancho > 0) ctx.fillText(`LARGO ${p.largo} m  ·  ANCHO ${p.ancho} m  ·  ${p.naves} NAVE${p.naves > 1 ? 'S' : ''}`, W / 2, H - 14);

    let mensaje;
    if (tipo === 'Tubular') {
      mensaje = `Estructura modular tubular abierta con ventilación cenital. Módulos: ${p.naves}. Luz libre, sin postes de obstrucción.`;
    } else {
      mensaje = `Estructura tipo capilla de guadua con ${p.naves} nave${p.naves > 1 ? 's' : ''} acoplada${p.naves > 1 ? 's' : ''}. Requiere hileras de postes centrales cada ${distancia} m.`;
    }
    if (parseInt(p.naves, 10) > 5) mensaje += ' (El dibujo muestra un máximo de 5 naves; el cálculo usa todas.)';
    return { ok: true, mensaje };
  }

  window.AgroSimulador = { dibujar };
})();
