import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ProductDto, Category, StockBatchDto, ExpenseItemDto } from '../types';
import { Plus, FolderPlus, List, Tag, Layers, FileImage, DollarSign, Search } from 'lucide-react';

export type InventoryStockFilter = 'ALL' | 'IN_STOCK' | 'OUT_OF_STOCK' | 'ALMOST_OUT';

interface InventoryProps {
  stockFilter?: InventoryStockFilter;
}

export const Inventory: React.FC<InventoryProps> = ({ stockFilter: requestedStockFilter }) => {
  const [activeSubTab, setActiveSubTab] = useState<'products' | 'categories' | 'batches'>('products');
  
  // Data lists
  const [products, setProducts] = useState<ProductDto[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [stockFilter, setStockFilter] = useState<InventoryStockFilter>(requestedStockFilter || 'ALL');
  const [categories, setCategories] = useState<Category[]>([]);
  const [batches, setBatches] = useState<StockBatchDto[]>([]);
  
  // Create Product states
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImageFile, setProdImageFile] = useState<File | null>(null);
  const [prodStandardPrice, setProdStandardPrice] = useState('');
  const [prodMinPrice, setProdMinPrice] = useState('');
  
  // Create Category states
  const [catName, setCatName] = useState('');

  // Create Stock Batch states
  const [batchProductId, setBatchProductId] = useState('');
  const [batchQty, setBatchQty] = useState('');
  const [batchBaseCost, setBatchBaseCost] = useState('');
  const [batchSellingPrice, setBatchSellingPrice] = useState('');
  const [batchExpenses, setBatchExpenses] = useState<ExpenseItemDto[]>([]);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  // Add Batch Expense modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [addExpenseDesc, setAddExpenseDesc] = useState('');
  const [addExpenseAmount, setAddExpenseAmount] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filteredProducts = products.filter(product => {
    const matchesName = product.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesStock = stockFilter === 'ALL'
      || (stockFilter === 'IN_STOCK' && product.totalStock > 0)
      || (stockFilter === 'OUT_OF_STOCK' && product.totalStock === 0)
      || (stockFilter === 'ALMOST_OUT' && product.totalStock > 0 && product.totalStock < 5);
    return matchesName && matchesStock;
  });

  const loadAllData = async () => {
    try {
      const p = await api.products.getAll();
      setProducts(p);
      const c = await api.categories.getAll();
      setCategories(c);
      const b = await api.batches.getAll();
      setBatches(b);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (requestedStockFilter) {
      setActiveSubTab('products');
      setStockFilter(requestedStockFilter);
    }
  }, [requestedStockFilter]);

  // Product Creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // 1. Generate code from backend
      const nextCode = await api.products.getNextCode();

      // 2. Check if name exists
      const exists = await api.products.checkExists(prodName);
      if (exists) {
        throw new Error('A product with this name already exists.');
      }

      // 3. Upload image if selected
      let imageUrl = '';
      if (prodImageFile) {
        imageUrl = await api.uploads.uploadImage(prodImageFile);
      }

      // 4. Submit
      await api.products.create({
        itemCode: nextCode,
        name: prodName,
        description: prodDesc || undefined,
        imageUrl: imageUrl || undefined,
        standardPrice: prodStandardPrice ? parseFloat(prodStandardPrice) : 0,
        minPrice: prodMinPrice ? parseFloat(prodMinPrice) : 0
      });

      setSuccess('Product registered successfully!');
      setProdName('');
      setProdDesc('');
      setProdImageFile(null);
      setProdStandardPrice('');
      setProdMinPrice('');
      
      const fileInput = document.getElementById('prod-img-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to register product');
    } finally {
      setLoading(false);
    }
  };

  // Category Creation
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.categories.create({ name: catName });
      setSuccess('Category created successfully!');
      setCatName('');
      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  // Add temp expense to batch form list
  const addTempExpense = () => {
    if (!newExpenseDesc || !newExpenseAmount) return;
    setBatchExpenses([...batchExpenses, {
      description: newExpenseDesc,
      amount: parseFloat(newExpenseAmount) || 0
    }]);
    setNewExpenseDesc('');
    setNewExpenseAmount('');
  };

  // Remove temp expense
  const removeTempExpense = (idx: number) => {
    setBatchExpenses(batchExpenses.filter((_, i) => i !== idx));
  };

  // Stock Batch Creation
  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchProductId || !batchQty || !batchBaseCost || !batchSellingPrice) {
      setError('Please fill in all required batch fields.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Fetch latest prices for standard/min updates or fallback
      const prod = products.find(p => p.id === parseInt(batchProductId));
      const sPrice = prodStandardPrice ? parseFloat(prodStandardPrice) : (prod?.standardPrice || parseFloat(batchSellingPrice));
      const mPrice = prodMinPrice ? parseFloat(prodMinPrice) : (prod?.minPrice || parseFloat(batchSellingPrice));

      await api.batches.create({
        productId: parseInt(batchProductId),
        quantity: parseInt(batchQty),
        baseCost: parseFloat(batchBaseCost),
        sellingPrice: parseFloat(batchSellingPrice),
        expenses: batchExpenses,
        standardPrice: sPrice,
        minPrice: mPrice
      });

      setSuccess('Stock batch added successfully!');
      setBatchProductId('');
      setBatchQty('');
      setBatchBaseCost('');
      setBatchSellingPrice('');
      setBatchExpenses([]);
      setProdStandardPrice('');
      setProdMinPrice('');
      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add stock batch');
    } finally {
      setLoading(false);
    }
  };

  // Add expense to existing batch
  const handleAddBatchExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !addExpenseDesc || !addExpenseAmount) return;
    setLoading(true);
    setError('');

    try {
      await api.batches.addExpense({
        batchId: selectedBatchId,
        description: addExpenseDesc,
        amount: parseFloat(addExpenseAmount)
      });
      setShowExpenseModal(false);
      setAddExpenseDesc('');
      setAddExpenseAmount('');
      setSuccess('Expense added to stock batch!');
      loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add batch expense');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-col gap-4">
      {/* Tab Menu Header */}
      <div className="page-header flex justify-between align-center">
        <div>
          <h1>Inventory & Stock Control</h1>
          <p className="page-subtitle">Add products, categories, track stock batches, and record landed expenses</p>
        </div>
        
        {/* Sub Navigation */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-glass)',
          borderRadius: 'var(--radius-md)',
          padding: '0.25rem'
        }}>
          <button 
            onClick={() => { setActiveSubTab('products'); setError(''); setSuccess(''); }} 
            className={`btn ${activeSubTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: 'none', boxShadow: 'none' }}
          >
            <Layers size={14} /> Products
          </button>
          <button 
            onClick={() => { setActiveSubTab('batches'); setError(''); setSuccess(''); }} 
            className={`btn ${activeSubTab === 'batches' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: 'none', boxShadow: 'none' }}
          >
            <List size={14} /> Stock Batches
          </button>
          <button 
            onClick={() => { setActiveSubTab('categories'); setError(''); setSuccess(''); }} 
            className={`btn ${activeSubTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: 'none', boxShadow: 'none' }}
          >
            <Tag size={14} /> Categories
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

      {/* PRODUCTS TAB */}
      {activeSubTab === 'products' && (
        <div className="layout-split">
          {/* Register Form */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Register New Product</h3>
            <form onSubmit={handleCreateProduct} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Product Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Body Kit for Toyota Corolla 2020" 
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea 
                  className="form-textarea" 
                  placeholder="Optional details..." 
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Product Image</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <label htmlFor="prod-img-input" className="btn btn-secondary" style={{ flex: 1, cursor: 'pointer' }}>
                    <FileImage size={16} /> Choose File
                  </label>
                  <input 
                    id="prod-img-input"
                    type="file" 
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => setProdImageFile(e.target.files?.[0] || null)}
                  />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {prodImageFile ? prodImageFile.name : 'No file chosen'}
                  </span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Standard Price (Retail) ($)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={prodStandardPrice}
                    onChange={(e) => setProdStandardPrice(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Min Price Floor ($)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={prodMinPrice}
                    onChange={(e) => setProdMinPrice(e.target.value)}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
                {loading ? 'Registering product...' : 'Register Product'}
              </button>
            </form>
          </div>

          {/* List panel */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem' }}>Product Registry</h3>
            <div className="form-row" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Search by Product Name</label>
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', bottom: '0.7rem', color: 'var(--text-muted)' }} />
                <input
                  type="search"
                  className="form-input"
                  style={{ paddingLeft: '2.25rem' }}
                  placeholder="Search product name..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Stock Status</label>
                <select
                  className="form-select"
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as typeof stockFilter)}
                >
                  <option value="ALL">All products</option>
                  <option value="IN_STOCK">In stock</option>
                  <option value="OUT_OF_STOCK">Out of stock</option>
                  <option value="ALMOST_OUT">Almost out (less than 5)</option>
                </select>
              </div>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Item Code</th>
                    <th>Image</th>
                    <th>Name</th>
                    <th>Standard (Retail)</th>
                    <th>Min Price</th>
                    <th>Stock Remaining</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map(product => (
                    <tr key={product.id}>
                      <td><code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{product.itemCode}</code></td>
                      <td>
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <strong>{product.name}</strong>
                        {product.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{product.description}</p>}
                      </td>
                      <td>${product.standardPrice.toFixed(2)}</td>
                      <td>${product.minPrice.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${product.totalStock > 0 ? 'badge-success' : 'badge-danger'}`}>
                          {product.totalStock} units
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {products.length === 0
                          ? 'No products registered. Use form on the left.'
                          : 'No products match the selected filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STOCK BATCHES TAB */}
      {activeSubTab === 'batches' && (
        <div className="layout-split">
          {/* Create Stock Batch Form */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Add Stock Batch</h3>
            <form onSubmit={handleCreateBatch} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Target Product</label>
                <select 
                  className="form-select" 
                  value={batchProductId} 
                  onChange={(e) => setBatchProductId(e.target.value)}
                  required
                >
                  <option value="">Select Product</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.itemCode})</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Quantity Received</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="e.g. 50" 
                    value={batchQty}
                    onChange={(e) => setBatchQty(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Base Cost / Unit ($)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={batchBaseCost}
                    onChange={(e) => setBatchBaseCost(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Wholesale Price / Unit ($)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="0.00" 
                  value={batchSellingPrice}
                  onChange={(e) => setBatchSellingPrice(e.target.value)}
                  required
                />
              </div>

              {/* Price default overrides */}
              <div className="form-row" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <span style={{ gridColumn: '1/-1', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>UPDATE DEFAULT PRODUCT PRICES (OPTIONAL)</span>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Standard Retail ($)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Same as Wholesale if empty"
                    value={prodStandardPrice}
                    onChange={(e) => setProdStandardPrice(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Min Price Floor ($)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Same as Wholesale if empty"
                    value={prodMinPrice}
                    onChange={(e) => setProdMinPrice(e.target.value)}
                  />
                </div>
              </div>

              {/* Batch-specific expenses */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', borderTop: '1px dashed var(--border-glass)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Batch Landed Expenses</span>
                
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    style={{ flex: 2 }}
                    placeholder="Expense name (e.g., Shipping)" 
                    value={newExpenseDesc}
                    onChange={(e) => setNewExpenseDesc(e.target.value)}
                  />
                  <input 
                    type="number" 
                    className="form-input" 
                    style={{ flex: 1 }}
                    placeholder="Amount" 
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                  />
                  <button type="button" onClick={addTempExpense} className="btn btn-secondary">
                    Add
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {batchExpenses.map((exp, idx) => (
                    <div key={idx} className="flex justify-between align-center glass-card" style={{ padding: '0.5rem 0.75rem' }}>
                      <span>{exp.description}</span>
                      <div className="flex align-center gap-4">
                        <strong>${exp.amount.toFixed(2)}</strong>
                        <button type="button" onClick={() => removeTempExpense(idx)} style={{ background: 'none', border: 'none', color: 'var(--accent-danger)', cursor: 'pointer' }}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
                {loading ? 'Adding stock batch...' : 'Add Stock Batch'}
              </button>
            </form>
          </div>

          {/* List panel */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem' }}>Active Stock Batches</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>Wholesale Price</th>
                    <th>Landed Cost/Unit</th>
                    <th>Expenses</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map(batch => (
                    <tr key={batch.id}>
                      <td><strong>{batch.productName}</strong></td>
                      <td>
                        <strong>{batch.quantityRemaining}</strong> / <span style={{ color: 'var(--text-muted)' }}>{batch.quantityInitial}</span>
                      </td>
                      <td>${batch.sellingPrice.toFixed(2)}</td>
                      <td>
                        <strong className="text-success">${batch.costPerItem.toFixed(2)}</strong>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Base cost: ${batch.baseCost.toFixed(2)}</p>
                      </td>
                      <td>
                        <span className="text-danger">-${batch.totalExpenses.toFixed(2)}</span>
                      </td>
                      <td>
                        <button 
                          onClick={() => { setSelectedBatchId(batch.id); setShowExpenseModal(true); }}
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          + Add Expense
                        </button>
                      </td>
                    </tr>
                  ))}
                  {batches.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No stock batches recorded. Fill form on left.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORIES TAB */}
      {activeSubTab === 'categories' && (
        <div className="layout-split">
          {/* Create Category */}
          <div className="glass-panel" style={{ height: 'fit-content' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>Create Category</h3>
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Category Name</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g. Body Kit for Toyota Corolla 2020" 
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
                {loading ? 'Creating category...' : 'Create Category'}
              </button>
            </form>
          </div>

          {/* List panel */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: '1rem' }}>Category Index</h3>
            <div className="table-container" style={{ maxWidth: '400px' }}>
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Category Name</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr key={cat.id}>
                      <td><code>#{cat.id}</code></td>
                      <td><strong>{cat.name}</strong></td>
                    </tr>
                  ))}
                  {categories.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No categories found. Create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal overlay to add batch expense */}
      {showExpenseModal && (
        <div className="modal-overlay">
          <div className="glass-panel modal-container">
            <h2 style={{ marginBottom: '1.5rem' }}>Add Landed Expense to Batch</h2>
            <form onSubmit={handleAddBatchExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-group">
                <label className="form-label">Expense Description</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., Customs Duty / Courier charges" 
                  value={addExpenseDesc}
                  onChange={(e) => setAddExpenseDesc(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Expense Amount ($)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="0.00" 
                  value={addExpenseAmount}
                  onChange={(e) => setAddExpenseAmount(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
                  {loading ? 'Adding expense...' : 'Add Expense'}
                </button>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }} 
                  onClick={() => { setShowExpenseModal(false); setSelectedBatchId(null); }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
