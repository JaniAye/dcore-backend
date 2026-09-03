import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ProductDto, CustomerDto, SaleItemRequest, DiscountLevel, SalePaymentMethod, SaleDto, StockBatchDto } from '../types';
import { Search, Plus, X, ShoppingCart, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';

export const POS: React.FC = () => {
  // Data lists
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [batches, setBatches] = useState<StockBatchDto[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  
  // Cart state
  interface CartItem {
    product: ProductDto;
    quantity: number;
    basePrice: number; // product.standardPrice or batch.sellingPrice
    useWholesale: boolean;
    discountType: 'NONE' | 'PERCENTAGE' | 'FIXED';
    discountValue: number;
  }
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Customer selection
  const [mobileQuery, setMobileQuery] = useState('');
  const [customer, setCustomer] = useState<CustomerDto | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerMobile, setNewCustomerMobile] = useState('');
  
  // Checkout options
  const [discountLevel, setDiscountLevel] = useState<DiscountLevel>('NONE');
  const [discountReason, setDiscountReason] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [internalReason, setInternalReason] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<SalePaymentMethod>('CASH');
  
  // Transaction feedback
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successSale, setSuccessSale] = useState<SaleDto | null>(null);

  // Initialize POS
  const loadData = async () => {
    try {
      const prodList = await api.products.getAll();
      setProducts(prodList);
      
      const batchList = await api.batches.getAll();
      setBatches(batchList);
    } catch (err) {
      console.error('Failed to load POS data:', err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Customer search - allow free text (name) or mobile; open quick-create when not found
  const handleCustomerSearch = async () => {
    if (!mobileQuery) {
      setCustomer(null);
      return;
    }
    setError('');
    try {
      // If query is digits only, treat as mobile search
      if (/^\d+$/.test(mobileQuery)) {
        const cust = await api.customers.searchMobile(mobileQuery);
        setCustomer(cust);
        return;
      }

      // Otherwise search by name among all customers (small dataset assumption)
      const all = await api.customers.getAll();
      const found = all.find(c => c.name.toLowerCase().includes(mobileQuery.toLowerCase()) || c.mobile.includes(mobileQuery));
      if (found) {
        setCustomer(found);
      } else {
        setError('Customer not found. You can register them below.');
        setNewCustomerName(mobileQuery);
        setNewCustomerMobile('');
        setShowAddCustomer(true);
        setCustomer(null);
      }
    } catch (err: any) {
      setError('Error searching for customer.');
      setCustomer(null);
    }
  };

  // Add customer inline (quick-create)
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName || !newCustomerMobile) return;
    setError('');
    try {
      const created = await api.customers.create({
        name: newCustomerName,
        mobile: newCustomerMobile
      });
      setCustomer(created);
      setShowAddCustomer(false);
      setNewCustomerName('');
      setNewCustomerMobile('');
      setMobileQuery('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create customer');
    }
  };

  // Get wholesale price from latest batch of a product
  const getProductWholesalePrice = (productId: number, defaultStandardPrice: number): number => {
    const productBatches = batches
      .filter(b => b.productId === productId)
      .sort((a, b) => b.id - a.id); // latest first
    if (productBatches.length > 0) {
      return productBatches[0].sellingPrice;
    }
    return defaultStandardPrice;
  };

  // Add item to cart
  const addToCart = (product: ProductDto) => {
    if (product.totalStock <= 0) {
      alert('Product is out of stock!');
      return;
    }

    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    if (existingIndex > -1) {
      const updatedCart = [...cart];
      if (updatedCart[existingIndex].quantity >= product.totalStock) {
        alert(`Cannot add more. Only ${product.totalStock} units available.`);
        return;
      }
      updatedCart[existingIndex].quantity += 1;
      setCart(updatedCart);
    } else {
      setCart([...cart, {
        product,
        quantity: 1,
        basePrice: product.standardPrice,
        useWholesale: false,
        discountType: 'NONE',
        discountValue: 0
      }]);
    }
  };

  // Update item in cart
  const updateCartItem = (index: number, updates: Partial<CartItem>) => {
    const updatedCart = [...cart];
    const item = { ...updatedCart[index], ...updates };
    
    // Validate stock
    if (item.quantity > item.product.totalStock) {
      alert(`Only ${item.product.totalStock} units available.`);
      item.quantity = item.product.totalStock;
    }
    if (item.quantity < 1) item.quantity = 1;
    
    updatedCart[index] = item;
    setCart(updatedCart);
  };

  // Remove item
  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  // Calculations
  const calculateItemOverridePrice = (item: CartItem): number => {
    if (isInternal) return 0;
    
    let price = item.basePrice;
    if (item.discountType === 'PERCENTAGE') {
      price = price * (1 - item.discountValue / 100);
    } else if (item.discountType === 'FIXED') {
      price = price - item.discountValue;
    }
    return Math.max(0, price);
  };

  const getCartTotals = () => {
    let subtotal = 0;
    let discount = 0;
    
    cart.forEach(item => {
      const originalItemTotal = item.basePrice * item.quantity;
      const finalItemPrice = calculateItemOverridePrice(item);
      const finalItemTotal = finalItemPrice * item.quantity;
      
      subtotal += originalItemTotal;
      discount += (originalItemTotal - finalItemTotal);
    });

    const final = Math.max(0, subtotal - discount);
    return { subtotal, discount, final };
  };

  const { subtotal, discount, final } = getCartTotals();

  // Reset states on success checkout view close
  const handleNewSale = () => {
    setCart([]);
    setCustomer(null);
    setMobileQuery('');
    setDiscountLevel('NONE');
    setDiscountReason('');
    setIsInternal(false);
    setInternalReason('');
    setPaymentAmount('');
    setSuccessSale(null);
    loadData(); // refresh stock
  };

  // Submit sale
  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError('Your checkout cart is empty.');
      return;
    }
    
    if (!isInternal && !customer && !paymentAmount) {
      setError('Please search/select a customer, or enter a payment amount for immediate cash sale.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const items: SaleItemRequest[] = cart.map(item => ({
        productId: item.product.id,
        quantity: item.quantity,
        discountType: 'NONE', // Backend handles discounts via overridePrice
        discountValue: 0,
        overridePrice: calculateItemOverridePrice(item)
      }));

      const sale = await api.sales.create({
        customerId: customer ? customer.id : 0,
        items,
        discountLevel,
        discountReason: discountReason || undefined,
        isInternal,
        internalReason: isInternal ? internalReason : undefined,
        paymentAmount: paymentAmount ? parseFloat(paymentAmount) : undefined,
        paymentMethod: paymentAmount ? paymentMethod : undefined
      });
      setSuccessSale(sale);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Checkout failed. Verify inventory and pricing floor levels.');
    } finally {
      setLoading(false);
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.itemCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (successSale) {
    return (
      <div className="flex-col align-center justify-between" style={{ padding: '3rem 1rem', maxWidth: '600px', margin: '0 auto' }}>
        <div className="glass-panel w-full text-center" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <CheckCircle size={64} style={{ color: 'var(--accent-success)', margin: '0 auto' }} />
          <h2>Sale Completed Successfully</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Invoice Code: <strong style={{ color: '#fff' }}>{successSale.invoiceId}</strong></p>
          
          <div style={{
            textAlign: 'left',
            background: 'rgba(255,255,255,0.02)',
            padding: '1.5rem',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-glass)',
            fontSize: '0.95rem'
          }}>
            <div className="flex justify-between mb-4">
              <span>Customer:</span>
              <strong>{successSale.customerName || 'Walk-in Cash Customer'}</strong>
            </div>
            <div className="flex justify-between mb-4">
              <span>Sold By:</span>
              <span>{successSale.sellerName}</span>
            </div>
            <div className="flex justify-between mb-4">
              <span>Total Before Discount:</span>
              <span>${successSale.totalAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-4">
              <span>Item Discounts:</span>
              <span className="text-danger">-${successSale.discountAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between mb-4" style={{ fontSize: '1.15rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
              <strong>Total Invoice:</strong>
              <strong className="text-accent">${successSale.finalAmount.toFixed(2)}</strong>
            </div>
            <div className="flex justify-between">
              <span>Outstanding Balance:</span>
              <strong className={successSale.outstandingBalance > 0 ? 'text-warning' : 'text-success'}>
                ${successSale.outstandingBalance.toFixed(2)}
              </strong>
            </div>
          </div>

          <button onClick={handleNewSale} className="btn btn-primary mt-4">
            Start New POS checkout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-col gap-4">
      <div className="page-header">
        <h1>POS Checkout Terminal</h1>
        <p className="page-subtitle">Draft transactions, apply wholesale/retail pricing, and record payments</p>
      </div>

      {error && (
        <div className="flex align-center gap-2" style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: 'var(--accent-danger)',
          padding: '1rem',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem'
        }}>
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      )}

      <div className="layout-split-pos">
        {/* Main area: Cart and Checkout controls */}
        <div className="flex-col gap-4">
          <div className="glass-panel" style={{ padding: '1.5rem', position: 'relative', zIndex: 2 }}>
            <label className="form-label">Search Items</label>
            <div style={{ position: 'relative' }}>
              <Search size={18} style={{
                position: 'absolute',
                left: '1rem',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)'
              }} />
              <input
                type="text"
                className="form-input w-full"
                style={{ paddingLeft: '2.75rem' }}
                placeholder="Search products by code or name..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setShowItemSuggestions(true);
                }}
                onFocus={() => setShowItemSuggestions(true)}
              />
              {showItemSuggestions && searchTerm.trim() && filteredProducts.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  zIndex: 20,
                  marginTop: '0.25rem',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-glass)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-md)',
                  maxHeight: '280px',
                  overflowY: 'auto'
                }}>
                  {filteredProducts.map(product => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        addToCart(product);
                        setSearchTerm('');
                        setShowItemSuggestions(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.65rem',
                        width: '100%',
                        padding: '0.5rem 0.65rem',
                        border: 'none',
                        borderBottom: '1px solid var(--border-glass)',
                        background: 'transparent',
                        color: 'var(--text-primary)',
                        textAlign: 'left',
                        cursor: 'pointer'
                      }}
                    >
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt="" style={{ width: '28px', height: '28px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-tertiary)', flexShrink: 0 }} />
                      )}
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{product.name}</strong>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{product.itemCode} | Stock: {product.totalStock}</span>
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 700 }}>${product.standardPrice.toFixed(2)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Cart items */}
          <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', zIndex: 1 }}>
            <div className="flex justify-between align-center">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingCart size={18} />
                <span>Selected Items</span>
              </h3>
              <span className="badge badge-info">{cart.length} items</span>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '350px' }}>
              {cart.map((item, index) => {
                const finalUnitPrice = calculateItemOverridePrice(item);
                const itemTotal = finalUnitPrice * item.quantity;
                return (
                  <div key={item.product.id} className="pos-cart-item">
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.product.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', gap: '0.5rem' }}>
                        <span>Code: {item.product.itemCode}</span>
                        <span>Stock: {item.product.totalStock}</span>
                      </div>
                    </div>

                    {/* Pricing mode: Retail vs Wholesale */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <select 
                        className="form-select" 
                        style={{ padding: '0.25rem', fontSize: '0.75rem' }}
                        value={item.useWholesale ? 'wholesale' : 'retail'}
                        onChange={(e) => {
                          const isWholesale = e.target.value === 'wholesale';
                          const defaultPrice = isWholesale 
                            ? getProductWholesalePrice(item.product.id, item.product.standardPrice)
                            : item.product.standardPrice;
                          updateCartItem(index, { useWholesale: isWholesale, basePrice: defaultPrice });
                        }}
                      >
                        <option value="retail">Retail</option>
                        <option value="wholesale">Wholesale</option>
                      </select>
                      <input 
                        type="number" 
                        className="form-input" 
                        style={{ padding: '0.25rem', width: '70px', fontSize: '0.75rem' }}
                        value={item.basePrice}
                        onChange={(e) => updateCartItem(index, { basePrice: parseFloat(e.target.value) || 0 })}
                        title="Override base unit price"
                      />
                    </div>

                    {/* Quantity & Discount */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Qty:</span>
                        <input 
                          type="number" 
                          className="form-input" 
                          style={{ padding: '0.25rem 0.5rem', width: '50px', fontSize: '0.75rem' }} 
                          value={item.quantity}
                          min="1"
                          max={item.product.totalStock}
                          onChange={(e) => updateCartItem(index, { quantity: parseInt(e.target.value) || 1 })}
                        />
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <select 
                          className="form-select" 
                          style={{ padding: '0.15rem', fontSize: '0.7rem' }}
                          value={item.discountType}
                          onChange={(e) => updateCartItem(index, { discountType: e.target.value as any, discountValue: 0 })}
                        >
                          <option value="NONE">Disc: None</option>
                          <option value="PERCENTAGE">%</option>
                          <option value="FIXED">$</option>
                        </select>
                        {item.discountType !== 'NONE' && (
                          <input 
                            type="number" 
                            className="form-input" 
                            style={{ padding: '0.15rem', width: '45px', fontSize: '0.7rem' }}
                            value={item.discountValue}
                            onChange={(e) => updateCartItem(index, { discountValue: parseFloat(e.target.value) || 0 })}
                          />
                        )}
                      </div>
                    </div>

                    {/* Totals & delete */}
                    <div className="text-right" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>${itemTotal.toFixed(2)}</span>
                      {item.basePrice !== finalUnitPrice && (
                        <span style={{ fontSize: '0.7rem', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                          ${(item.basePrice * item.quantity).toFixed(2)}
                        </span>
                      )}
                      <button onClick={() => removeFromCart(index)} className="mt-4" style={{
                        background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer'
                      }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {cart.length === 0 && (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Cart is empty. Select items from grid.
                </div>
              )}
            </div>

            {/* Global Pricing options */}
            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="flex justify-between">
                <span>Cart Subtotal:</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discounts applied:</span>
                <span className="text-danger">-${discount.toFixed(2)}</span>
              </div>

              {/* Discount levels */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Discount Level</label>
                  <select 
                    className="form-select" 
                    value={discountLevel} 
                    onChange={(e) => setDiscountLevel(e.target.value as any)}
                  >
                    <option value="NONE">None</option>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="MAX">Max (Admin review needed)</option>
                  </select>
                </div>
                {discountLevel === 'MAX' && (
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: '0.7rem' }}>Discount Reason</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Required"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Internal transaction toggle */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input 
                    type="checkbox" 
                    checked={isInternal} 
                    onChange={(e) => setIsInternal(e.target.checked)} 
                  />
                  <span>Mark as Internal Office/Demo Sale (Total: $0)</span>
                </label>
                {isInternal && (
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter reason for internal usage" 
                    value={internalReason}
                    onChange={(e) => setInternalReason(e.target.value)}
                  />
                )}
              </div>

              {/* Payment details */}
              <div className="form-row" style={{ borderTop: '1px dashed var(--border-glass)', paddingTop: '1rem' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Payment Received ($)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder={final.toFixed(2)}
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Payment Method</label>
                  <select 
                    className="form-select" 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="CASH">Cash</option>
                    <option value="CARD">Card</option>
                    <option value="BANK_TRANSFER">Bank Transfer</option>
                    <option value="CREDIT">Store Credit</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between align-center mt-4" style={{ fontSize: '1.25rem', borderTop: '1px solid var(--border-glass)', paddingTop: '1rem' }}>
                <strong>Payable Total:</strong>
                <strong className="text-accent">${isInternal ? '0.00' : final.toFixed(2)}</strong>
              </div>

              <button 
                onClick={handleCheckout} 
                className="btn btn-primary w-full mt-4"
                disabled={loading || cart.length === 0}
              >
                {loading ? 'Processing checkout...' : 'Submit Transaction'}
              </button>
            </div>
          </div>
        </div>

        {/* Secondary area: Product selector grid */}
        <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Customer Assignment</h3>
            {!customer ? (
              <div className="flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-input w-full"
                    placeholder="Search name or mobile..."
                    value={mobileQuery}
                    onChange={(e) => setMobileQuery(e.target.value)}
                  />
                  <button onClick={handleCustomerSearch} className="btn btn-secondary" type="button">
                    <Search size={18} />
                  </button>
                  <button
                    onClick={() => {
                      if (showAddCustomer) {
                        setShowAddCustomer(false);
                        setNewCustomerName('');
                        setNewCustomerMobile('');
                      } else {
                        setNewCustomerName(mobileQuery);
                        setShowAddCustomer(true);
                      }
                    }}
                    className={`btn ${showAddCustomer ? 'btn-secondary' : 'btn-outline'}`}
                    type="button"
                    aria-label={showAddCustomer ? 'Close customer form' : 'Add customer'}
                  >
                    {showAddCustomer ? <X size={16} /> : <Plus size={16} />}
                  </button>
                </div>
                {showAddCustomer && (
                  <form onSubmit={handleCreateCustomer} className="glass-card mt-4 flex-col gap-2">
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>REGISTER CUSTOMER</span>
                    <div className="form-group">
                      <input type="text" className="form-input" placeholder="Customer Name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} required />
                    </div>
                    <div className="form-group">
                      <input type="text" className="form-input" placeholder="Mobile" value={newCustomerMobile} onChange={(e) => setNewCustomerMobile(e.target.value)} required />
                    </div>
                    <button type="submit" className="btn btn-primary w-full">
                      <Plus size={16} /> Save Customer
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="glass-card flex justify-between align-center">
                <div>
                  <h4 style={{ fontWeight: 700 }}>{customer.name}</h4>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mob: {customer.mobile}</span>
                </div>
                <div className="text-right">
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Outstanding Balance</span>
                  <div style={{ color: 'var(--accent-warning)', fontWeight: 700 }}>${customer.outstandingBalance.toFixed(2)}</div>
                  <button onClick={() => setCustomer(null)} className="pointer" style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>Clear Selection</button>
                </div>
              </div>
            )}
          </div>

          <div className="pos-products-grid">
            {filteredProducts.map(product => (
              <div 
                key={product.id} 
                className="glass-card pos-product-card" 
                onClick={() => addToCart(product)}
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} className="pos-product-image" />
                ) : (
                  <div className="pos-product-placeholder">No Image</div>
                )}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>{product.itemCode}</span>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: '1.2' }}>{product.name}</span>
                  <div className="flex justify-between align-center mt-4">
                    <span style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>${product.standardPrice.toFixed(2)}</span>
                    <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>Stock: {product.totalStock}</span>
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                No products found matching "{searchTerm}"
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
