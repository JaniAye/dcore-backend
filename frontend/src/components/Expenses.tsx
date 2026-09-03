import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { MiscExpenseDto } from '../types';
import { Plus, Trash2, Receipt } from 'lucide-react';

export const Expenses: React.FC = () => {
  const [expenses, setExpenses] = useState<MiscExpenseDto[]>([]);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const expenseCategories = ['Facebook Bill', 'Packaging', 'Rentals'];
  const [filterDate, setFilterDate] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const filteredExpenses = expenses.filter(expense => {
    const matchesDate = !filterDate || expense.expenseDate === filterDate;
    const matchesDescription = !filterDescription
      || expense.category === filterDescription
      || expense.description.toLowerCase().includes(filterDescription.toLowerCase());
    return matchesDate && matchesDescription;
  });

  const loadExpenses = async () => {
    try {
      const expList = await api.miscExpenses.getAll();
      setExpenses(expList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await api.miscExpenses.create({
        description,
        amount: parseFloat(amount),
        expenseDate: new Date().toISOString().split('T')[0],
        category: expenseCategories.includes(description) ? description : 'Other'
      });
      setSuccess('Expense logged successfully!');
      setDescription('');
      setAmount('');
      loadExpenses();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to log expense');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Are you sure you want to delete this expense log?')) return;
    setLoading(true);
    setError('');
    try {
      await api.miscExpenses.delete(id);
      setSuccess('Expense deleted.');
      loadExpenses();
    } catch (err: any) {
      setError('Failed to delete expense.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-col gap-4">
      <div className="page-header">
        <h1>Operating Expenses</h1>
        <p className="page-subtitle">Record operational costs and general overheads outside stock purchase costs</p>
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

      <div className="layout-split">
        {/* Create Form */}
        <div className="glass-panel" style={{ height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Receipt size={18} />
            <span>Log Expense</span>
          </h3>
          <form onSubmit={handleAddExpense} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="form-group">
              <label className="form-label">Expense Description</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Office Rent / Electric Bill" 
                list="expense-description-options"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              <datalist id="expense-description-options">
                {expenseCategories.map(expenseCategory => (
                  <option key={expenseCategory} value={expenseCategory} />
                ))}
              </datalist>
            </div>
            <div className="form-group">
              <label className="form-label">Expense Value ($)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="0.00" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-full mt-2" disabled={loading}>
              {loading ? 'Logging expense...' : 'Log Expense'}
            </button>
          </form>
        </div>

        {/* Expenses List */}
        <div className="glass-panel">
          <h3 style={{ marginBottom: '1rem' }}>Operating Expenses Ledger</h3>
          <div className="form-row" style={{ marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Filter by Log Date</label>
              <input
                type="date"
                className="form-input"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Filter by Description</label>
              <select
                className="form-select"
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
              >
                <option value="">All descriptions</option>
                {expenseCategories.map(expenseCategory => (
                  <option key={expenseCategory} value={expenseCategory}>{expenseCategory}</option>
                ))}
                <option value="Other">Other</option>
              </select>
            </div>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Log Date</th>
                  <th>Description</th>
                  <th>Amount</th>
                  <th style={{ width: '80px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map(expense => (
                  <tr key={expense.id}>
                    <td>
                      {expense.expenseDate
                        ? new Date(`${expense.expenseDate}T00:00:00`).toLocaleDateString()
                        : 'N/A'}
                    </td>
                    <td>
                      <strong>{expense.description}</strong>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{expense.category}</p>
                    </td>
                    <td className="text-danger" style={{ fontWeight: 700 }}>-${expense.amount.toFixed(2)}</td>
                    <td>
                      {expense.id && (
                        <button 
                          onClick={() => handleDeleteExpense(expense.id!)} 
                          className="logout-btn" 
                          title="Delete Expense"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      {expenses.length === 0
                        ? 'No operating expenses recorded. Log one on the left.'
                        : 'No expenses match the selected filters.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
