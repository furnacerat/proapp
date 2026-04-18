import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit, Trash2, Package, Calculator } from 'lucide-react';
import type { Assembly, AssemblyItem } from '../../data/types';

export function AssembliesLibrary() {
  const { assemblies, laborRates, materials, addAssembly, updateAssembly, deleteAssembly } = useApp();
  const { showToast } = useToast();
  
  const [showModal, setShowModal] = useState(false);
  const [editingAssembly, setEditingAssembly] = useState<Assembly | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    laborHours: '0',
    laborRateId: '',
  });
  
  const [items, setItems] = useState<AssemblyItem[]>([]);

  const handleSave = () => {
    if (!formData.name) {
      showToast('Name is required', 'error');
      return;
    }

    if (editingAssembly) {
      updateAssembly(editingAssembly.id, {
        ...formData,
        laborHours: parseFloat(formData.laborHours) || 0,
        items,
      });
      showToast('Assembly updated');
    } else {
      addAssembly({
        ...formData,
        laborHours: parseFloat(formData.laborHours) || 0,
        items,
      });
      showToast('Assembly created');
    }
    
    setShowModal(false);
    setEditingAssembly(null);
    setFormData({ name: '', description: '', category: '', laborHours: '0', laborRateId: '' });
    setItems([]);
  };

  const handleEdit = (assembly: Assembly) => {
    setEditingAssembly(assembly);
    setFormData({
      name: assembly.name,
      description: assembly.description || '',
      category: assembly.category,
      laborHours: assembly.laborHours.toString(),
      laborRateId: assembly.laborRateId || '',
    });
    setItems(assembly.items || []);
    setShowModal(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteAssembly(deleteId);
      showToast('Assembly deleted');
      setDeleteId(null);
    }
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, unitPrice: 0, category: 'material' }]);
  };

  const updateItem = (index: number, updates: Partial<AssemblyItem>) => {
    setItems(items.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = (assemblyItems: AssemblyItem[]) => {
    return assemblyItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const starterAssemblies = [
    { 
      name: 'Demolition Package', 
      category: 'Demo', 
      laborHours: 4,
      items: [
        { name: 'Demo - Walls', quantity: 1, unitPrice: 200, category: 'labor' as const },
        { name: 'Demo - Flooring', quantity: 1, unitPrice: 150, category: 'labor' as const },
        { name: 'Debris Removal', quantity: 1, unitPrice: 100, category: 'other' as const },
      ]
    },
    { 
      name: 'Drywall - Room', 
      category: 'Drywall', 
      laborHours: 6,
      items: [
        { name: 'Drywall 4x8', quantity: 12, unitPrice: 12, category: 'material' as const },
        { name: 'Joint Compound', quantity: 2, unitPrice: 18, category: 'material' as const },
        { name: 'Paper Tape', quantity: 2, unitPrice: 2.5, category: 'material' as const },
        { name: 'Install & Tape', quantity: 6, unitPrice: 35, category: 'labor' as const },
      ]
    },
    { 
      name: 'Paint Room', 
      category: 'Painting', 
      laborHours: 8,
      items: [
        { name: 'Paint', quantity: 4, unitPrice: 45, category: 'material' as const },
        { name: 'Primer', quantity: 2, unitPrice: 25, category: 'material' as const },
        { name: 'Supplies', quantity: 1, unitPrice: 25, category: 'material' as const },
        { name: 'Paint - Walls', quantity: 6, unitPrice: 35, category: 'labor' as const },
        { name: 'Paint - Ceiling', quantity: 2, unitPrice: 40, category: 'labor' as const },
      ]
    },
    { 
      name: 'Vanity Install', 
      category: 'Plumbing', 
      laborHours: 4,
      items: [
        { name: 'Vanity Unit', quantity: 1, unitPrice: 450, category: 'material' as const },
        { name: 'Faucet', quantity: 1, unitPrice: 150, category: 'material' as const },
        { name: 'Supply Lines', quantity: 1, unitPrice: 35, category: 'material' as const },
        { name: 'Install', quantity: 3, unitPrice: 45, category: 'labor' as const },
      ]
    },
    { 
      name: 'Cabinet Install - Base', 
      category: 'Carpentry', 
      laborHours: 2,
      items: [
        { name: 'Base Cabinet 24"', quantity: 1, unitPrice: 250, category: 'material' as const },
        { name: 'Screws/Hardware', quantity: 1, unitPrice: 15, category: 'material' as const },
        { name: 'Install Labor', quantity: 2, unitPrice: 45, category: 'labor' as const },
      ]
    },
    { 
      name: 'Flooring Install - Hardwood', 
      category: 'Flooring', 
      laborHours: 6,
      items: [
        { name: 'Hardwood Flooring', quantity: 200, unitPrice: 8, category: 'material' as const },
        { name: 'Underlayment', quantity: 200, unitPrice: 0.75, category: 'material' as const },
        { name: 'Nails/Staples', quantity: 1, unitPrice: 25, category: 'material' as const },
        { name: 'Install Labor', quantity: 6, unitPrice: 4, category: 'labor' as const },
      ]
    },
    { 
      name: 'Trim Package', 
      category: 'Carpentry', 
      laborHours: 4,
      items: [
        { name: 'Base Shoe', quantity: 100, unitPrice: 1.5, category: 'material' as const },
        { name: 'Casing', quantity: 60, unitPrice: 2.5, category: 'material' as const },
        { name: 'Casing Head', quantity: 4, unitPrice: 8, category: 'material' as const },
        { name: 'Install Labor', quantity: 4, unitPrice: 45, category: 'labor' as const },
      ]
    },
    { 
      name: 'Roofing Tear-Off & Replace', 
      category: 'Roofing', 
      laborHours: 16,
      items: [
        { name: 'Tear-Off Labor', quantity: 8, unitPrice: 45, category: 'labor' as const },
        { name: 'Underlayment', quantity: 4, unitPrice: 45, category: 'material' as const },
        { name: 'Shingles', quantity: 4, unitPrice: 35, category: 'material' as const },
        { name: 'Drip Edge', quantity: 4, unitPrice: 18, category: 'material' as const },
        { name: 'Nails', quantity: 1, unitPrice: 25, category: 'material' as const },
        { name: 'Install Labor', quantity: 8, unitPrice: 45, category: 'labor' as const },
      ]
    },
  ];

  const handleAddStarter = () => {
    starterAssemblies.forEach(a => {
      addAssembly(a);
    });
    showToast('Added 8 starter assemblies');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Assemblies Library</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> New Assembly
        </button>
      </div>

      <div className="page-content">
        {assemblies.length === 0 && (
          <div className="card mb-6">
            <div className="card-body text-center">
              <p className="text-muted mb-4">No assemblies yet. Add starter assemblies to get going quickly.</p>
              <button className="btn btn-primary" onClick={handleAddStarter}>
                Add Starter Assemblies
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            {assemblies.length === 0 ? (
              <div className="text-center py-8 text-muted">
                No assemblies. Create reusable cost assemblies for your estimates.
              </div>
            ) : (
              <div className="space-y-3">
                {assemblies.map(assembly => (
                  <div key={assembly.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{assembly.name}</span>
                        <span className="badge badge-gray">{assembly.category}</span>
                      </div>
                      {assembly.description && (
                        <div className="text-sm text-muted mt-1">{assembly.description}</div>
                      )}
                      <div className="text-xs text-muted mt-1">
                        {assembly.laborHours}h labor • {assembly.items?.length || 0} items • {formatCurrency(calculateTotal(assembly.items || []))}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-sm btn-icon" onClick={() => handleEdit(assembly)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-sm btn-icon btn-danger" onClick={() => setDeleteId(assembly.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingAssembly(null); setItems([]); }} title={editingAssembly ? 'Edit Assembly' : 'New Assembly'} size="lg">
        <div className="space-y-4">
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Assembly Name *</label>
              <input
                className="form-input"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., Drywall - Room"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                className="form-input"
                value={formData.category}
                onChange={e => setFormData({...formData, category: e.target.value})}
                placeholder="e.g., Drywall, Framing"
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Labor Hours</label>
            <input
              className="form-input"
              type="number"
              value={formData.laborHours}
              onChange={e => setFormData({...formData, laborHours: e.target.value})}
            />
          </div>
          
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="form-label mb-0">Line Items</label>
              <button className="btn btn-sm btn-secondary" onClick={addItem}>
                <Plus size={14} /> Add Item
              </button>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid-4 gap-2 items-center">
                  <input
                    className="form-input"
                    value={item.name}
                    onChange={e => updateItem(index, { name: e.target.value })}
                    placeholder="Item name"
                  />
                  <input
                    className="form-input"
                    type="number"
                    value={item.quantity}
                    onChange={e => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                    placeholder="Qty"
                  />
                  <input
                    className="form-input"
                    type="number"
                    value={item.unitPrice}
                    onChange={e => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                    placeholder="Price"
                  />
                  <button className="btn btn-sm btn-icon btn-danger" onClick={() => removeItem(index)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="text-right mt-2 text-sm text-muted">
              Total: {formatCurrency(calculateTotal(items))}
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingAssembly(null); setItems([]); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editingAssembly ? 'Update' : 'Create'} Assembly
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Assembly?"
        message="This will remove the assembly from your library."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}