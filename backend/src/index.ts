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

  // Pre-calentar cache: fetching últimos 3 meses en segundo plano al iniciar
  setTimeout(async () => {
    const now = new Date();
    console.log('[Prewarm] Iniciando precarga de cache...');
    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      try {
        await siigoService.getRevenueByMonth(y, m);
        await siigoService.getRevenueByType(y, m);
        console.log(`[Prewarm] ${m}/${y} listo`);
      } catch (e: any) {
        console.warn(`[Prewarm] ${m}/${y} error:`, e.message);
      }
    }
    console.log('[Prewarm] Cache precalentado ✓');
  }, 8000); // esperar 8s a que el server esté estable
});
