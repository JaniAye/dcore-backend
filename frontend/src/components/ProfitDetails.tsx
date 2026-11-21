import React, { useEffect, useState } from 'react';
import { ArrowLeft, X } from 'lucide-react';
import { api } from '../services/api';
import { DeliveryOrderDto, ProfitBreakdownDto, SaleDto } from '../types';
import { formatCurrency } from '../utils/format';

type BillRow = {
  key: string;
  type: 'POS' | 'Delivery';
  reference: string;
  customer: string;
  income: number;
  cost: number;
  items: Array<{ name: string; quantity: number; unitPrice: number; unitCost: number }>;
};

const amount = (value?: number | null) => Number(value ?? 0);

const saleBill = (sale: SaleDto): BillRow => {
  const items = (sale.items || []).filter(item => !item.cancelled).map(item => ({
    name: item.productName,
    quantity: item.quantity,
    unitPrice: amount(item.subtotal) / Math.max(1, item.quantity),
    unitCost: amount(item.purchasePrice)
  }));
  const income = items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
  const cost = items.reduce((total, item) => total + item.unitCost * item.quantity, 0);
  return {
    key: `pos-${sale.id}`,
    type: 'POS',
    reference: sale.invoiceId,
    customer: sale.customerName || sale.customerMobile || 'Walk-in customer',
    income,
    cost,
    items
  };
};

const deliveryBill = (order: DeliveryOrderDto): BillRow => {
  const items = (order.items || []).map(item => ({
    name: item.productName,
    quantity: item.quantity,
    unitPrice: amount(item.sellingPrice),
    unitCost: amount(item.purchasePrice)
  }));
  return {
    key: `delivery-${order.id}`,
    type: 'Delivery',
    reference: `Delivery #${order.id}`,
    customer: order.mobileNumber || order.customerMobile || 'No mobile number',
    income: amount(order.codAmount) - amount(order.deliveryFee),
    cost: items.reduce((total, item) => total + item.unitCost * item.quantity, 0),
    items
  };
};

