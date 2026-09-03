import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { DeliveryOrderDto, ProductDto, OrderStatus, DeliveryPaymentMethod } from '../types';
import { Check, RotateCcw, Truck, ShieldCheck, List, AlertTriangle } from 'lucide-react';

export const DeliveryOrders: React.FC = () => {
  const [orders, setOrders] = useState<DeliveryOrderDto[]>([]);
  const [products, setProducts] = useState<ProductDto[]>([]);

  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<DeliveryPaymentMethod>('COD');
  const [codAmount, setCodAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');

  interface SelectedItem {
    productId: number;
    quantity: number;
    name: string;
    stock: number;
  }
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [addItemQty, setAddItemQty] = useState('');
  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [filteredProducts, setFilteredProducts] = useState<ProductDto[]>([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const [showCreateForm, setShowCreateForm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      const o = await api.deliveryOrders.getAll();
      setOrders(o);
      const p = await api.products.getAll();
      setProducts(p);
    } catch (err) {
      console.error(err);
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
      setFilteredProducts(results);
    } catch (err) {
      console.error('Product search failed:', err);
      setFilteredProducts(products.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase())
      ));
    }
  };

  const handleSelectProduct = (product: ProductDto) => {
    setProductSearchQuery(product.name);
    setFilteredProducts([]);
    setShowProductDropdown(false);
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
        stock: prod.totalStock
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

    if (selectedItems.length === 0) {
      setError('Please add at least one item.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.deliveryOrders.create({
        deliveryDetails: deliveryDetails.trim(),
        paymentMethod,
        codAmount: codAmount ? parseFloat(codAmount) : 0,
        deliveryFee: deliveryFee ? parseFloat(deliveryFee) : 0,
        items: selectedItems.map(i => ({ productId: i.productId, quantity: i.quantity }))
      });
      setSuccess('Delivery order created successfully!');
      setDeliveryDetails('');
      setPaymentMethod('COD');
      setCodAmount('');
      setDeliveryFee('');
      setSelectedItems([]);
      setShowCreateForm(false);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to create delivery order');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: number, status: OrderStatus) => {
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await api.deliveryOrders.updateStatus(orderId, status);
      setSuccess(`Order #${orderId} status updated to ${status}`);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update order status');
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
            onClick={() => { setShowCreateForm(!showCreateForm); setError(''); setSuccess(''); }} 
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
          <h2 style={{ marginBottom: '1.5rem' }}>Create Delivery Dispatch</h2>
          <form onSubmit={handleCreateOrder} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Delivery Details (Name, Address, Mobile) *</label>
              <textarea
                className="form-input"
                style={{ minHeight: '100px', fontFamily: 'inherit', resize: 'vertical' }}
                placeholder="Enter delivery recipient name, address, contact numbers and any special instructions..."
                value={deliveryDetails}
                onChange={(e) => setDeliveryDetails(e.target.value)}
                required
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Payment Mode</label>
                <select 
                  className="form-select" 
                  value={paymentMethod} 
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                >
                  <option value="COD">Cash On Delivery (COD)</option>
                  <option value="CASH_DEPOSIT">Prepaid Cash Deposit</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">COD Amount ($)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="0.00" 
                  value={codAmount}
                  onChange={(e) => setCodAmount(e.target.value)}
                  disabled={paymentMethod === 'CASH_DEPOSIT'}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Delivery Service Fee ($)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="0.00" 
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
              />
            </div>

            <div style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <span className="form-label">Select Package Contents</span>
              
              <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <div style={{ flex: 3, position: 'relative' }}>
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
                                  Stock: {p.totalStock} | ${p.standardPrice.toFixed(2)}
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
                    style={{ flex: 1 }}
                    placeholder="Qty" 
                    value={addItemQty}
                    onChange={(e) => setAddItemQty(e.target.value)}
                  />
                  <button type="button" onClick={handleAddProductToOrder} className="btn btn-secondary">
                    Add Item
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                {selectedItems.map((item, idx) => (
                  <div key={idx} className="flex justify-between align-center glass-card" style={{ padding: '0.5rem 1rem' }}>
                    <div>
                      <strong>{item.name}</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Deducting {item.quantity} units</p>
                    </div>
                    <button type="button" onClick={() => removeProductFromOrder(idx)} className="pointer" style={{ background: 'none', border: 'none', color: 'var(--accent-danger)' }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading || selectedItems.length === 0}>
              {loading ? 'Creating order...' : 'Dispatch Delivery Order'}
            </button>
          </form>
        </div>
      ) : (
        <div className="glass-panel">
          <h2 style={{ marginBottom: '1rem' }}>Active Shipments Log</h2>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Delivery Details</th>
                  <th>Order Date</th>
                  <th>Fee</th>
                  <th>Payment Type</th>
                  <th>COD Value</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id}>
                    <td><code>#{order.id}</code></td>
                    <td>
                      {order.deliveryDetails || 'N/A'}
                    </td>
                    <td>{new Date(order.orderDate).toLocaleDateString()}</td>
                    <td>${order.deliveryFee.toFixed(2)}</td>
                    <td>
                      <span className="badge badge-info">{order.paymentMethod}</span>
                    </td>
                    <td>${order.codAmount.toFixed(2)}</td>
                    <td>
                      <span className={`badge ${
                        order.status === 'PENDING' ? 'badge-warning' : 
                        order.status === 'DELIVERED' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        {order.status === 'PENDING' && (
                          <>
                            <button 
                              onClick={() => handleUpdateStatus(order.id, 'DELIVERED')}
                              className="btn btn-success" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              <Check size={12} /> Deliver
                            </button>
                            <button 
                              onClick={() => handleUpdateStatus(order.id, 'RETURNED')}
                              className="btn btn-danger" 
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              <RotateCcw size={12} /> Return
                            </button>
                          </>
                        )}
                        {order.status !== 'PENDING' && (
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Locked</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {orders.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      No delivery orders registered yet. Click "+ New Delivery Order" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};