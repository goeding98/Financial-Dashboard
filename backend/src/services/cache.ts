// Registro central de caches para poder invalidarlos todos a la vez
const caches: import('node-cache')[] = [];

export function registerCache(cache: import('node-cache')) {
  caches.push(cache);
}

export function flushAllCaches() {
  caches.forEach(c => c.flushAll());
  console.log('[Cache] Todos los caches invalidados');
}
