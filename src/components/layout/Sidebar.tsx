import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Clock,
  Receipt,
  CheckSquare,
  FileText,
  Calendar,
  BarChart3,
  Calculator,
  Package,
  Copy,
  DollarSign,
  FilePlus,
  Settings,
  User
} from 'lucide-react';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Briefcase size={24} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '1rem', lineHeight: 1.1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            Allen's Contractor's
          </span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Estimating</div>
          <NavLink to="/estimates" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose} end>
            <Calculator size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/estimates/list" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <FileText size={20} />
            <span>All Estimates</span>
          </NavLink>
          <NavLink to="/estimates/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <FilePlus size={20} />
            <span>New Estimate</span>
          </NavLink>
          <NavLink to="/estimates/templates" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Copy size={20} />
            <span>Templates</span>
          </NavLink>
          <NavLink to="/estimates/assemblies" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Package size={20} />
            <span>Assemblies</span>
          </NavLink>
          <NavLink to="/estimates/pricebook" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <DollarSign size={20} />
            <span>Price Book</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Operations</div>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose} end>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/jobs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Briefcase size={20} />
            <span>Jobs</span>
          </NavLink>
          <NavLink to="/workers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Users size={20} />
            <span>Workers</span>
          </NavLink>
          <NavLink to="/time-entries" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Clock size={20} />
            <span>Time Entries</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Finance</div>
          <NavLink to="/expenses" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Receipt size={20} />
            <span>Expenses</span>
          </NavLink>
          <NavLink to="/invoices" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <FileText size={20} />
            <span>Invoices</span>
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>
          <NavLink to="/customers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <User size={20} />
            <span>Customers</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Planning</div>
          <NavLink to="/tasks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <CheckSquare size={20} />
            <span>Tasks</span>
          </NavLink>
          <NavLink to="/schedule" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <Calendar size={20} />
            <span>Schedule</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} onClick={onClose}>
            <BarChart3 size={20} />
            <span>Reports</span>
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}