export const ProfitDetails: React.FC<{ month: string; onBack: () => void }> = ({ month, onBack }) => {
  const [billsByDate, setBillsByDate] = useState<Record<string, BillRow[]>>({});
  const [monthlyReport, setMonthlyReport] = useState<ProfitBreakdownDto | null>(null);
  const [selectedBill, setSelectedBill] = useState<BillRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const [yearText, monthText] = month.split('-');
    Promise.all([
      api.sales.getAll(),
      api.deliveryOrders.getAll(),
      api.reports.getMonthlyProfit(Number(yearText), Number(monthText))
    ])
      .then(([sales, orders, report]) => {
        const grouped: Record<string, BillRow[]> = {};
        const addBill = (date: string, bill: BillRow) => {
          if (!date.startsWith(month)) return;
          const today = new Date().toISOString().slice(0, 10);
          if (month === today.slice(0, 7) && date > today) return;
          (grouped[date] ||= []).push(bill);
        };

        sales
          .filter(sale => !sale.cancelled && !sale.isInternal)
          .forEach(sale => addBill(sale.createdAt.slice(0, 10), saleBill(sale)));
        orders
          .filter(order => order.status === 'DELIVERED')
          .forEach(order => addBill((order.deliveredAt || order.orderDate).slice(0, 10), deliveryBill(order)));

        Object.values(grouped).forEach(bills => bills.sort((first, second) => first.reference.localeCompare(second.reference)));
        if (active) {
          setBillsByDate(grouped);
          setMonthlyReport(report);
        }
      })
      .catch(() => {
        if (active) setError('Unable to load monthly bill details. Please try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [month]);

  const dates = Object.keys(billsByDate).sort();
  const monthIncome = dates.reduce((total, date) => total + billsByDate[date].reduce((dayTotal, bill) => dayTotal + bill.income, 0), 0);
  const monthProfit = dates.reduce((total, date) => total + billsByDate[date].reduce((dayTotal, bill) => dayTotal + bill.income - bill.cost, 0), 0);

  return (
    <section>
      <header className="page-header">
        <div>
          <button type="button" className="btn btn-secondary" onClick={onBack} style={{ marginBottom: '1rem' }}>
            <ArrowLeft size={16} /> Dashboard
          </button>
          <h1>Monthly Profit Breakdown</h1>
          <p className="page-subtitle">{month} · delivered orders are grouped by completion date</p>
        </div>
      </header>

      <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
        <div className="glass-panel stat-card">
          <span className="stat-title">Bill Income</span>
          <div className="stat-value">{formatCurrency(monthIncome)}</div>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-title">Bill Profit Before Expenses</span>
          <div className={`stat-value ${monthProfit >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(monthProfit)}</div>
        </div>
        <div className="glass-panel stat-card">
          <span className="stat-title">Net Profit After Expenses</span>
          <div className={`stat-value ${(monthlyReport?.netProfit ?? 0) >= 0 ? 'text-success' : 'text-danger'}`}>{formatCurrency(monthlyReport?.netProfit)}</div>
        </div>
      </div>

      {error && <div className="glass-panel" role="alert" style={{ marginBottom: '1rem' }}>{error}</div>}
      {loading ? <div className="glass-panel">Loading monthly bills...</div> : dates.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No eligible sales or delivered orders for this month.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {dates.map(date => {
            const bills = billsByDate[date];
            const dayIncome = bills.reduce((total, bill) => total + bill.income, 0);
            const dayProfit = bills.reduce((total, bill) => total + bill.income - bill.cost, 0);
            return (
              <section className="glass-panel" key={date} style={{ padding: 0, overflow: 'hidden' }}>
                <header style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-glass)' }}>
                  <h2 style={{ fontSize: '1rem' }}>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })}</h2>
                  <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', fontSize: '0.9rem' }}>
                    <span>Income <strong>{formatCurrency(dayIncome)}</strong></span>
                    <span>Profit <strong className={dayProfit >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(dayProfit)}</strong></span>
                  </div>
                </header>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ minWidth: 560 }}>
                    <thead><tr><th>Bill</th><th>Type</th><th>Mobile / Customer</th><th>Income</th><th>Profit</th></tr></thead>
                    <tbody>
                      {bills.map(bill => {
                        const profit = bill.income - bill.cost;
                        return (
                          <tr key={bill.key} onClick={() => setSelectedBill(bill)} style={{ cursor: 'pointer' }}>
                            <td><button type="button" className="link-button" onClick={() => setSelectedBill(bill)}>{bill.reference}</button></td>
                            <td>{bill.type}</td>
                            <td>{bill.customer}</td>
                            <td>{formatCurrency(bill.income)}</td>
                            <td className={profit >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(profit)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}
        </div>
      )}

      {selectedBill && (
        <div role="presentation" onClick={() => setSelectedBill(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.68)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="bill-detail-title" className="glass-panel" onClick={event => event.stopPropagation()} style={{ width: 'min(720px, 100%)', maxHeight: '85vh', overflow: 'auto' }}>
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
              <div><h2 id="bill-detail-title">{selectedBill.reference}</h2><p className="page-subtitle">{selectedBill.type} · {selectedBill.customer}</p></div>
              <button type="button" className="icon-button" aria-label="Close bill details" onClick={() => setSelectedBill(null)}><X size={18} /></button>
            </header>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ minWidth: 480 }}>
                <thead><tr><th>Item</th><th>Qty</th><th>Unit Income</th><th>Unit Cost</th></tr></thead>
                <tbody>{selectedBill.items.map((item, index) => (
                  <tr key={`${item.name}-${index}`}><td>{item.name}</td><td>{item.quantity}</td><td>{formatCurrency(item.unitPrice)}</td><td>{formatCurrency(item.unitCost)}</td></tr>
                ))}</tbody>
              </table>
            </div>
            <footer style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-glass)' }}>
              <strong>Bill income</strong><strong>{formatCurrency(selectedBill.income)}</strong>
            </footer>
            <p style={{ textAlign: 'right', marginTop: '0.5rem' }}>Profit: <strong className={selectedBill.income - selectedBill.cost >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(selectedBill.income - selectedBill.cost)}</strong></p>
          </section>
        </div>
      )}
    </section>
  );
};