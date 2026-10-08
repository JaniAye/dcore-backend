import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DeliveryOrderDto, ProductDto, OrderStatus, DeliveryPaymentMethod } from '../types';
import { Check, ShieldCheck, ChevronLeft, ChevronRight, Trash2, Pencil, Download } from 'lucide-react';
import { TableLoader } from './TableLoader';
import { Pagination } from './Pagination';
import { formatCurrency } from '../utils/format';
import { generateBillPdf } from '../utils/billGenerator';

export const DeliveryOrders: React.FC = () => {
  const [orders, setOrders] = useState<DeliveryOrderDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);

  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [remark, setRemark] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DeliveryPaymentMethod>('COD');
  const [codAmount, setCodAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');

  interface SelectedItem {
    productId?: number;
    customItemName?: string;
    customDescription?: string;
    baseCost?: number;
    quantity: number;
    name: string;
    stock: number;
    unitPrice: number;
  }
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [addItemQty, setAddItemQty] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<ProductDto[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showAddCustomItem, setShowAddCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [customBaseCost, setCustomBaseCost] = useState('');
  const [customSellingPrice, setCustomSellingPrice] = useState('');
  const [customQuantity, setCustomQuantity] = useState('1');

  const selectedItemsTotal = selectedItems.reduce(
    (total, item) => total + item.unitPrice * item.quantity,
    0
  );

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [pendingOrderIndex, setPendingOrderIndex] = useState(0);
  const [orderStatusFilter, setOrderStatusFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [orderDateFilter, setOrderDateFilter] = useState('');
  const [orderProductFilter, setOrderProductFilter] = useState('');
  const [orderSearchFilter, setOrderSearchFilter] = useState('');
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [deliveryPage, setDeliveryPage] = useState(1);
  const deliveryPageSize = 10;

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const pendingOrders = orders.filter(order => order.status === 'PENDING');
  const pendingOrder = pendingOrders[pendingOrderIndex];
  const orderProductNames = Array.from(new Set(orders.flatMap(order => order.items.map(item => item.productName)))).sort();
  const filteredOrders = orders.filter(order => {
    const matchesStatus = orderStatusFilter === 'ALL' || order.status === orderStatusFilter;
    const matchesDate = !orderDateFilter || order.orderDate.startsWith(orderDateFilter);
    const matchesProduct = !orderProductFilter || order.items.some(item => item.productName === orderProductFilter);
    const searchableText = `${order.deliveryDetails || ''} ${order.mobileNumber || ''}`.toLowerCase();
    const matchesSearch = !orderSearchFilter.trim() || searchableText.includes(orderSearchFilter.trim().toLowerCase());
    const matchesOrderId = !orderIdFilter || String(order.id) === orderIdFilter;
    return matchesStatus && matchesDate && matchesProduct && matchesSearch && matchesOrderId;
  });
  const paginatedOrders = filteredOrders.slice((deliveryPage - 1) * deliveryPageSize, deliveryPage * deliveryPageSize);

  const loadData = async () => {
    setDataLoading(true);
    try {
      const o = await api.deliveryOrders.getAll();
      setOrders(o);
      const p = await api.products.getAll();
      setProducts(p.filter(product => product.active !== false));
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleProductSearch = async (query: string) => {
    setProductSearchQuery(query);
    setShowProductDropdown(true);

    if (!query.trim()) {
      setFilteredProducts(products);
      return;
    }

    try {
      const results = await api.products.search(query);
      setFilteredProducts(results.filter(product => product.active !== false));
    } catch (err) {
      console.error('Product search failed:', err);
      setFilteredProducts(products.filter(p => 
        p.active !== false && p.name.toLowerCase().includes(query.toLowerCase())
      ));
    }
  };

  const handleSelectProduct = (product: ProductDto) => {
    setProductSearchQuery(product.name);
    setFilteredProducts([]);
    setShowProductDropdown(false);
  };

  const handleAddCustomItem = (event: React.FormEvent) => {
    event.preventDefault();
    const quantity = Number(customQuantity);
    const baseCost = Number(customBaseCost);
    const sellingPrice = Number(customSellingPrice);
    if (!customItemName.trim() || !Number.isInteger(quantity) || quantity < 1
        || !Number.isFinite(baseCost) || baseCost < 0
        || !Number.isFinite(sellingPrice) || sellingPrice < baseCost) {
      setError('Enter an item name, quantity, and valid prices. Selling price must cover base cost.');
      return;
    }
    setSelectedItems(current => [...current, {
      customItemName: customItemName.trim(),
      customDescription: customDescription.trim() || undefined,
      baseCost,
      quantity,
      name: customItemName.trim(),
      stock: 0,
      unitPrice: sellingPrice
    }]);
    setCustomItemName('');
    setCustomDescription('');
    setCustomBaseCost('');
    setCustomSellingPrice('');
    setCustomQuantity('1');
    setShowAddCustomItem(false);
    setError('');
  };

  const handleAddProductToOrder = () => {
    if (!productSearchQuery || !addItemQty) {
      setError('Please select a product and enter quantity');
      return;
    }

    const prod = filteredProducts.find(p => p.name === productSearchQuery) || 
                 products.find(p => p.name === productSearchQuery);
    
    if (!prod) {
      setError('Product not found');
      return;
    }

    const qty = parseInt(addItemQty);
    if (qty > prod.totalStock) {
      setError(`Only ${prod.totalStock} units available in stock.`);
      return;
    }

    const existingIdx = selectedItems.findIndex(i => i.productId === prod.id);
    if (existingIdx > -1) {
      const updated = [...selectedItems];
      if (updated[existingIdx].quantity + qty > prod.totalStock) {
        setError(`Cannot add. Exceeds total stock of ${prod.totalStock}.`);
        return;
      }
      updated[existingIdx].quantity += qty;
      setSelectedItems(updated);
    } else {
      setSelectedItems([...selectedItems, {
        productId: prod.id,
        quantity: qty,
        name: prod.name,
        stock: prod.totalStock,
        unitPrice: prod.standardPrice
      }]);
    }
    setProductSearchQuery('');
    setAddItemQty('');
    setFilteredProducts([]);
    setShowProductDropdown(false);
    setError('');
  };

  const removeProductFromOrder = (idx: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== idx));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deliveryDetails.trim()) {
      setError('Please enter delivery details.');
      return;
    }

    if (!mobileNumber.trim()) {
      setError('Please enter a mobile number.');
      return;
    }

    if (selectedItems.length === 0) {
      setError('Please add at least one item.');
      return;
    }

    const parsedCodAmount = codAmount.trim() ? Number(codAmount) : 0;
    const parsedDeliveryFee = deliveryFee.trim() ? Number(deliveryFee) : 0;
    if (!Number.isFinite(parsedCodAmount) || parsedCodAmount < 0) {
      setError('COD amount must be zero or greater.');
      return;
    }
    if (!Number.isFinite(parsedDeliveryFee) || parsedDeliveryFee < 0) {
      setError('Delivery service fee must be zero or greater.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const orderData = {
        deliveryDetails: deliveryDetails.trim(),
        mobileNumber: mobileNumber.trim(),
        remark: remark.trim() || undefined,
        paymentMethod,
        codAmount: parsedCodAmount,
        deliveryFee: parsedDeliveryFee,
        items: selectedItems.map(i => i.productId != null ? ({ productId: i.productId, quantity: i.quantity }) : ({
          customItemName: i.customItemName,
          customDescription: i.customDescription,
          baseCost: i.baseCost,
          sellingPrice: i.unitPrice,
          quantity: i.quantity
        }))
      };
      if (editingOrderId !== null) {
        await api.deliveryOrders.update(editingOrderId, orderData);
        setSuccess(`Delivery order #${editingOrderId} updated successfully!`);
      } else {
        await api.deliveryOrders.create(orderData);
        setSuccess('Delivery order created successfully!');
      }
      setDeliveryDetails('');
      setMobileNumber('');
      setRemark('');
      setPaymentMethod('COD');
      setCodAmount('');
      setDeliveryFee('');
      setSelectedItems([]);
      setEditingOrderId(null);
      setShowCreateForm(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create delivery order');
    } finally {
      setLoading(false);
    }
  };

  const handleEditOrder = (order: DeliveryOrderDto) => {
    setEditingOrderId(order.id);
    setDeliveryDetails(order.deliveryDetails || '');
    setMobileNumber(order.mobileNumber || order.customerMobile || '');
    setRemark(order.remark || '');
    setPaymentMethod(order.paymentMethod as DeliveryPaymentMethod);
    setCodAmount(String(order.codAmount || 0));
    setDeliveryFee(String(order.deliveryFee || 0));
    setSelectedItems(order.items.map(item => {
      const product = products.find(candidate => candidate.id === item.productId);
      return {
        productId: item.productId ?? undefined,
        customItemName: item.productId != null ? undefined : item.productName,
        customDescription: item.description,
        baseCost: item.purchasePrice,
        quantity: item.quantity,
        name: item.productName,
        stock: (product?.totalStock || 0) + item.quantity,
        unitPrice: item.sellingPrice ?? product?.standardPrice ?? 0
      };
    }));
    setProductSearchQuery('');
    setFilteredProducts([]);
    setShowProductDropdown(false);
    setError('');
    setSuccess('');
    setShowCreateForm(true);
  };

  const handleUpdateStatus = async (orderId: number, status: OrderStatus) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.deliveryOrders.updateStatus(orderId, status);
      setSuccess(`Order #${orderId} status updated to ${status}`);
      if (status === 'READY') {
        setPendingOrderIndex(index => Math.min(index, Math.max(0, pendingOrders.length - 2)));
      }
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to update order status');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoComplete = async () => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const count = await api.deliveryOrders.autoComplete();
      setSuccess(`Successfully auto-completed ${count} old pending orders.`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to auto-complete orders');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteOrder = async (orderId: number) => {
    if (!confirm(`Delete pending order #${orderId}?`)) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.deliveryOrders.delete(orderId);
      setSuccess(`Order #${orderId} deleted successfully.`);
      setPendingOrderIndex(index => Math.max(0, Math.min(index, pendingOrders.length - 2)));
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to delete order');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadBill = (order: DeliveryOrderDto) => {
    const items = order.items.map(item => {
      const unitPrice = item.sellingPrice ?? 0;
      return {
        productId: item.productId ?? 0,
        productName: item.productName,
        description: item.description,
        quantity: item.quantity,
        unitPrice,
        subtotal: unitPrice * item.quantity
      };
    });
    const itemTotal = items.reduce((total, item) => total + item.subtotal, 0);
    const mobileNumber = order.mobileNumber || order.customerMobile || `order-${order.id}`;
    const safeFilename = mobileNumber.replace(/[^a-zA-Z0-9+-]/g, '_');

    generateBillPdf({
      id: order.id,
      invoiceId: `DO-${order.id}`,
      customerName: order.customerName || order.deliveryDetails || 'Delivery Customer',
      customerMobile: order.mobileNumber || order.customerMobile,
      totalAmount: itemTotal,
      discountAmount: 0,
      finalAmount: order.paymentMethod === 'COD' ? order.codAmount : itemTotal + order.deliveryFee,
      createdAt: order.orderDate,
      items,
      payments: [],
      outstandingBalance: 0
    }, {
      filename: `${safeFilename}.pdf`,
      deliveryFee: order.deliveryFee,
      statusLabel: `Order Status: ${order.status} | Payment: ${order.paymentMethod.replace('_', ' ')}`
    });
  };

  return (
    <div className="flex-col gap-4">
      <div className="page-header flex justify-between align-center">
        <div>
          <h1>Delivery Management</h1>
          <p className="page-subtitle">Track, register and manage courier shipments and cash deposits</p>
        </div>

        <div className="flex gap-4">
          <button onClick={handleAutoComplete} className="btn btn-secondary" disabled={loading}>
            <ShieldCheck size={16} /> Auto-Complete Old (8d+)
          </button>
          <button 
            onClick={() => {
              if (!showCreateForm) {
                setEditingOrderId(null);
                setDeliveryDetails('');
                setMobileNumber('');
                setRemark('');
                setSelectedItems([]);
                setPaymentMethod('COD');
                setCodAmount('');
                setDeliveryFee('');
              }
              setShowCreateForm(!showCreateForm);
              setError('');
              setSuccess('');
            }}
            className="btn btn-primary"
          >
            {showCreateForm ? 'View Orders' : '+ New Delivery Order'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--accent-danger)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      {success && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          color: 'var(--accent-success)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1rem'
        }}>
          {success}
        </div>
      )}

      {showCreateForm ? (
        <div className="glass-panel" style={{ maxWidth: '700px', margin: '0 auto', width: '100%' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>{editingOrderId !== null ? 'Update Delivery Dispatch' : 'Create Delivery Dispatch'}</h2>
          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Delivery Details (Name and Address) *</label>
              <textarea
                className="form-input"
                style={{ minHeight: '100px', fontFamily: 'inherit', resize: 'vertical' }}
                placeholder="Enter the delivery recipient name and address..."
                value={deliveryDetails}
                onChange={(e) => setDeliveryDetails(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Mobile Number *</label>
                <input
                  type="tel"
                  className="form-input"
                  placeholder="Enter mobile number"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Remark</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Optional remark"
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                />
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span className="form-label">Select Package Contents</span>
              
              <div style={{ position: 'relative' }}>
                <div className="delivery-item-input-row">
                  <div className="delivery-product-search" style={{ position: 'relative' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Search product by name..."
                      value={productSearchQuery}
                      onChange={(e) => handleProductSearch(e.target.value)}
                      onFocus={() => {
                        setShowProductDropdown(true);
                        if (!productSearchQuery) {
                          setFilteredProducts(products);
                        }
                      }}
                    />
                    {showProductDropdown && filteredProducts.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: 'var(--radius-md)',
                        marginTop: '0.25rem',
                        maxHeight: '250px',
                        overflowY: 'auto',
                        zIndex: 10
                      }}>
                        {filteredProducts.map(p => (
                          <div
                            key={p.id}
                            onClick={() => handleSelectProduct(p)}
                            style={{
                              padding: '0.75rem 1rem',
                              cursor: 'pointer',
                              borderBottom: '1px solid var(--border-glass)'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'var(--bg-secondary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <strong>{p.name}</strong>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  Stock: {p.totalStock} | {formatCurrency(p.standardPrice)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <input 
                    type="number" 
                    className="form-input" 
                    min="1"
                    step="1"
                    placeholder="Qty" 
                    value={addItemQty}
                    onChange={(e) => setAddItemQty(e.target.value)}
                  />
                  <button type="button" onClick={handleAddProductToOrder} className="btn btn-secondary delivery-add-item-button">
                    Add Item
                  </button>
                </div>
              </div>
              <button type="button" className="btn btn-outline" onClick={() => setShowAddCustomItem(true)}>
                Add unlisted item
              </button>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {selectedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between align-center glass-card" style={{ padding: '0.5rem 1rem' }}>
                    <div>
                      <strong>{item.name}</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {item.quantity} x {formatCurrency(item.unitPrice)} = {formatCurrency(item.quantity * item.unitPrice)}
                      </p>
                      {item.customDescription && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.customDescription} · not tracked in stock</p>}
                    </div>
                    <button type="button" onClick={() => removeProductFromOrder(idx)} className="pointer" style={{ background: 'none', border: 'none', color: 'var(--accent-danger)' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              <div className="delivery-items-total" aria-live="polite">
                <span>Selected items total</span>
                <strong>{formatCurrency(selectedItemsTotal)}</strong>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Mode *</label>
                <select
                  className="form-select"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as DeliveryPaymentMethod)}
                  required
                >
                  <option value="COD">Cash On Delivery (COD)</option>
                  <option value="CASH_DEPOSIT">Prepaid Cash Deposit</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">COD Amount (LKR) *</label>
                <input
                  type="number"
                  className="form-input"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={codAmount}
                  onChange={(e) => setCodAmount(e.target.value)}
                  disabled={paymentMethod === 'CASH_DEPOSIT'}
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Delivery Service Fee (LKR) *</label>
              <input
                type="number"
                className="form-input"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading || selectedItems.length === 0}>
              {loading ? (editingOrderId !== null ? 'Updating order...' : 'Creating order...') : (editingOrderId !== null ? 'Update Delivery Order' : 'Dispatch Delivery Order')}
            </button>
          </form>
        </div>
      ) : (
        <>
          <div className="glass-panel">
            <div className="flex justify-between align-center" style={{ marginBottom: '1rem' }}>
              <div>
                <h2>Pending Order Inspection</h2>
                <p className="page-subtitle">Review each pending delivery before preparing it.</p>
              </div>
              {pendingOrder && (
                <span className="badge badge-warning">{pendingOrderIndex + 1} of {pendingOrders.length}</span>
              )}
            </div>

            {pendingOrder ? (
              <div className="glass-card" style={{ padding: '1.25rem' }}>
                <div className="flex justify-between align-center" style={{ marginBottom: '1rem' }}>
                  <div>
                    <span className="form-label">DELIVERY ORDER</span>
                    <h3 style={{ marginTop: '0.25rem' }}>Order #{pendingOrder.id}</h3>
                  </div>
                  <span className="badge badge-warning">PENDING</span>
                </div>

                <div className="form-row" style={{ marginBottom: '1rem' }}>
                  <div>
                    <span className="form-label">Delivery Details</span>
                    <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.35rem' }}>{pendingOrder.deliveryDetails || 'No delivery details'}</p>
                  </div>
                  <div>
                    <span className="form-label">Mobile Number</span>
                    <p style={{ marginTop: '0.35rem' }}>{pendingOrder.mobileNumber || 'No mobile number'}</p>
                  </div>
                  <div>
                    <span className="form-label">Order Date</span>
                    <p style={{ marginTop: '0.35rem' }}>{new Date(pendingOrder.orderDate).toLocaleString()}</p>
                  </div>
                </div>

                <div className="form-row" style={{ marginBottom: '1rem' }}>
                  <div>
                    <span className="form-label">COD Amount</span>
                    <p style={{ marginTop: '0.35rem', fontSize: '1.1rem', fontWeight: 600 }}>{formatCurrency(pendingOrder.codAmount)}</p>
                  </div>
                  <div>
                    <span className="form-label">Delivery Fee</span>
                    <p style={{ marginTop: '0.35rem', fontSize: '1.1rem', fontWeight: 600 }}>{formatCurrency(pendingOrder.deliveryFee)}</p>
                  </div>
                </div>

                <div style={{ marginBottom: '1rem' }}>
                  <span className="form-label">Remark</span>
                  <p style={{ whiteSpace: 'pre-wrap', marginTop: '0.35rem' }}>{pendingOrder.remark || 'No remark'}</p>
                </div>

                <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                  <span className="form-label">Items and Quantities</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {pendingOrder.items.map((item, index) => (
                      <div key={`${pendingOrder.id}-${item.productId ?? item.productName}-${index}`} className="flex justify-between align-center" style={{ padding: '0.65rem 0.75rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                        <span>{item.productName}</span>
                        <strong>Qty: {item.quantity}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-between align-center" style={{ marginTop: '1.25rem', gap: '0.75rem' }}>
                  <button type="button" className="btn btn-outline" onClick={() => setPendingOrderIndex(index => Math.max(0, index - 1))} disabled={pendingOrderIndex === 0}>
                    <ChevronLeft size={16} /> Previous
                  </button>
                  <button type="button" className="btn btn-success" onClick={() => handleUpdateStatus(pendingOrder.id, 'READY')} disabled={loading}>
                    <Check size={16} /> Mark Ready
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={() => handleEditOrder(pendingOrder)} disabled={loading}>
                    <Pencil size={16} /> Edit Order
                  </button>
                  <button type="button" className="btn btn-outline" onClick={() => setPendingOrderIndex(index => Math.min(pendingOrders.length - 1, index + 1))} disabled={pendingOrderIndex === pendingOrders.length - 1}>
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>No pending delivery orders to inspect.</p>
            )}
          </div>

        <div className="glass-panel">
          <h2 style={{ marginBottom: '1rem' }}>Delivery Orders</h2>
          <div className="form-row" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Search Orders</label>
              <input
                type="search"
                className="form-input"
                placeholder="Search mobile or delivery details"
                value={orderSearchFilter}
                onChange={(e) => setOrderSearchFilter(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Filter by Order ID</label>
              <input
                type="number"
                min="1"
                className="form-input"
                placeholder="Enter ID, e.g. 1"
                value={orderIdFilter}
                onChange={(e) => setOrderIdFilter(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Filter by Status</label>
              <select
                className="form-select"
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value as 'ALL' | OrderStatus)}
              >
                <option value="ALL">All statuses</option>
                <option value="PENDING">Pending</option>
                <option value="READY">Ready</option>
                <option value="DELIVERED">Delivered</option>
                <option value="RETURNED">Returned</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Filter by Order Date</label>
              <input
                type="date"
                className="form-input"
                value={orderDateFilter}
                onChange={(e) => setOrderDateFilter(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Filter by Product</label>
              <select
                className="form-select"
                value={orderProductFilter}
                onChange={(e) => setOrderProductFilter(e.target.value)}
              >
                <option value="">All products</option>
                {orderProductNames.map(productName => (
                  <option key={productName} value={productName}>{productName}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Delivery Details</th>
                  <th>Mobile No.</th>
                  <th>Items and Quantities</th>
                  <th>Order Date</th>
                  <th>Fee</th>
                  <th>COD Value</th>
                  <th>Status</th>
                  <th>Bill</th>
                </tr>
              </thead>
              <tbody>
                {dataLoading ? <TableLoader colSpan={9} label="Loading delivery orders..." /> : paginatedOrders.map(order => (
                  <tr key={order.id}>
                    <td><code>#{order.id}</code></td>
                    <td>
                      {order.deliveryDetails || 'N/A'}
                    </td>
                    <td>{order.mobileNumber || 'N/A'}</td>
                    <td className="delivery-items-cell">
                      {order.items.map((item, index) => (
                        <div key={`${order.id}-${item.productId ?? item.productName}-${index}`} className="delivery-item-row">
                          <span>{item.productName}</span>
                          <strong>Qty: {item.quantity}</strong>
                        </div>
                      ))}
                    </td>
                    <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td>{formatCurrency(order.deliveryFee)}</td>
                    <td>{formatCurrency(order.codAmount)}</td>
                    <td>
                      <div className="flex gap-2 align-center">
                        <select
                          className={`form-select status-select status-select-${order.status.toLowerCase()}`}
                          value={order.status}
                          onChange={(e) => handleUpdateStatus(order.id, e.target.value as OrderStatus)}
                          disabled={loading}
                          aria-label={`Change status for order #${order.id}`}
                          style={{ minWidth: '125px' }}
                        >
                          <option value="PENDING">Pending</option>
                          <option value="READY">Ready</option>
                          <option value="DELIVERED">Delivered</option>
                          <option value="RETURNED">Returned</option>
                        </select>
                        {order.status === 'PENDING' && (
                          <button
                            onClick={() => handleDeleteOrder(order.id)}
                            className="btn btn-danger"
                            title={`Delete order #${order.id}`}
                            aria-label={`Delete order #${order.id}`}
                            style={{ padding: '0.25rem', minWidth: '28px' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleDownloadBill(order)}
                        className="btn btn-secondary"
                        title={`Download bill for ${order.mobileNumber || order.customerMobile || `order ${order.id}`}`}
                        aria-label={`Download bill for delivery order #${order.id}`}
                        style={{ padding: '0.25rem', minWidth: '28px' }}
                      >
                        <Download size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!dataLoading && filteredOrders.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      {orders.length === 0
                        ? 'No delivery orders registered yet. Click "+ New Delivery Order" to create one.'
                        : 'No delivery orders match the selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={deliveryPage} totalItems={filteredOrders.length} pageSize={deliveryPageSize} onPageChange={setDeliveryPage} />
        </div>
        </>
      )}
      {showAddCustomItem && (
        <div role="dialog" aria-modal="true" aria-label="Add unlisted delivery item" onClick={() => setShowAddCustomItem(false)} style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', background: 'rgba(0, 0, 0, 0.65)' }}>
          <form onSubmit={handleAddCustomItem} onClick={event => event.stopPropagation()} className="glass-panel flex-col gap-2" style={{ width: '100%', maxWidth: '460px' }}>
            <div className="flex justify-between align-center"><h3>Add unlisted item</h3><button type="button" className="btn btn-outline" onClick={() => setShowAddCustomItem(false)} aria-label="Close">Close</button></div>
            <div className="form-group"><label className="form-label">Item name *</label><input className="form-input" value={customItemName} onChange={event => setCustomItemName(event.target.value)} required autoFocus /></div>
            <div className="form-group"><label className="form-label">Description</label><input className="form-input" value={customDescription} onChange={event => setCustomDescription(event.target.value)} /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Base cost *</label><input type="number" min="0" step="0.01" className="form-input" value={customBaseCost} onChange={event => setCustomBaseCost(event.target.value)} required /></div>
              <div className="form-group"><label className="form-label">Selling price *</label><input type="number" min={customBaseCost || 0} step="0.01" className="form-input" value={customSellingPrice} onChange={event => setCustomSellingPrice(event.target.value)} required /></div>
            </div>
            <div className="form-group"><label className="form-label">Quantity *</label><input type="number" min="1" step="1" className="form-input" value={customQuantity} onChange={event => setCustomQuantity(event.target.value)} required /></div>
            <button type="submit" className="btn btn-primary w-full">Add to delivery order</button>
          </form>
        </div>
      )}
    </div>
  );
};