import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { POS } from './components/POS';
import { Inventory } from './components/Inventory';
import { InventoryStockFilter } from './components/Inventory';
import { DeliveryOrders } from './components/DeliveryOrders';
import { Expenses } from './components/Expenses';
import { Invoices } from './components/Invoices';
import { Customers } from './components/Customers';
import { Role } from './types';

interface UserSession {
  username: string;
  name: string;
  role: Role;
}

export const App: React.FC = () => {
  const [user, setUser] = useState<UserSession | null>(null);
  const [currentTab, setCurrentTab] = useState<string>('pos');
  const [token, setToken] = useState<string | null>(null);
  const [inventoryStockFilter, setInventoryStockFilter] = useState<InventoryStockFilter>('ALL');
  const [expenseMonthFilter, setExpenseMonthFilter] = useState('');

  const syncAuthState = () => {
    const t = localStorage.getItem('dcore_token');
    const u = localStorage.getItem('dcore_user');
    
    if (t && u) {
      const parsedUser = JSON.parse(u) as UserSession;
      setUser(parsedUser);
      setToken(t);
      // Admin defaults to Dashboard, Sales defaults to POS checkout
      setCurrentTab(parsedUser.role === 'SUPER_ADMIN' ? 'dashboard' : 'pos');
    } else {
      setUser(null);
      setToken(null);
      setCurrentTab('pos');
    }
  };

  useEffect(() => {
    syncAuthState();
    window.addEventListener('auth_change', syncAuthState);
    return () => {
      window.removeEventListener('auth_change', syncAuthState);
    };
  }, []);

  if (!token || !user) {
    return <Login />;
  }

  return (
    <div className="app-container">
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} user={user} />
      <main className="main-content">
        {currentTab === 'dashboard' && user.role === 'SUPER_ADMIN' && (
          <Dashboard
            onOpenDeliveryOrders={() => setCurrentTab('delivery')}
            onOpenInventory={(filter) => {
              setInventoryStockFilter(filter);
              setCurrentTab('inventory');
            }}
            onOpenExpenses={(month) => {
              setExpenseMonthFilter(month);
              setCurrentTab('expenses');
            }}
          />
        )}
        {currentTab === 'pos' && <POS />}
        {currentTab === 'inventory' && <Inventory stockFilter={inventoryStockFilter} />}
        {currentTab === 'delivery' && <DeliveryOrders />}
        {currentTab === 'invoices' && <Invoices />}
        {currentTab === 'customers' && <Customers />}
        {currentTab === 'expenses' && <Expenses monthFilter={expenseMonthFilter} />}
      </main>
    </div>
  );
};
