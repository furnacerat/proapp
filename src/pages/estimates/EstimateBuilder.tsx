import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../../data/types';
import type { Estimate, EstimateScope, EstimateSection, EstimateLineItem, EstimateLineCategory, Customer, JobType, EstimateStatus } from '../../data/types';
import { useToast } from '../../components/common/Toast';
import { Modal } from '../../components/common/Modal';
import {
  Plus, Trash2, Save, Send, ArrowLeft, Copy, FileText, Printer,
  Package, Clock, DollarSign, ChevronDown, ChevronUp,
  Calculator, X, Eye, CheckSquare, Search, Zap, Briefcase,
  Users, Wrench, Truck, Home, Building, Building2, LayoutGrid,
  EyeOff, RotateCcw, CheckCircle, Edit3
} from 'lucide-react';

const PROJECT_TYPES = [
  { value: 'kitchen', label: 'Kitchen', icon: Home, color: '#f97316' },
  { value: 'bathroom', label: 'Bathroom', icon: Building, color: '#06b6d4' },
  { value: 'roofing', label: 'Roofing', icon: Building2, color: '#8b5cf6' },
  { value: 'remodel', label: 'Full Remodel', icon: LayoutGrid, color: '#10b981' },
  { value: 'addition', label: 'Addition', icon: Plus, color: '#3b82f6' },
  { value: 'custom', label: 'Custom', icon: Wrench, color: '#64748b' },
];

const CATEGORIES: { value: EstimateLineCategory; label: string; icon: any; color: string }[] = [
  { value: 'labor', label: 'Labor', icon: Users, color: '#3b82f6' },
  { value: 'material', label: 'Material', icon: Package, color: '#10b981' },
  { value: 'equipment', label: 'Equipment', icon: Wrench, color: '#f97316' },
  { value: 'subcontractor', label: 'Subcontractor', icon: Truck, color: '#8b5cf6' },
  { value: 'allowance', label: 'Allowance', icon: DollarSign, color: '#eab308' },
  { value: 'other', label: 'Other', icon: FileText, color: '#64748b' },
];

