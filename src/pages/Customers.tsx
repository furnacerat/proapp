import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { Plus, Search, Trash2, Mail, Phone, MapPin, Edit } from 'lucide-react';

export function Customers() {
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useApp();
  const { showToast } = useToast();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '', address: '', notes: ''
  });

  const filteredCustomers = customers.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return c.name.toLowerCase().includes(s) || 
           c.company?.toLowerCase().includes(s) || 
           c.email?.toLowerCase().includes(s);
  });

  const handleSave = () => {
    if (!form.name) { showToast('Enter customer name', 'error'); return; }
    
    if (editingCustomer) {
      updateCustomer(editingCustomer.id, form);
      showToast('Customer updated');
    } else {
      addCustomer(form);
      showToast('Customer created');
    }
    
    setForm({ name: '', company: '', email: '', phone: '', address: '', notes: '' });
    setShowModal(false);
    setEditingCustomer(null);
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      company: customer.company || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteCustomer(deleteId);
      showToast('Customer deleted');
      setDeleteId(null);
    }
  };

  const handleNewCustomer = () => {
    setEditingCustomer(null);
    setForm({ name: '', company: '', email: '', phone: '', address: '', notes: '' });
    setShowModal(true);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <h1 className="page-title">Customers</h1>
        <button className="btn btn-primary" onClick={handleNewCustomer}>
          <Plus size={18} /> Add Customer
        </button>
      </div>

      <div className="filters mb-4">
        <div className="search-bar">
          <Search />
          <input 
            className="form-input" 
            placeholder="Search customers..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            style={{paddingLeft: '40px'}} 
          />
        </div>
      </div>

      <div className="card">
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Company</th>
                <th>Contact</th>
                <th>Address</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-muted py-8">
                    {customers.length === 0 ? 'No customers yet' : 'No matching customers'}
                  </td>
                </tr>
              ) : filteredCustomers.map(customer => (
                <tr key={customer.id}>
                  <td className="font-medium">{customer.name}</td>
                  <td>{customer.company || '—'}</td>
                  <td>
                    <div className="flex flex-col gap-1">
                      {customer.email && (
                        <div className="flex items-center gap-1 text-sm">
                          <Mail size={12} />
                          <span>{customer.email}</span>
                        </div>
                      )}
                      {customer.phone && (
                        <div className="flex items-center gap-1 text-sm">
                          <Phone size={12} />
                          <span>{customer.phone}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td>{customer.address || '—'}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-sm btn-secondary btn-icon" onClick={() => handleEdit(customer)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteId(customer.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingCustomer ? 'Edit Customer' : 'New Customer'}>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="John Smith" />
          </div>
          <div className="form-group">
            <label className="form-label">Company</label>
            <input className="form-input" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="ABC Corp" />
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="john@email.com" />
          </div>
          <div className="form-group">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="(555) 123-4567" />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Address</label>
          <input className="form-input" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="123 Main St, City, State" />
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Additional notes..." />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editingCustomer ? 'Update' : 'Create'}</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Customer"
        message="Are you sure you want to delete this customer? This cannot be undone."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}

export default Customers;