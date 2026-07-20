import React from 'react';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  Truck, 
  Receipt, 
  FileText,
  LogOut 
} from 'lucide-react';
import { Role } from '../types';

interface NavbarProps {
  currentTab: string;
  setCurrentTab: (tab: string) => void;
  user: { username: string; name: string; role: Role } | null;
}

export const Navbar: React.FC<NavbarProps> = ({ currentTab, setCurrentTab, user }) => {
  const handleLogout = () => {
    localStorage.removeItem('dcore_token');
    localStorage.removeItem('dcore_user');
    window.dispatchEvent(new Event('auth_change'));
  };

  const isAdmin = user?.role === 'SUPER_ADMIN';

  return (
    <aside className="sidebar">
      <div className="brand-section">
        <div className="brand-logo">⚡</div>
        <span className="brand-name">DCORE</span>
      </div>

      <nav className="nav-links">
        {isAdmin && (
          <button
            onClick={() => setCurrentTab('dashboard')}
            className={`nav-link ${currentTab === 'dashboard' ? 'active' : ''}`}
          >
            <LayoutDashboard className="nav-icon" />
            <span>Dashboard</span>
          </button>
        )}
        
        <button
          onClick={() => setCurrentTab('pos')}
          className={`nav-link ${currentTab === 'pos' ? 'active' : ''}`}
        >
          <ShoppingCart className="nav-icon" />
          <span>POS Checkout</span>
        </button>

        <button
          onClick={() => setCurrentTab('inventory')}
          className={`nav-link ${currentTab === 'inventory' ? 'active' : ''}`}
        >
          <Package className="nav-icon" />
          <span>Inventory</span>
        </button>

        <button
          onClick={() => setCurrentTab('delivery')}
          className={`nav-link ${currentTab === 'delivery' ? 'active' : ''}`}
        >
          <Truck className="nav-icon" />
          <span>Delivery Orders</span>
        </button>

        <button
          onClick={() => setCurrentTab('invoices')}
          className={`nav-link ${currentTab === 'invoices' ? 'active' : ''}`}
        >
          <FileText className="nav-icon" />
          <span>Invoices</span>
        </button>

        <button
          onClick={() => setCurrentTab('expenses')}
          className={`nav-link ${currentTab === 'expenses' ? 'active' : ''}`}
        >
          <Receipt className="nav-icon" />
          <span>Misc Expenses</span>
        </button>
      </nav>

      {user && (
        <div className="user-profile">
          <div className="profile-info">
            <span className="profile-name">{user.name}</span>
            <span className="profile-role">
              {user.role === 'SUPER_ADMIN' ? 'Administrator' : 'Sales Representative'}
            </span>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
      )}
    </aside>
  );
};
