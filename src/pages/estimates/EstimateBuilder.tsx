import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES, ESTIMATE_STATUSES as STATUSES } from '../../data/types';
import type { EstimateSection, EstimateLineItem, EstimateStatus, JobType, EstimateLineCategory, Estimate, EstimateTaxable, EstimateScope, ProjectTypeTemplate, ProjectTypeTemplateItem, ProjectTypeTemplateSection } from '../../data/types';
import { useToast } from '../../components/common/Toast';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { Modal } from '../../components/common/Modal';
import { 
  Plus, Trash2, Save, Send, CheckCircle, ArrowLeft, Copy, FileText, 
  Package, Clock, DollarSign, ChevronDown, ChevronUp, GripVertical,
  AlertTriangle, Calculator, X, Eye, Archive, FolderOpen, CheckSquare
} from 'lucide-react';

export function EstimateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { estimates, customers, materials, laborRates, assemblies, templates, projectTypeTemplates, addEstimate, updateEstimate, deleteEstimate, duplicateEstimate, archiveEstimate, convertEstimateToJob, getEstimateCustomer } = useApp();
  const { showToast } = useToast();
  
  const isNew = id === 'new';
  const estimate = isNew ? null : estimates.find(e => e.id === id);
  const customer = estimate ? getEstimateCustomer(estimate.id) : undefined;
  
  const [isEditing, setIsEditing] = useState(!estimate);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAssemblyPicker, setShowAssemblyPicker] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showNewEstimateModal, setShowNewEstimateModal] = useState(isNew);
  const [showAddScope, setShowAddScope] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTypeTemplate | null>(null);
  const [selectedTemplateItems, setSelectedTemplateItems] = useState<Record<string, boolean>>({});
  const [templatePickerStep, setTemplatePickerStep] = useState<'select' | 'items'>('select');
  const [activeScopeId, setActiveScopeId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EstimateLineItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  
  const [formData, setFormData] = useState({
    name: estimate?.name || '',
    customerId: estimate?.customerId || '',
    address: estimate?.address || '',
    status: estimate?.status || 'draft',
    type: estimate?.type || '',
    markupPercent: estimate?.markupPercent?.toString() || '20',
    taxable: estimate?.taxable || 'none',
    notes: estimate?.notes || '',
    validUntil: estimate?.validUntil || '',
  });

  const [newSectionName, setNewSectionName] = useState('');
  const [newScopeName, setNewScopeName] = useState('');
  const [itemForm, setItemForm] = useState({
    name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
    category: 'material' as EstimateLineCategory, isLabor: false, hours: '0',
    isOptional: false, isExcluded: false, isAllowance: false, notes: '',
  });

  const allScopes = estimate?.scopes || [];
  const legacySections = estimate?.sections || [];
  
  const getScopeTotals = (scope: EstimateScope) => {
    let laborTotal = 0, materialTotal = 0, equipmentTotal = 0, subcontractorTotal = 0, hours = 0, itemsCount = 0;
    scope.sections?.forEach(section => {
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
    return { laborTotal, materialTotal, equipmentTotal, subcontractorTotal, subtotal, hours, itemsCount };
  };
  
  const totals = useMemo(() => {
    if (!estimate) return { laborTotal: 0, materialTotal: 0, equipmentTotal: 0, subcontractorTotal: 0, subtotal: 0, markupAmount: 0, total: 0, hours: 0, itemsCount: 0 };
    
    let laborTotal = 0, materialTotal = 0, equipmentTotal = 0, subcontractorTotal = 0, hours = 0, itemsCount = 0;
    
    allScopes.forEach(scope => {
      const scopeTotals = getScopeTotals(scope);
      laborTotal += scopeTotals.laborTotal;
      materialTotal += scopeTotals.materialTotal;
      equipmentTotal += scopeTotals.equipmentTotal;
      subcontractorTotal += scopeTotals.subcontractorTotal;
      hours += scopeTotals.hours;
      itemsCount += scopeTotals.itemsCount;
    });
    
    legacySections.forEach(section => {
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
  }, [estimate, allScopes, legacySections]);

  useEffect(() => {
    if (estimate && formData.markupPercent) {
      const percent = parseFloat(formData.markupPercent) || 0;
      if (percent !== estimate.markupPercent) {
        updateEstimate(estimate.id, { markupPercent: percent });
      }
    }
  }, [formData.markupPercent]);

  const handleCreateNewEstimate = () => {
    if (!formData.name || !formData.customerId) {
      showToast('Name and customer are required', 'error');
      return;
    }
    
    const newId = addEstimate({
      estimateNumber: `EST-${new Date().getFullYear()}-${String(estimates.length + 1).padStart(3, '0')}`,
      customerId: formData.customerId,
      name: formData.name,
      address: formData.address,
      type: formData.type as JobType,
      status: 'draft',
      sections: [],
      markupPercent: parseFloat(formData.markupPercent) || 20,
      taxable: formData.taxable as EstimateTaxable,
      notes: formData.notes,
      validUntil: formData.validUntil,
    });
    
    showToast('Estimate created');
    setShowNewEstimateModal(false);
    navigate(`/estimates/${newId}`);
  };

  if (!estimate) {
    return (
      <div>
        <div className="page-header">
          <h1 className="page-title">New Estimate</h1>
        </div>
        <div className="page-content">
          <div className="card" style={{maxWidth: '600px'}}>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Estimate Name *</label>
                <input
                  className="form-input"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., Smith Kitchen Remodel"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer *</label>
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
                <label className="form-label">Project Address</label>
                <input
                  className="form-input"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Project address"
                />
              </div>
              <div className="grid-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Project Type</label>
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
                  <label className="form-label">Markup %</label>
                  <input
                    className="form-input"
                    type="number"
                    value={formData.markupPercent}
                    onChange={e => setFormData({...formData, markupPercent: e.target.value})}
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-6">
                <button className="btn btn-secondary" onClick={() => navigate('/estimates')}>Cancel</button>
                <button className="btn btn-primary" onClick={handleCreateNewEstimate}>Create Estimate</button>
              </div>
            </div>
          </div>
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
      sortOrder: activeScopeId 
        ? allScopes.find(s => s.id === activeScopeId)?.sections?.length || 0
        : legacySections.length,
    };
    
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return { ...scope, sections: [...(scope.sections || []), newSection] };
        }
        return scope;
      });
      updateEstimate(estimate.id, { scopes: updatedScopes });
    } else {
      updateEstimate(estimate.id, {
        sections: [...legacySections, newSection],
      });
    }
    
    setNewSectionName('');
    setShowAddSection(false);
    setActiveSectionId(newSection.id);
    showToast('Section added');
  };

  const handleDeleteSection = (sectionId: string) => {
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return { ...scope, sections: scope.sections?.filter(s => s.id !== sectionId) || [] };
        }
        return scope;
      });
      updateEstimate(estimate.id, { scopes: updatedScopes });
    } else {
      updateEstimate(estimate.id, {
        sections: legacySections.filter(s => s.id !== sectionId),
      });
    }
  };

  const handleAddScope = () => {
    if (!selectedTemplate || !newScopeName.trim()) return;
    
    const templateSections: EstimateSection[] = selectedTemplate.sections?.map(ts => ({
      id: crypto.randomUUID(),
      name: ts.name,
      description: ts.description,
      lineItems: ts.items
        .filter(item => selectedTemplateItems[item.id] !== false)
        .map(item => ({
          id: crypto.randomUUID(),
          name: item.name,
          description: item.description,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          category: item.category as EstimateLineCategory,
          isLabor: item.isLabor || false,
          hours: item.isLabor ? item.hours : undefined,
          total: item.quantity * item.unitPrice,
          isOptional: item.isOptional,
          isAllowance: item.isAllowance,
        })),
      sortOrder: ts.sortOrder,
    })) || [];
    
    const newScope: EstimateScope = {
      id: crypto.randomUUID(),
      name: newScopeName,
      projectType: selectedTemplate.projectType,
      sections: templateSections,
      subtotal: 0,
      isOptional: false,
      sortOrder: allScopes.length,
    };
    
    updateEstimate(estimate.id, {
      scopes: [...allScopes, newScope],
    });
    
    setNewScopeName('');
    setSelectedTemplate(null);
    setSelectedTemplateItems({});
    setTemplatePickerStep('select');
    setShowAddScope(false);
    setActiveScopeId(newScope.id);
    showToast('Scope added');
  };

  const handleDeleteScope = (scopeId: string) => {
    updateEstimate(estimate.id, {
      scopes: allScopes.filter(s => s.id !== scopeId),
    });
    if (activeScopeId === scopeId) {
      setActiveScopeId(null);
    }
  };

  const handleSelectTemplate = (template: ProjectTypeTemplate) => {
    setSelectedTemplate(template);
    const defaults: Record<string, boolean> = {};
    template.sections?.forEach(ts => {
      ts.items?.forEach(item => {
        defaults[item.id] = item.isDefaultChecked || false;
      });
    });
    setSelectedTemplateItems(defaults);
    setTemplatePickerStep('items');
  };

  const handleToggleTemplateItem = (itemId: string) => {
    setSelectedTemplateItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleAddItemToScope = () => {
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
    
    const updatedScopes = allScopes.map(scope => {
      if (scope.id === activeScopeId) {
        return {
          ...scope,
          sections: scope.sections?.map(s => {
            if (s.id === activeSectionId) {
              return { ...s, lineItems: [...(s.lineItems || []), newItem] };
            }
            return s;
          }) || [],
        };
      }
      return scope;
    });
    
    updateEstimate(estimate.id, { scopes: updatedScopes });
    
    setItemForm({
      name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
      category: 'material', isLabor: false, hours: '0',
      isOptional: false, isExcluded: false, isAllowance: false, notes: '',
    });
    setShowAddItem(false);
    showToast('Item added');
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
    
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return {
            ...scope,
            sections: scope.sections?.map(s => {
              if (s.id === activeSectionId) {
                return { ...s, lineItems: [...(s.lineItems || []), newItem] };
              }
              return s;
            }) || [],
          };
        }
        return scope;
      });
      updateEstimate(estimate.id, { scopes: updatedScopes });
    } else {
      const updatedSections = legacySections.map(s => {
        if (s.id === activeSectionId) {
          return { ...s, lineItems: [...(s.lineItems || []), newItem] };
        }
        return s;
      });
      updateEstimate(estimate.id, { sections: updatedSections });
    }
    
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
    
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return {
            ...scope,
            sections: scope.sections?.map(s => {
              if (s.id === activeSectionId) {
                return {
                  ...s,
                  lineItems: s.lineItems?.map(item => item.id === editingItem.id ? updatedItem : item) || [],
                };
              }
              return s;
            }) || [],
          };
        }
        return scope;
      });
      updateEstimate(estimate.id, { scopes: updatedScopes });
    } else {
      const updatedSections = legacySections.map(s => {
        if (s.id === activeSectionId) {
          return {
            ...s,
            lineItems: s.lineItems?.map(item => item.id === editingItem.id ? updatedItem : item) || [],
          };
        }
        return s;
      });
      updateEstimate(estimate.id, { sections: updatedSections });
    }
    
    setEditingItem(null);
    setShowAddItem(false);
    showToast('Item updated');
  };
  
  const handleDeleteItem = (itemId: string) => {
    if (!activeSectionId) return;
    
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return {
            ...scope,
            sections: scope.sections?.map(s => {
              if (s.id === activeSectionId) {
                return { ...s, lineItems: s.lineItems?.filter(i => i.id !== itemId) || [] };
              }
              return s;
            }) || [],
          };
        }
        return scope;
      });
      updateEstimate(estimate.id, { scopes: updatedScopes });
    } else {
      const updatedSections = legacySections.map(s => {
        if (s.id === activeSectionId) {
          return { ...s, lineItems: s.lineItems?.filter(i => i.id !== itemId) || [] };
        }
        return s;
      });
      updateEstimate(estimate.id, { sections: updatedSections });
    }
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
    
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return {
            ...scope,
            sections: scope.sections?.map(s => {
              if (s.id === activeSectionId) {
                return { ...s, lineItems: [...(s.lineItems || []), ...newItems] };
              }
              return s;
            }) || [],
          };
        }
        return scope;
      });
      updateEstimate(estimate.id, { scopes: updatedScopes });
    } else {
      const updatedSections = legacySections.map(s => {
        if (s.id === activeSectionId) {
          return { ...s, lineItems: [...(s.lineItems || []), ...newItems] };
        }
        return s;
      });
      updateEstimate(estimate.id, { sections: updatedSections });
    }
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
    
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return { ...scope, sections: [...(scope.sections || []), ...newSections] };
        }
        return scope;
      });
      updateEstimate(estimate.id, { scopes: updatedScopes });
    } else {
      updateEstimate(estimate.id, { 
        sections: [...legacySections, ...newSections],
        markupPercent: template.markupPercent || estimate.markupPercent,
      });
    }
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
              <button className="btn btn-secondary w-full" onClick={() => setShowAddScope(true)}>
                <CheckSquare size={16} /> Add Scope
              </button>
              <button className="btn btn-danger w-full" onClick={handleArchive}>
                <Archive size={16} /> Archive
              </button>
            </div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-header flex justify-between items-center">
            <h3 className="card-title">Project Scopes</h3>
            <button className="btn btn-sm btn-primary" onClick={() => setShowAddScope(true)}>
              <Plus size={14} /> Add Scope
            </button>
          </div>
          <div className="card-body">
            {allScopes.length === 0 && legacySections.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted mb-4">No scopes yet. Add a project scope to start building your estimate.</p>
                <button className="btn btn-primary" onClick={() => setShowAddScope(true)}>
                  <Plus size={18} /> Add Scope
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {allScopes.map((scope, scopeIndex) => {
                  const scopeTotals = getScopeTotals(scope);
                  return (
                    <div key={scope.id} className="border-2 border-blue-200 rounded-lg">
                      <div 
                        className="flex items-center justify-between p-4 bg-blue-50 cursor-pointer"
                        onClick={() => setActiveScopeId(activeScopeId === scope.id ? null : scope.id)}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-lg">{scope.name}</span>
                          <span className="badge badge-blue">{scope.sections?.length || 0} sections</span>
                          <span className="badge badge-green">{formatCurrency(scopeTotals.subtotal)}</span>
                        </div>
                        {activeScopeId === scope.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                      
                      {activeScopeId === scope.id && (
                        <div className="p-4 border-t bg-white">
                          <div className="flex justify-between mb-4">
                            <button className="btn btn-sm btn-primary" onClick={() => { setActiveScopeId(scope.id); setShowAddSection(true); }}>
                              <Plus size={14} /> Add Section
                            </button>
                            <button 
                              className="btn btn-sm btn-danger"
                              onClick={() => handleDeleteScope(scope.id)}
                            >
                              <Trash2 size={14} /> Delete Scope
                            </button>
                          </div>
                          
                          <div className="space-y-4">
                            {scope.sections?.map((section, sectionIndex) => (
                              <div key={section.id} className="border rounded-lg">
                                <div 
                                  className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer"
                                  onClick={() => { setActiveScopeId(scope.id); setActiveSectionId(activeSectionId === section.id ? null : section.id); }}
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{section.name}</span>
                                    <span className="badge badge-gray">{section.lineItems?.length || 0} items</span>
                                  </div>
                                  {activeSectionId === section.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                </div>
                                
                                {activeSectionId === section.id && (
                                  <div className="p-3 border-t">
                                    <div className="flex justify-between mb-3">
                                      <button className="btn btn-sm btn-primary" onClick={() => openItemEditor(undefined, section.id)}>
                                        <Plus size={14} /> Add Item
                                      </button>
                                      <button 
                                        className="btn btn-sm btn-danger"
                                        onClick={() => { setActiveScopeId(scope.id); handleDeleteSection(section.id); }}
                                      >
                                        <Trash2 size={14} /> Delete Section
                                      </button>
                                    </div>
                                    
                                    {!section.lineItems?.length ? (
                                      <div className="text-center text-muted py-3">
                                        No items in this section.
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
                                                    onClick={() => { setActiveScopeId(scope.id); openItemEditor(item, section.id); }}
                                                  >
                                                    <Copy size={14} />
                                                  </button>
                                                  <button 
                                                    className="btn btn-sm btn-icon btn-danger"
                                                    onClick={() => { setActiveScopeId(scope.id); handleDeleteItem(item.id); }}
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
                        </div>
                      )}
                    </div>
                  );
                })}
                
                {legacySections.length > 0 && (
                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-4 text-muted">Legacy Sections</h4>
                    <div className="space-y-4">
                      {legacySections.map((section, sectionIndex) => (
                        <div key={section.id} className="border rounded-lg">
                          <div 
                            className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer"
                            onClick={() => { setActiveScopeId(null); setActiveSectionId(activeSectionId === section.id ? null : section.id); }}
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
                                  No items in this section.
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
                  </div>
                )}
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

      <Modal isOpen={showAddScope} onClose={() => { setShowAddScope(false); setSelectedTemplate(null); setTemplatePickerStep('select'); }} title="Add Project Scope" size="lg">
        {templatePickerStep === 'select' ? (
          <>
            <div className="form-group">
              <label className="form-label">Scope Name</label>
              <input
                className="form-input"
                value={newScopeName}
                onChange={e => setNewScopeName(e.target.value)}
                placeholder="e.g., Kitchen, Master Bath, Flooring"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Select Template</label>
              <div className="space-y-2">
                {projectTypeTemplates.length === 0 ? (
                  <div className="text-center py-4 text-muted">No project type templates available.</div>
                ) : (
                  projectTypeTemplates.map(template => (
                    <button
                      key={template.id}
                      className="w-full text-left p-3 border rounded-lg hover:bg-gray-50"
                      onClick={() => handleSelectTemplate(template)}
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-muted">{template.description}</div>
                      <div className="text-xs text-muted mt-1">{template.sections?.length} sections</div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <button className="btn btn-sm btn-secondary" onClick={() => setTemplatePickerStep('select')}>
                <ArrowLeft size={14} /> Back
              </button>
              <span className="font-medium">{selectedTemplate?.name}</span>
            </div>
            <div className="form-group mb-4">
              <label className="form-label">Scope Name</label>
              <input
                className="form-input"
                value={newScopeName}
                onChange={e => setNewScopeName(e.target.value)}
                placeholder="e.g., Kitchen, Master Bath, Flooring"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Select Items to Include</label>
              <div className="text-sm text-muted mb-2">Check items to include in this scope. Default items are pre-selected.</div>
              <div className="max-h-96 overflow-y-auto space-y-4">
                {selectedTemplate?.sections?.map(section => (
                  <div key={section.id} className="border rounded-lg p-3">
                    <div className="font-medium mb-2">{section.name}</div>
                    {section.description && <div className="text-sm text-muted mb-2">{section.description}</div>}
                    <div className="space-y-2">
                      {section.items?.map(item => (
                        <label key={item.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedTemplateItems[item.id] || false}
                            onChange={() => handleToggleTemplateItem(item.id)}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.name}</div>
                            {item.description && <div className="text-xs text-muted">{item.description}</div>}
                          </div>
                          <div className="text-sm text-muted">
                            {item.quantity} {item.unit} × {formatCurrency(item.unitPrice)}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
              <button className="btn btn-secondary" onClick={() => { setShowAddScope(false); setSelectedTemplate(null); setTemplatePickerStep('select'); }}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddScope} disabled={!newScopeName.trim()}>Add Scope</button>
            </div>
          </>
        )}
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
            {allScopes.map(scope => (
              <div key={scope.id} className="mb-4">
                <h4 className="font-medium">{scope.name}</h4>
                <table className="w-full text-sm">
                  <tbody>
                    {scope.sections?.flatMap(section => section.lineItems || []).map(item => (
                      <tr key={item.id} className={item.isExcluded ? 'line-through text-muted' : ''}>
                        <td>{item.name}</td>
                        <td className="text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
            {legacySections.map(section => (
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