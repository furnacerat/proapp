import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Edit, Trash2, Hammer, Package, DollarSign, Search, Filter,
  Clock, TrendingUp, Zap, ChevronRight, Boxes, Users, AlertTriangle,
} from 'lucide-react';
import type { LaborRate, Material } from '../../data/types';

type PriceTab = 'all' | 'labor' | 'materials' | 'equipment' | 'subcontractors';
type SelectedPriceItem =
  | { type: 'labor'; item: LaborRate }
  | { type: 'material'; item: Material }
  | null;

export function PriceBook() {
  const {
    laborRates,
    materials,
    estimates,
    timeEntries,
    addLaborRate,
    updateLaborRate,
    deleteLaborRate,
    addMaterial,
    updateMaterial,
    deleteMaterial,
  } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<PriceTab>('labor');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingRate, setEditingRate] = useState<LaborRate | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'labor' | 'material'>('labor');
  const [selectedItem, setSelectedItem] = useState<SelectedPriceItem>(laborRates[0] ? { type: 'labor', item: laborRates[0] } : null);

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

    const payload = {
      name: formData.name,
      trade: formData.trade,
      hourlyRate: parseFloat(formData.hourlyRate) || 0,
      overtimeRate: parseFloat(formData.overtimeRate) || 0,
      isActive: formData.isActive,
    };

    if (editingRate) {
      updateLaborRate(editingRate.id, payload);
      setSelectedItem({ type: 'labor', item: { ...editingRate, ...payload } });
      showToast('Labor rate updated');
    } else {
      const id = addLaborRate(payload);
      setSelectedItem({ type: 'labor', item: { id, ...payload } });
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

    const payload = {
      name: materialForm.name,
      category: materialForm.category,
      unit: materialForm.unit,
      unitPrice: parseFloat(materialForm.unitPrice) || 0,
      supplier: materialForm.supplier,
      sku: materialForm.sku,
      isActive: materialForm.isActive,
    };

    if (editingMaterial) {
      updateMaterial(editingMaterial.id, payload);
      setSelectedItem({ type: 'material', item: { ...editingMaterial, ...payload } });
      showToast('Material updated');
    } else {
      const id = addMaterial(payload);
      setSelectedItem({ type: 'material', item: { id, ...payload } });
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
    if (!deleteId) return;
    if (deleteType === 'labor') {
      deleteLaborRate(deleteId);
      showToast('Labor rate deleted');
    } else {
      deleteMaterial(deleteId);
      showToast('Material deleted');
    }
    setDeleteId(null);
    setSelectedItem(null);
  };

  const openDelete = (type: 'labor' | 'material', id: string) => {
    setDeleteType(type);
    setDeleteId(id);
  };

  const trades = ['Carpentry', 'Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Drywall', 'Painting', 'Flooring', 'General', 'Demolition', 'Landscaping', 'Other'];
  const materialCategories = ['Lumber', 'Sheathing', 'Drywall', 'Hardware', 'Flooring', 'Tile', 'Plumbing', 'Electrical', 'Paint', 'Fasteners', 'Other'];

  const laborUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    estimates.forEach(estimate => {
      JSON.stringify(estimate).replace(/"linkedLaborRateId":"([^"]+)"/g, (_match, id) => {
        usage[id] = (usage[id] || 0) + 1;
        return '';
      });
    });
    timeEntries.forEach(entry => {
      const workerKey = entry.workerId;
      usage[workerKey] = (usage[workerKey] || 0) + 1;
    });
    return usage;
  }, [estimates, timeEntries]);

  const filteredLabor = useMemo(() => {
    const term = search.trim().toLowerCase();
    return laborRates.filter(rate => !term || rate.name.toLowerCase().includes(term) || rate.trade.toLowerCase().includes(term));
  }, [laborRates, search]);

  const filteredMaterials = useMemo(() => {
    const term = search.trim().toLowerCase();
    return materials.filter(material => !term ||
      material.name.toLowerCase().includes(term) ||
      material.category?.toLowerCase().includes(term) ||
      material.supplier?.toLowerCase().includes(term) ||
      material.sku?.toLowerCase().includes(term)
    );
  }, [materials, search]);

  const avgRate = laborRates.length > 0 ? laborRates.reduce((sum, rate) => sum + rate.hourlyRate, 0) / laborRates.length : 0;
  const tradeUsage = laborRates.reduce((acc, rate) => {
    acc[rate.trade] = (acc[rate.trade] || 0) + (laborUsage[rate.id] || 1);
    return acc;
  }, {} as Record<string, number>);
  const mostUsedTrade = Object.entries(tradeUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet';
  const lastUpdated = laborRates.length + materials.length > 0 ? 'Today' : 'No updates';
  const lowRateCount = laborRates.filter(rate => rate.hourlyRate > 0 && rate.hourlyRate < Math.max(45, avgRate * 0.8)).length;
  const missingOvertimeCount = laborRates.filter(rate => !rate.overtimeRate || rate.overtimeRate <= rate.hourlyRate).length;

  const tabs: { id: PriceTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: laborRates.length + materials.length },
    { id: 'labor', label: 'Labor', count: laborRates.length },
    { id: 'materials', label: 'Materials', count: materials.length },
    { id: 'equipment', label: 'Equipment', count: materials.filter(m => m.category?.toLowerCase().includes('equipment')).length },
    { id: 'subcontractors', label: 'Subcontractors', count: laborRates.filter(r => r.trade?.toLowerCase().includes('sub')).length },
  ];

  const showLaborTable = activeTab === 'labor' || activeTab === 'all' || activeTab === 'subcontractors';
  const showMaterialTable = activeTab === 'materials' || activeTab === 'equipment';
  const tableLabor = activeTab === 'subcontractors'
    ? filteredLabor.filter(rate => rate.trade.toLowerCase().includes('sub'))
    : filteredLabor;
  const tableMaterials = activeTab === 'equipment'
    ? filteredMaterials.filter(material => material.category?.toLowerCase().includes('equipment'))
    : filteredMaterials;

  const selectedUsage = selectedItem?.type === 'labor' ? laborUsage[selectedItem.item.id] || 0 : 0;

  const importStarterRates = () => {
    [
      { name: 'Lead Carpenter', trade: 'Carpentry', hourlyRate: 72, overtimeRate: 108, isActive: true },
      { name: 'Journeyman Electrician', trade: 'Electrical', hourlyRate: 88, overtimeRate: 132, isActive: true },
      { name: 'Plumber', trade: 'Plumbing', hourlyRate: 92, overtimeRate: 138, isActive: true },
      { name: 'Painter', trade: 'Painting', hourlyRate: 54, overtimeRate: 81, isActive: true },
    ].forEach(rate => addLaborRate(rate));
    showToast('Starter labor rates imported');
  };

  return (
    <div className="pricebook-page">
      <div className="pricebook-shell">
        <div className="pricebook-header">
          <div>
            <div className="pricebook-eyebrow">Pricing command center</div>
            <h1>Price Book</h1>
            <p>Manage labor rates, material pricing, and cost structures for accurate estimates.</p>
          </div>
          <div className="pricebook-header-actions">
            <div className="pricebook-search">
              <Search size={18} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search labor, materials, trades..." />
            </div>
            <button className={`pricebook-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}><Filter size={17} /> Filter</button>
            <button className="pricebook-primary-btn" onClick={() => activeTab === 'materials' || activeTab === 'equipment' ? setShowMaterialModal(true) : setShowModal(true)}>
              <Plus size={18} /> {activeTab === 'materials' || activeTab === 'equipment' ? 'Add Item' : 'Add Rate'}
            </button>
          </div>
        </div>

        <div className="pricebook-kpis">
          <div className="pricebook-kpi-card"><div className="pricebook-kpi-icon"><Users size={20} /></div><span>Total Labor Roles</span><strong>{laborRates.length}</strong></div>
          <div className="pricebook-kpi-card"><div className="pricebook-kpi-icon"><DollarSign size={20} /></div><span>Average Hourly Rate</span><strong>{formatCurrency(avgRate)}</strong></div>
          <div className="pricebook-kpi-card"><div className="pricebook-kpi-icon"><TrendingUp size={20} /></div><span>Most Used Trade</span><strong>{mostUsedTrade}</strong></div>
          <div className="pricebook-kpi-card"><div className="pricebook-kpi-icon"><Clock size={20} /></div><span>Last Updated</span><strong>{lastUpdated}</strong></div>
        </div>

        {showFilters && (
          <div className="pricebook-tabs">
            {tabs.map(tab => (
              <button key={tab.id} className={`pricebook-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                {tab.label}<span>{tab.count}</span>
              </button>
            ))}
          </div>
        )}

        {laborRates.length === 0 ? (
          <div className="pricebook-empty">
            <div className="pricebook-empty-icon"><Hammer size={42} /></div>
            <h2>Set your labor rates to start building accurate estimates</h2>
            <p>Create reusable labor roles and rates so every estimate starts with reliable pricing.</p>
            <div className="pricebook-empty-actions">
              <button className="pricebook-primary-btn" onClick={() => setShowModal(true)}><Plus size={18} /> Add Labor Rate</button>
              <button className="pricebook-secondary-btn" onClick={importStarterRates}><Package size={18} /> Import Starter Rates</button>
            </div>
          </div>
        ) : (
          <div className="pricebook-workspace">
            <div className="pricebook-main">
              <div className="pricebook-insights">
                <div><Zap size={18} /><strong>Smart Insights</strong></div>
                <p>{lowRateCount > 0 ? `${lowRateCount} labor roles look underpriced against your current average.` : 'Labor rates look consistent across active roles.'}</p>
                <p>{missingOvertimeCount > 0 ? `${missingOvertimeCount} roles need overtime rates reviewed.` : `Most used trade: ${mostUsedTrade}. Keep it current for accurate bids.`}</p>
              </div>

              {showLaborTable && (
                <div className="pricebook-table-card">
                  <div className="pricebook-table-head">
                    <span>Role Name</span><span>Category</span><span>Base Rate</span><span>Overtime Rate</span><span>Usage Count</span><span>Actions</span>
                  </div>
                  <div className="pricebook-table-body">
                    {tableLabor.map(rate => (
                      <button key={rate.id} className={`pricebook-row ${selectedItem?.type === 'labor' && selectedItem.item.id === rate.id ? 'selected' : ''}`} onClick={() => setSelectedItem({ type: 'labor', item: rate })}>
                        <span className="pricebook-row-main"><span className="pricebook-thumb"><Hammer size={18} /></span><strong>{rate.name}</strong></span>
                        <span><em className="pricebook-badge">{rate.trade}</em></span>
                        <span onClick={e => e.stopPropagation()}><input className="pricebook-inline-input" type="number" value={rate.hourlyRate} onChange={e => updateLaborRate(rate.id, { hourlyRate: parseFloat(e.target.value) || 0 })} /></span>
                        <span onClick={e => e.stopPropagation()}><input className="pricebook-inline-input" type="number" value={rate.overtimeRate || 0} onChange={e => updateLaborRate(rate.id, { overtimeRate: parseFloat(e.target.value) || 0 })} /></span>
                        <span>{laborUsage[rate.id] || 0}</span>
                        <span className="pricebook-row-actions" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleEditRate(rate)}><Edit size={14} /></button>
                          <button onClick={() => openDelete('labor', rate.id)}><Trash2 size={14} /></button>
                        </span>
                      </button>
                    ))}
                    {tableLabor.length === 0 && <div className="pricebook-no-results">No labor rates match this view.</div>}
                  </div>
                </div>
              )}

              {showMaterialTable && (
                <div className="pricebook-table-card">
                  <div className="pricebook-material-head">
                    <span>Item</span><span>Category</span><span>Unit</span><span>Unit Price</span><span>Supplier</span><span>Actions</span>
                  </div>
                  <div className="pricebook-table-body">
                    {tableMaterials.map(material => (
                      <button key={material.id} className={`pricebook-row pricebook-material-row ${selectedItem?.type === 'material' && selectedItem.item.id === material.id ? 'selected' : ''}`} onClick={() => setSelectedItem({ type: 'material', item: material })}>
                        <span className="pricebook-row-main"><span className="pricebook-thumb"><Boxes size={18} /></span><strong>{material.name}</strong></span>
                        <span><em className="pricebook-badge">{material.category || 'Material'}</em></span>
                        <span>{material.unit}</span>
                        <span>{formatCurrency(material.unitPrice)}</span>
                        <span>{material.supplier || '-'}</span>
                        <span className="pricebook-row-actions" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleEditMaterial(material)}><Edit size={14} /></button>
                          <button onClick={() => openDelete('material', material.id)}><Trash2 size={14} /></button>
                        </span>
                      </button>
                    ))}
                    {tableMaterials.length === 0 && <div className="pricebook-no-results">No material items match this view.</div>}
                  </div>
                </div>
              )}
            </div>

            <aside className="pricebook-detail-panel">
              {selectedItem ? (
                <>
                  <div className="pricebook-detail-hero">
                    <div className="pricebook-detail-icon">{selectedItem.type === 'labor' ? <Hammer size={42} /> : <Boxes size={42} />}</div>
                    <div>
                      <em className="pricebook-badge">{selectedItem.type === 'labor' ? selectedItem.item.trade : selectedItem.item.category || 'Material'}</em>
                      <h2>{selectedItem.item.name}</h2>
                      <p>{selectedItem.type === 'labor' ? 'Labor role used for estimate line-item pricing.' : `${selectedItem.item.unit} pricing${selectedItem.item.supplier ? ` from ${selectedItem.item.supplier}` : ''}.`}</p>
                    </div>
                  </div>
                  <div className="pricebook-detail-stats">
                    {selectedItem.type === 'labor' ? (
                      <>
                        <div><span>Base rate</span><strong>{formatCurrency(selectedItem.item.hourlyRate)}/hr</strong></div>
                        <div><span>OT rate</span><strong>{formatCurrency(selectedItem.item.overtimeRate || 0)}/hr</strong></div>
                        <div><span>Estimate usage</span><strong>{selectedUsage}</strong></div>
                        <div><span>Status</span><strong>{selectedItem.item.isActive ? 'Active' : 'Inactive'}</strong></div>
                      </>
                    ) : (
                      <>
                        <div><span>Unit price</span><strong>{formatCurrency(selectedItem.item.unitPrice)}</strong></div>
                        <div><span>Unit</span><strong>{selectedItem.item.unit}</strong></div>
                        <div><span>Supplier</span><strong>{selectedItem.item.supplier || '-'}</strong></div>
                        <div><span>Status</span><strong>{selectedItem.item.isActive ? 'Active' : 'Inactive'}</strong></div>
                      </>
                    )}
                  </div>
                  <div className="pricebook-detail-actions">
                    <button className="pricebook-secondary-btn" onClick={() => selectedItem.type === 'labor' ? handleEditRate(selectedItem.item) : handleEditMaterial(selectedItem.item)}><Edit size={16} /> Edit</button>
                    <button className="pricebook-danger-btn" onClick={() => openDelete(selectedItem.type === 'labor' ? 'labor' : 'material', selectedItem.item.id)}><Trash2 size={16} /> Delete</button>
                    <Link to="/estimates/new" className="pricebook-primary-btn"><Plus size={16} /> Apply to Estimate</Link>
                  </div>
                  {selectedItem.type === 'labor' && selectedItem.item.hourlyRate < Math.max(45, avgRate * 0.8) && (
                    <div className="pricebook-warning"><AlertTriangle size={16} /> This role may be underpriced. Consider increasing the base rate or reviewing markup.</div>
                  )}
                </>
              ) : (
                <div className="pricebook-no-results">Select a pricing row to inspect details.</div>
              )}
            </aside>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingRate(null); }} title={editingRate ? 'Edit Labor Rate' : 'New Labor Rate'} size="md">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Rate Name *</label>
            <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Lead Carpenter" />
          </div>
          <div className="form-group">
            <label className="form-label">Trade *</label>
            <select className="form-select" value={formData.trade} onChange={e => setFormData({...formData, trade: e.target.value})}>
              <option value="">Select trade...</option>
              {trades.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Hourly Rate</label>
              <input className="form-input" type="number" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Overtime Rate</label>
              <input className="form-input" type="number" value={formData.overtimeRate} onChange={e => setFormData({...formData, overtimeRate: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
              Active
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingRate(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveRate}>{editingRate ? 'Update' : 'Create'} Rate</button>
        </div>
      </Modal>

      <Modal isOpen={showMaterialModal} onClose={() => { setShowMaterialModal(false); setEditingMaterial(null); }} title={editingMaterial ? 'Edit Material' : 'New Material'} size="md">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Material Name *</label>
            <input className="form-input" value={materialForm.name} onChange={e => setMaterialForm({...materialForm, name: e.target.value})} placeholder="e.g., 2x4x8 Stud" />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={materialForm.category} onChange={e => setMaterialForm({...materialForm, category: e.target.value})}>
              <option value="">Select category...</option>
              {materialCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input className="form-input" value={materialForm.unit} onChange={e => setMaterialForm({...materialForm, unit: e.target.value})} placeholder="ea, sqft, lf, etc." />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price</label>
              <input className="form-input" type="number" value={materialForm.unitPrice} onChange={e => setMaterialForm({...materialForm, unitPrice: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <input className="form-input" value={materialForm.supplier} onChange={e => setMaterialForm({...materialForm, supplier: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={materialForm.isActive} onChange={e => setMaterialForm({...materialForm, isActive: e.target.checked})} />
              Active
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowMaterialModal(false); setEditingMaterial(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveMaterial}>{editingMaterial ? 'Update' : 'Create'} Material</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteType === 'labor' ? 'Labor Rate' : 'Material'}?`}
        message={`This will remove the ${deleteType === 'labor' ? 'rate' : 'material'} from your price book.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
