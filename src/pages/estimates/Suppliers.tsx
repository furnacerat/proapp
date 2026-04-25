import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatDate } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit, Trash2, Truck, Search, Phone, Mail, Globe } from 'lucide-react';
import type { Supplier } from '../../data/types';

interface SupplierForm {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  website: string;
  leadTimeDays: string;
  notes: string;
  isActive: boolean;
}

export function Suppliers() {
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>({
    name: '', contactName: '', phone: '', email: '', address: '',
    website: '', leadTimeDays: '', notes: '', isActive: true,
  });

  const resetForm = () => setForm({ name: '', contactName: '', phone: '', email: '', address: '', website: '', leadTimeDays: '', notes: '', isActive: true });

  const openAdd = () => { resetForm(); setEditingId(null); setShowModal(true); };
  const openEdit = (s: Supplier) => {
    setForm({ name: s.name, contactName: s.contactName || '', phone: s.phone || '', email: s.email || '', address: s.address || '', website: s.website || '', leadTimeDays: s.leadTimeDays?.toString() || '', notes: s.notes || '', isActive: s.isActive });
    setEditingId(s.id); setShowModal(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) { showToast('Supplier name is required', 'error'); return; }
    if (editingId) {
      updateSupplier(editingId, { name: form.name, contactName: form.contactName || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, website: form.website || undefined, leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : undefined, notes: form.notes || undefined, isActive: form.isActive });
      showToast('Supplier updated');
    } else {
      addSupplier({ name: form.name, contactName: form.contactName || undefined, phone: form.phone || undefined, email: form.email || undefined, address: form.address || undefined, website: form.website || undefined, leadTimeDays: form.leadTimeDays ? parseInt(form.leadTimeDays) : undefined, notes: form.notes || undefined, isActive: form.isActive });
      showToast('Supplier added');
    }
    setShowModal(false);
  };

  const handleDelete = (id: string) => {
    deleteSupplier(id);
    showToast('Supplier deleted');
    setDeleteConfirm(null);
  };

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.contactName?.toLowerCase().includes(search.toLowerCase()) ||
    s.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Suppliers</h1>
          <p className="text-muted text-sm">Manage material and equipment suppliers for ordering</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd}><Plus size={18} /> Add Supplier</button>
      </div>

      <div className="card mb-4">
        <div className="card-body">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input className="form-input pl-10" placeholder="Search suppliers..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="grid-3 gap-4">
        {filtered.length === 0 && <div className="card col-span-full"><p className="text-muted text-center py-8">No suppliers found</p></div>}
        {filtered.map(s => (
          <div key={s.id} className={`card ${!s.isActive ? 'opacity-60' : ''}`}>
            <div className="card-header">
              <div className="flex items-center gap-2">
                <Truck size={16} className="text-blue-600" />
                <span className="font-semibold">{s.name}</span>
                {!s.isActive && <span className="badge badge-gray ml-auto">Inactive</span>}
              </div>
              <div className="flex gap-1">
                <button className="btn btn-sm btn-secondary btn-icon" onClick={() => openEdit(s)} title="Edit"><Edit size={14} /></button>
                <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteConfirm(s.id)} title="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="card-body">
              {s.contactName && <div className="text-sm mb-1">{s.contactName}</div>}
              <div className="space-y-1 text-sm text-muted">
                {s.phone && <div className="flex items-center gap-2"><Phone size={12} />{s.phone}</div>}
                {s.email && <div className="flex items-center gap-2"><Mail size={12} />{s.email}</div>}
                {s.website && <div className="flex items-center gap-2"><Globe size={12} />{s.website}</div>}
                {s.leadTimeDays && <div className="mt-2"><span className="font-medium">{s.leadTimeDays}</span> day lead time</div>}
              </div>
              {s.notes && <div className="text-sm text-muted mt-2 border-t pt-2">{s.notes}</div>}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Supplier' : 'Add Supplier'} size="md">
        <div className="form-stack">
          <div className="form-group">
            <label className="form-label">Supplier Name *</label>
            <input className="form-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. ABC Building Supply" />
          </div>
          <div className="form-group">
            <label className="form-label">Contact Name</label>
            <input className="form-input" value={form.contactName} onChange={e => setForm({ ...form, contactName: e.target.value })} placeholder="e.g. John Smith" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="(555) 555-5555" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="orders@supplier.com" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Address</label>
            <input className="form-input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="123 Main St, City, State ZIP" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Website</label>
              <input className="form-input" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} placeholder="https://abcbldsupply.com" />
            </div>
            <div className="form-group">
              <label className="form-label">Lead Time (days)</label>
              <input className="form-input" type="number" value={form.leadTimeDays} onChange={e => setForm({ ...form, leadTimeDays: e.target.value })} placeholder="3" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label checkbox-label">
              <input type="checkbox" checked={form.isActive} onChange={e => setForm({ ...form, isActive: e.target.checked })} />
              Active
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
          <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>{editingId ? 'Update' : 'Add Supplier'}</button>
        </div>
      </Modal>

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="text-lg font-semibold mb-4">Delete Supplier?</h3>
            <p className="text-muted mb-6">This will permanently delete this supplier.</p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}