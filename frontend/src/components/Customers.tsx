import React, { useEffect, useState } from 'react';
import { Search, CheckCircle, Eye, X, ArrowRight } from 'lucide-react';
import { api } from '../services/api';
import { CustomerDto, PaymentRequest, SaleDto, SalePaymentMethod } from '../types';

interface CustomersProps {
  onOpenCustomerInvoices: (mobile: string, outstandingOnly: boolean) => void;
}

export const Customers: React.FC<CustomersProps> = ({ onOpenCustomerInvoices }) => {
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerDto | null>(null);
  const [customerSales, setCustomerSales] = useState<SaleDto[]>([]);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('CASH');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadCustomers = async () => {
    try {
      setCustomers(await api.customers.getAll());
    } catch (err) {
      setError('Unable to load customers.');
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter(customer => {
    const query = searchTerm.trim().toLowerCase();
    return !query || customer.name.toLowerCase().includes(query) || customer.mobile.includes(query);
  });

  const selectCustomer = async (customer: CustomerDto) => {
    setSelectedCustomer(customer);
    setPaymentAmount('');
    setError('');
    try {
      setCustomerSales(await api.customers.getSalesHistory(customer.id));
    } catch (err) {
      setError('Unable to load customer outstanding sales.');
    }
  };

  const openOutstandingPopup = async (customer: CustomerDto) => {
    await selectCustomer(customer);
  };

  const outstandingSales = customerSales
    .filter(sale => sale.outstandingBalance > 0)
    .sort((first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime());
  const customerOutstanding = outstandingSales.reduce((total, sale) => total + sale.outstandingBalance, 0);

  const handlePayment = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedCustomer || !paymentAmount) return;
    const amount = parseFloat(paymentAmount);
    if (amount <= 0 || amount > customerOutstanding) {
      setError('Enter an amount up to the outstanding balance.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      let remaining = amount;
      for (const sale of outstandingSales) {
        if (remaining <= 0) break;
        const paymentForSale = Math.min(remaining, sale.outstandingBalance);
        const request: PaymentRequest = { saleId: sale.id, amount: paymentForSale, paymentMethod };
        await api.sales.addPayment(request);
        remaining -= paymentForSale;
      }
      setSuccess('Payment recorded and outstanding balance updated.');
      setPaymentAmount('');
      if (selectedCustomer) await selectCustomer(selectedCustomer);
      const refreshedCustomers = await api.customers.getAll();
      setCustomers(refreshedCustomers);
      if (selectedCustomer) {
        setSelectedCustomer(refreshedCustomers.find(customer => customer.id === selectedCustomer.id) || null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to record payment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-col gap-4">
      <div className="page-header">
        <h1>Customers</h1>
        <p className="page-subtitle">Search customer accounts, review spending, and settle outstanding balances.</p>
      </div>
      {error && <div className="glass-card" style={{ color: 'var(--accent-danger)' }}>{error}</div>}
      {success && <div className="glass-card" style={{ color: 'var(--accent-success)' }}><CheckCircle size={16} /> {success}</div>}

      <div className="layout-split">
        <div className="glass-panel" style={{ width: '100%', maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ position: 'relative', marginBottom: '1rem' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '0.75rem', color: 'var(--text-muted)' }} />
            <input className="form-input" style={{ paddingLeft: '2.25rem' }} placeholder="Search by name or mobile number..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Name</th><th>Mobile</th><th>Total Spend</th><th>Outstanding</th><th>Action</th></tr></thead>
              <tbody>
                {filteredCustomers.map(customer => (
                  <tr key={customer.id} onClick={() => onOpenCustomerInvoices(customer.mobile, false)} style={{ cursor: 'pointer' }}>
                    <td><strong>{customer.name}</strong></td>
                    <td>{customer.mobile}</td>
                    <td>${customer.totalSpend.toFixed(2)}</td>
                    <td className={customer.outstandingBalance > 0 ? 'text-warning' : 'text-success'}>${customer.outstandingBalance.toFixed(2)}</td>
                    <td>
                      <button type="button" className="btn btn-secondary" onClick={(event) => { event.stopPropagation(); openOutstandingPopup(customer); }} title="Check outstanding balance" aria-label="Check outstanding balance" style={{ padding: '0.35rem 0.5rem', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                        <Eye size={13} /> Check
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No customers found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        {selectedCustomer && <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedCustomer(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 80,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
            background: 'rgba(0, 0, 0, 0.65)'
          }}
        >
          <div className="glass-panel" onClick={(event) => event.stopPropagation()} style={{ width: '100%', maxWidth: '520px' }}>
            <div className="flex-col gap-4">
              <div className="flex justify-between align-center">
                <div><h2>{selectedCustomer.name}</h2><p style={{ color: 'var(--text-secondary)' }}>{selectedCustomer.mobile}</p></div>
                <button type="button" className="btn btn-outline" onClick={() => setSelectedCustomer(null)} aria-label="Close outstanding details"><X size={16} /></button>
              </div>
              <div className="flex justify-between"><span>Total Spend</span><strong>${selectedCustomer.totalSpend.toFixed(2)}</strong></div>
              <div className="flex justify-between"><span>Outstanding Balance</span><strong className="text-warning">${customerOutstanding.toFixed(2)}</strong></div>
              <form onSubmit={handlePayment} className="flex-col gap-2">
                <label className="form-label">Record Outstanding Payment</label>
                <input className="form-input" type="number" min="0.01" max={customerOutstanding} step="0.01" placeholder={`Amount paid (up to $${customerOutstanding.toFixed(2)})`} value={paymentAmount} onChange={(event) => setPaymentAmount(event.target.value)} disabled={customerOutstanding <= 0} required />
                <select className="form-select" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as SalePaymentMethod)} disabled={customerOutstanding <= 0}>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                </select>
                <button type="submit" className="btn btn-primary" disabled={loading || customerOutstanding <= 0}>{loading ? 'Recording...' : 'Record Payment'}</button>
              </form>
              <button type="button" className="btn btn-secondary" onClick={() => onOpenCustomerInvoices(selectedCustomer.mobile, true)}>
                <ArrowRight size={16} /> See All Outstanding Bills
              </button>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
};
