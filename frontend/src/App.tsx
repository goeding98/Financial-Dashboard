import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import PnL from './pages/PnL';
import CashFlow from './pages/CashFlow';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="pnl" element={<PnL />} />
          <Route path="cashflow" element={<CashFlow />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
