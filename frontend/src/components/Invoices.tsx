import React, { useEffect, useMemo, useState } from 'react';
import { Search, Receipt, Eye, X, Printer, Download, Pencil, Ban, Plus, Trash2, Save, RotateCcw } from 'lucide-react';
import { api } from '../services/api';
import { CustomerDto, ProductDto, SaleDto } from '../types';
import { TableLoader } from './TableLoader';
import { Pagination } from './Pagination';
import { formatCurrency } from '../utils/format';
import { generateBillPdf, printBill } from '../utils/billGenerator';

type FilterRange = 'today' | 'this_week' | 'this_month' | 'this_year' | 'custom';
type EditableInvoiceItem = {
  productId?: number;
  productName: string;
  quantity: number;
  originalPrice: number;
  unitPrice: number;
  baseCost?: number;
  customDescription?: string;
};

interface InvoicesProps {
  searchFilter?: string;
  paymentFilter?: string;
}

export const Invoices: React.FC<InvoicesProps> = ({ searchFilter, paymentFilter }) => {
  const [sales, setSales] = useState<SaleDto[]>([]);
  const [customers, setCustomers] = useState<CustomerDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState(searchFilter || '');
  const [selectedRange, setSelectedRange] = useState<FilterRange>('this_year');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSale, setSelectedSale] = useState<SaleDto | null>(null);
  const [paymentTypeFilter, setPaymentTypeFilter] = useState(paymentFilter || 'ALL');
  const [invoicePage, setInvoicePage] = useState(1);
  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editItems, setEditItems] = useState<EditableInvoiceItem[]>([]);
  const invoicePageSize = 10;

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
        .filter(payment => payment.amount > 0 && payment.paymentMethod !== 'REFUND')
        .map(payment => payment.paymentMethod)
        .filter(paymentMethod => paymentMethod !== 'CREDIT')
    ));

    return paymentMethods.length === 1 ? paymentMethods[0] : 'PAID';
  };

  const updateSaleInList = (updatedSale: SaleDto) => {
    setSales(currentSales => currentSales.map(sale => sale.id === updatedSale.id ? updatedSale : sale));
    setSelectedSale(updatedSale);
  };

  const startEditing = async (sale: SaleDto) => {
    try {
      const availableProducts = products.length > 0 ? products : await api.products.getAll();
      setProducts(availableProducts);
      setEditItems((sale.items || []).filter(item => !item.cancelled).map(item => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        originalPrice: item.unitPrice,
        unitPrice: item.quantity > 0
          ? (item.subtotal ?? item.subTotal ?? item.unitPrice * item.quantity) / item.quantity
          : item.unitPrice,
        baseCost: item.purchasePrice,
        customDescription: item.description
      })));
      setSelectedSale(sale);
      setEditingSaleId(sale.id);
      setError('');
    } catch {
      setError('Unable to load products for invoice editing.');
    }
  };

  const saveInvoice = async () => {
    if (!selectedSaleDetails || editItems.length === 0) return;
    try {
      const updatedSale = await api.sales.update(selectedSaleDetails.id, {
        items: editItems.map(item => ({
          productId: item.productId,
          customItemName: item.productId ? undefined : item.productName,
          customDescription: item.customDescription,
          baseCost: item.baseCost,
          sellingPrice: item.unitPrice,
          quantity: item.quantity,
          discountType: 'NONE',
          discountValue: 0,
          originalPrice: item.originalPrice,
          overridePrice: item.unitPrice
        })),
        discountLevel: selectedSaleDetails.discountLevel || 'NONE',
        discountReason: selectedSaleDetails.discountReason,
        isInternal: selectedSaleDetails.isInternal
      });
      updateSaleInList(updatedSale);
      setEditingSaleId(null);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Unable to update this invoice.');
    }
  };

  const cancelInvoice = async (sale: SaleDto) => {
    if (!window.confirm(`Cancel invoice ${sale.invoiceId}? Stock will be returned and its sales and profit removed from reports.`)) return;
    try {
      const cancelledSale = await api.sales.cancel(sale.id);
      updateSaleInList(cancelledSale);
      setEditingSaleId(null);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to cancel this invoice.');
    }
  };

  const setInvoiceItemCancelled = async (itemId: number | undefined, cancelled: boolean) => {
    if (!selectedSaleDetails || itemId === undefined) return;
    try {
      const updatedSale = await api.sales.setItemCancelled(selectedSaleDetails.id, itemId, cancelled);
      updateSaleInList(updatedSale);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Unable to update this invoice item.');
    }
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
      const customer = sale.customerId ? customersById[sale.customerId] : undefined;
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
  const paginatedSales = filteredSales.slice((invoicePage - 1) * invoicePageSize, invoicePage * invoicePageSize);

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
            <div className="table-container"><table><tbody><TableLoader colSpan={7} label="Loading invoices..." /></tbody></table></div>
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
                  {paginatedSales.map(sale => (
                    <tr key={sale.id} onClick={() => setSelectedSale(sale)} style={{ cursor: 'pointer' }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <Receipt size={14} color="var(--accent-primary)" />
                          <strong>{sale.invoiceId}</strong>
                          {sale.cancelled && <span className="badge badge-danger">Cancelled</span>}
                        </div>
                      </td>
                      <td>
                        <div>{sale.customerName || 'Walk-in Customer'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {(sale.customerId && customersById[sale.customerId]?.mobile) || sale.customerMobile || 'No mobile'}
                        </div>
                      </td>
                      <td>{new Date(sale.createdAt).toLocaleString()}</td>
                      <td><span className="badge badge-info">{getPaymentType(sale)}</span></td>
                      <td>{formatCurrency(sale.finalAmount)}</td>
                      <td>{formatCurrency(sale.discountAmount)}</td>
                      <td>
                        <div className="flex gap-1">
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setSelectedSale(sale); }}
                            title="View invoice details"
                            style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                          >
                            <Eye size={13} /> View
                          </button>
                          {!sale.cancelled && <>

                          {/* Removed the edit option due to multiple errors before enable fix errors*/}
                            {/* <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void startEditing(sale); }}
                              title="Edit invoice"
                              aria-label={`Edit ${sale.invoiceId}`}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }}
                            > */}
                              {/* <Pencil size={13} /> Edit */}
                            {/* </button> */}
                            <button
                              className="btn btn-secondary"
                              type="button"
                              onClick={(e) => { e.stopPropagation(); void cancelInvoice(sale); }}
                              title="Cancel invoice and return stock"
                              aria-label={`Cancel ${sale.invoiceId}`}
                              style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: 'var(--accent-danger)' }}
                            >
                              <Ban size={13} /> Cancel
                            </button>
                          </>}
                          <button
                            className="btn btn-secondary"
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cust = sale.customerId ? customersById[sale.customerId] : undefined;
                              const fullSale: SaleDto = {
                                ...sale,
                                customerMobile: sale.customerMobile || cust?.mobile
                              };
                              printBill(fullSale);
                            }}
                            title="Print bill"
                            style={{
                              padding: '0.35rem 0.6rem',
                              fontSize: '0.8rem',
                              background: 'rgba(16, 185, 129, 0.1)',
                              borderColor: '#10b981',
                              color: '#34d399'
                            }}
                            id={`btn-print-invoice-${sale.id}`}
                          >
                            <Printer size={13} /> Print
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination currentPage={invoicePage} totalItems={filteredSales.length} pageSize={invoicePageSize} onPageChange={setInvoicePage} />
            </div>
          )}
        </div>

        {selectedSaleDetails && <div
          role="dialog"
          aria-modal="true"
          onClick={() => { setSelectedSale(null); setEditingSaleId(null); }}
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
              {error && (
                <div role="alert" className="glass-card" style={{ color: 'var(--accent-danger)' }}>
                  {error}
                </div>
              )}
              <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h3>{selectedSaleDetails.invoiceId}</h3>
                  <p className="page-subtitle" style={{ marginTop: '0.25rem' }}>
                    {selectedSaleDetails.customerName || 'Walk-in Customer'}
                  </p>
                </div>
                <div className="flex align-center gap-2">
                  <div className={`badge ${selectedSaleDetails.cancelled ? 'badge-danger' : 'badge-info'}`}>
                    {selectedSaleDetails.cancelled ? 'Cancelled' : new Date(selectedSaleDetails.createdAt).toLocaleDateString()}
                  </div>
                  <button type="button" className="btn btn-outline" onClick={() => { setSelectedSale(null); setEditingSaleId(null); }} aria-label="Close invoice details" title="Close invoice details">
                    <X size={16} />
                  </button>
                </div>
              </div>

              <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div className="flex justify-between"><span>Seller</span><strong>{selectedSaleDetails.sellerName}</strong></div>
                <div className="flex justify-between"><span>Active items</span><strong>{selectedSaleDetails.items?.filter(item => !item.cancelled).length || 0}</strong></div>
                <div className="flex justify-between"><span>Total before discount</span><strong>{formatCurrency(selectedSaleDetails.totalAmount)}</strong></div>
                <div className="flex justify-between"><span>Discount</span><strong className="text-danger">-{formatCurrency(selectedSaleDetails.discountAmount)}</strong></div>
                <div className="flex justify-between"><span>Final amount</span><strong className="text-accent">{formatCurrency(selectedSaleDetails.finalAmount)}</strong></div>
                <div className="flex justify-between"><span>Paid (net)</span><strong>{formatCurrency(selectedSaleDetails.payments.reduce((total, payment) => total + payment.amount, 0))}</strong></div>
                {selectedSaleDetails.payments.some(payment => payment.amount < 0) && (
                  <div className="flex justify-between"><span>Refund adjustment</span><strong className="text-warning">{formatCurrency(selectedSaleDetails.payments.filter(payment => payment.amount < 0).reduce((total, payment) => total + Math.abs(payment.amount), 0))}</strong></div>
                )}
                <div className="flex justify-between"><span>Outstanding</span><strong className={selectedSaleDetails.outstandingBalance > 0 ? 'text-warning' : 'text-success'}>{formatCurrency(selectedSaleDetails.outstandingBalance)}</strong></div>
              </div>

              {!selectedSaleDetails.cancelled && editingSaleId !== selectedSaleDetails.id && <div className="flex gap-2 justify-end" style={{ marginTop: '0.25rem', flexWrap: 'wrap' }}>
                {selectedSaleDetails.items?.some(item => !item.cancelled) && (
                  <button type="button" className="btn btn-secondary" onClick={() => void startEditing(selectedSaleDetails)}>
                    <Pencil size={14} /> Edit Invoice
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => void cancelInvoice(selectedSaleDetails)} style={{ color: 'var(--accent-danger)' }}>
                  <Ban size={14} /> Cancel Invoice
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cust = selectedSaleDetails.customerId ? customersById[selectedSaleDetails.customerId] : undefined;
                    generateBillPdf({
                      ...selectedSaleDetails,
                      customerMobile: selectedSaleDetails.customerMobile || cust?.mobile
                    });
                  }}
                  className="btn btn-secondary flex align-center gap-1"
                  style={{ background: 'rgba(59, 130, 246, 0.12)', borderColor: '#3b82f6', color: '#93c5fd', fontSize: '0.85rem' }}
                  id="btn-invoice-modal-download"
                >
                  <Download size={14} /> Download Bill (PDF)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const cust = selectedSaleDetails.customerId ? customersById[selectedSaleDetails.customerId] : undefined;
                    printBill({
                      ...selectedSaleDetails,
                      customerMobile: selectedSaleDetails.customerMobile || cust?.mobile
                    });
                  }}
                  className="btn btn-secondary flex align-center gap-1"
                  style={{ background: 'rgba(16, 185, 129, 0.12)', borderColor: '#10b981', color: '#6ee7b7', fontSize: '0.85rem' }}
                  id="btn-invoice-modal-print"
                >
                  <Printer size={14} /> Print Bill
                </button>
              </div>}

              <div>
                <div className="flex justify-between align-center" style={{ marginBottom: '0.75rem', gap: '1rem', flexWrap: 'wrap' }}>
                  <h4>Items</h4>
                  {editingSaleId === selectedSaleDetails.id && (
                    <select
                      className="form-select"
                      aria-label="Add product to invoice"
                      value=""
                      onChange={(event) => {
                        const product = products.find(candidate => candidate.id === Number(event.target.value));
                        if (!product) return;
                        setEditItems(current => [...current, {
                          productId: product.id,
                          productName: product.name,
                          quantity: 1,
                          originalPrice: product.standardPrice,
                          unitPrice: product.standardPrice
                        }]);
                      }}
                      style={{ width: 'auto', minWidth: '220px' }}
                    >
                      <option value="">Add product...</option>
                      {products.filter(product => product.active && product.totalStock > 0).map(product => (
                        <option key={product.id} value={product.id}>{product.name} ({product.totalStock} in stock)</option>
                      ))}
                    </select>
                  )}
                </div>
                {editingSaleId === selectedSaleDetails.id ? (
                  <div className="flex-col gap-2">
                    {editItems.map((item, index) => (
                      <div key={`${item.productId ?? item.productName}-${index}`} className="glass-card" style={{ padding: '0.85rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(130px, 1fr) repeat(2, minmax(90px, 130px)) auto', alignItems: 'end', gap: '0.6rem' }}>
                          <div style={{ minWidth: 0 }}>
                            <label className="form-label">Item</label>
                            <div style={{ overflowWrap: 'anywhere' }}><strong>{item.productName}</strong></div>
                          </div>
                          <div>
                            <label className="form-label">Quantity</label>
                            <input className="form-input" type="number" min="1" step="1" value={item.quantity}
                              onChange={event => setEditItems(current => current.map((line, lineIndex) => lineIndex === index
                                ? { ...line, quantity: Math.max(1, Number(event.target.value)) } : line))} />
                          </div>
                          <div>
                            <label className="form-label">Unit price</label>
                            <input className="form-input" type="number" min="0" step="0.01" value={item.unitPrice}
                              onChange={event => setEditItems(current => current.map((line, lineIndex) => lineIndex === index
                                ? { ...line, unitPrice: Math.max(0, Number(event.target.value)) } : line))} />
                          </div>
                          <button type="button" className="btn btn-secondary" title="Remove item" aria-label={`Remove ${item.productName}`}
                            disabled={editItems.length === 1}
                            onClick={() => setEditItems(current => current.filter((_, lineIndex) => lineIndex !== index))}>
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="flex justify-between align-center" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                      <strong>Revised total: {formatCurrency(editItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0))}</strong>
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-secondary" onClick={() => setEditingSaleId(null)}>Discard</button>
                        <button type="button" className="btn btn-primary" onClick={() => void saveInvoice()}>
                          <Save size={14} /> Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                ) : <div className="flex-col gap-2">
                  {selectedSaleDetails.items?.map((item, index) => {
                    const disc = item.discountAmount || 0;
                    const sub = item.subtotal ?? item.subTotal ?? (item.unitPrice * item.quantity - disc);
                    return (
                      <div key={item.id ?? `${item.productId}-${index}`} className="glass-card" style={{
                        padding: '0.85rem',
                        background: item.cancelled ? 'rgba(239, 68, 68, 0.12)' : undefined,
                        borderColor: item.cancelled ? 'var(--accent-danger)' : undefined
                      }}>
                        <div className="flex justify-between align-center" style={{ gap: '0.75rem', flexWrap: 'wrap' }}>
                          <strong style={item.cancelled ? { color: 'var(--accent-danger)', textDecoration: 'line-through' } : undefined}>{item.productName}</strong>
                          <div className="flex align-center gap-2">
                            {item.cancelled
                              ? <span className="badge badge-danger">Cancelled · Qty {item.quantity}</span>
                              : <span className="badge badge-info">Qty {item.quantity}</span>}
                            {!selectedSaleDetails.cancelled && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => void setInvoiceItemCancelled(item.id, !item.cancelled)}
                                disabled={item.id === undefined}
                                aria-label={`${item.cancelled ? 'Restore' : 'Cancel'} ${item.productName}`}
                                title={item.cancelled ? 'Undo item cancellation' : 'Cancel this item and return stock'}
                                style={{
                                  padding: '0.35rem 0.55rem',
                                  color: item.cancelled ? 'var(--accent-success)' : 'var(--accent-danger)'
                                }}
                              >
                                {item.cancelled ? <RotateCcw size={14} /> : <Ban size={14} />}
                                {item.cancelled ? 'Undo' : 'Cancel'}
                              </button>
                            )}
                          </div>
                        </div>
                        {item.productCode && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Code: {item.productCode}</div>
                        )}
                        <div className="flex justify-between" style={{ marginTop: '0.4rem', color: 'var(--text-muted)' }}>
                          <span>Unit price</span>
                          <span>{formatCurrency(item.unitPrice)}</span>
                        </div>
                        {disc > 0 && (
                          <div className="flex justify-between" style={{ color: 'var(--accent-danger)' }}>
                            <span>Item discount</span>
                            <span>-{formatCurrency(disc)}</span>
                          </div>
                        )}
                        <div className="flex justify-between" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                          <span>Subtotal</span>
                          <span>{formatCurrency(sub)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>}
              </div>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
};
