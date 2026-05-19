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
  // Sin prewarm automático — el cache se llena de forma lazy en el primer request.
  // Esto evita saturar Siigo al arrancar y competir con requests reales del usuario.
  console.log('[Cache] Listo — se llenará en el primer request.');
});
