/*
 * Servidor local para ver AgroEstructura en el computador y en el celular (misma red Wi-Fi).
 * Uso: doble clic en INICIAR_SERVIDOR.bat   (o: node herramientas/servidor.js)
 * No necesita instalar nada, solo Node.js.
 */
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const raiz = path.resolve(__dirname, '..');
const tipos = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon',
};

const servidor = http.createServer((req, res) => {
  let ruta = decodeURIComponent(req.url.split('?')[0]);
  if (ruta === '/') ruta = '/index.html';
  const archivo = path.normalize(path.join(raiz, ruta));
  if (!archivo.startsWith(raiz) || /[\\/]herramientas[\\/]/.test(archivo)) { res.writeHead(403); return res.end('Prohibido'); }
  fs.readFile(archivo, (err, datos) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
    res.writeHead(200, { 'Content-Type': tipos[path.extname(archivo).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(datos);
  });
});

function direcciones(puerto) {
  const lista = [];
  Object.values(os.networkInterfaces()).forEach((ifs) => (ifs || []).forEach((i) => {
    if (i.family === 'IPv4' && !i.internal) lista.push(`http://${i.address}:${puerto}`);
  }));
  return lista;
}

function iniciar(puerto, intentos) {
  servidor.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && intentos > 0) iniciar(puerto + 1, intentos - 1);
    else { console.error('No se pudo iniciar el servidor:', e.message); process.exit(1); }
  });
  servidor.listen(puerto, '0.0.0.0', () => {
    console.log('\n  AgroEstructura está funcionando.\n');
    console.log('  En este computador:   http://localhost:' + puerto);
    const ips = direcciones(puerto);
    if (ips.length) { console.log('  En el celular (misma red Wi-Fi):'); ips.forEach((u) => console.log('      ' + u)); }
    else console.log('  (No encontré una red. Conecta el computador a Wi-Fi para verlo desde el celular.)');
    console.log('\n  Para detenerlo: cierra esta ventana o pulsa Ctrl + C.\n');
  });
}
iniciar(Number(process.argv[2]) || 8080, 10);
