import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit, Trash2, Package, Calculator, Search } from 'lucide-react';
import type { Assembly, AssemblyItem } from '../../data/types';

export function AssembliesLibrary() {
  const { assemblies, laborRates, materials, addAssembly, updateAssembly, deleteAssembly } = useApp();
  const { showToast } = useToast();
  
  const [showModal, setShowModal] = useState(false);
  const [editingAssembly, setEditingAssembly] = useState<Assembly | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPricePicker, setShowPricePicker] = useState(false);
  const [pricePickerTab, setPricePickerTab] = useState<'materials' | 'labor'>('materials');
  const [priceSearch, setPriceSearch] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    unit: 'ea',
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
    setFormData({ name: '', description: '', category: '', unit: 'ea', laborHours: '0', laborRateId: '' });
    setItems([]);
  };

  const handleEdit = (assembly: Assembly) => {
    setEditingAssembly(assembly);
    setFormData({
      name: assembly.name,
      description: assembly.description || '',
      category: assembly.category,
      unit: assembly.unit || 'ea',
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
    setItems([...items, { name: '', description: '', quantity: 1, unit: 'ea', unitPrice: 0, category: 'material' }]);
  };

  const updateItem = (index: number, updates: Partial<AssemblyItem>) => {
    setItems(items.map((item, i) => i === index ? { ...item, ...updates } : item));
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const calculateTotal = (assemblyItems: AssemblyItem[]) => {
    let materialTotal = 0;
    let laborTotal = 0;
    let equipmentTotal = 0;
    let otherTotal = 0;
    
    assemblyItems.forEach(item => {
      const itemTotal = item.quantity * item.unitPrice;
      if (item.category === 'material' || item.category === 'allowance') {
        materialTotal += itemTotal;
      } else if (item.category === 'labor') {
        laborTotal += itemTotal;
      } else if (item.category === 'equipment') {
        equipmentTotal += itemTotal;
      } else {
        otherTotal += itemTotal;
      }
    });
    
    return { materialTotal, laborTotal, equipmentTotal, otherTotal, subtotal: materialTotal + laborTotal + equipmentTotal + otherTotal };
  };

  const starterAssemblies = [
    { 
      name: 'Demolition Package', 
      category: 'Demo', 
      unit: 'room',
      laborHours: 4,
      items: [
        { name: 'Demo - Walls', quantity: 1, unit: 'ea', unitPrice: 200, category: 'labor' as const },
        { name: 'Demo - Flooring', quantity: 1, unit: 'ea', unitPrice: 150, category: 'labor' as const },
        { name: 'Debris Removal', quantity: 1, unit: 'ea', unitPrice: 100, category: 'other' as const },
      ]
    },
    { 
      name: 'Drywall - Room', 
      category: 'Drywall', 
      unit: 'room',
      laborHours: 6,
      items: [
        { name: 'Drywall 4x8', quantity: 12, unit: 'sheet', unitPrice: 12, category: 'material' as const },
        { name: 'Joint Compound', quantity: 2, unit: 'bucket', unitPrice: 18, category: 'material' as const },
        { name: 'Paper Tape', quantity: 2, unit: 'roll', unitPrice: 2.5, category: 'material' as const },
        { name: 'Install & Tape', quantity: 6, unit: 'hrs', unitPrice: 35, category: 'labor' as const },
      ]
    },
    { 
      name: 'Paint Room', 
      category: 'Painting', 
      unit: 'room',
      laborHours: 8,
      items: [
        { name: 'Paint', quantity: 4, unit: 'gal', unitPrice: 45, category: 'material' as const },
        { name: 'Primer', quantity: 2, unit: 'gal', unitPrice: 25, category: 'material' as const },
        { name: 'Supplies', quantity: 1, unit: 'ea', unitPrice: 25, category: 'material' as const },
        { name: 'Paint - Walls', quantity: 6, unit: 'hrs', unitPrice: 35, category: 'labor' as const },
        { name: 'Paint - Ceiling', quantity: 2, unit: 'hrs', unitPrice: 40, category: 'labor' as const },
      ]
    },
    { 
      name: 'Vanity Install', 
      category: 'Plumbing', 
      unit: 'ea',
      laborHours: 4,
      items: [
        { name: 'Vanity Unit', quantity: 1, unit: 'ea', unitPrice: 450, category: 'material' as const },
        { name: 'Faucet', quantity: 1, unit: 'ea', unitPrice: 150, category: 'material' as const },
        { name: 'Supply Lines', quantity: 1, unit: 'ea', unitPrice: 35, category: 'material' as const },
        { name: 'Install', quantity: 3, unit: 'hrs', unitPrice: 45, category: 'labor' as const },
      ]
}, 
    { 
      name: 'Cabinet Install - Base', 
      category: 'Carpentry', 
      unit: 'ea',
      laborHours: 2,
      items: [
        { name: 'Base Cabinet 24"', quantity: 1, unit: 'ea', unitPrice: 250, category: 'material' as const },
        { name: 'Screws/Hardware', quantity: 1, unit: 'box', unitPrice: 15, category: 'material' as const },
        { name: 'Install Labor', quantity: 2, unit: 'hrs', unitPrice: 45, category: 'labor' as const },
      ]
    },
    { 
      name: 'Flooring Install - Hardwood', 
      category: 'Flooring', 
      unit: 'sqft',
      laborHours: 6,
      items: [
        { name: 'Hardwood Flooring', quantity: 200, unit: 'sqft', unitPrice: 8, category: 'material' as const },
        { name: 'Underlayment', quantity: 200, unit: 'sqft', unitPrice: 0.75, category: 'material' as const },
        { name: 'Nails/Staples', quantity: 1, unit: 'box', unitPrice: 25, category: 'material' as const },
        { name: 'Install Labor', quantity: 6, unit: 'hrs', unitPrice: 4, category: 'labor' as const },
      ]
    },
    { 
      name: 'Trim Package', 
      category: 'Carpentry', 
      unit: 'lnft',
      laborHours: 4,
      items: [
        { name: 'Base Shoe', quantity: 100, unit: 'lnft', unitPrice: 1.5, category: 'material' as const },
        { name: 'Casing', quantity: 60, unit: 'lnft', unitPrice: 2.5, category: 'material' as const },
        { name: 'Casing Head', quantity: 4, unit: 'lnft', unitPrice: 8, category: 'material' as const },
        { name: 'Install Labor', quantity: 4, unit: 'hrs', unitPrice: 45, category: 'labor' as const },
      ]
    },
    { 
      name: 'Roofing Tear-Off & Replace', 
      category: 'Roofing', 
      unit: 'sqft',
      laborHours: 16,
      items: [
        { name: 'Tear-Off Labor', quantity: 8, unit: 'hrs', unitPrice: 45, category: 'labor' as const },
        { name: 'Underlayment', quantity: 4, unit: 'roll', unitPrice: 45, category: 'material' as const },
        { name: 'Shingles', quantity: 4, unit: 'bundle', unitPrice: 35, category: 'material' as const },
        { name: 'Drip Edge', quantity: 4, unit: 'bundle', unitPrice: 18, category: 'material' as const },
        { name: 'Nails', quantity: 1, unit: 'box', unitPrice: 25, category: 'material' as const },
        { name: 'Install Labor', quantity: 8, unit: 'hrs', unitPrice: 45, category: 'labor' as const },
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
                        {assembly.laborHours}h labor • {assembly.items?.length || 0} items
                      </div>
                      <div className="text-xs text-muted">
                        Materials: {formatCurrency(calculateTotal(assembly.items || []).materialTotal)} • Labor: {formatCurrency(calculateTotal(assembly.items || []).laborTotal)} • Total: {formatCurrency(calculateTotal(assembly.items || []).subtotal)}
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
          <div className="grid-3 gap-4">
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
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input
                className="form-input"
                value={formData.unit}
                onChange={e => setFormData({...formData, unit: e.target.value})}
                placeholder="e.g., sqft, ea, lf"
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
              <div className="flex gap-2">
                <button className="btn btn-sm btn-secondary" onClick={() => setShowPricePicker(true)}>
                  <Search size={14} /> From Price List
                </button>
                <button className="btn btn-sm btn-secondary" onClick={addItem}>
                  <Plus size={14} /> Add Item
                </button>
              </div>
            </div>
            <div className="flex gap-2 mb-2 text-xs font-medium text-muted">
              <div className="flex-1">Item</div>
              <div className="w-12 text-center">Qty</div>
              <div className="w-12 text-center">Unit</div>
              <div className="w-20 text-right">Price</div>
              <div className="w-28 text-center">Category</div>
              <div className="w-8"></div>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <div className="flex-1 min-w-0">
                    <input
                      className="form-input"
                      value={item.name}
                      onChange={e => updateItem(index, { name: e.target.value })}
                      placeholder="Item name"
                    />
                  </div>
                  <div className="w-12">
                    <input
                      className="form-input text-center"
                      type="number"
                      value={item.quantity}
                      onChange={e => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                      placeholder="1"
                    />
                  </div>
                  <div className="w-12">
                    <input
                      className="form-input text-center"
                      value={item.unit}
                      onChange={e => updateItem(index, { unit: e.target.value })}
                      placeholder="ea"
                    />
                  </div>
                  <div className="w-20">
                    <input
                      className="form-input text-right"
                      type="number"
                      value={item.unitPrice}
                      onChange={e => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="w-28">
                    <select
                      className="form-select"
                      value={item.category}
                      onChange={e => updateItem(index, { category: e.target.value as 'material' | 'labor' | 'equipment' | 'other' })}
                    >
                      <option value="material">Mat</option>
                      <option value="labor">Lab</option>
                      <option value="equipment">Eqp</option>
                      <option value="other">Oth</option>
                    </select>
                  </div>
                  <div className="w-8">
                    <button className="btn btn-sm btn-icon btn-danger" onClick={() => removeItem(index)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t flex justify-between text-sm">
              <div className="space-y-1">
                <div className="text-muted">Materials: {formatCurrency(calculateTotal(items).materialTotal)}</div>
                <div className="text-muted">Labor: {formatCurrency(calculateTotal(items).laborTotal)}</div>
                <div className="text-muted">Equipment: {formatCurrency(calculateTotal(items).equipmentTotal)}</div>
              </div>
              <div className="text-right">
                <div className="font-medium text-lg">Total: {formatCurrency(calculateTotal(items).subtotal)}</div>
              </div>
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

      <Modal isOpen={showPricePicker} onClose={() => { setShowPricePicker(false); setPriceSearch(''); }} title="Select from Price Book" size="lg">
        <div className="mb-4">
          <div className="flex gap-2 mb-3">
            <button className={`btn btn-sm ${pricePickerTab === 'materials' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPricePickerTab('materials')}>
              Materials ({materials?.length || 0})
            </button>
            <button className={`btn btn-sm ${pricePickerTab === 'labor' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setPricePickerTab('labor')}>
              Labor ({laborRates?.length || 0})
            </button>
          </div>
          <input
            className="form-input"
            placeholder={`Search ${pricePickerTab}...`}
            value={priceSearch}
            onChange={e => setPriceSearch(e.target.value)}
          />
        </div>
        <div className="max-h-[50vh] overflow-y-auto">
          {pricePickerTab === 'materials' ? (
            <div className="space-y-1">
              {materials
                ?.filter(m => m.isActive !== false && m.name.toLowerCase().includes(priceSearch.toLowerCase()))
                .map(m => (
                  <button
                    key={m.id}
                    className="w-full flex items-center justify-between p-2 border rounded hover:bg-gray-50 text-left"
                    onClick={() => {
                      setItems([...items, {
                        name: m.name,
                        description: m.description || '',
                        quantity: 1,
                        unit: m.unit,
                        unitPrice: m.unitPrice,
                        category: 'material' as const,
                        linkedMaterialId: m.id,
                      }]);
                      setShowPricePicker(false);
                      setPriceSearch('');
                      showToast('Item added');
                    }}
                  >
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-xs text-muted">{m.category} • {m.supplier || 'No supplier'}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(m.unitPrice)}</div>
                      <div className="text-xs text-muted">/{m.unit}</div>
                    </div>
                  </button>
                ))}
            </div>
          ) : (
            <div className="space-y-1">
              {laborRates
                ?.filter(r => r.isActive !== false && r.name.toLowerCase().includes(priceSearch.toLowerCase()))
                .map(r => (
                  <button
                    key={r.id}
                    className="w-full flex items-center justify-between p-2 border rounded hover:bg-gray-50 text-left"
                    onClick={() => {
                      setItems([...items, {
                        name: r.name,
                        description: r.trade,
                        quantity: 1,
                        unit: 'hr',
                        unitPrice: r.hourlyRate,
                        category: 'labor' as const,
                        linkedLaborRateId: r.id,
                      }]);
                      setShowPricePicker(false);
                      setPriceSearch('');
                      showToast('Item added');
                    }}
                  >
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-xs text-muted">{r.trade}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{formatCurrency(r.hourlyRate)}</div>
                      <div className="text-xs text-muted">/hr</div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}