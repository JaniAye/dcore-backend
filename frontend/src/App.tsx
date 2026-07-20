import React, { useEffect, useState } from 'react';
import { Navbar } from './components/Navbar';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { POS } from './components/POS';
import { Inventory } from './components/Inventory';
import { DeliveryOrders } from './components/DeliveryOrders';
import { Expenses } from './components/Expenses';
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
      {/* Sidebar navigation */}
      <Navbar currentTab={currentTab} setCurrentTab={setCurrentTab} user={user} />
      
      {/* Main app panel */}
      <main className="main-content">
        {currentTab === 'dashboard' && user.role === 'SUPER_ADMIN' && <Dashboard />}
        {currentTab === 'pos' && <POS />}
        {currentTab === 'inventory' && <Inventory />}
        {currentTab === 'delivery' && <DeliveryOrders />}
        {currentTab === 'expenses' && <Expenses />}
      </main>
    </div>
  );
};