export function EstimateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { branding, estimates, customers, materials, laborRates, assemblies, projectTypeTemplates, addEstimate, updateEstimate, getEstimateCustomer, convertEstimateToJob } = useApp();
  const { showToast } = useToast();

  const isNew = id === 'new';
  const estimate = (!isNew && id) ? estimates?.find(e => e.id === id) : null;
  const customer = estimate ? getEstimateCustomer(estimate.id) : undefined;

  // Form state
  const [formData, setFormData] = useState({
    name: estimate?.name || 'New Estimate',
    customerId: estimate?.customerId || '',
    address: estimate?.address || '',
    status: estimate?.status || 'draft',
    type: estimate?.type || 'remodel',
    markupPercent: estimate?.markupPercent?.toString() || '20',
    notes: estimate?.notes || '',
    validUntil: estimate?.validUntil || '',
  });

  // Scopes/Sections state
  const [scopes, setScopes] = useState<EstimateScope[]>(estimate?.scopes || []);
  const [legacySections, setLegacySections] = useState<EstimateSection[]>(estimate?.sections || []);
  const [activeScopeId, setActiveScopeId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);

  // UI state
  const [clientView, setClientView] = useState(false);
  const [showCustomerPicker, setShowCustomerPicker] = useState(false);
  const [showProjectTypePicker, setShowProjectTypePicker] = useState(!estimate?.type);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAssemblyPicker, setShowAssemblyPicker] = useState(false);
  const [editingItem, setEditingItem] = useState<{ item?: EstimateLineItem; sectionId: string } | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: '', quantity: '1', unit: 'ea', unitPrice: '0', category: 'material' as EstimateLineCategory });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertOptions, setConvertOptions] = useState({ startDate: new Date().toISOString().split('T')[0], dueDate: '', copyLineItems: true, copyPricing: true, copyNotes: true });

  // Handler functions
  const handleScopeNameUpdate = (scopeId: string, name: string) => {
    setScopes(scopes.map(s => s.id === scopeId ? { ...s, name } : s));
  };

  const handleSectionNameUpdate = (sectionId: string, name: string) => {
    setScopes(scopes.map(s => ({
      ...s,
      sections: s.sections?.map(sec => sec.id === sectionId ? { ...sec, name } : sec)
    })));
  };

  const handleToggleScope = (scopeId: string) => {
    setActiveScopeId(activeScopeId === scopeId ? null : scopeId);
  };

  const handleToggleSection = (sectionId: string) => {
    setActiveSectionId(activeSectionId === sectionId ? null : sectionId);
  };

  const handleDeleteScope = (scopeId: string) => {
    setScopes(scopes.filter(s => s.id !== scopeId));
  };

  const handleAddSection = (scopeId: string) => {
    const newSection: EstimateSection = { id: crypto.randomUUID(), name: 'New Section', lineItems: [] };
    setScopes(scopes.map(s => s.id === scopeId ? { ...s, sections: [...(s.sections || []), newSection] } : s));
  };

  const handleAddItemToSection = (sectionId: string) => {
    setEditingItem({ sectionId });
    setNewItemForm({ name: '', quantity: '1', unit: 'ea', unitPrice: '0', category: 'material' });
    setShowAddItem(true);
  };

  const handleEditItem = (sectionId: string, item: EstimateLineItem) => {
    setEditingItem({ item, sectionId });
    setNewItemForm({ name: item.name, quantity: String(item.quantity), unit: item.unit, unitPrice: String(item.unitPrice), category: item.category });
    setShowAddItem(true);
  };

  const handleDeleteItem = (sectionId: string, itemId: string) => {
    setScopes(scopes.map(s => ({
      ...s,
      sections: s.sections?.map(sec => sec.id === sectionId ? { ...sec, lineItems: sec.lineItems?.filter(item => item.id !== itemId) } : sec)
    })));
  };

  const handleAddItemFromFooter = (sectionId: string) => {
    handleAddItemToSection(sectionId);
  };

  // Auto-save
  const saveEstimate = useCallback(() => {
    if (isNew) return;
    const totals = calculateTotals;
    updateEstimate(estimate!.id, {
      ...formData,
      markupPercent: parseFloat(formData.markupPercent) || 0,
      scopes,
      sections: legacySections,
      ...totals,
    });
    setLastSaved(new Date());
  }, [estimate, formData, scopes, legacySections, isNew]);

  useEffect(() => {
    if (!isNew && estimate) {
      const timer = setTimeout(saveEstimate, 2000);
      return () => clearTimeout(timer);
    }
  }, [formData, scopes, legacySections, saveEstimate, isNew, estimate]);

  // Calculate totals
  const calculateTotals = useMemo(() => {
    const allItems: EstimateLineItem[] = [];
    scopes.forEach(s => s.sections?.forEach(sec => sec.lineItems?.forEach(item => { if (!item.isExcluded) allItems.push(item); })));
    legacySections.forEach(sec => sec.lineItems?.forEach(item => { if (!item.isExcluded) allItems.push(item); }));

    const laborTotal = allItems.filter(i => i.isLabor || i.category === 'labor').reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const materialTotal = allItems.filter(i => i.category === 'material' || i.category === 'allowance' || i.category === 'other').reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const equipmentTotal = allItems.filter(i => i.category === 'equipment').reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const subcontractorTotal = allItems.filter(i => i.category === 'subcontractor').reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);

    const subtotal = laborTotal + materialTotal + equipmentTotal + subcontractorTotal;
    const markupAmount = subtotal * (parseFloat(formData.markupPercent) / 100);
    const total = subtotal + markupAmount;
    const laborHours = allItems.filter(i => i.isLabor || i.category === 'labor').reduce((s, i) => s + (i.hours || 0), 0);

    const internalCost = laborTotal + materialTotal + equipmentTotal + subcontractorTotal;
    const profit = total - internalCost;
    const profitPercent = total > 0 ? (profit / total) * 100 : 0;

    return { laborTotal, materialTotal, equipmentTotal, subcontractorTotal, subtotal, markupAmount, total, laborHours, internalCost, profit, profitPercent };
  }, [scopes, legacySections, formData.markupPercent]);

  // Add scope
  const addScope = (name: string) => {
    const newScope: EstimateScope = { id: crypto.randomUUID(), name, projectType: formData.type as any, sections: [], subtotal: 0, isOptional: false, sortOrder: scopes.length };
    setScopes([...scopes, newScope]);
    setActiveScopeId(newScope.id);
  };

  // Add item
  const addItem = (sectionId: string, item: EstimateLineItem) => {
    const newItem = { ...item, id: crypto.randomUUID(), total: (item.quantity || 0) * (item.unitPrice || 0) };
    setScopes(scopes.map(s => ({
      ...s,
      sections: s.sections?.map(sec => sec.id === sectionId ? { ...sec, lineItems: [...(sec.lineItems || []), newItem] } : sec)
    })));
  };

  // Update item
  const updateItem = (sectionId: string, itemId: string, updates: Partial<EstimateLineItem>) => {
    setScopes(scopes.map(s => ({
      ...s,
      sections: s.sections?.map(sec => ({
        ...sec,
        lineItems: sec.lineItems?.map(item => item.id === itemId ? { ...item, ...updates, total: ((updates.quantity ?? item.quantity) || 0) * ((updates.unitPrice ?? item.unitPrice) || 0) } : item)
      }))
    })));
  };

  // Create new estimate
  const handleCreate = () => {
    if (!formData.name || !formData.customerId) { showToast('Name and customer required', 'error'); return; }
    const totals = calculateTotals;
    const newId = addEstimate({
      ...formData,
      scopes,
      sections: legacySections,
      ...totals,
    } as any);
    navigate(`/estimates/${newId}`);
    showToast('Estimate created');
  };

  const badge = (status: string) => {
    const m: Record<string, string> = { draft: 'status-draft', sent: 'status-sent', viewed: 'status-sent', in_review: 'status-review', approved: 'status-approved', rejected: 'status-rejected', archived: 'status-draft', converted: 'status-approved' };
    return m[status] || 'status-draft';
  };

  const selectedCustomer = customers?.find(c => c.id === formData.customerId);
  const projectType = PROJECT_TYPES.find(p => p.value === formData.type);

  return (
    <div className="eb-root">
      {/* Sticky Header */}
      <div className="eb-header">
        <div className="eb-header-left">
          <Link to="/estimates" className="eb-backBtn"><ArrowLeft size={18} /></Link>
          <div className="eb-header-info">
            {isNew ? (
              <input className="eb-nameInput" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Estimate name..." />
            ) : (
              <input className="eb-nameInput" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            )}
            <div className="eb-header-meta">
              {selectedCustomer ? (
                <button className="eb-customerBtn" onClick={() => setShowCustomerPicker(true)}>
                  <span>{selectedCustomer.name}</span>
                  <ChevronDown size={12} />
                </button>
              ) : (
                <button className="eb-customerBtn eb-customerBtnEmpty" onClick={() => setShowCustomerPicker(true)}>+ Add Customer</button>
              )}
              <span className={`badge ${badge(formData.status)}`}>{formData.status}</span>
              {projectType && <span className="eb-typeTag" style={{color: projectType.color}}><projectType.icon size={12} />{projectType.label}</span>}
            </div>
          </div>
        </div>
        <div className="eb-header-actions">
          <button className={`eb-viewToggle ${clientView ? 'active' : ''}`} onClick={() => setClientView(!clientView)}>
            <Eye size={16} /><span>{clientView ? 'Client' : 'Internal'}</span>
          </button>
          {!isNew && estimate?.status === 'approved' && !estimate.convertedToJobId && (
            <button className="eb-actionBtn" onClick={() => setShowConvertModal(true)}><Briefcase size={16} /><span>Convert</span></button>
          )}
          {!isNew && <button className="eb-actionBtn" onClick={saveEstimate}><Save size={16} /><span>Save</span></button>}
          {isNew ? (
            <button className="eb-actionBtn eb-actionBtnPrimary" onClick={handleCreate}><Plus size={16} /><span>Create</span></button>
          ) : (
            <>
              <button className="eb-actionBtn"><Printer size={16} /></button>
              <button className="eb-actionBtn"><Send size={16} /></button>
            </>
          )}
        </div>
      </div>

      <div className="eb-body">
        {/* LEFT: Builder Panel */}
        <div className="eb-builder">
          {/* Project Type */}
          <div className="eb-section">
            <div className="eb-sectionHeader">
              <div>
                <p className="eb-sectionEyebrow">Estimate Setup</p>
                <h2>Project Type</h2>
              </div>
              {projectType && <span className="eb-sectionPill">{projectType.label}</span>}
            </div>
            <div className="eb-typeGrid">
              {PROJECT_TYPES.map(pt => (
                <button key={pt.value} className={`eb-typeCard ${formData.type === pt.value ? 'selected' : ''}`}
                  onClick={() => { setFormData({...formData, type: pt.value as JobType}); setShowProjectTypePicker(false); }}>
                  <div className="eb-typeIcon" style={{background: `${pt.color}20`, color: pt.color}}><pt.icon size={24} /></div>
                  <div className="eb-typeLabel">{pt.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="eb-section">
            <div className="eb-sectionHeader">
              <div>
                <p className="eb-sectionEyebrow">Customer & Scope</p>
                <h2>Estimate Details</h2>
              </div>
            </div>
            <div className="eb-detailsGrid">
              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as EstimateStatus})}>
                  {ESTIMATE_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Markup %</label>
                <input className="form-input" type="number" min="0" step="0.1" value={formData.markupPercent} onChange={e => setFormData({...formData, markupPercent: e.target.value})} />
              </div>
              <div className="form-group">
                <label className="form-label">Valid Until</label>
                <input className="form-input" type="date" value={formData.validUntil} onChange={e => setFormData({...formData, validUntil: e.target.value})} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Project Address</label>
              <input className="form-input" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Street, city, state" />
            </div>
            <div className="form-group">
              <label className="form-label">Internal Notes</label>
              <textarea className="form-textarea" value={formData.notes} onChange={e => setFormData({...formData, notes: e.target.value})} placeholder="Scope assumptions, exclusions, or reminders" />
            </div>
          </div>

          {/* Scopes & Sections */}
          {scopes.length === 0 ? (
            <div className="eb-emptyScope">
              <div className="eb-emptyScopeIcon"><Zap size={32} /></div>
              <div className="eb-emptyScopeTitle">Start building your estimate</div>
              <div className="eb-emptyScopeActions">
                <button className="btn btn-primary btn-lg" onClick={() => addScope('Scope 1')}><Plus size={18} /><span>Add Scope</span></button>
                {projectTypeTemplates?.[0] && <button className="btn btn-secondary btn-lg"><CheckSquare size={18} /><span>From Template</span></button>}
              </div>
            </div>
          ) : (
            scopes.map(scope => (
              <div key={scope.id} className="eb-scope">
                <div className="eb-scopeHeader" onClick={() => handleToggleScope(scope.id)}>
                  <div className="eb-scopeTitle">
                    <input className="eb-scopeNameInput" value={scope.name} onChange={e => handleScopeNameUpdate(scope.id, e.target.value)} />
                    <span className="eb-scopeCount">{scope.sections?.length || 0} sections</span>
                  </div>
                  <div className="eb-scopeActions">
                    <button className="eb-iconBtn" onClick={(e) => { e.stopPropagation(); handleAddSection(scope.id); }}><Plus size={14} /></button>
                    <button className="eb-iconBtn eb-iconBtnDanger" onClick={(e) => { e.stopPropagation(); handleDeleteScope(scope.id); }}><Trash2 size={14} /></button>
                    {activeScopeId === scope.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {activeScopeId === scope.id && (
                  <div className="eb-scopeBody">
                    {(scope.sections?.length || 0) === 0 ? (
                      <div className="eb-noSections">
                        <button className="btn btn-secondary" onClick={() => handleAddSection(scope.id)}><Plus size={14} /><span>Add Section</span></button>
                      </div>
                    ) : (
                      scope.sections?.map(section => (
                        <div key={section.id} className="eb-sectionCard">
                          <div className="eb-sectionHeader" onClick={() => handleToggleSection(section.id)}>
                            <input className="eb-sectionNameInput" value={section.name} onChange={e => handleSectionNameUpdate(section.id, e.target.value)} />
                            <div className="eb-sectionActions">
                              <button className="eb-iconBtn" onClick={(e) => { e.stopPropagation(); handleAddItemToSection(section.id); }}><Plus size={14} /></button>
                              {activeSectionId === section.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </div>
                          {activeSectionId === section.id && (
                            <div className="eb-sectionBody">
                              {section.lineItems?.length === 0 ? (
                                <div className="eb-noItems">No items yet</div>
                              ) : (
                                <table className="eb-itemsTable">
                                  <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Price</th><th>Total</th><th></th></tr></thead>
                                  <tbody>
                                    {section.lineItems?.map(item => (
                                      <tr key={item.id} className={item.isExcluded ? 'excluded' : ''}>
                                        <td>
                                          <div className="eb-itemName">{item.name}</div>
                                          {item.description && <div className="eb-itemDesc">{item.description}</div>}
                                        </td>
                                        <td className="eb-qtyCell">{item.quantity}</td>
                                        <td className="eb-unitCell">{item.unit}</td>
                                        <td className="eb-priceCell">{formatCurrency(item.unitPrice)}</td>
                                        <td className="eb-totalCell">{formatCurrency(item.total)}</td>
                                        <td className="eb-actionsCell">
                                          <button className="eb-iconBtn" onClick={() => handleEditItem(section.id, item)}><Edit3 size={12} /></button>
                                          <button className="eb-iconBtn eb-iconBtnDanger" onClick={() => handleDeleteItem(section.id, item.id)}><Trash2 size={12} /></button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                              <div className="eb-sectionFooter">
                                <button className="eb-addItemBtn" onClick={() => handleAddItemFromFooter(section.id)}><Plus size={14} />Add Item</button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add Scope Button */}
          {!showProjectTypePicker && (
            <button className="eb-addScopeBtn" onClick={() => addScope(`Scope ${scopes.length + 1}`)}>
              <Plus size={18} /><span>Add Another Scope</span>
            </button>
          )}
        </div>

        {/* RIGHT: Live Summary Panel */}
        <div className={`eb-summary ${clientView ? 'eb-summaryClient' : ''}`}>
          <div className="eb-summaryHeader">
            <h3>Pricing Summary</h3>
            {lastSaved && <span className="eb-savedTime">Saved {lastSaved.toLocaleTimeString()}</span>}
          </div>

          <div className="eb-summaryBody">
            {/* Line Items */}
            <div className="eb-summaryLines">
              <div className="eb-summaryLine"><span>Labor</span><span>{formatCurrency(calculateTotals.laborTotal)}</span></div>
              <div className="eb-summaryLine"><span>Materials</span><span>{formatCurrency(calculateTotals.materialTotal)}</span></div>
              <div className="eb-summaryLine"><span>Equipment</span><span>{formatCurrency(calculateTotals.equipmentTotal)}</span></div>
              <div className="eb-summaryLine"><span>Subcontractor</span><span>{formatCurrency(calculateTotals.subcontractorTotal)}</span></div>
            </div>

            <div className="eb-summaryDivider" />

            {/* Subtotal */}
            <div className="eb-summaryLine eb-summarySubtotal"><span>Subtotal</span><span>{formatCurrency(calculateTotals.subtotal)}</span></div>

            {/* Markup */}
            <div className="eb-summaryMarkup">
              <div className="eb-summaryLine"><span>Markup ({formData.markupPercent}%)</span><span>{formatCurrency(calculateTotals.markupAmount)}</span></div>
            </div>

            <div className="eb-summaryDivider" />

            {/* Total */}
            <div className="eb-summaryTotal">
              <span>Total</span>
              <span>{formatCurrency(calculateTotals.total)}</span>
            </div>

            {/* Internal Profit View */}
            {!clientView && (
              <div className="eb-profitCard">
                <div className="eb-profitTitle">Internal View</div>
                <div className="eb-profitGrid">
                  <div className="eb-profitItem">
                    <span className="eb-profitLabel">Cost</span>
                    <span className="eb-profitValue">{formatCurrency(calculateTotals.internalCost)}</span>
                  </div>
                  <div className="eb-profitItem">
                    <span className="eb-profitLabel">Charge</span>
                    <span className="eb-profitValue">{formatCurrency(calculateTotals.total)}</span>
                  </div>
                  <div className="eb-profitItem">
                    <span className="eb-profitLabel">Profit</span>
                    <span className="eb-profitValue eb-profitValueGreen">{formatCurrency(calculateTotals.profit)}</span>
                  </div>
                  <div className="eb-profitItem">
                    <span className="eb-profitLabel">%</span>
                    <span className="eb-profitValue eb-profitValueGreen">{calculateTotals.profitPercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      <Modal isOpen={showAddItem} onClose={() => setShowAddItem(false)} title={editingItem?.item ? 'Edit Item' : 'Add Item'} size="sm">
        <div className="eb-itemForm">
          <div className="form-group">
            <label className="form-label">Item Name</label>
            <input className="form-input" value={newItemForm.name} onChange={e => setNewItemForm({...newItemForm, name: e.target.value})} placeholder="e.g., Cabinets, Demo, Installation" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Quantity</label>
              <input className="form-input" type="number" value={newItemForm.quantity} onChange={e => setNewItemForm({...newItemForm, quantity: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Unit</label>
              <select className="form-select" value={newItemForm.unit} onChange={e => setNewItemForm({...newItemForm, unit: e.target.value})}>
                <option value="ea">ea</option>
                <option value="hr">hr</option>
                <option value="day">day</option>
                <option value="sf">sf</option>
                <option value="lf">lf</option>
                <option value="sq">sq</option>
                <option value="unit">unit</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Unit Price</label>
              <input className="form-input" type="number" value={newItemForm.unitPrice} onChange={e => setNewItemForm({...newItemForm, unitPrice: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <select className="form-select" value={newItemForm.category} onChange={e => setNewItemForm({...newItemForm, category: e.target.value as EstimateLineCategory})}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="eb-itemFormTotal">
            <span>Line Total:</span>
            <span>{formatCurrency(parseFloat(newItemForm.quantity) * parseFloat(newItemForm.unitPrice))}</span>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowAddItem(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            const item: EstimateLineItem = { id: editingItem?.item?.id || '', name: newItemForm.name, quantity: parseFloat(newItemForm.quantity), unit: newItemForm.unit, unitPrice: parseFloat(newItemForm.unitPrice), category: newItemForm.category, total: parseFloat(newItemForm.quantity) * parseFloat(newItemForm.unitPrice), isLabor: newItemForm.category === 'labor' };
            if (editingItem?.item) { updateItem(editingItem.sectionId, editingItem.item.id, item); }
            else { addItem(editingItem?.sectionId || '', item); }
            setShowAddItem(false);
          }}>{editingItem?.item ? 'Update' : 'Add Item'}</button>
        </div>
      </Modal>

      {/* Customer Picker Modal */}
      <Modal isOpen={showCustomerPicker} onClose={() => setShowCustomerPicker(false)} title="Select Customer" size="sm">
        <div className="eb-customerList">
          {customers?.map(c => (
            <button key={c.id} className={`eb-customerOption ${formData.customerId === c.id ? 'selected' : ''}`} onClick={() => { setFormData({...formData, customerId: c.id}); setShowCustomerPicker(false); }}>
              <div className="eb-customerOptionName">{c.name}</div>
              <div className="eb-customerOptionEmail">{c.email}</div>
            </button>
          ))}
          {customers?.length === 0 && <div className="text-center text-muted py-4">No customers yet</div>}
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <Link to="/customers" className="btn btn-secondary" onClick={() => setShowCustomerPicker(false)}>Manage Customers</Link>
        </div>
      </Modal>

      {/* Convert to Job Modal */}
      <Modal isOpen={showConvertModal} onClose={() => setShowConvertModal(false)} title="Convert to Job" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-muted">Configure job before converting this estimate.</p>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Start Date</label>
              <input className="form-input" type="date" value={convertOptions.startDate} onChange={e => setConvertOptions({...convertOptions, startDate: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Due Date (Optional)</label>
              <input className="form-input" type="date" value={convertOptions.dueDate} onChange={e => setConvertOptions({...convertOptions, dueDate: e.target.value})} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyPricing} onChange={e => setConvertOptions({...convertOptions, copyPricing: e.target.checked})} />
              <span>Copy pricing (Contract: {formatCurrency(calculateTotals.total)})</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyLineItems} onChange={e => setConvertOptions({...convertOptions, copyLineItems: e.target.checked})} />
              <span>Copy line items</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={convertOptions.copyNotes} onChange={e => setConvertOptions({...convertOptions, copyNotes: e.target.checked})} />
              <span>Copy notes</span>
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowConvertModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={() => {
            if (estimate) {
              const jobId = convertEstimateToJob(estimate.id, {
                startDate: convertOptions.startDate || undefined,
                dueDate: convertOptions.dueDate || undefined,
                copyLineItems: convertOptions.copyLineItems,
                copyPricing: convertOptions.copyPricing,
                copyNotes: convertOptions.copyNotes,
              });
              showToast('Converted to job');
              setShowConvertModal(false);
              navigate(`/jobs/${jobId}`);
            }
          }}>Convert to Job</button>
        </div>
      </Modal>
    </div>
  );
}
