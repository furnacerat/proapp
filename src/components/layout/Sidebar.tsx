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
} from 'lucide-react';

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Briefcase size={24} />
          <span>BuildOps</span>
        </div>
      </div>
      <nav className="sidebar-nav">
        <div className="nav-section">
          <div className="nav-section-title">Estimating</div>
          <NavLink to="/estimates" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            <Calculator size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/estimates/list" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FileText size={20} />
            <span>All Estimates</span>
          </NavLink>
          <NavLink to="/estimates/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FilePlus size={20} />
            <span>New Estimate</span>
          </NavLink>
          <NavLink to="/estimates/templates" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Copy size={20} />
            <span>Templates</span>
          </NavLink>
          <NavLink to="/estimates/assemblies" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Package size={20} />
            <span>Assemblies</span>
          </NavLink>
          <NavLink to="/estimates/pricebook" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <DollarSign size={20} />
            <span>Price Book</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Operations</div>
          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/jobs" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Briefcase size={20} />
            <span>Jobs</span>
          </NavLink>
          <NavLink to="/workers" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Users size={20} />
            <span>Workers</span>
          </NavLink>
          <NavLink to="/time-entries" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Clock size={20} />
            <span>Time Entries</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Finance</div>
          <NavLink to="/expenses" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Receipt size={20} />
            <span>Expenses</span>
          </NavLink>
          <NavLink to="/invoices" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <FileText size={20} />
            <span>Invoices</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <div className="nav-section-title">Planning</div>
          <NavLink to="/tasks" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <CheckSquare size={20} />
            <span>Tasks</span>
          </NavLink>
          <NavLink to="/schedule" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Calendar size={20} />
            <span>Schedule</span>
          </NavLink>
        </div>
        <div className="nav-section">
          <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <BarChart3 size={20} />
            <span>Reports</span>
          </NavLink>
        </div>
      </nav>
    </aside>
  );
}