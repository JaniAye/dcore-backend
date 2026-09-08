import React, { useEffect, useState } from 'react';
import { api, getImageUrl } from '../services/api';
import { ProductDto, Category, StockBatchDto, ExpenseItemDto } from '../types';
import { Plus, List, Tag, Layers, FileImage, Search, Pencil, Trash2, X } from 'lucide-react';
import { TableLoader } from './TableLoader';
import { Pagination } from './Pagination';
import { formatCurrency } from '../utils/format';

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
  const [batchSearchDraft, setBatchSearchDraft] = useState('');
  const [batchSearch, setBatchSearch] = useState('');
  
  // Create Product states
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodImageFile, setProdImageFile] = useState<File | null>(null);
  const [prodImagePreview, setProdImagePreview] = useState('');
  const [prodStandardPrice, setProdStandardPrice] = useState('');
  const [prodWholesalePrice, setProdWholesalePrice] = useState('');
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingProductImageUrl, setEditingProductImageUrl] = useState('');
  const [editingProductActive, setEditingProductActive] = useState(true);
  
  // Create Category states
  const [catName, setCatName] = useState('');

  // Create Stock Batch states
  const [batchProductId, setBatchProductId] = useState('');
  const [batchProductQuery, setBatchProductQuery] = useState('');
  const [batchQty, setBatchQty] = useState('');
  const [batchBaseCost, setBatchBaseCost] = useState('');
  const [batchExpenses, setBatchExpenses] = useState<ExpenseItemDto[]>([]);
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');

  // Add Batch Expense modal states
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [addExpenseDesc, setAddExpenseDesc] = useState('');
  const [addExpenseAmount, setAddExpenseAmount] = useState('');

  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [editBatchProductId, setEditBatchProductId] = useState('');
  const [editBatchQuantity, setEditBatchQuantity] = useState('');
  const [editBatchRemaining, setEditBatchRemaining] = useState('');
  const [editBatchBaseCost, setEditBatchBaseCost] = useState('');
  const [editBatchStandardPrice, setEditBatchStandardPrice] = useState('');

  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [productPage, setProductPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [categoryPage, setCategoryPage] = useState(1);
  const inventoryPageSize = 10;

  const filteredProducts = products.filter(product => {
    const matchesName = product.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchesStock = stockFilter === 'ALL'
      || (stockFilter === 'IN_STOCK' && product.totalStock > 0)
      || (stockFilter === 'OUT_OF_STOCK' && product.totalStock === 0)
      || (stockFilter === 'ALMOST_OUT' && product.totalStock > 0 && product.totalStock < 5);
    return matchesName && matchesStock;
  });

  const filteredBatches = batches.filter(batch => {
    const query = batchSearch.trim().toLowerCase();
    return !query || batch.productName.toLowerCase().includes(query);
  });
  const paginatedProducts = filteredProducts.slice((productPage - 1) * inventoryPageSize, productPage * inventoryPageSize);
  const paginatedBatches = filteredBatches.slice((batchPage - 1) * inventoryPageSize, batchPage * inventoryPageSize);
  const paginatedCategories = categories.slice((categoryPage - 1) * inventoryPageSize, categoryPage * inventoryPageSize);

  const normalizedProductName = prodName.trim().toLowerCase();
  const similarProducts = normalizedProductName
    ? products.filter(product => product.name.toLowerCase().includes(normalizedProductName) && product.id !== editingProductId).slice(0, 5)
    : [];
  const duplicateProduct = products.find(product => product.active && product.name.trim().toLowerCase() === normalizedProductName && product.id !== editingProductId);

  const loadAllData = async () => {
    setDataLoading(true);
    try {
      const p = await api.products.getAll();
      setProducts(p);
      const c = await api.categories.getAll();
      setCategories(c);
      const b = await api.batches.getAll();
      setBatches(b);
    } catch (err) {
      console.error(err);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    if (!prodImageFile) return;
    const previewUrl = URL.createObjectURL(prodImageFile);
    setProdImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [prodImageFile]);

  useEffect(() => {
    if (requestedStockFilter) {
      setActiveSubTab('products');
      setStockFilter(requestedStockFilter);
    }
  }, [requestedStockFilter]);

  // Product Creation
  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim() || duplicateProduct) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const nextCode = editingProductId === null ? await api.products.getNextCode() : (products.find(product => product.id === editingProductId)?.itemCode || '');

      if (editingProductId === null && await api.products.checkExists(prodName.trim())) {
        throw new Error('A product with this name already exists.');
      }

      // 3. Upload image if selected
      let imageUrl = '';
      if (prodImageFile) {
        imageUrl = await api.uploads.uploadImage(prodImageFile);
      }

      // 4. Submit
      const productData = {
        itemCode: nextCode,
        name: prodName.trim(),
        description: prodDesc || undefined,
        imageUrl: imageUrl || editingProductImageUrl || undefined,
        active: editingProductId === null ? true : editingProductActive,
        standardPrice: prodStandardPrice ? parseFloat(prodStandardPrice) : 0,
        wholesalePrice: prodWholesalePrice ? parseFloat(prodWholesalePrice) : 0
      };
      if (editingProductId === null) {
        await api.products.create(productData);
      } else {
        await api.products.update(editingProductId, productData);
      }

      setSuccess(editingProductId === null ? 'Product registered successfully!' : 'Product updated successfully!');
      setProdName('');
      setProdDesc('');
      setProdImageFile(null);
      setProdImagePreview('');
      setProdStandardPrice('');
      setProdWholesalePrice('');
      setEditingProductId(null);
      setEditingProductImageUrl('');
      setEditingProductActive(true);
      
      const fileInput = document.getElementById('prod-img-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      loadAllData();
      setShowProductForm(false);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to register product');
    } finally {
      setLoading(false);
    }
  };

  const startEditingProduct = (product: ProductDto) => {
    setEditingProductId(product.id);
    setProdName(product.name);
    setProdDesc(product.description || '');
    setProdStandardPrice(String(product.standardPrice || ''));
    setProdWholesalePrice(String(product.wholesalePrice || ''));
    setEditingProductImageUrl(product.imageUrl || '');
    setProdImagePreview(getImageUrl(product.imageUrl));
    setEditingProductActive(product.active !== false);
    setProdImageFile(null);
    setProdImagePreview('');
    setShowProductForm(true);
    setError('');
    setSuccess('');
  };

  const cancelProductEdit = () => {
    setEditingProductId(null);
    setEditingProductImageUrl('');
    setEditingProductActive(true);
    setProdName('');
    setProdDesc('');
    setProdImageFile(null);
    setProdStandardPrice('');
    setProdWholesalePrice('');
    setShowProductForm(false);
  };

  const handleDeleteProduct = async (product: ProductDto) => {
    if (!window.confirm(`Deactivate product "${product.name}"?`)) return;
    setLoading(true);
    setError('');
    try {
      await api.products.update(product.id, {
        itemCode: product.itemCode,
        name: product.name,
        description: product.description,
        imageUrl: product.imageUrl,
        standardPrice: product.standardPrice,
        wholesalePrice: product.wholesalePrice,
        active: false
      });
      setSuccess('Product deactivated successfully!');
      if (editingProductId === product.id) cancelProductEdit();
      await loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Unable to delete this product. It may be used by existing stock or sales.');
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
    if (!batchProductId || !batchQty || !batchBaseCost) {
      setError('Please fill in all required batch fields.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Keep the product's retail price editable while receiving stock.
      const prod = products.find(p => p.id === parseInt(batchProductId));
      const sPrice = prodStandardPrice ? parseFloat(prodStandardPrice) : (prod?.standardPrice || 0);

      await api.batches.create({
        productId: parseInt(batchProductId),
        quantity: parseInt(batchQty),
        baseCost: parseFloat(batchBaseCost),
        expenses: batchExpenses,
        standardPrice: sPrice
      });

      setSuccess('Stock batch added successfully!');
      setBatchProductId('');
      setBatchQty('');
      setBatchBaseCost('');
      setBatchProductQuery('');
      setBatchExpenses([]);
      setProdStandardPrice('');
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

  const startEditingBatch = (batch: StockBatchDto) => {
    setEditingBatchId(batch.id);
    setEditBatchProductId(String(batch.productId));
    setEditBatchQuantity(String(batch.quantityInitial));
    setEditBatchRemaining(String(batch.quantityRemaining));
    setEditBatchBaseCost(String(batch.baseCost));
    const product = products.find(item => item.id === batch.productId);
    setEditBatchStandardPrice(String(product?.standardPrice || ''));
    setShowBatchEditModal(true);
    setError('');
    setSuccess('');
  };

  const addStockForProduct = async (product: ProductDto) => {
    setActiveSubTab('batches');
    setBatchProductId(String(product.id));
    setBatchProductQuery(`${product.name} (${product.itemCode})`);
    setBatchQty('');
    setBatchBaseCost('');
    setBatchExpenses([]);
    setProdStandardPrice(String(product.standardPrice || ''));
    setError('');
    setSuccess('');

    try {
      const defaults = await api.batches.getProductDefaults(product.id);
      setBatchBaseCost(defaults.lastBaseCost ? String(defaults.lastBaseCost) : '');
      if (defaults.standardPrice) setProdStandardPrice(String(defaults.standardPrice));
    } catch (err) {
      console.error('Unable to load product stock defaults:', err);
    }
  };

  const handleEditBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBatchId || !editBatchProductId || !editBatchQuantity || !editBatchRemaining || !editBatchBaseCost) return;
    setLoading(true);
    setError('');
    try {
      await api.batches.update(editingBatchId, {
        productId: parseInt(editBatchProductId),
        quantity: parseInt(editBatchQuantity),
        quantityRemaining: parseInt(editBatchRemaining),
        baseCost: parseFloat(editBatchBaseCost),
        expenses: [],
        standardPrice: editBatchStandardPrice ? parseFloat(editBatchStandardPrice) : 0
      });
      setShowBatchEditModal(false);
      setEditingBatchId(null);
      setSuccess('Stock batch updated successfully!');
      await loadAllData();
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update stock batch');
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
          {/* <button 
            onClick={() => { setActiveSubTab('categories'); setError(''); setSuccess(''); }} 
            className={`btn ${activeSubTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', border: 'none', boxShadow: 'none' }}
          >
            <Tag size={14} /> Categories
          </button> */}
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
        <div className="flex-col gap-4">
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => { if (showProductForm) cancelProductEdit(); else { setShowProductForm(true); setError(''); setSuccess(''); } }}
            >
              {showProductForm ? <><X size={16} /> Close Product Form</> : <><Plus size={16} /> Register New Product</>}
            </button>
          </div>
          {/* Register Form */}
          {showProductForm && <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) cancelProductEdit(); }}>
          <div className="glass-panel modal-container" style={{ maxWidth: '700px', width: '100%' }}>
            <h3 style={{ marginBottom: '1.5rem' }}>{editingProductId === null ? 'Register New Product' : 'Edit Product'}</h3>
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
                {similarProducts.length > 0 && (
                  <div style={{ marginTop: '0.35rem', border: '1px solid rgba(250, 204, 21, 0.35)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                    {similarProducts.map(product => (
                      <button key={product.id} type="button" onClick={() => startEditingProduct(product)} style={{ display: 'block', width: '100%', textAlign: 'left', border: 'none', padding: '0.45rem 0.65rem', background: 'rgba(250, 204, 21, 0.12)', color: '#facc15', cursor: 'pointer' }}>
                        {product.name}
                      </button>
                    ))}
                  </div>
                )}
                {duplicateProduct && (
                  <div style={{ color: '#facc15', fontSize: '0.8rem', marginTop: '0.35rem' }}>
                    {duplicateProduct.name}
                  </div>
                )}
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
                {prodImagePreview && (
                  <img src={prodImagePreview} alt="Product preview" style={{ marginTop: '0.75rem', width: '96px', height: '96px', objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-glass)' }} />
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Standard Price (Retail) (LKR)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={prodStandardPrice}
                    onChange={(e) => setProdStandardPrice(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Wholesale Price (LKR)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="0.00" 
                    value={prodWholesalePrice}
                    onChange={(e) => setProdWholesalePrice(e.target.value)}
                  />
                </div>
              </div>

              {editingProductId !== null && (
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: editingProductActive ? 'var(--accent-success)' : 'var(--accent-danger)' }}>
                  <input type="checkbox" checked={editingProductActive} onChange={(event) => setEditingProductActive(event.target.checked)} />
                  {editingProductActive ? 'Active product' : 'Inactive product - reactivate'}
                </label>
              )}

              <button type="submit" className="btn btn-primary w-full mt-4" disabled={loading}>
                {loading ? (editingProductId === null ? 'Registering product...' : 'Updating product...') : (editingProductId === null ? 'Register Product' : 'Update Product')}
              </button>
            </form>
          </div>
          </div>}

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
                    <th>Wholesale Price</th>
                    <th>Stock Remaining</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dataLoading ? <TableLoader colSpan={7} label="Loading products..." /> : paginatedProducts.map(product => (
                    <tr key={product.id} style={!product.active ? { color: 'var(--accent-danger)' } : undefined}>
                      <td><code style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{product.itemCode}</code></td>
                      <td>
                        {product.imageUrl ? (
                          <img src={getImageUrl(product.imageUrl)} alt={product.name} style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: 'var(--radius-sm)' }} />
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>None</span>
                        )}
                      </td>
                      <td>
                        <strong style={!product.active ? { color: 'var(--accent-danger)' } : undefined}>{product.name}</strong>
                        {!product.active && <span style={{ display: 'block', color: 'var(--accent-danger)', fontSize: '0.7rem' }}>INACTIVE</span>}
                        {product.description && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{product.description}</p>}
                      </td>
                      <td>
                        <div>{formatCurrency(product.standardPrice)}</div>
                        <small style={{ display: 'block', color: 'var(--accent-danger)', fontSize: '0.7rem', marginTop: '0.15rem' }}>
                          {(() => {
                            const latestBatch = batches
                              .filter(batch => batch.productId === product.id)
                              .sort((first, second) => second.id - first.id)[0];
                            return latestBatch ? formatCurrency(latestBatch.costPerItem) : 'N/A';
                          })()}
                        </small>
                      </td>
                      <td>{formatCurrency(product.wholesalePrice)}</td>
                      <td>
                        <span className={`badge ${product.totalStock > 0 ? 'badge-success' : 'badge-danger'}`}>
                          {product.totalStock} units
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem' }}>
                          <button type="button" className="btn btn-primary" title={`Add stock for ${product.name}`} aria-label={`Add stock for ${product.name}`} onClick={() => addStockForProduct(product)} style={{ padding: '0.35rem' }}><Plus size={14} /></button>
                          <button type="button" className="btn btn-secondary" title="Edit product" onClick={() => startEditingProduct(product)} style={{ padding: '0.35rem' }}><Pencil size={14} /></button>
                          {product.active && <button type="button" className="btn btn-secondary" title="Deactivate product" onClick={() => handleDeleteProduct(product)} disabled={loading} style={{ padding: '0.35rem', color: 'var(--accent-danger)' }}><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!dataLoading && filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {products.length === 0
                          ? 'No products registered. Use form on the left.'
                          : 'No products match the selected filters.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination currentPage={productPage} totalItems={filteredProducts.length} pageSize={inventoryPageSize} onPageChange={setProductPage} />
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
                <input
                  className="form-input"
                  placeholder="Search products..."
                  value={batchProductQuery}
                  onChange={(e) => {
                    const query = e.target.value;
                    setBatchProductQuery(query);
                    const selected = products.find(p => p.active && `${p.name} (${p.itemCode})` === query);
                    setBatchProductId(selected ? String(selected.id) : '');
                  }}
                  list="batch-product-options"
                  required
                />
                <datalist id="batch-product-options">
                  {products.filter(p => p.active).map(p => (
                    <option key={p.id} value={`${p.name} (${p.itemCode})`} />
                  ))}
                </datalist>
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
                  <label className="form-label">Base Cost / Unit (LKR)</label>
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

              {/* Price default overrides */}
              {/* <div className="form-row" style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: 'var(--radius-md)' }}>
                <span style={{ gridColumn: '1/-1', fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>UPDATE DEFAULT PRODUCT PRICES (OPTIONAL)</span>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.7rem' }}>Standard Retail (LKR)</label>
                  <input 
                    type="number" 
                    className="form-input" 
                    placeholder="Keep current retail price"
                    value={prodStandardPrice}
                    onChange={(e) => setProdStandardPrice(e.target.value)}
                  />
                </div>
              </div> */}

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
                        <strong>{formatCurrency(exp.amount)}</strong>
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
            <div className="flex align-center gap-2" style={{ marginBottom: '1rem' }}>
              <input
                type="search"
                className="form-input"
                placeholder="Search stock batches by product..."
                value={batchSearchDraft}
                onChange={(event) => setBatchSearchDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') setBatchSearch(batchSearchDraft); }}
                style={{ flex: 1 }}
              />
              <button type="button" className="btn btn-secondary" onClick={() => setBatchSearch(batchSearchDraft)} title="Search stock batches" aria-label="Search stock batches" style={{ padding: '0.65rem 0.8rem' }}>
                <Search size={16} />
              </button>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>Landed Cost/Unit</th>
                    <th>Expenses</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {dataLoading ? <TableLoader colSpan={5} label="Loading stock batches..." /> : paginatedBatches.map(batch => {
                    const batchProduct = products.find(product => product.id === batch.productId);
                    const isInactive = batchProduct?.active === false;
                    return (
                    <tr key={batch.id} style={isInactive ? { color: 'var(--accent-danger)' } : undefined}>
                      <td><strong style={isInactive ? { color: 'var(--accent-danger)' } : undefined}>{batch.productName}</strong>{isInactive && <span style={{ display: 'block', color: 'var(--accent-danger)', fontSize: '0.7rem' }}>INACTIVE PRODUCT</span>}</td>
                      <td>
                        <strong>{batch.quantityRemaining}</strong> / <span style={{ color: 'var(--text-muted)' }}>{batch.quantityInitial}</span>
                      </td>
                      <td>
                        <strong className="text-success">{formatCurrency(batch.costPerItem)}</strong>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Base cost: {formatCurrency(batch.baseCost)}</p>
                      </td>
                      <td>
                        <span className="text-danger">-{formatCurrency(batch.totalExpenses)}</span>
                      </td>
                      <td>
                        <button 
                          onClick={() => { setSelectedBatchId(batch.id); setShowExpenseModal(true); }}
                          className="btn btn-secondary" 
                          style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        >
                          + Add Expense
                        </button>
                          <button
                            type="button"
                            onClick={() => startEditingBatch(batch)}
                            className="btn btn-secondary"
                            title="Edit stock batch"
                            style={{ padding: '0.25rem 0.5rem' }}
                          >
                            <Pencil size={13} /> Edit
                          </button>
                      </td>
                    </tr>
                    );
                  })}
                  {!dataLoading && filteredBatches.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        {batches.length === 0 ? 'No stock batches recorded. Fill form on left.' : 'No stock batches match your search.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination currentPage={batchPage} totalItems={filteredBatches.length} pageSize={inventoryPageSize} onPageChange={setBatchPage} />
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
                  {dataLoading ? <TableLoader colSpan={2} label="Loading categories..." /> : paginatedCategories.map(cat => (
                    <tr key={cat.id}>
                      <td><code>#{cat.id}</code></td>
                      <td><strong>{cat.name}</strong></td>
                    </tr>
                  ))}
                  {!dataLoading && categories.length === 0 && (
                    <tr>
                      <td colSpan={2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                        No categories found. Create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              <Pagination currentPage={categoryPage} totalItems={categories.length} pageSize={inventoryPageSize} onPageChange={setCategoryPage} />
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
                <label className="form-label">Expense Amount (LKR)</label>
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

      {showBatchEditModal && (
        <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) setShowBatchEditModal(false); }}>
          <div className="glass-panel modal-container">
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Stock Batch</h2>
            <form onSubmit={handleEditBatchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Product</label>
                <select className="form-select" value={editBatchProductId} onChange={(event) => setEditBatchProductId(event.target.value)} required>
                  {products.filter(product => product.active || String(product.id) === editBatchProductId).map(product => (
                    <option key={product.id} value={product.id}>{product.name} ({product.itemCode})</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Initial Quantity</label>
                  <input type="number" min="0" className="form-input" value={editBatchQuantity} onChange={(event) => setEditBatchQuantity(event.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Remaining Quantity</label>
                  <input type="number" min="0" className="form-input" value={editBatchRemaining} onChange={(event) => setEditBatchRemaining(event.target.value)} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Base Cost / Unit (LKR)</label>
                  <input type="number" min="0" step="0.01" className="form-input" value={editBatchBaseCost} onChange={(event) => setEditBatchBaseCost(event.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Standard Retail (LKR)</label>
                  <input type="number" min="0" step="0.01" className="form-input" value={editBatchStandardPrice} onChange={(event) => setEditBatchStandardPrice(event.target.value)} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>{loading ? 'Updating batch...' : 'Update Batch'}</button>
                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowBatchEditModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
