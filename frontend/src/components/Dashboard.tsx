import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DeliveryOrderDto, ProductDto, ProfitBreakdownDto } from '../types';
import { InventoryStockFilter } from './Inventory';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Package, 
  ArrowUpRight, 
  TrendingDown, 
  Calendar,
  Truck
} from 'lucide-react';

interface DashboardProps {
  onOpenDeliveryOrders: () => void;
  onOpenInventory: (filter: InventoryStockFilter) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onOpenDeliveryOrders, onOpenInventory }) => {
  const [dailySales, setDailySales] = useState<number>(0);
  const [monthlyReport, setMonthlyReport] = useState<ProfitBreakdownDto | null>(null);
  const [productCount, setProductCount] = useState<number>(0);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [customerCount, setCustomerCount] = useState<number>(0);
  const [deliveryOrders, setDeliveryOrders] = useState<DeliveryOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [yearMonth, setYearMonth] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  });

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Daily Sales
      const sales = await api.reports.getDailySales(date);
      setDailySales(sales);

      // 2. Monthly Profit Report
      const [yearStr, monthStr] = yearMonth.split('-');
      const report = await api.reports.getMonthlyProfit(parseInt(yearStr), parseInt(monthStr));
      setMonthlyReport(report);

      // 3. Products
      const products = await api.products.getAll();
      setProductCount(products.length);
      setProducts(products);

      // 4. Customers
      const customers = await api.customers.getAll();
      setCustomerCount(customers.length);

      // Delivery metrics are derived from the same order data used by Delivery Management.
      const orders = await api.deliveryOrders.getAll();
      setDeliveryOrders(orders);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch dashboard reports. Ensure your session has Super Admin privileges.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [date, yearMonth]);

  const pendingDeliveryCount = deliveryOrders.filter(order => order.status === 'PENDING').length;
  const activeProductCount = products.filter(product => product.totalStock > 0).length;
  const stockOutProductCount = products.filter(product => product.totalStock === 0).length;
  const almostOutProductCount = products.filter(product => product.totalStock > 0 && product.totalStock < 5).length;
  const shippedDeliveryCount = deliveryOrders.filter(order => order.status === 'READY').length;
  const monthlyDeliveryCount = deliveryOrders.filter(order => order.orderDate.startsWith(yearMonth)).length;
  const shippedDeliveryIncome = deliveryOrders
    .filter(order => order.status === 'READY')
    .reduce((total, order) => total + order.items.reduce((orderTotal, item) => (
      orderTotal + (item.sellingPrice || 0) * item.quantity
    ), 0), 0);

  if (loading && !monthlyReport) {
    return <div className="text-center mt-4">Loading dashboard insights...</div>;
  }

  return (
    <div className="flex-col gap-4">
      <div className="page-header flex justify-between align-center">
        <div>
          <h1>Dashboard & Reports</h1>
          <p className="page-subtitle">Real-time distribution analytics and profit monitoring</p>
        </div>
        
        <div className="flex gap-4">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Sales Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Profit Month</label>
            <input 
              type="month" 
              className="form-input" 
              value={yearMonth} 
              onChange={(e) => setYearMonth(e.target.value)} 
            />
          </div>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--accent-danger)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '2rem'
        }}>
          {error}
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="stats-grid">
        <div className="glass-panel stat-card">
          <span className="stat-title">Daily Sales</span>
          <div className="stat-value text-accent">${dailySales.toFixed(2)}</div>
          <div className="stat-trend trend-up">
            <Calendar size={14} />
            <span>For selected date</span>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-title">Net Profit (Monthly)</span>
          <div className={`stat-value ${monthlyReport && monthlyReport.netProfit >= 0 ? 'text-success' : 'text-danger'}`}>
            ${monthlyReport ? monthlyReport.netProfit.toFixed(2) : '0.00'}
          </div>
          <div className="stat-trend">
            {monthlyReport && monthlyReport.netProfit >= 0 ? (
              <span className="trend-up flex align-center gap-2"><TrendingUp size={14} /> Profit margins active</span>
            ) : (
              <span className="trend-down flex align-center gap-2"><TrendingDown size={14} /> Expenses exceed revenue</span>
            )}
          </div>
        </div>

        <button type="button" className="glass-panel stat-card" onClick={() => onOpenInventory('IN_STOCK')} style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
          <span className="stat-title">Active Products</span>
          <div className="stat-value">{activeProductCount}</div>
          <div className="stat-trend trend-up">
            <Package size={14} />
            <span>Products currently in stock</span>
          </div>
        </button>

        <button type="button" className="glass-panel stat-card" onClick={() => onOpenInventory('OUT_OF_STOCK')} style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
          <span className="stat-title">Out-of-Stock Products</span>
          <div className="stat-value text-danger">{stockOutProductCount}</div>
          <div className="stat-trend trend-down">
            <Package size={14} />
            <span>Products with zero stock</span>
          </div>
        </button>

        <button type="button" className="glass-panel stat-card" onClick={() => onOpenInventory('ALMOST_OUT')} style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
          <span className="stat-title">Almost Out Products</span>
          <div className="stat-value" style={{ color: 'var(--accent-warning)' }}>{almostOutProductCount}</div>
          <div className="stat-trend">
            <Package size={14} />
            <span>Less than 5 units remaining</span>
          </div>
        </button>

        {/* <div className="glass-panel stat-card">
          <span className="stat-title">Registered Customers</span>
          <div className="stat-value">{customerCount}</div>
          <div className="stat-trend trend-up">
            <Users size={14} />
            <span>Active accounts</span>
          </div>
        </div> */}

        <button type="button" className="glass-panel stat-card" onClick={onOpenDeliveryOrders} style={{ textAlign: 'left', color: 'inherit', cursor: 'pointer' }}>
          <span className="stat-title">Pending Deliveries</span>
          <div className="stat-value text-accent">{pendingDeliveryCount}</div>
          <div className="stat-trend trend-up">
            <Truck size={14} />
            <span>Open delivery inspection</span>
          </div>
        </button>

        <div className="glass-panel stat-card">
          <span className="stat-title">Shipped Deliveries</span>
          <div className="stat-value text-success">{shippedDeliveryCount}</div>
          <div className="stat-trend trend-up">
            <Truck size={14} />
            <span>Ready orders</span>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-title">Shipped Item Income</span>
          <div className="stat-value text-success">${shippedDeliveryIncome.toFixed(2)}</div>
          <div className="stat-trend trend-up">
            <DollarSign size={14} />
            <span>Items only, fees excluded</span>
          </div>
        </div>

        <div className="glass-panel stat-card">
          <span className="stat-title">Monthly Delivery Orders</span>
          <div className="stat-value">{monthlyDeliveryCount}</div>
          <div className="stat-trend">
            <Calendar size={14} />
            <span>For {yearMonth}</span>
          </div>
        </div>
      </div>

      {/* Profit breakdown panels */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        <div className="glass-panel">
          <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>Monthly Financial Statement</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>({yearMonth})</span>
          </h2>
          {monthlyReport ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1.25rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '4px solid var(--accent-primary)'
              }}>
                <div>
                  <span style={{ fontWeight: 650 }}>Total Revenue (Sales)</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Gross invoice income generated this month</p>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
                  ${monthlyReport.totalSales.toFixed(2)}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1.25rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '4px solid var(--accent-warning)'
              }}>
                <div>
                  <span style={{ fontWeight: 650 }}>Cost of Goods Sold (COGS)</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Buying prices and batch expenses of sold products</p>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-warning)' }}>
                  -${monthlyReport.totalCostOfSales.toFixed(2)}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1.25rem',
                background: 'rgba(255,255,255,0.02)',
                borderRadius: 'var(--radius-md)',
                borderLeft: '4px solid var(--accent-danger)'
              }}>
                <div>
                  <span style={{ fontWeight: 650 }}>Miscellaneous Operating Expenses</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Rent, utilities, damage controls, etc. recorded in logs</p>
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-danger)' }}>
                  -${monthlyReport.totalMiscExpenses.toFixed(2)}
                </div>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '1.5rem',
                background: monthlyReport.netProfit >= 0 ? 'rgba(16, 185, 129, 0.05)' : 'rgba(239, 68, 68, 0.05)',
                borderRadius: 'var(--radius-md)',
                border: monthlyReport.netProfit >= 0 ? '1px dashed rgba(16, 185, 129, 0.2)' : '1px dashed rgba(239, 68, 68, 0.2)',
                marginTop: '1rem'
              }}>
                <div>
                  <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>Net Profit / Loss</span>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Net performance calculated as: Revenue - COGS - Expenses</p>
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: 850, 
                  color: monthlyReport.netProfit >= 0 ? 'var(--accent-success)' : 'var(--accent-danger)'
                }}>
                  ${monthlyReport.netProfit.toFixed(2)}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
              No profit data generated for this period.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
