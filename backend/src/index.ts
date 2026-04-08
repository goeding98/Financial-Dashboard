import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import financialRouter from './routes/financial';

const app = express();
const PORT = process.env.PORT || 3001;

const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173').split(',');
app.use(cors({ origin: (origin, cb) => cb(null, !origin || allowedOrigins.some(o => origin.startsWith(o.trim()))) }));
app.use(express.json());

app.use('/api', financialRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`\n🚀 Financial Dashboard API corriendo en http://localhost:${PORT}`);
  console.log(`   → Status:    http://localhost:${PORT}/api/status`);
  console.log(`   → KPIs:      http://localhost:${PORT}/api/kpis`);
  console.log(`   → P&G:       http://localhost:${PORT}/api/pnl`);
  console.log(`   → Flujo:     http://localhost:${PORT}/api/cashflow`);
  console.log(`   → Tendencia: http://localhost:${PORT}/api/trend\n`);
});
