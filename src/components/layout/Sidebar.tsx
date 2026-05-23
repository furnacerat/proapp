import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Clock,
  Receipt,
  CreditCard,
  CheckSquare,
  FileText,
  Calendar,
  BarChart3,
  Calculator,
  LogOut,
  Package,
  Copy,
  DollarSign,
  FilePlus,
  Settings,
  User,
  Truck,
  ShoppingCart,
  SunMedium,
  Megaphone,
  HardHat,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dataService } from '../../services/dataService';
import { canAccessRoute, roleLabels } from '../../auth/rbac';
import { APP_LOGO_SRC, APP_NAME } from '../../config/appIdentity';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user, signOut, role } = useAuth();
  const shellName = APP_NAME;
  const canSee = (to: string) => canAccessRoute(role, to);
  const navLink = (to: string, icon: React.ReactNode, label: string, end = false) => canSee(to) ? (
    <NavLink to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose} end={end}>
      {icon}
      <span>{label}</span>
    </NavLink>
  ) : null;

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <img src={APP_LOGO_SRC} alt="" className="app-logo" />
          <span style={{ fontSize: '1rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {shellName}
          </span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Estimating</div>
          {navLink('/estimates', <Calculator size={20} />, 'Dashboard', true)}
          {navLink('/customers', <User size={20} />, 'Customers')}
          {navLink('/estimates/list', <FileText size={20} />, 'All Estimates')}
          {navLink('/estimates/new', <FilePlus size={20} />, 'New Estimate')}
          {navLink('/estimates/templates', <Copy size={20} />, 'Templates')}
          {navLink('/estimates/assemblies', <Package size={20} />, 'Assemblies')}
          {navLink('/estimates/pricebook', <DollarSign size={20} />, 'Price Book')}
          {navLink('/estimates/orders', <ShoppingCart size={20} />, 'Orders')}
          {navLink('/estimates/suppliers', <Truck size={20} />, 'Suppliers')}
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Operations</div>
          {navLink('/', <SunMedium size={20} />, 'Today', true)}
          {navLink('/field', <HardHat size={20} />, 'Field Mode')}
          {navLink('/dashboard', <LayoutDashboard size={20} />, 'Dashboard')}
          {navLink('/jobs', <Briefcase size={20} />, 'Jobs')}
          {navLink('/workers', <Users size={20} />, 'Workers')}
          {navLink('/time-entries', <Clock size={20} />, 'Time Entries')}
          {navLink('/shopping-lists', <ShoppingCart size={20} />, 'Shopping Lists')}
          {navLink('/marketing', <Megaphone size={20} />, 'Marketing Studio')}
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Finance</div>
          {navLink('/expenses', <Receipt size={20} />, 'Expenses')}
          {navLink('/company-expenses', <CreditCard size={20} />, 'Company Expenses')}
          {navLink('/invoices', <FileText size={20} />, 'Invoices')}
          {navLink('/settings', <Settings size={20} />, 'Settings')}
        </div>
        {(canSee('/admin/team')) && (
          <div className="nav-section">
            <div className="nav-section-title">Admin</div>
            {navLink('/admin/team', <Users size={20} />, 'Team')}
          </div>
        )}
        <div className="nav-section">
          <div className="nav-section-title">Planning</div>
          {navLink('/tasks', <CheckSquare size={20} />, 'Tasks')}
          {navLink('/schedule', <Calendar size={20} />, 'Schedule')}
        </div>
        <div className="nav-section">
          {navLink('/reports', <BarChart3 size={20} />, 'Reports')}
        </div>
      </nav>
      <div className="sidebar-account">
        <div className="sidebar-account-meta">
          <span className="storage-pill">{dataService.mode === 'supabase' ? 'Supabase' : 'Local'}</span>
          <span className="storage-pill">{roleLabels[role]}</span>
          <strong>{user?.email || 'Local workspace'}</strong>
        </div>
        {dataService.mode === 'supabase' && user && (
          <button className="sidebar-logout" onClick={() => void signOut()} title="Log out">
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
}
