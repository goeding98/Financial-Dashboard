import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import financialRouter from './routes/financial';
import { siigoService } from './services/siigo';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || '').split(',').filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (origin.includes('localhost')) return cb(null, true);
    if (origin.endsWith('.vercel.app')) return cb(null, true);
    if (allowedOrigins.some(o => origin.startsWith(o.trim()))) return cb(null, true);
    cb(new Error('Not allowed by CORS'));
  },
}));
app.use(express.json());

app.use('/api', financialRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`\n🚀 Financial Dashboard API corriendo en http://localhost:${PORT}\n`);

  // Verificar variables críticas
  if (!process.env.SIIGO_USERNAME || !process.env.SIIGO_ACCESS_KEY) {
    console.error('⚠️  CRÍTICO: SIIGO_USERNAME o SIIGO_ACCESS_KEY no están configuradas. Revisa las variables en Railway!');
  } else {
    console.log(`[Config] Siigo: ${process.env.SIIGO_USERNAME} ✓`);
  }

  // Pre-calentar cache: fetching últimos 3 meses en segundo plano al iniciar
  setTimeout(async () => {
    const now = new Date();
    console.log('[Prewarm] Iniciando precarga de cache...');

    // 1) Mapa de productos primero (lo usan todos los cálculos de tipo)
    await siigoService.getProductReferenceMap().catch((e: any) =>
      console.warn('[Prewarm] Products error:', e.message)
    );

    // 2) Dos meses: actual + anterior (secuencial para no saturar Siigo)
    for (let i = 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      try {
        await siigoService.getRevenueByMonth(y, m); // trae facturas → cache
        // Con facturas en cache, el resto es cálculo local — corre en paralelo
        await Promise.all([
          siigoService.getRevenueByMonth(y, m, 'Colseguros'),
          siigoService.getRevenueByMonth(y, m, 'Ciudad Jardin'),
          siigoService.getRevenueByType(y, m),
          siigoService.getRevenueByType(y, m, 'Colseguros'),
          siigoService.getRevenueByType(y, m, 'Ciudad Jardin'),
        ]);
        console.log(`[Prewarm] ${m}/${y} listo`);
      } catch (e: any) {
        console.warn(`[Prewarm] ${m}/${y} error:`, e.message);
      }
    }
    console.log('[Prewarm] Cache precalentado ✓');
  }, 2000); // 2s para que el server esté estable antes de golpear Siigo
});
