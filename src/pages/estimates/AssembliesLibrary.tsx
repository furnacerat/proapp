import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Edit, Trash2, Package, Search, Filter, Tags, Clock, Layers,
  Sparkles, ChevronRight, History, Hammer, Boxes, ArrowUpRight
} from 'lucide-react';
import type { Assembly, AssemblyItem } from '../../data/types';

export function AssembliesLibrary() {
  const { assemblies, estimates, laborRates, materials, addAssembly, updateAssembly, deleteAssembly } = useApp();
  const { showToast } = useToast();
  
  const [showModal, setShowModal] = useState(false);
  const [editingAssembly, setEditingAssembly] = useState<Assembly | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showPricePicker, setShowPricePicker] = useState(false);
  const [pricePickerTab, setPricePickerTab] = useState<'materials' | 'labor'>('materials');
  const [priceSearch, setPriceSearch] = useState('');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All Categories');
  const [showFilters, setShowFilters] = useState(true);
  const [selectedAssemblyId, setSelectedAssemblyId] = useState<string | null>(assemblies[0]?.id || null);
  const [detailTab, setDetailTab] = useState<'details' | 'history'>('details');
  
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

  const categoryChips = ['All Categories', 'Demolition', 'Framing', 'Drywall', 'Flooring', 'Painting', 'Plumbing', 'Electrical'];
  const normalizeCategory = (category?: string) => {
    const value = (category || 'Uncategorized').toLowerCase();
    if (value.includes('demo')) return 'Demolition';
    if (value.includes('frame')) return 'Framing';
    if (value.includes('drywall')) return 'Drywall';
    if (value.includes('floor')) return 'Flooring';
    if (value.includes('paint')) return 'Painting';
    if (value.includes('plumb')) return 'Plumbing';
    if (value.includes('electric')) return 'Electrical';
    return category || 'Uncategorized';
  };

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { 'All Categories': assemblies.length };
    assemblies.forEach(assembly => {
      const category = normalizeCategory(assembly.category);
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  }, [assemblies]);

  const filteredAssemblies = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assemblies.filter(assembly => {
      const normalizedCategory = normalizeCategory(assembly.category);
      const matchesCategory = activeCategory === 'All Categories' || normalizedCategory === activeCategory;
      const matchesSearch = !term ||
        assembly.name.toLowerCase().includes(term) ||
        assembly.category?.toLowerCase().includes(term) ||
        assembly.description?.toLowerCase().includes(term) ||
        assembly.items?.some(item => item.name.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [assemblies, activeCategory, search]);

  const selectedAssembly = assemblies.find(a => a.id === selectedAssemblyId) || filteredAssemblies[0] || assemblies[0] || null;
  const selectedTotals = selectedAssembly ? calculateTotal(selectedAssembly.items || []) : null;
  const totalCategories = new Set(assemblies.map(a => normalizeCategory(a.category))).size;
  const mostUsed = assemblies.length > 0
    ? [...assemblies].sort((a, b) => (b.items?.length || 0) - (a.items?.length || 0))[0]
    : null;
  const timeSaved = assemblies.reduce((sum, assembly) => sum + (assembly.laborHours || 0), 0);
  const usageHistory = selectedAssembly
    ? estimates.filter(estimate => JSON.stringify(estimate).toLowerCase().includes(selectedAssembly.name.toLowerCase()))
    : [];

  const selectAssembly = (assembly: Assembly) => {
    setSelectedAssemblyId(assembly.id);
    setDetailTab('details');
  };

  return (
    <div className="assemblies-page">
      <div className="assemblies-shell">
        <div className="assemblies-header">
          <div>
            <div className="assemblies-eyebrow">Reusable estimating systems</div>
            <h1>Assemblies Library</h1>
            <p>Pre-built labor and material assemblies to help you estimate faster and more accurately.</p>
          </div>
          <div className="assemblies-header-actions">
            <div className="assemblies-search">
              <Search size={18} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search assemblies..." />
            </div>
            <button className={`assemblies-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter size={17} /> Filters
            </button>
            <button className="assemblies-primary-btn" onClick={() => setShowModal(true)}>
              <Plus size={18} /> New Assembly
            </button>
          </div>
        </div>

        <div className="assemblies-kpis">
          <div className="assembly-kpi-card">
            <div className="assembly-kpi-icon"><Package size={20} /></div>
            <span>Total Assemblies</span>
            <strong>{assemblies.length}</strong>
          </div>
          <div className="assembly-kpi-card">
            <div className="assembly-kpi-icon"><Tags size={20} /></div>
            <span>Categories</span>
            <strong>{totalCategories}</strong>
          </div>
          <div className="assembly-kpi-card">
            <div className="assembly-kpi-icon"><Sparkles size={20} /></div>
            <span>Most Used</span>
            <strong>{mostUsed?.name || 'None yet'}</strong>
          </div>
          <div className="assembly-kpi-card">
            <div className="assembly-kpi-icon"><Clock size={20} /></div>
            <span>Time Saved</span>
            <strong>{timeSaved.toFixed(0)}h</strong>
          </div>
        </div>

        {showFilters && (
          <div className="assembly-category-bar">
            <div className="assembly-category-scroll">
              {categoryChips.map(category => (
                <button
                  key={category}
                  className={`assembly-chip ${activeCategory === category ? 'active' : ''}`}
                  onClick={() => setActiveCategory(category)}
                >
                  {category}
                  <span>{categoryCounts[category] || 0}</span>
                </button>
              ))}
            </div>
            <button className="assembly-manage-btn" onClick={() => setShowModal(true)}>Manage Categories</button>
          </div>
        )}

        {assemblies.length === 0 ? (
          <div className="assembly-empty-premium">
            <div className="assembly-empty-icon"><Layers size={42} /></div>
            <h2>Build your first assembly</h2>
            <p>Create reusable bundles of labor and materials to speed up estimating.</p>
            <div className="assembly-empty-actions">
              <button className="assemblies-primary-btn" onClick={() => setShowModal(true)}><Plus size={18} /> New Assembly</button>
              <button className="assemblies-secondary-btn" onClick={handleAddStarter}><Package size={18} /> Import Starter Assemblies</button>
            </div>
          </div>
        ) : (
          <div className="assemblies-workspace">
            <div className="assemblies-list-card">
              <div className="assemblies-table-head">
                <span>Assembly</span>
                <span>Category</span>
                <span>Items</span>
                <span>Cost</span>
                <span>Labor</span>
                <span>Total</span>
                <span></span>
              </div>
              <div className="assemblies-table-body">
                {filteredAssemblies.map(assembly => {
                  const totals = calculateTotal(assembly.items || []);
                  const selected = selectedAssembly?.id === assembly.id;
                  return (
                    <button key={assembly.id} className={`assembly-row ${selected ? 'selected' : ''}`} onClick={() => selectAssembly(assembly)}>
                      <span className="assembly-row-main">
                        <span className="assembly-thumb"><Package size={18} /></span>
                        <span>
                          <strong>{assembly.name}</strong>
                          <small>{assembly.description || 'Reusable labor and material bundle'}</small>
                        </span>
                      </span>
                      <span><em className="assembly-category-badge">{assembly.category || 'Uncategorized'}</em></span>
                      <span>{assembly.items?.length || 0}</span>
                      <span>{formatCurrency(totals.materialTotal + totals.equipmentTotal + totals.otherTotal)}</span>
                      <span>{formatCurrency(totals.laborTotal)}</span>
                      <span className="assembly-total-cell">{formatCurrency(totals.subtotal)}</span>
                      <span className="assembly-arrow"><ChevronRight size={18} /></span>
                    </button>
                  );
                })}
                {filteredAssemblies.length === 0 && (
                  <div className="assembly-no-results">No assemblies match your search or filters.</div>
                )}
              </div>
            </div>

            <aside className="assembly-detail-panel">
              {selectedAssembly && selectedTotals ? (
                <>
                  <div className="assembly-detail-hero">
                    <div className="assembly-detail-image"><Boxes size={46} /></div>
                    <div>
                      <div className="assembly-category-badge">{selectedAssembly.category || 'Uncategorized'}</div>
                      <h2>{selectedAssembly.name}</h2>
                      <p>{selectedAssembly.description || 'No description yet. Add notes to help your team understand when to use this assembly.'}</p>
                    </div>
                  </div>

                  <div className="assembly-detail-stats">
                    <div><span>Labor time</span><strong>{selectedAssembly.laborHours || 0}h</strong></div>
                    <div><span>Items</span><strong>{selectedAssembly.items?.length || 0}</strong></div>
                    <div><span>Labor cost</span><strong>{formatCurrency(selectedTotals.laborTotal)}</strong></div>
                    <div><span>Total price</span><strong>{formatCurrency(selectedTotals.subtotal)}</strong></div>
                  </div>

                  <div className="assembly-detail-tabs">
                    <button className={detailTab === 'details' ? 'active' : ''} onClick={() => setDetailTab('details')}><Hammer size={15} /> Details</button>
                    <button className={detailTab === 'history' ? 'active' : ''} onClick={() => setDetailTab('history')}><History size={15} /> Usage History</button>
                  </div>

                  {detailTab === 'details' ? (
                    <div className="assembly-items-list">
                      <div className="assembly-item-line assembly-item-head">
                        <div>Item name</div><div>Cost</div><div>Labor</div><div>Total</div>
                      </div>
                      {(selectedAssembly.items || []).map((item, index) => {
                        const lineTotal = item.quantity * item.unitPrice;
                        return (
                          <div key={`${item.name}-${index}`} className="assembly-item-line">
                            <div>
                              <strong>{item.name}</strong>
                              <span>{item.category} - {item.quantity} {item.unit}</span>
                            </div>
                            <div>{formatCurrency(item.unitPrice)}</div>
                            <div>{item.category === 'labor' ? formatCurrency(lineTotal) : '-'}</div>
                            <div>{formatCurrency(lineTotal)}</div>
                          </div>
                        );
                      })}
                      {(selectedAssembly.items || []).length === 0 && <div className="assembly-no-results">No included items yet.</div>}
                    </div>
                  ) : (
                    <div className="assembly-history-list">
                      {usageHistory.length > 0 ? usageHistory.slice(0, 5).map(estimate => (
                        <Link key={estimate.id} to={`/estimates/${estimate.id}`} className="assembly-history-item">
                          <span>{estimate.name}</span>
                          <ArrowUpRight size={15} />
                        </Link>
                      )) : (
                        <div className="assembly-no-results">No usage history found yet. Add this assembly from the Estimate Builder to begin tracking usage.</div>
                      )}
                    </div>
                  )}

                  <div className="assembly-detail-actions">
                    <button className="assemblies-secondary-btn" onClick={() => handleEdit(selectedAssembly)}><Edit size={16} /> Edit Assembly</button>
                    <button className="assemblies-danger-btn" onClick={() => setDeleteId(selectedAssembly.id)}><Trash2 size={16} /> Delete Assembly</button>
                    <Link to="/estimates/new" className="assemblies-primary-btn"><Plus size={16} /> Add to Estimate</Link>
                  </div>
                </>
              ) : (
                <div className="assembly-no-results">Select an assembly to inspect details.</div>
              )}
            </aside>
          </div>
        )}
      </div>
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
              <div className="w-10 text-center">Qty</div>
              <div className="w-10 text-center">Unit</div>
              <div className="w-16 text-right">Price</div>
              <div className="w-32 text-center">Category</div>
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
                  <div className="w-10">
                    <input
                      className="form-input text-center"
                      type="number"
                      value={item.quantity}
                      onChange={e => updateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                      placeholder="1"
                    />
                  </div>
                  <div className="w-10">
                    <input
                      className="form-input text-center"
                      value={item.unit}
                      onChange={e => updateItem(index, { unit: e.target.value })}
                      placeholder="ea"
                    />
                  </div>
                  <div className="w-16">
                    <input
                      className="form-input text-right"
                      type="number"
                      value={item.unitPrice}
                      onChange={e => updateItem(index, { unitPrice: parseFloat(e.target.value) || 0 })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="w-32">
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
