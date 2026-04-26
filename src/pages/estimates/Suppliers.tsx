import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import {
  Building2,
  CheckCircle,
  Edit,
  Mail,
  MapPin,
  Package,
  Phone,
  Plus,
  Search,
  Star,
  Trash2,
  Truck,
} from 'lucide-react';
import type { Supplier } from '../../data/types';

const supplierCategories = ['General', 'Hardware', 'Lumber', 'Electrical', 'Plumbing', 'Flooring', 'Paint', 'Equipment', 'Fixtures'];

interface SupplierForm {
  name: string;
  category: string;
  location: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isPreferred: boolean;
  isDefault: boolean;
  isActive: boolean;
}

const emptyForm: SupplierForm = {
  name: '',
  category: 'General',
  location: '',
  contactName: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
  isPreferred: false,
  isDefault: false,
  isActive: true,
};

const supplierLocation = (supplier: Supplier) => supplier.location || supplier.address || 'Location not set';
const supplierCategory = (supplier: Supplier) => supplier.category || supplier.categories?.[0] || 'General';

export function Suppliers() {
  const { suppliers, materialOrders, shoppingLists, addSupplier, updateSupplier, deleteSupplier } = useApp();
  const { showToast } = useToast();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(suppliers[0]?.id || null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  const filteredSuppliers = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suppliers
      .filter(supplier => supplier.isActive !== false)
      .filter(supplier => !term ||
        supplier.name.toLowerCase().includes(term) ||
        supplierCategory(supplier).toLowerCase().includes(term) ||
        supplierLocation(supplier).toLowerCase().includes(term) ||
        supplier.phone?.toLowerCase().includes(term) ||
        supplier.notes?.toLowerCase().includes(term)
      )
      .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || Number(Boolean(b.isPreferred)) - Number(Boolean(a.isPreferred)) || a.name.localeCompare(b.name));
  }, [suppliers, search]);

  const selectedSupplier = suppliers.find(supplier => supplier.id === selectedId) || filteredSuppliers[0] || suppliers[0] || null;
  const linkedOrders = selectedSupplier ? materialOrders.filter(order => order.supplierId === selectedSupplier.id || order.supplierName === selectedSupplier.name) : [];
  const linkedShoppingItems = selectedSupplier
    ? shoppingLists.flatMap(list => list.items
      .filter(item => item.supplierId === selectedSupplier.id || item.supplierName === selectedSupplier.name)
      .map(item => ({ list, item })))
    : [];

  const resetForm = () => setForm(emptyForm);

  const openAdd = () => {
    resetForm();
    setEditingId(null);
    setShowModal(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditingId(supplier.id);
    setForm({
      name: supplier.name,
      category: supplierCategory(supplier),
      location: supplier.location || '',
      contactName: supplier.contactName || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      notes: supplier.notes || '',
      isPreferred: Boolean(supplier.isPreferred),
      isDefault: Boolean(supplier.isDefault),
      isActive: supplier.isActive !== false,
    });
    setShowModal(true);
  };

  const supplierPayload = () => ({
    name: form.name.trim(),
    category: form.category,
    categories: [form.category],
    location: form.location.trim() || undefined,
    contactName: form.contactName.trim() || undefined,
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    address: form.address.trim() || undefined,
    notes: form.notes.trim() || undefined,
    isPreferred: form.isPreferred,
    isDefault: form.isDefault,
    isActive: form.isActive,
  });

  const handleSave = () => {
    if (!form.name.trim()) {
      showToast('Supplier name is required', 'error');
      return;
    }

    if (editingId) {
      updateSupplier(editingId, supplierPayload());
      setSelectedId(editingId);
      showToast('Supplier updated');
    } else {
      const id = addSupplier(supplierPayload());
      setSelectedId(id);
      showToast('Supplier added');
    }
    setShowModal(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    deleteSupplier(id);
    setDeleteConfirm(null);
    if (selectedId === id) setSelectedId(suppliers.find(supplier => supplier.id !== id)?.id || null);
    showToast('Supplier deleted');
  };

  const setDefaultSupplier = (supplier: Supplier) => {
    updateSupplier(supplier.id, { isDefault: true, isPreferred: true });
    setSelectedId(supplier.id);
    showToast(`${supplier.name} set as default supplier`);
  };

  return (
    <div className="suppliers-page">
      <div className="suppliers-shell">
        <header className="suppliers-header">
          <div>
            <h1>Suppliers</h1>
            <p>Manage vendors for materials, equipment, and job purchases</p>
          </div>
          <div className="suppliers-header-actions">
            <label className="suppliers-search">
              <Search size={18} />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search suppliers..." />
            </label>
            <button className="suppliers-primary" onClick={openAdd}><Plus size={18} /> Add Supplier</button>
          </div>
        </header>

        {suppliers.length === 0 ? (
          <section className="suppliers-empty">
            <div className="suppliers-empty-icon"><Truck size={36} /></div>
            <h2>Add your first supplier</h2>
            <p>Save vendors you frequently purchase from for faster ordering.</p>
            <button className="suppliers-primary" onClick={openAdd}><Plus size={18} /> Add Supplier</button>
          </section>
        ) : (
          <main className="suppliers-workspace">
            <section className="suppliers-list">
              {filteredSuppliers.map(supplier => {
                const selected = selectedSupplier?.id === supplier.id;
                return (
                  <article
                    key={supplier.id}
                    className={`supplier-card ${selected ? 'selected' : ''}`}
                    onClick={() => setSelectedId(supplier.id)}
                  >
                    <div className="supplier-card-top">
                      <div className="supplier-icon"><Building2 size={20} /></div>
                      <div>
                        <h2>{supplier.name}</h2>
                        <span>{supplierCategory(supplier)}</span>
                      </div>
                      <div className="supplier-badges">
                        {supplier.isDefault && <span className="supplier-badge default"><CheckCircle size={13} /> Default</span>}
                        {supplier.isPreferred && <span className="supplier-badge preferred"><Star size={13} /> Preferred</span>}
                      </div>
                    </div>
                    <div className="supplier-card-grid">
                      <span><MapPin size={14} /> {supplierLocation(supplier)}</span>
                      <span><Phone size={14} /> {supplier.phone || 'No phone'}</span>
                    </div>
                    {supplier.notes && <p>{supplier.notes}</p>}
                    <div className="supplier-card-actions" onClick={event => event.stopPropagation()}>
                      <button onClick={() => openEdit(supplier)}><Edit size={15} /> Edit</button>
                      <button onClick={() => setDefaultSupplier(supplier)}><CheckCircle size={15} /> Set Default</button>
                      <button className="danger" onClick={() => setDeleteConfirm(supplier.id)}><Trash2 size={15} /> Delete</button>
                    </div>
                  </article>
                );
              })}
              {filteredSuppliers.length === 0 && (
                <div className="suppliers-no-results">
                  <Search size={28} />
                  <h2>No suppliers match your search</h2>
                  <p>Try a vendor name, category, location, or note.</p>
                </div>
              )}
            </section>

            <aside className="supplier-detail">
              {selectedSupplier ? (
                <>
                  <div className="supplier-detail-hero">
                    <div className="supplier-detail-icon"><Truck size={26} /></div>
                    <div>
                      <h2>{selectedSupplier.name}</h2>
                      <p>{supplierCategory(selectedSupplier)} supplier</p>
                    </div>
                  </div>

                  <div className="supplier-detail-actions">
                    <button className="suppliers-secondary" onClick={() => openEdit(selectedSupplier)}><Edit size={16} /> Edit</button>
                    <button className="suppliers-secondary" onClick={() => setDefaultSupplier(selectedSupplier)}><CheckCircle size={16} /> Set as default supplier</button>
                  </div>

                  <section className="supplier-detail-section">
                    <h3>Contact Info</h3>
                    <div className="supplier-contact-list">
                      <span><Package size={15} /> {supplierCategory(selectedSupplier)}</span>
                      <span><MapPin size={15} /> {supplierLocation(selectedSupplier)}</span>
                      <span><Phone size={15} /> {selectedSupplier.phone || 'No phone saved'}</span>
                      <span><Mail size={15} /> {selectedSupplier.email || 'No email saved'}</span>
                    </div>
                  </section>

                  <section className="supplier-detail-section">
                    <h3>Categories They Supply</h3>
                    <div className="supplier-chip-row">
                      {(selectedSupplier.categories?.length ? selectedSupplier.categories : [supplierCategory(selectedSupplier)]).map(category => <span key={category}>{category}</span>)}
                    </div>
                  </section>

                  <section className="supplier-detail-section">
                    <h3>Notes</h3>
                    <p>{selectedSupplier.notes || 'No notes yet.'}</p>
                  </section>

                  <section className="supplier-detail-section">
                    <h3>Linked Orders</h3>
                    <p>{linkedOrders.length ? `${linkedOrders.length} order${linkedOrders.length === 1 ? '' : 's'} linked.` : 'Future order history will appear here.'}</p>
                  </section>

                  <section className="supplier-detail-section">
                    <h3>Linked Shopping List Items</h3>
                    <p>{linkedShoppingItems.length ? `${linkedShoppingItems.length} shopping item${linkedShoppingItems.length === 1 ? '' : 's'} linked.` : 'Future shopping list item history will appear here.'}</p>
                  </section>
                </>
              ) : (
                <div className="suppliers-no-results">
                  <Truck size={30} />
                  <h2>Select a supplier</h2>
                  <p>Contact details and linked purchasing activity appear here.</p>
                </div>
              )}
            </aside>
          </main>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Supplier' : 'Add Supplier'} size="md">
        <div className="form-stack suppliers-modal-form">
          <div className="form-group">
            <label className="form-label">Supplier Name *</label>
            <input className="form-input" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} placeholder="ABC Building Supply" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={form.category} onChange={event => setForm({ ...form, category: event.target.value })}>
                {supplierCategories.map(category => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input className="form-input" value={form.location} onChange={event => setForm({ ...form, location: event.target.value })} placeholder="Springfield, IL" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={form.phone} onChange={event => setForm({ ...form, phone: event.target.value })} placeholder="(555) 555-5555" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} placeholder="orders@supplier.com" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={form.notes} onChange={event => setForm({ ...form, notes: event.target.value })} placeholder="What do they supply? When should the team use them?" />
          </div>
          <div className="supplier-form-toggles">
            <label><input type="checkbox" checked={form.isPreferred} onChange={event => setForm({ ...form, isPreferred: event.target.checked })} /> Preferred</label>
            <label><input type="checkbox" checked={form.isDefault} onChange={event => setForm({ ...form, isDefault: event.target.checked })} /> Default supplier</label>
          </div>
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: '16px' }}>
          <button className="suppliers-secondary" onClick={() => setShowModal(false)}>Cancel</button>
          <button className="suppliers-primary" onClick={handleSave}>{editingId ? 'Update' : 'Add Supplier'}</button>
        </div>
      </Modal>

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="suppliers-delete-box">
            <h3>Delete Supplier?</h3>
            <p>This removes the supplier from the directory. Existing orders and lists keep their saved vendor text.</p>
            <div>
              <button className="suppliers-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="suppliers-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
