import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES, ESTIMATE_STATUSES as STATUSES } from '../../data/types';
import type { EstimateSection, EstimateLineItem, EstimateStatus, JobType, EstimateLineCategory, Estimate, EstimateTaxable } from '../../data/types';
import { useToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Modal } from '../../components/common/Modal';
import { 
  Plus, Trash2, Save, Send, CheckCircle, ArrowLeft, Copy, FileText, 
  Package, Clock, DollarSign, ChevronDown, ChevronUp, GripVertical,
  AlertTriangle, Calculator, X, Eye, Archive
} from 'lucide-react';

export function EstimateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { estimates, customers, materials, laborRates, assemblies, templates, addEstimate, updateEstimate, deleteEstimate, duplicateEstimate, archiveEstimate, convertEstimateToJob, getEstimateCustomer } = useApp();
  const { showToast } = useToast();
  
  const estimate = id === 'new' ? null : estimates.find(e => e.id === id);
  const customer = estimate ? getEstimateCustomer(estimate.id) : undefined;
  
  const [isEditing, setIsEditing] = useState(true);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAssemblyPicker, setShowAssemblyPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EstimateLineItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: estimate?.name || '',
    customerId: estimate?.customerId || '',
    address: estimate?.address || '',
    type: estimate?.type || 'remodel',
    status: estimate?.status || 'draft',
    markupPercent: estimate?.markupPercent?.toString() || '20',
    taxable: estimate?.taxable || 'none',
    notes: estimate?.notes || '',
    validUntil: estimate?.validUntil || '',
  });

  const [newSectionName, setNewSectionName] = useState('');
  const [itemForm, setItemForm] = useState({
    name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
    category: 'material' as EstimateLineCategory, isLabor: false, hours: '0',
    isOptional: false, isExcluded: false, isAllowance: false, notes: '',
  });

  const sections = estimate?.sections || [];
  
  const totals = useMemo(() => {
    if (!estimate) return { laborTotal: 0, materialTotal: 0, equipmentTotal: 0, subcontractorTotal: 0, subtotal: 0, markupAmount: 0, total: 0, hours: 0, itemsCount: 0 };
    
    let laborTotal = 0, materialTotal = 0, equipmentTotal = 0, subcontractorTotal = 0, hours = 0, itemsCount = 0;
    
    sections.forEach(section => {
      section.lineItems?.forEach(item => {
        if (item.isExcluded) return;
        itemsCount++;
        if (item.isLabor || item.category === 'labor') {
          laborTotal += item.total;
          hours += item.hours || 0;
        } else if (item.category === 'material') {
          materialTotal += item.total;
        } else if (item.category === 'equipment') {
          equipmentTotal += item.total;
        } else if (item.category === 'subcontractor') {
          subcontractorTotal += item.total;
        }
      });
    });
    
    const subtotal = laborTotal + materialTotal + equipmentTotal + subcontractorTotal;
    const markupAmount = subtotal * (estimate.markupPercent / 100);
    const total = subtotal + markupAmount;
    
    return { laborTotal, materialTotal, equipmentTotal, subcontractorTotal, subtotal, markupAmount, total, hours, itemsCount };
  }, [estimate, sections]);

  useEffect(() => {
    if (estimate && formData.markupPercent) {
      const percent = parseFloat(formData.markupPercent) || 0;
      if (percent !== estimate.markupPercent) {
        updateEstimate(estimate.id, { markupPercent: percent });
      }
    }
  }, [formData.markupPercent]);

  if (!estimate) {
    if (id === 'new') {
      if (!formData.name) {
        return (
          <div className="page-container">
            <div className="empty-state">
              <h3>Create New Estimate</h3>
              <p>Select or create an estimate to begin</p>
              <Link to="/estimates" className="btn btn-primary">Go to Estimates</Link>
            </div>
          </div>
        );
      }
    }
    return (
      <div className="page-container">
        <div className="empty-state">
          <FileText size={48} />
          <h3>Estimate not found</h3>
          <Link to="/estimates" className="btn btn-primary">Back to Estimates</Link>
        </div>
      </div>
    );
  }

  const handleSave = () => {
    if (!formData.name || !formData.customerId) {
      showToast('Name and customer are required', 'error');
      return;
    }
    
    updateEstimate(estimate.id, {
      name: formData.name,
      customerId: formData.customerId,
      address: formData.address,
      type: formData.type as JobType,
      status: formData.status as EstimateStatus,
      markupPercent: parseFloat(formData.markupPercent) || 20,
      taxable: formData.taxable as any,
      notes: formData.notes,
      validUntil: formData.validUntil,
    });
    
    showToast('Estimate saved');
  };

  const handleAddSection = () => {
    if (!newSectionName.trim()) return;
    
    const newSection: EstimateSection = {
      id: crypto.randomUUID(),
      name: newSectionName,
      lineItems: [],
      sortOrder: sections.length,
    };
    
    updateEstimate(estimate.id, {
      sections: [...sections, newSection],
    });
    
    setNewSectionName('');
    setShowAddSection(false);
    setActiveSectionId(newSection.id);
    showToast('Section added');
  };

  const handleDeleteSection = (sectionId: string) => {
    updateEstimate(estimate.id, {
      sections: sections.filter(s => s.id !== sectionId),
    });
  };

  const handleAddItem = () => {
    if (!itemForm.name.trim() || !activeSectionId) return;
    
    const qty = parseFloat(itemForm.quantity) || 1;
    const price = parseFloat(itemForm.unitPrice) || 0;
    const hours = parseFloat(itemForm.hours) || 0;
    const isLabor = itemForm.isLabor || itemForm.category === 'labor';
    
    const newItem: EstimateLineItem = {
      id: crypto.randomUUID(),
      name: itemForm.name,
      description: itemForm.description,
      quantity: qty,
      unit: itemForm.unit,
      unitPrice: price,
      category: itemForm.category,
      isLabor,
      hours: isLabor ? hours : undefined,
      total: qty * price,
      isOptional: itemForm.isOptional,
      isExcluded: itemForm.isExcluded,
      isAllowance: itemForm.isAllowance,
      notes: itemForm.notes,
    };
    
    const updatedSections = sections.map(s => {
      if (s.id === activeSectionId) {
        return { ...s, lineItems: [...(s.lineItems || []), newItem] };
      }
      return s;
    });
    
    updateEstimate(estimate.id, { sections: updatedSections });
    
    setItemForm({
      name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
      category: 'material', isLabor: false, hours: '0',
      isOptional: false, isExcluded: false, isAllowance: false, notes: '',
    });
    setShowAddItem(false);
    showToast('Item added');
  };

  const handleUpdateItem = () => {
    if (!editingItem || !activeSectionId) return;
    
    const qty = parseFloat(itemForm.quantity) || 1;
    const price = parseFloat(itemForm.unitPrice) || 0;
    const hours = parseFloat(itemForm.hours) || 0;
    const isLabor = itemForm.isLabor || itemForm.category === 'labor';
    
    const updatedItem: EstimateLineItem = {
      ...editingItem,
      name: itemForm.name,
      description: itemForm.description,
      quantity: qty,
      unit: itemForm.unit,
      unitPrice: price,
      category: itemForm.category,
      isLabor,
      hours: isLabor ? hours : undefined,
      total: qty * price,
      isOptional: itemForm.isOptional,
      isExcluded: itemForm.isExcluded,
      isAllowance: itemForm.isAllowance,
      notes: itemForm.notes,
    };
    
    const updatedSections = sections.map(s => {
      if (s.id === activeSectionId) {
        return {
          ...s,
          lineItems: s.lineItems?.map(item => item.id === editingItem.id ? updatedItem : item) || [],
        };
      }
      return s;
    });
    
    updateEstimate(estimate.id, { sections: updatedSections });
    
    setEditingItem(null);
    setShowAddItem(false);
    showToast('Item updated');
  };

  const handleDeleteItem = (itemId: string) => {
    if (!activeSectionId) return;
    
    const updatedSections = sections.map(s => {
      if (s.id === activeSectionId) {
        return { ...s, lineItems: s.lineItems?.filter(i => i.id !== itemId) || [] };
      }
      return s;
    });
    
    updateEstimate(estimate.id, { sections: updatedSections });
    showToast('Item deleted');
  };

  const handleInsertAssembly = (assembly: any) => {
    const newItems: EstimateLineItem[] = assembly.items?.map((item: any) => ({
      id: crypto.randomUUID(),
      name: item.name,
      quantity: item.quantity,
      unit: 'ea',
      unitPrice: item.unitPrice,
      category: item.category,
      isLabor: item.category === 'labor',
      hours: item.laborHours ? item.laborHours * item.quantity : undefined,
      total: item.quantity * item.unitPrice,
    })) || [];
    
    const sectionItems = sections.find(s => s.id === activeSectionId)?.lineItems || [];
    
    const updatedSections = sections.map(s => {
      if (s.id === activeSectionId) {
        return { ...s, lineItems: [...(s.lineItems || []), ...newItems] };
      }
      return s;
    });
    
    updateEstimate(estimate.id, { sections: updatedSections });
    setShowAssemblyPicker(false);
    showToast('Assembly inserted');
  };

  const handleInsertTemplate = (template: any) => {
    const newSections: EstimateSection[] = template.sections?.map((section: any) => ({
      id: crypto.randomUUID(),
      name: section.name,
      description: section.description,
      lineItems: section.lineItems?.map((item: any) => ({
        id: crypto.randomUUID(),
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || 'ea',
        unitPrice: item.unitPrice,
        category: item.isLabor ? 'labor' : 'material',
        isLabor: item.isLabor,
        hours: item.isLabor ? item.quantity : undefined,
        total: item.quantity * item.unitPrice,
      })) || [],
      sortOrder: section.sortOrder,
    })) || [];
    
    updateEstimate(estimate.id, { 
      sections: [...sections, ...newSections],
      markupPercent: template.markupPercent || estimate.markupPercent,
    });
    setShowTemplatePicker(false);
    showToast('Template inserted');
  };

  const handleDuplicate = () => {
    duplicateEstimate(estimate.id);
    showToast('Estimate duplicated');
  };

  const handleArchive = () => {
    archiveEstimate(estimate.id);
    showToast('Estimate archived');
    navigate('/estimates');
  };

  const handleConvertToJob = () => {
    const jobId = convertEstimateToJob(estimate.id);
    if (jobId) {
      showToast('Estimate converted to job!', 'success');
      navigate(`/jobs/${jobId}`);
    }
  };

  const handleDelete = () => {
    deleteEstimate(estimate.id);
    navigate('/estimates');
    showToast('Estimate deleted');
  };

  const openItemEditor = (item?: EstimateLineItem, sectionId?: string) => {
    if (item) {
      setActiveSectionId(sectionId || activeSectionId);
      setEditingItem(item);
      setItemForm({
        name: item.name,
        description: item.description || '',
        quantity: item.quantity.toString(),
        unit: item.unit,
        unitPrice: item.unitPrice.toString(),
        category: item.category,
        isLabor: item.isLabor,
        hours: (item.hours || 0).toString(),
        isOptional: item.isOptional || false,
        isExcluded: item.isExcluded || false,
        isAllowance: item.isAllowance || false,
        notes: item.notes || '',
      });
    } else {
      setEditingItem(null);
      setItemForm({
        name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
        category: 'material', isLabor: false, hours: '0',
        isOptional: false, isExcluded: false, isAllowance: false, notes: '',
      });
    }
    setShowAddItem(true);
  };

  const getStatusBadge = (status: EstimateStatus) => {
    const colors: Record<EstimateStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      in_review: 'bg-yellow-100 text-yellow-700',
      sent: 'bg-blue-100 text-blue-700',
      viewed: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
      archived: 'bg-gray-100 text-gray-500',
      converted: 'bg-green-100 text-green-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <Link to="/estimates" className="btn btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="page-title">{estimate.name}</h1>
            <div className="text-sm text-muted">{estimate.estimateNumber}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={() => setShowProposal(true)}>
            <Eye size={18} /> Preview
          </button>
          {estimate.status === 'draft' ? (
            <button className="btn btn-secondary" onClick={() => updateEstimate(estimate.id, { status: 'sent' })}>
              <Send size={18} /> Mark Sent
            </button>
          ) : null}
          {estimate.status === 'approved' && !estimate.convertedToJobId && (
            <button className="btn btn-success" onClick={() => setShowConvertConfirm(true)}>
              <CheckCircle size={18} /> Convert to Job
            </button>
          )}
          {estimate.convertedToJobId && (
            <Link to={`/jobs/${estimate.convertedToJobId}`} className="btn btn-secondary">
              <FileText size={18} /> View Job
            </Link>
          )}
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={18} /> Save
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="sticky top-0 bg-white border-b z-10 pb-4 mb-4">
          <div className="grid-4 gap-4">
            <div className="kpi-card">
              <div className="kpi-label text-xs">Total</div>
              <div className="kpi-value">{formatCurrency(totals.total)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label text-xs">Labor ({totals.hours}h)</div>
              <div className="kpi-value">{formatCurrency(totals.laborTotal)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label text-xs">Materials</div>
              <div className="kpi-value">{formatCurrency(totals.materialTotal)}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label text-xs">Markup ({estimate.markupPercent}%)</div>
              <div className="kpi-value">{formatCurrency(totals.markupAmount)}</div>
            </div>
          </div>
        </div>

        <div className="grid-3 gap-6 mb-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Project</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="form-group">
                <label className="form-label">Estimate Name</label>
                <input
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer</label>
                <select
                  className="form-select"
                  value={formData.customerId}
                  onChange={e => setFormData({...formData, customerId: e.target.value})}
                >
                  <option value="">Select customer...</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  className="form-input"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
              <div className="grid-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select
                    className="form-select"
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as JobType})}
                  >
                    {JOB_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={e => setFormData({...formData, status: e.target.value as EstimateStatus})}
                  >
                    {STATUSES.map(s => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Pricing</h3>
            </div>
            <div className="card-body space-y-3">
              <div className="form-group">
                <label className="form-label">Markup %</label>
                <input
                  className="form-input"
                  type="number"
                  value={formData.markupPercent}
                  onChange={e => setFormData({...formData, markupPercent: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Valid Until</label>
                <input
                  className="form-input"
                  type="date"
                  value={formData.validUntil}
                  onChange={e => setFormData({...formData, validUntil: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={formData.notes}
                  onChange={e => setFormData({...formData, notes: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Quick Actions</h3>
            </div>
            <div className="card-body space-y-2">
              <button className="btn btn-secondary w-full" onClick={() => setShowAssemblyPicker(true)}>
                <Package size={16} /> Insert Assembly
              </button>
              <button className="btn btn-secondary w-full" onClick={() => setShowTemplatePicker(true)}>
                <FileText size={16} /> Insert Template
              </button>
              <button className="btn btn-secondary w-full" onClick={handleDuplicate}>
                <Copy size={16} /> Duplicate
              </button>
              <button className="btn btn-secondary w-full" onClick={() => setShowAddSection(true)}>
                <Plus size={16} /> Add Section
              </button>
              <button className="btn btn-danger w-full" onClick={handleArchive}>
                <Archive size={16} /> Archive
              </button>
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-header">
            <h3 className="card-title">Sections & Line Items</h3>
          </div>
          <div className="card-body">
            {sections.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted mb-4">No sections yet. Add a section to start building your estimate.</p>
                <button className="btn btn-primary" onClick={() => setShowAddSection(true)}>
                  <Plus size={18} /> Add Section
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {sections.map((section, sectionIndex) => (
                  <div key={section.id} className="border rounded-lg">
                    <div 
                      className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                      onClick={() => setActiveSectionId(activeSectionId === section.id ? null : section.id)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{section.name}</span>
                        <span className="badge badge-gray">{section.lineItems?.length || 0} items</span>
                      </div>
                      {activeSectionId === section.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                    
                    {activeSectionId === section.id && (
                      <div className="p-4 border-t">
                        <div className="flex justify-between mb-4">
                          <button className="btn btn-sm btn-primary" onClick={() => openItemEditor(undefined, section.id)}>
                            <Plus size={14} /> Add Item
                          </button>
                          <button 
                            className="btn btn-sm btn-danger"
                            onClick={() => handleDeleteSection(section.id)}
                          >
                            <Trash2 size={14} /> Delete Section
                          </button>
                        </div>
                        
                        {!section.lineItems?.length ? (
                          <div className="text-center text-muted py-4">
                            No items in this section. Add line items to build your estimate.
                          </div>
                        ) : (
                          <table className="table">
                            <thead>
                              <tr>
                                <th>Item</th>
                                <th>Qty</th>
                                <th>Unit</th>
                                <th>Unit Price</th>
                                <th>Total</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {section.lineItems?.map(item => (
                                <tr key={item.id} className={item.isExcluded ? 'opacity-50 line-through' : ''}>
                                  <td>
                                    <div className="font-medium">{item.name}</div>
                                    {item.description && (
                                      <div className="text-xs text-muted">{item.description}</div>
                                    )}
                                    {item.isOptional && <span className="badge badge-yellow text-xs">Optional</span>}
                                    {item.isExcluded && <span className="badge badge-red text-xs">Excluded</span>}
                                    {item.isAllowance && <span className="badge badge-blue text-xs">Allowance</span>}
                                  </td>
                                  <td>{item.quantity}</td>
                                  <td>{item.unit}</td>
                                  <td>{formatCurrency(item.unitPrice)}</td>
                                  <td className="font-medium">{formatCurrency(item.total)}</td>
                                  <td>
                                    <div className="flex gap-1">
                                      <button 
                                        className="btn btn-sm btn-icon"
                                        onClick={() => openItemEditor(item, section.id)}
                                      >
                                        <Copy size={14} />
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-icon btn-danger"
                                        onClick={() => handleDeleteItem(item.id)}
                                      >
                                        <Trash2 size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-between text-sm text-muted">
          <div>Created {formatDate(estimate.createdAt)}</div>
          <div>Updated {formatDate(estimate.updatedAt)}</div>
        </div>
      </div>

      <Modal isOpen={showAddSection} onClose={() => setShowAddSection(false)} title="Add Section">
        <div className="form-group">
          <label className="form-label">Section Name</label>
          <input
            className="form-input"
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="e.g., Kitchen, Demolition, Framing"
          />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowAddSection(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddSection}>Add Section</button>
        </div>
      </Modal>

      <Modal isOpen={showAddItem} onClose={() => { setShowAddItem(false); setEditingItem(null); }} title={editingItem ? 'Edit Line Item' : 'Add Line Item'} size="lg">
        <div className="grid-2 gap-3">
          <div className="form-group col-span-2">
            <label className="form-label">Item Name</label>
            <input
              className="form-input"
              value={itemForm.name}
              onChange={e => setItemForm({...itemForm, name: e.target.value})}
            />
          </div>
          <div className="form-group col-span-2">
            <label className="form-label">Description</label>
            <input
              className="form-input"
              value={itemForm.description}
              onChange={e => setItemForm({...itemForm, description: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={itemForm.category}
              onChange={e => setItemForm({...itemForm, category: e.target.value as EstimateLineCategory})}
            >
              <option value="material">Material</option>
              <option value="labor">Labor</option>
              <option value="equipment">Equipment</option>
              <option value="subcontractor">Subcontractor</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input
              className="form-input"
              type="number"
              value={itemForm.quantity}
              onChange={e => setItemForm({...itemForm, quantity: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Unit</label>
            <input
              className="form-input"
              value={itemForm.unit}
              onChange={e => setItemForm({...itemForm, unit: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Unit Price</label>
            <input
              className="form-input"
              type="number"
              value={itemForm.unitPrice}
              onChange={e => setItemForm({...itemForm, unitPrice: e.target.value})}
            />
          </div>
          {(itemForm.isLabor || itemForm.category === 'labor') && (
            <div className="form-group">
              <label className="form-label">Hours</label>
              <input
                className="form-input"
                type="number"
                value={itemForm.hours}
                onChange={e => setItemForm({...itemForm, hours: e.target.value})}
              />
            </div>
          )}
          <div className="form-group col-span-2">
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={itemForm.isOptional}
                  onChange={e => setItemForm({...itemForm, isOptional: e.target.checked})}
                />
                Optional
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={itemForm.isExcluded}
                  onChange={e => setItemForm({...itemForm, isExcluded: e.target.checked})}
                />
                Excluded
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={itemForm.isAllowance}
                  onChange={e => setItemForm({...itemForm, isAllowance: e.target.checked})}
                />
                Allowance
              </label>
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowAddItem(false); setEditingItem(null); }}>Cancel</button>
          <button 
            className="btn btn-primary" 
            onClick={editingItem ? handleUpdateItem : handleAddItem}
          >
            {editingItem ? 'Update' : 'Add'} Item
          </button>
        </div>
      </Modal>

      <Modal isOpen={showAssemblyPicker} onClose={() => setShowAssemblyPicker(false)} title="Insert Assembly" size="lg">
        <div className="space-y-2">
          {assemblies.length === 0 ? (
            <div className="text-center py-8 text-muted">No assemblies available. Create assemblies in the library.</div>
          ) : (
            assemblies.map(assembly => (
              <button
                key={assembly.id}
                className="w-full text-left p-3 border rounded-lg hover:bg-gray-50"
                onClick={() => handleInsertAssembly(assembly)}
              >
                <div className="font-medium">{assembly.name}</div>
                <div className="text-sm text-muted">{assembly.description}</div>
              </button>
            ))
          )}
        </div>
      </Modal>

      <Modal isOpen={showTemplatePicker} onClose={() => setShowTemplatePicker(false)} title="Insert Template" size="lg">
        <div className="space-y-2">
          {templates.length === 0 ? (
            <div className="text-center py-8 text-muted">No templates available.</div>
          ) : (
            templates.map(template => (
              <button
                key={template.id}
                className="w-full text-left p-3 border rounded-lg hover:bg-gray-50"
                onClick={() => handleInsertTemplate(template)}
              >
                <div className="font-medium">{template.name}</div>
                <div className="text-sm text-muted">{template.scope}</div>
              </button>
            ))
          )}
        </div>
      </Modal>

      <Modal isOpen={showProposal} onClose={() => setShowProposal(false)} title="Proposal Preview" size="lg">
        <div className="proposal-preview p-8 bg-white">
          <div className="text-center border-b pb-4 mb-6">
            <h2 className="text-2xl font-bold">{estimate.name}</h2>
            <p className="text-muted">{estimate.estimateNumber}</p>
          </div>
          
          <div className="mb-6">
            <h3 className="font-bold mb-2">Customer</h3>
            <p>{customer?.name}</p>
            {customer?.address && <p className="text-sm text-muted">{customer.address}</p>}
          </div>
          
          <div className="mb-6">
            <h3 className="font-bold mb-2">Scope of Work</h3>
            {sections.map(section => (
              <div key={section.id} className="mb-4">
                <h4 className="font-medium">{section.name}</h4>
                <table className="w-full text-sm">
                  <tbody>
                    {section.lineItems?.map(item => (
                      <tr key={item.id} className={item.isExcluded ? 'line-through text-muted' : ''}>
                        <td>{item.name}</td>
                        <td className="text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          
          <div className="border-t pt-4">
            <div className="flex justify-between mb-2">
              <span>Subtotal</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span>Markup ({estimate.markupPercent}%)</span>
              <span>{formatCurrency(totals.markupAmount)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold">
              <span>Total</span>
              <span>{formatCurrency(totals.total)}</span>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Estimate?"
        message="This action cannot be undone. All estimate data will be lost."
        confirmLabel="Delete"
        danger
      />

      <ConfirmDialog
        isOpen={showConvertConfirm}
        onClose={() => setShowConvertConfirm(false)}
        onConfirm={handleConvertToJob}
        title="Convert to Job?"
        message="This will create a new job from this estimate."
        confirmLabel="Convert"
      />
    </div>
  );
}