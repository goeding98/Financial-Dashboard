import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import financialRouter from './routes/financial';
import { siigoService } from './services/siigo';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.some(o => origin.startsWith(o.trim()))) }));
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
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      try {
        // 1) Fetch facturas del mes (llama a Siigo, llena invoice cache)
        await siigoService.getRevenueByMonth(y, m);
        // 2) Calcular sedes usando invoice cache ya lleno — sin llamadas extra a Siigo
        await siigoService.getRevenueByMonth(y, m, 'Colseguros');
        await siigoService.getRevenueByMonth(y, m, 'Ciudad Jardin');
        // 3) Revenue por tipo (también usa invoice cache)
        await siigoService.getRevenueByType(y, m);
        await siigoService.getRevenueByType(y, m, 'Colseguros');
        await siigoService.getRevenueByType(y, m, 'Ciudad Jardin');
        console.log(`[Prewarm] ${m}/${y} listo (all + 2 sedes)`);
      } catch (e: any) {
        console.warn(`[Prewarm] ${m}/${y} error:`, e.message);
      }
    }
    console.log('[Prewarm] Cache precalentado ✓');
  }, 8000); // esperar 8s a que el server esté estable
});
