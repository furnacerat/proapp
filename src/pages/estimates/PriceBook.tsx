import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit, Trash2, Hammer, Package, DollarSign } from 'lucide-react';
import type { LaborRate, Material } from '../../data/types';

export function PriceBook() {
  const { laborRates, materials, addLaborRate, updateLaborRate, deleteLaborRate, addMaterial, updateMaterial, deleteMaterial } = useApp();
  const { showToast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'labor' | 'materials'>('labor');
  const [showModal, setShowModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingRate, setEditingRate] = useState<LaborRate | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    trade: '',
    hourlyRate: '0',
    overtimeRate: '0',
    isActive: true,
  });

  const [materialForm, setMaterialForm] = useState({
    name: '',
    category: '',
    unit: 'ea',
    unitPrice: '0',
    supplier: '',
    sku: '',
    isActive: true,
  });

  const handleSaveRate = () => {
    if (!formData.name || !formData.trade) {
      showToast('Name and trade are required', 'error');
      return;
    }

    if (editingRate) {
      updateLaborRate(editingRate.id, {
        name: formData.name,
        trade: formData.trade,
        hourlyRate: parseFloat(formData.hourlyRate) || 0,
        overtimeRate: parseFloat(formData.overtimeRate) || 0,
        isActive: formData.isActive,
      });
      showToast('Labor rate updated');
    } else {
      addLaborRate({
        name: formData.name,
        trade: formData.trade,
        hourlyRate: parseFloat(formData.hourlyRate) || 0,
        overtimeRate: parseFloat(formData.overtimeRate) || 0,
        isActive: formData.isActive,
      });
      showToast('Labor rate created');
    }
    
    setShowModal(false);
    setEditingRate(null);
    setFormData({ name: '', trade: '', hourlyRate: '0', overtimeRate: '0', isActive: true });
  };

  const handleEditRate = (rate: LaborRate) => {
    setEditingRate(rate);
    setFormData({
      name: rate.name,
      trade: rate.trade,
      hourlyRate: rate.hourlyRate.toString(),
      overtimeRate: rate.overtimeRate?.toString() || '0',
      isActive: rate.isActive,
    });
    setShowModal(true);
  };

  const handleSaveMaterial = () => {
    if (!materialForm.name) {
      showToast('Name is required', 'error');
      return;
    }

    if (editingMaterial) {
      updateMaterial(editingMaterial.id, {
        name: materialForm.name,
        category: materialForm.category,
        unit: materialForm.unit,
        unitPrice: parseFloat(materialForm.unitPrice) || 0,
        supplier: materialForm.supplier,
        sku: materialForm.sku,
        isActive: materialForm.isActive,
      });
      showToast('Material updated');
    } else {
      addMaterial({
        name: materialForm.name,
        category: materialForm.category,
        unit: materialForm.unit,
        unitPrice: parseFloat(materialForm.unitPrice) || 0,
        supplier: materialForm.supplier,
        sku: materialForm.sku,
        isActive: materialForm.isActive,
      });
      showToast('Material created');
    }
    
    setShowMaterialModal(false);
    setEditingMaterial(null);
    setMaterialForm({ name: '', category: '', unit: 'ea', unitPrice: '0', supplier: '', sku: '', isActive: true });
  };

  const handleEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setMaterialForm({
      name: material.name,
      category: material.category,
      unit: material.unit,
      unitPrice: material.unitPrice.toString(),
      supplier: material.supplier || '',
      sku: material.sku || '',
      isActive: material.isActive,
    });
    setShowMaterialModal(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      if (activeTab === 'labor') {
        deleteLaborRate(deleteId);
        showToast('Labor rate deleted');
      } else {
        deleteMaterial(deleteId);
        showToast('Material deleted');
      }
      setDeleteId(null);
    }
  };

  const trades = ['Carpentry', 'Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Drywall', 'Painting', 'Flooring', 'General', 'Demolition', 'Landscaping', 'Other'];
  const materialCategories = ['Lumber', 'Sheathing', 'Drywall', 'Hardware', 'Flooring', 'Tile', 'Plumbing', 'Electrical', 'Paint', 'Fasteners', 'Other'];

  const laborInUse = activeTab === 'labor' ? deleteId : null;
  const materialInUse = activeTab === 'materials' ? deleteId : null;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Price Book</h1>
      </div>

      <div className="page-content">
        <div className="tabs mb-4">
          <button 
            className={`tab ${activeTab === 'labor' ? 'active' : ''}`}
            onClick={() => setActiveTab('labor')}
          >
            <Hammer size={16} /> Labor Rates
          </button>
          <button 
            className={`tab ${activeTab === 'materials' ? 'active' : ''}`}
            onClick={() => setActiveTab('materials')}
          >
            <Package size={16} /> Materials
          </button>
        </div>

        {activeTab === 'labor' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Labor Rates</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowModal(true)}>
                <Plus size={16} /> Add Rate
              </button>
            </div>
            <div className="card-body">
              <div className="space-y-2">
                {laborRates.map(rate => (
                  <div key={rate.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{rate.name}</span>
                        <span className="badge badge-gray">{rate.trade}</span>
                        {!rate.isActive && <span className="badge badge-red">Inactive</span>}
                      </div>
                      <div className="text-sm text-muted mt-1">
                        {formatCurrency(rate.hourlyRate)}/hr
                        {rate.overtimeRate && <span> • {formatCurrency(rate.overtimeRate)}/hr OT</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-sm btn-icon" onClick={() => handleEditRate(rate)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-sm btn-icon btn-danger" onClick={() => setDeleteId(rate.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {laborRates.length === 0 && (
                  <div className="text-center py-8 text-muted">
                    No labor rates. Add your team rates for accurate estimating.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'materials' && (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Materials</h3>
              <button className="btn btn-sm btn-primary" onClick={() => setShowMaterialModal(true)}>
                <Plus size={16} /> Add Material
              </button>
            </div>
            <div className="card-body">
              <div className="space-y-2">
                {materials.map(material => (
                  <div key={material.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{material.name}</span>
                        <span className="badge badge-gray">{material.category}</span>
                        {!material.isActive && <span className="badge badge-red">Inactive</span>}
                      </div>
                      <div className="text-sm text-muted mt-1">
                        {formatCurrency(material.unitPrice)}/{material.unit}
                        {material.supplier && <span> • {material.supplier}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="btn btn-sm btn-icon" onClick={() => handleEditMaterial(material)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-sm btn-icon btn-danger" onClick={() => setDeleteId(material.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {materials.length === 0 && (
                  <div className="text-center py-8 text-muted">
                    No materials. Add common materials for accurate estimating.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingRate(null); }} title={editingRate ? 'Edit Labor Rate' : 'New Labor Rate'} size="md">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Rate Name *</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Lead Carpenter"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Trade *</label>
            <select
              className="form-select"
              value={formData.trade}
              onChange={e => setFormData({...formData, trade: e.target.value})}
            >
              <option value="">Select trade...</option>
              {trades.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Hourly Rate</label>
              <input
                className="form-input"
                type="number"
                value={formData.hourlyRate}
                onChange={e => setFormData({...formData, hourlyRate: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Overtime Rate</label>
              <input
                className="form-input"
                type="number"
                value={formData.overtimeRate}
                onChange={e => setFormData({...formData, overtimeRate: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={e => setFormData({...formData, isActive: e.target.checked})}
              />
              Active
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingRate(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveRate}>
            {editingRate ? 'Update' : 'Create'} Rate
          </button>
        </div>
      </Modal>

      <Modal isOpen={showMaterialModal} onClose={() => { setShowMaterialModal(false); setEditingMaterial(null); }} title={editingMaterial ? 'Edit Material' : 'New Material'} size="md">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Material Name *</label>
            <input
              className="form-input"
              value={materialForm.name}
              onChange={e => setMaterialForm({...materialForm, name: e.target.value})}
              placeholder="e.g., 2x4x8 Stud"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={materialForm.category}
              onChange={e => setMaterialForm({...materialForm, category: e.target.value})}
            >
              <option value="">Select category...</option>
              {materialCategories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input
                className="form-input"
                value={materialForm.unit}
                onChange={e => setMaterialForm({...materialForm, unit: e.target.value})}
                placeholder="ea, sqft, lf, etc."
              />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price</label>
              <input
                className="form-input"
                type="number"
                value={materialForm.unitPrice}
                onChange={e => setMaterialForm({...materialForm, unitPrice: e.target.value})}
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <input
              className="form-input"
              value={materialForm.supplier}
              onChange={e => setMaterialForm({...materialForm, supplier: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={materialForm.isActive}
                onChange={e => setMaterialForm({...materialForm, isActive: e.target.checked})}
              />
              Active
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowMaterialModal(false); setEditingMaterial(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveMaterial}>
            {editingMaterial ? 'Update' : 'Create'} Material
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={`Delete ${activeTab === 'labor' ? 'Labor Rate' : 'Material'}?`}
        message={`This will remove the ${activeTab === 'labor' ? 'rate' : 'material'} from your price book.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}