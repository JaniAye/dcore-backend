import React, { useEffect, useMemo, useState } from 'react';
import { Search, CalendarDays, Receipt, Eye, X } from 'lucide-react';
import { api } from '../services/api';
import { CustomerDto, SaleDto } from '../types';

type FilterRange = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';

interface InvoicesProps {
  searchFilter?: string;
  paymentFilter?: string;
}

export const Invoices: React.FC<InvoicesProps> = ({ searchFilter, paymentFilter }) => {
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(searchFilter || '');
  const [selectedRange, setSelectedRange] = useState<FilterRange>('this_week');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleDto | null>(null);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState(paymentFilter || 'ALL');

  useEffect(() => {
    if (searchFilter !== undefined) setSearchTerm(searchFilter);
    if (paymentFilter !== undefined) setPaymentTypeFilter(paymentFilter);
  }, [paymentFilter, searchFilter]);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [salesResponse, customersResponse] = await Promise.all([
          selectedRange === 'custom' ? api.sales.getFiltered(startDate || undefined, endDate || undefined) : api.sales.getAll(),
          api.customers.getAll()
        ]);
        setSales(salesResponse);
        setCustomers(customersResponse);
        setSelectedSale(null);
      } catch (err) {
        setError('Unable to load invoices right now.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [endDate, selectedRange, startDate]);

  const customersById = useMemo(() => {
    return customers.reduce<Record<number, CustomerDto>>((acc, customer) => {
      acc[customer.id] = customer;
      return acc;
    }, {});
  }, [customers]);

  const getPaymentType = (sale: SaleDto) => {
    if (sale.outstandingBalance > 0) {
      return 'CREDIT';
    }

    const paymentMethods = Array.from(new Set(
      sale.payments
        .map(payment => payment.paymentMethod)
        .filter(paymentMethod => paymentMethod !== 'CREDIT')
    ));

    return paymentMethods.length === 1 ? paymentMethods[0] : 'PAID';
  };

  const filteredSales = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const yearEnd = new Date(today.getFullYear(), 11, 31);

    const matchesRange = (sale: SaleDto) => {
      const saleDate = new Date(sale.createdAt);
      const saleDay = new Date(saleDate.getFullYear(), saleDate.getMonth(), saleDate.getDate());

      if (selectedRange === 'today') {
        return saleDay.getTime() === today.getTime();
      }

      if (selectedRange === 'this_week') {
        return saleDay >= weekStart && saleDay <= weekEnd;
      }

      if (selectedRange === 'this_month') {
        return saleDay >= monthStart && saleDay <= monthEnd;
      }

      if (selectedRange === 'this_year') {
        return saleDay >= yearStart && saleDay <= yearEnd;
      }

      if (selectedRange === 'custom') {
        if (!startDate && !endDate) return true;
        const from = startDate ? new Date(startDate) : null;
        const to = endDate ? new Date(endDate) : null;
        if (from) from.setHours(0,0,0,0);
        if (to) to.setHours(23,59,59,999);
        if (from && to) return saleDate >= from && saleDate <= to;
        if (from) return saleDate >= from;
        if (to) return saleDate <= to;
      }

      return true;
    };

    const matchesSearch = (sale: SaleDto) => {
      if (!normalizedSearch) return true;
      const customer = customersById[sale.customerId];
      const searchableText = [
        sale.invoiceId,
        sale.customerName,
        customer?.mobile || '',
        sale.sellerName
      ].join(' ').toLowerCase();

      return searchableText.includes(normalizedSearch);
    };

    return sales
      .filter(matchesRange)
      .filter(matchesSearch)
      .filter(sale => paymentTypeFilter === 'ALL' || getPaymentType(sale).split(', ').includes(paymentTypeFilter))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [customersById, endDate, paymentTypeFilter, sales, searchTerm, selectedRange, startDate]);

  const selectedSaleDetails = selectedSale
    ? filteredSales.find(sale => sale.id === selectedSale.id) || selectedSale
    : null;

  return (
    <div className="flex-col gap-4">
      <div className="page-header">
        <h1>Invoice History</h1>
        <p className="page-subtitle">Browse POS invoices, filter by period, and review full sale details.</p>
      </div>

      {error && (
        <div className="glass-card" style={{ color: 'var(--accent-danger)' }}>
          {error}
        </div>
      )}

      <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="flex justify-between" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
            <div className="flex align-center gap-2" style={{ flexWrap: 'wrap', flex: '1 1 420px' }}>
            {[
              { key: 'today', label: 'Today' },
              { key: 'this_week', label: 'This Week' },
              { key: 'this_month', label: 'This Month' },
              { key: 'this_year', label: 'This Year' },
              { key: 'custom', label: 'Custom' }
            ].map(option => (
              <button
                key={option.key}
                className={`btn ${selectedRange === option.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedRange(option.key as FilterRange)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex align-center gap-2" style={{ flexWrap: 'wrap', flex: '1 1 420px', justifyContent: 'flex-end', alignItems: 'flex-end' }}>
            <div className="flex align-center gap-2" style={{ minWidth: '220px', flex: '1 1 220px' }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                className="form-input w-full"
                placeholder="Search invoice, customer or mobile"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select className="form-select" value={paymentTypeFilter} onChange={(e) => setPaymentTypeFilter(e.target.value)} style={{ minWidth: '160px', flex: '0 1 190px' }}>
              <option value="ALL">All payment types</option>
              <option value="CASH">Cash</option>
              <option value="CARD">Card</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CREDIT">Store Credit</option>
              <option value="PAID">Paid (legacy)</option>
            </select>
          </div>
        </div>

        {selectedRange === 'custom' && (
          <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
            <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
              <label className="form-label">From</label>
              <input className="form-input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0, minWidth: '180px' }}>
              <label className="form-label">To</label>
              <input className="form-input" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="layout-split" style={{ gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '1rem', width: '100%', maxWidth: '1100px', margin: '0 auto', gridColumn: '1 / -1' }}>
          {loading ? (
            <div className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>Loading invoices...</div>
          ) : filteredSales.length === 0 ? (
            <div className="text-center" style={{ padding: '2rem', color: 'var(--text-muted)' }}>No invoices found for this filter.</div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Payment Type</th>
                    <th>Total</th>
                    <th>Discount</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.map(sale => (
                    <tr key={sale.id} onClick={() => setSelectedSale(sale)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Receipt size={14} color="var(--accent-primary)" />
                          <strong>{sale.invoiceId}</strong>
                        </div>
                      </td>
                      <td>
                        <div>{sale.customerName || 'Walk-in Customer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {customersById[sale.customerId]?.mobile || 'No mobile'}
                        </div>
                      </td>
                      <td>{new Date(sale.createdAt).toLocaleString()}</td>
                      <td><span className="badge badge-info">{getPaymentType(sale)}</span></td>
                      <td>${sale.finalAmount.toFixed(2)}</td>
                      <td>${sale.discountAmount.toFixed(2)}</td>
                      <td>
                        <button className="btn btn-secondary" type="button" onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); }}>
                          <Eye size={14} /> View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedSaleDetails && <div
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedSale(null)}
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
          <div className="glass-panel" onClick={(event) => event.stopPropagation()} style={{ padding: '1rem', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="flex-col gap-3">
              <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3>{selectedSaleDetails.invoiceId}</h3>
                  <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
                    {selectedSaleDetails.customerName || 'Walk-in Customer'}
                  </p>
                </div>
                <div className="flex align-center gap-2">
                  <div className="badge badge-info">{new Date(selectedSaleDetails.createdAt).toLocaleDateString()}</div>
                  <button type="button" className="btn btn-outline" onClick={() => setSelectedSale(null)} aria-label="Close invoice details" title="Close invoice details">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div className="flex justify-between"><span>Seller</span><strong>{selectedSaleDetails.sellerName}</strong></div>
                <div className="flex justify-between"><span>Items</span><strong>{selectedSaleDetails.items?.length || 0}</strong></div>
                <div className="flex justify-between"><span>Total before discount</span><strong>${selectedSaleDetails.totalAmount.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Discount</span><strong className="text-danger">-${selectedSaleDetails.discountAmount.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Final amount</span><strong className="text-accent">${selectedSaleDetails.finalAmount.toFixed(2)}</strong></div>
                <div className="flex justify-between"><span>Outstanding</span><strong className={selectedSaleDetails.outstandingBalance > 0 ? 'text-warning' : 'text-success'}>${selectedSaleDetails.outstandingBalance.toFixed(2)}</strong></div>
              </div>

              <div>
                <h4 style={{ marginBottom: '0.75rem' }}>Items</h4>
                <div className="flex-col gap-2">
                  {selectedSaleDetails.items?.map((item, index) => (
                    <div key={`${item.productId}-${index}`} className="glass-card" style={{ padding: '0.85rem' }}>
                      <div className="flex justify-between align-center">
                        <strong>{item.productName}</strong>
                        <span className="badge badge-info">Qty {item.quantity}</span>
                      </div>
                      <div className="flex justify-between" style={{ marginTop: '0.4rem', color: 'var(--text-muted)' }}>
                        <span>Unit price</span>
                        <span>${(item.unitPrice || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between" style={{ color: 'var(--text-muted)' }}>
                        <span>Subtotal</span>
                        <span>${(item.subTotal ?? 0).toFixed(2)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
};
