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
  AlertTriangle, Calculator, X, Eye, Archive, FolderOpen, CheckSquare,
  MoreHorizontal, Edit3, RotateCcw, FileCheck, Briefcase
} from 'lucide-react';
import { renderEmailHTML, renderEmailAll } from '../../utils/emailTemplates';

export function EstimateBuilder() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { branding, estimates, customers, materials, laborRates, assemblies, templates, projectTypeTemplates, addEstimate, updateEstimate, deleteEstimate, duplicateEstimate, archiveEstimate, convertEstimateToJob, getEstimateCustomer, sendEmail } = useApp();
  const { showToast } = useToast();
  
  const isNew = id === 'new';
  const estimateList = estimates || [];
  const estimate = (isNew || !id) ? null : estimateList.find(e => e.id === id);
  const customer = estimate ? getEstimateCustomer(estimate.id) : undefined;
  
  const [showNewEstimateModal, setShowNewEstimateModal] = useState(isNew);
  
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

  const [showAddScope, setShowAddScope] = useState(false);
  const [showAddSection, setShowAddSection] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAssemblyPicker, setShowAssemblyPicker] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showProposal, setShowProposal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ email: '', subject: '', body: '' });
  const [emailAllPreview, setEmailAllPreview] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [showEmailAllPreview, setShowEmailAllPreview] = useState(false);
  const [emailHtmlPreview, setEmailHtmlPreview] = useState<{ subject: string; html: string } | null>(null);
  const [emailHtmlOpen, setEmailHtmlOpen] = useState(false);

  const handlePrint = () => window.print();

  const handleEmailWithFallback = (subject: string, body: string, existingEmail?: string) => {
    if (existingEmail) {
      window.location.href = `mailto:${existingEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    } else {
      // Build a universal HTML/Plaintext email using branding
      const brandingLocal = branding as any;
      try {
        const tmpl = renderEmailAll('estimate', brandingLocal, { estimate, customer, totals: { total: (typeof totals?.total === 'number' ? totals.total : 0) } });
        setEmailForm({ email: customer?.email ?? '', subject: tmpl.subject, body: tmpl.text });
        setEmailHtmlPreview({ subject: tmpl.subject, html: tmpl.html });
        setEmailAllPreview({ subject: tmpl.subject, html: tmpl.html, text: tmpl.text });
        setShowEmailModal(true);
        setShowEmailAllPreview(true);
      } catch {
        setEmailHtmlPreview(null);
      }
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.email) { showToast('Enter email address', 'error'); return; }
    // Try SMTP-based delivery first; fall back to mailto if unavailable
    const result = await sendEmail({ to: emailForm.email, subject: emailForm.subject, text: emailForm.body, html: emailHtmlPreview?.html });
    if (!result) {
      window.location.href = `mailto:${emailForm.email}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.body)}`;
    }
    setShowEmailModal(false);
    setEmailForm({ email: '', subject: '', body: '' });
  };

  const [selectedTemplate, setSelectedTemplate] = useState<ProjectTypeTemplate | null>(null);
  const [selectedTemplateItems, setSelectedTemplateItems] = useState<Record<string, boolean>>({});
  const [checklistQuantities, setChecklistQuantities] = useState<Record<string, number>>({});
  const [templatePickerStep, setTemplatePickerStep] = useState<'select' | 'items'>('select');
  
  const [activeScopeId, setActiveScopeId] = useState<string | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<EstimateLineItem | null>(null);
  const [editingScope, setEditingScope] = useState<EstimateScope | null>(null);
  const [editingSection, setEditingSection] = useState<EstimateSection | null>(null);
  
  const [newSectionName, setNewSectionName] = useState('');
  const [newScopeName, setNewScopeName] = useState('');
  const [itemForm, setItemForm] = useState({
    name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
    category: 'material' as EstimateLineCategory, isLabor: false, hours: '0',
    isOptional: false, isExcluded: false, isAllowance: false, notes: '',
    materialCost: '0', laborCost: '0', markup: '0',
  });

  const allScopes = estimate?.scopes ?? [];
  const legacySections = estimate?.sections ?? [];
  
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

  useEffect(() => {
    if (id && id !== 'new' && estimate) {
      setFormData({
        name: estimate.name,
        customerId: estimate.customerId,
        address: estimate.address || '',
        status: estimate.status,
        type: estimate.type || '',
        markupPercent: estimate.markupPercent?.toString() || '20',
        taxable: estimate.taxable || 'none',
        notes: estimate.notes || '',
        validUntil: estimate.validUntil || '',
      });
    }
  }, [id]);

  const handleCreateNewEstimate = async () => {
    if (!formData.name || !formData.customerId) {
      showToast('Name and customer are required', 'error');
      return;
    }
    
    const estList = estimates || [];
    const estNumber = `EST-${new Date().getFullYear()}-${String(estList.length + 1).padStart(3, '0')}`;
    
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const newId = await addEstimate({
      estimateNumber: estNumber,
      customerId: formData.customerId,
      name: formData.name,
      address: formData.address,
      type: formData.type as JobType,
      status: 'draft',
      sections: [],
      scopes: [],
      markupPercent: parseFloat(formData.markupPercent) || 20,
      taxable: formData.taxable as EstimateTaxable,
      notes: formData.notes,
      validUntil: formData.validUntil,
    });
    
    showToast('Estimate created');
    navigate('/estimates');
  };

  const handleSave = () => {
    if (!formData.name || !formData.customerId) {
      showToast('Name and customer are required', 'error');
      return;
    }
    
    updateEstimate(estimate!.id, {
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

  const handleDeleteSection = (sectionId: string) => {
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return { ...scope, sections: scope.sections?.filter(s => s.id !== sectionId) || [] };
        }
        return scope;
      });
      updateEstimate(estimate!.id, { scopes: updatedScopes });
    } else {
      updateEstimate(estimate!.id, {
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
          quantity: (checklistQuantities[item.id] || item.quantity),
          unit: item.unit,
          unitPrice: item.unitPrice,
          category: item.category as EstimateLineCategory,
          isLabor: item.isLabor || false,
          hours: item.isLabor ? (checklistQuantities[item.id] || item.quantity) : undefined,
          total: (checklistQuantities[item.id] || item.quantity) * item.unitPrice,
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
    
    updateEstimate(estimate!.id, {
      scopes: [...allScopes, newScope],
    });
    
    setNewScopeName('');
    setSelectedTemplate(null);
    setSelectedTemplateItems({});
    setChecklistQuantities({});
    setTemplatePickerStep('select');
    setShowAddScope(false);
    setActiveScopeId(newScope.id);
    showToast('Scope added');
  };

  const handleDeleteScope = (scopeId: string) => {
    updateEstimate(estimate!.id, {
      scopes: allScopes.filter(s => s.id !== scopeId),
    });
    if (activeScopeId === scopeId) {
      setActiveScopeId(null);
    }
    showToast('Scope deleted');
  };

  const handleDuplicateScope = (scope: EstimateScope) => {
    const newScope: EstimateScope = {
      ...scope,
      id: crypto.randomUUID(),
      name: `${scope.name} (Copy)`,
      sections: scope.sections?.map(s => ({
        ...s,
        id: crypto.randomUUID(),
        lineItems: s.lineItems?.map(item => ({
          ...item,
          id: crypto.randomUUID(),
        })) || [],
      })) || [],
      sortOrder: allScopes.length,
    };
    
    updateEstimate(estimate!.id, {
      scopes: [...allScopes, newScope],
    });
    showToast('Scope duplicated');
  };

  const handleUpdateScopeName = (scopeId: string, newName: string) => {
    if (!newName.trim()) return;
    const updatedScopes = allScopes.map(s => s.id === scopeId ? { ...s, name: newName } : s);
    updateEstimate(estimate!.id, { scopes: updatedScopes });
    setEditingScope(null);
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
      updateEstimate(estimate!.id, { scopes: updatedScopes });
    } else {
      updateEstimate(estimate!.id, {
        sections: [...legacySections, newSection],
      });
    }
    
    setNewSectionName('');
    setShowAddSection(false);
    setActiveSectionId(newSection.id);
    showToast('Section added');
  };

  const handleUpdateSectionName = (sectionId: string, newName: string) => {
    if (!newName.trim()) return;
    if (activeScopeId) {
      const updatedScopes = allScopes.map(scope => {
        if (scope.id === activeScopeId) {
          return {
            ...scope,
            sections: scope.sections?.map(s => s.id === sectionId ? { ...s, name: newName } : s) || [],
          };
        }
        return scope;
      });
      updateEstimate(estimate!.id, { scopes: updatedScopes });
    } else {
      const updatedSections = legacySections.map(s => s.id === sectionId ? { ...s, name: newName } : s);
      updateEstimate(estimate!.id, { sections: updatedSections });
    }
    setEditingSection(null);
  };

  const handleAddItem = () => {
    if (!itemForm.name.trim()) return;
    
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
      updateEstimate(estimate!.id, { scopes: updatedScopes });
    } else {
      const updatedSections = legacySections.map(s => {
        if (s.id === activeSectionId) {
          return { ...s, lineItems: [...(s.lineItems || []), newItem] };
        }
        return s;
      });
      updateEstimate(estimate!.id, { sections: updatedSections });
    }
    
    setItemForm({
      name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
      category: 'material', isLabor: false, hours: '0',
      isOptional: false, isExcluded: false, isAllowance: false, notes: '',
      materialCost: '0', laborCost: '0', markup: '0',
    });
    setShowAddItem(false);
    showToast('Item added');
  };

  const handleUpdateItem = () => {
    if (!editingItem) return;
    
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
      updateEstimate(estimate!.id, { scopes: updatedScopes });
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
      updateEstimate(estimate!.id, { sections: updatedSections });
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
      updateEstimate(estimate!.id, { scopes: updatedScopes });
    } else {
      const updatedSections = legacySections.map(s => {
        if (s.id === activeSectionId) {
          return { ...s, lineItems: s.lineItems?.filter(i => i.id !== itemId) || [] };
        }
        return s;
      });
      updateEstimate(estimate!.id, { sections: updatedSections });
    }
    showToast('Item deleted');
  };

  const handleInsertAssembly = (assembly: any) => {
    const newItems: EstimateLineItem[] = assembly.items?.map((item: any) => ({
      id: crypto.randomUUID(),
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || 'ea',
      unitPrice: item.unitPrice,
      category: item.category,
      isLabor: item.category === 'labor',
      hours: item.laborHours ? item.laborHours * item.quantity : undefined,
      total: item.quantity * item.unitPrice,
    })) || [];
    
    if (activeScopeId && activeSectionId) {
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
      updateEstimate(estimate!.id, { scopes: updatedScopes });
    } else if (activeSectionId) {
      const updatedSections = legacySections.map(s => {
        if (s.id === activeSectionId) {
          return { ...s, lineItems: [...(s.lineItems || []), ...newItems] };
        }
        return s;
      });
      updateEstimate(estimate!.id, { sections: updatedSections });
    }
    setShowAssemblyPicker(false);
    showToast('Assembly inserted');
  };

  const handleChecklistSelectTemplate = (template: ProjectTypeTemplate) => {
    setSelectedTemplate(template);
    const defaults: Record<string, boolean> = {};
    const quantities: Record<string, number> = {};
    template.sections?.forEach(ts => {
      ts.items?.forEach(item => {
        defaults[item.id] = item.isDefaultChecked || false;
        quantities[item.id] = item.quantity;
      });
    });
    setSelectedTemplateItems(defaults);
    setChecklistQuantities(quantities);
    setTemplatePickerStep('items');
    setShowChecklist(true);
  };

  const handleChecklistToggleItem = (itemId: string) => {
    setSelectedTemplateItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleChecklistQuantityChange = (itemId: string, qty: number) => {
    setChecklistQuantities(prev => ({
      ...prev,
      [itemId]: qty,
    }));
  };

  const handleAddChecklistItems = () => {
    if (!selectedTemplate || !activeScopeId) return;
    
    const templateSections = selectedTemplate.sections || [];
    const scope = allScopes.find(s => s.id === activeScopeId);
    if (!scope) return;
    
    const existingSectionNames = new Set(scope.sections?.map(s => s.name));
    const newSections: EstimateSection[] = [];
    
    templateSections.forEach(ts => {
      const itemsToAdd = ts.items
        .filter(item => selectedTemplateItems[item.id])
        .map(item => ({
          id: crypto.randomUUID(),
          name: item.name,
          description: item.description,
          quantity: checklistQuantities[item.id] || item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          category: item.category as EstimateLineCategory,
          isLabor: item.isLabor || false,
          hours: item.isLabor ? (checklistQuantities[item.id] || item.quantity) : undefined,
          total: (checklistQuantities[item.id] || item.quantity) * item.unitPrice,
          isOptional: item.isOptional,
          isAllowance: item.isAllowance,
        }));
      
      if (itemsToAdd.length > 0) {
        if (existingSectionNames.has(ts.name)) {
          const existingSection = scope.sections?.find(s => s.name === ts.name);
          if (existingSection) {
            const updatedScopes = allScopes.map(s => {
              if (s.id === activeScopeId) {
                return {
                  ...s,
                  sections: s.sections?.map(sec => 
                    sec.name === ts.name 
                      ? { ...sec, lineItems: [...(sec.lineItems || []), ...itemsToAdd] }
                      : sec
                  ) || [],
                };
              }
              return s;
            });
            updateEstimate(estimate!.id, { scopes: updatedScopes });
          }
        } else {
          newSections.push({
            id: crypto.randomUUID(),
            name: ts.name,
            description: ts.description,
            lineItems: itemsToAdd,
            sortOrder: ts.sortOrder,
          });
        }
      }
    });
    
    if (newSections.length > 0) {
      const updatedScopes = allScopes.map(s => {
        if (s.id === activeScopeId) {
          return { ...s, sections: [...(s.sections || []), ...newSections] };
        }
        return s;
      });
      updateEstimate(estimate!.id, { scopes: updatedScopes });
    }
    
    setShowChecklist(false);
    setSelectedTemplateItems({});
    setChecklistQuantities({});
    showToast('Items added');
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
        materialCost: '0',
        laborCost: '0',
        markup: '0',
      });
    } else {
      setEditingItem(null);
      setItemForm({
        name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
        category: 'material', isLabor: false, hours: '0',
        isOptional: false, isExcluded: false, isAllowance: false, notes: '',
        materialCost: '0', laborCost: '0', markup: '0',
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

  if (!estimate) {
    return (
      <div className="estimate-builder">
        <div className="page-header">
          <h1 className="page-title">New Estimate</h1>
        </div>
        <div className="page-content">
          <div className="card" style={{ maxWidth: '600px' }}>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">Estimate Name *</label>
                <input className="form-input" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Smith Kitchen Remodel" />
              </div>
              <div className="form-group">
                <label className="form-label">Customer *</label>
                <select className="form-select" value={formData.customerId} onChange={e => setFormData({ ...formData, customerId: e.target.value })}>
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Project Address</label>
                <input className="form-input" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} placeholder="Project address" />
              </div>
              <div className="grid-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Project Type</label>
                  <select className="form-select" value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value as JobType })}>
                    {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Markup %</label>
                  <input className="form-input" type="number" value={formData.markupPercent} onChange={e => setFormData({ ...formData, markupPercent: e.target.value })} />
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

  return (
    <div className="estimate-builder">
      {/* HEADER BAR */}
      <div className="page-header flex justify-between items-center bg-white border-b sticky top-0 z-50 px-6 py-3">
        <div className="flex items-center gap-4">
          <Link to="/estimates" className="btn btn-icon">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex items-center gap-3">
            <input
              className="text-xl font-semibold bg-transparent border-none outline-none hover:border hover:border-gray-300 rounded px-2 py-1"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
            />
            <span className={`badge ${getStatusBadge(estimate.status)}`}>
              {estimate.status.replace('_', ' ')}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn btn-secondary" onClick={() => setShowProposal(true)}>
            <Eye size={16} /> Preview
          </button>
          <button className="btn btn-secondary" onClick={handlePrint}>
            <FileText size={16} /> Print
          </button>
          <button className="btn btn-secondary" onClick={() => {
            // Email with branding signature if available
            const brandingSig = branding?.brandName ? `\n\n${branding.brandName}` + (branding.logoUrl ? `\n${branding.logoUrl}` : '') : '';
            const subjectText = `Estimate: ${estimate.name}`;
            const bodyBase = `Hi ${customer?.name || 'Customer'},\n\nPlease find attached the estimate for ${estimate.name}.\n\nTotal: ${formatCurrency(totals.total)}\n\nValid until: ${estimate.validUntil || 'N/A'}\n\nLet me know if you have any questions.\n\nThanks,\nAllen's`;
            const body = bodyBase + brandingSig;
            handleEmailWithFallback(subjectText, body, customer?.email);
          }}>
            <Send size={16} /> Email
          </button>
          {estimate.status === 'draft' && (
            <button className="btn btn-secondary" onClick={() => updateEstimate(estimate.id, { status: 'sent' })}>
              <Send size={16} /> Mark Sent
            </button>
          )}
          {estimate.status === 'approved' && !estimate.convertedToJobId && (
            <button className="btn btn-success" onClick={() => setShowConvertConfirm(true)}>
              <Briefcase size={16} /> Convert to Job
            </button>
          )}
          {estimate.convertedToJobId && (
            <Link to={`/jobs/${estimate.convertedToJobId}`} className="btn btn-secondary">
              <FileCheck size={16} /> View Job
            </Link>
          )}
          <button className="btn btn-primary" onClick={handleSave}>
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      {/* STICKY SUMMARY BAR */}
      <div className="sticky top-[73px] z-40 bg-slate-800 text-white px-6 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-8">
          <div>
            <div className="text-xs text-slate-400">Total</div>
            <div className="text-2xl font-bold">{formatCurrency(totals.total)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Labor</div>
            <div className="text-lg">{formatCurrency(totals.laborTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Materials</div>
            <div className="text-lg">{formatCurrency(totals.materialTotal)}</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Markup ({estimate.markupPercent}%)</div>
            <div className="text-lg">{formatCurrency(totals.markupAmount)}</div>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-slate-400">
            {totals.itemsCount} items • {totals.hours}h labor
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="page-content p-6 print-area">
        {allScopes.length === 0 && legacySections.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-6xl mb-4">📋</div>
            <h2 className="text-2xl font-bold mb-2">Start Building Your Estimate</h2>
            <p className="text-muted mb-6">Add your first project scope to begin</p>
            <button className="btn btn-primary btn-lg" onClick={() => setShowAddScope(true)}>
              <Plus size={20} /> Add Project Scope
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* SCOPE CARDS */}
            {allScopes.map((scope, scopeIndex) => {
              const scopeTotals = getScopeTotals(scope);
              const isExpanded = activeScopeId === scope.id || activeScopeId === null;
              
              return (
                <div key={scope.id} className="scope-card border-2 border-blue-200 rounded-xl overflow-hidden">
                  {/* SCOPE HEADER */}
                  <div 
                    className="scope-header bg-blue-50 px-5 py-4 flex items-center justify-between cursor-pointer"
                    onClick={() => setActiveScopeId(activeScopeId === scope.id ? null : scope.id)}
                  >
                    <div className="flex items-center gap-4">
                      {editingScope?.id === scope.id ? (
                        <input
                          className="form-input font-semibold text-lg"
                          defaultValue={scope.name}
                          autoFocus
                          onBlur={e => handleUpdateScopeName(scope.id, e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleUpdateScopeName(scope.id, (e.target as HTMLInputElement).value)}
                          onClick={e => e.stopPropagation()}
                        />
                      ) : (
                        <h3 
                          className="font-semibold text-lg flex items-center gap-2"
                          onDoubleClick={e => { e.stopPropagation(); setEditingScope(scope); }}
                        >
                          {scope.name}
                        </h3>
                      )}
                      <span className="badge badge-blue">{scope.sections?.length || 0} sections</span>
                      <span className="badge badge-green text-lg py-1">{formatCurrency(scopeTotals.subtotal)}</span>
                    </div>
                    <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                      <button 
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleDuplicateScope(scope)}
                        title="Duplicate scope"
                      >
                        <Copy size={14} />
                      </button>
                      <button 
                        className="btn btn-sm btn-danger"
                        onClick={() => handleDeleteScope(scope.id)}
                        title="Delete scope"
                      >
                        <Trash2 size={14} />
                      </button>
                      {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </div>

                  {/* SCOPE CONTENT */}
                  {isExpanded && (
                    <div className="scope-content bg-white">
                      {/* CHECKLIST BUTTON */}
                      <div className="px-5 py-3 border-b flex items-center justify-between bg-slate-50">
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => { setActiveScopeId(scope.id); handleChecklistSelectTemplate(projectTypeTemplates[0]); }}
                        >
                          <CheckSquare size={14} /> Add from Checklist
                        </button>
                        <button 
                          className="btn btn-sm btn-primary"
                          onClick={() => { setActiveScopeId(scope.id); setShowAddSection(true); }}
                        >
                          <Plus size={14} /> Add Section
                        </button>
                      </div>

                      {/* SECTIONS */}
                      <div className="sections p-5 space-y-4">
                        {scope.sections?.map((section, sectionIndex) => {
                          const sectionTotals = getScopeTotals({ ...scope, sections: [section] });
                          const isSectionExpanded = activeSectionId === section.id;
                          
                          return (
                            <div key={section.id} className="section-card border rounded-lg">
                              {/* SECTION HEADER */}
                              <div 
                                className="section-header bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer"
                                onClick={() => { setActiveScopeId(scope.id); setActiveSectionId(activeSectionId === section.id ? null : section.id); }}
                              >
                                <div className="flex items-center gap-3">
                                  {editingSection?.id === section.id ? (
                                    <input
                                      className="form-input font-medium"
                                      defaultValue={section.name}
                                      autoFocus
                                      onBlur={e => handleUpdateSectionName(section.id, e.target.value)}
                                      onKeyDown={e => e.key === 'Enter' && handleUpdateSectionName(section.id, (e.target as HTMLInputElement).value)}
                                      onClick={e => e.stopPropagation()}
                                    />
                                  ) : (
                                    <h4 
                                      className="font-medium flex items-center gap-2"
                                      onDoubleClick={e => { e.stopPropagation(); setActiveScopeId(scope.id); setEditingSection(section); }}
                                    >
                                      {section.name}
                                    </h4>
                                  )}
                                  <span className="badge badge-gray">{section.lineItems?.length || 0} items</span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className="font-medium text-slate-600">{formatCurrency(sectionTotals.subtotal)}</span>
                                  <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                    <button 
                                      className="btn btn-sm btn-icon"
                                      onClick={() => { setActiveScopeId(scope.id); setActiveSectionId(section.id); openItemEditor(undefined, section.id); }}
                                    >
                                      <Plus size={14} />
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-icon"
                                      onClick={() => { setActiveScopeId(scope.id); setActiveSectionId(section.id); setShowAssemblyPicker(true); }}
                                    >
                                      <Package size={14} />
                                    </button>
                                    <button 
                                      className="btn btn-sm btn-icon btn-danger"
                                      onClick={() => { setActiveScopeId(scope.id); handleDeleteSection(section.id); }}
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                    {isSectionExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                  </div>
                                </div>
                              </div>

                              {/* SECTION CONTENT */}
                              {isSectionExpanded && (
                                <div className="section-content p-4">
                                  {!section.lineItems?.length ? (
                                    <div className="text-center py-6 text-muted">
                                      No items yet. Add items or assemblies.
                                    </div>
                                  ) : (
                                    <table className="w-full">
                                      <thead>
                                        <tr className="text-xs text-muted border-b">
                                          <th className="text-left py-2">Item</th>
                                          <th className="text-right py-2 w-20">Qty</th>
                                          <th className="text-left py-2 w-20">Unit</th>
                                          <th className="text-right py-2 w-24">Unit Price</th>
                                          <th className="text-right py-2 w-24">Total</th>
                                          <th className="w-20"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {section.lineItems?.map(item => (
                                          <tr key={item.id} className={`border-b hover:bg-slate-50 ${item.isExcluded ? 'opacity-50 line-through' : ''}`}>
                                            <td className="py-2">
                                              <div className="font-medium">{item.name}</div>
                                              {item.description && (
                                                <div className="text-xs text-muted">{item.description}</div>
                                              )}
                                              <div className="flex gap-1 mt-1">
                                                {item.isOptional && <span className="badge badge-yellow text-xs">Optional</span>}
                                                {item.isExcluded && <span className="badge badge-red text-xs">Excluded</span>}
                                                {item.isAllowance && <span className="badge badge-blue text-xs">Allowance</span>}
                                              </div>
                                            </td>
                                            <td className="text-right py-2">{item.quantity}</td>
                                            <td className="text-left py-2">{item.unit}</td>
                                            <td className="text-right py-2">{formatCurrency(item.unitPrice)}</td>
                                            <td className="text-right py-2 font-medium">{formatCurrency(item.total)}</td>
                                            <td className="py-2">
                                              <div className="flex gap-1 justify-end">
                                                <button 
                                                  className="btn btn-sm btn-icon"
                                                  onClick={() => { setActiveScopeId(scope.id); setActiveSectionId(section.id); openItemEditor(item, section.id); }}
                                                >
                                                  <Edit3 size={14} />
                                                </button>
                                                <button 
                                                  className="btn btn-sm btn-icon btn-danger"
                                                  onClick={() => { setActiveScopeId(scope.id); setActiveSectionId(section.id); handleDeleteItem(item.id); }}
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
                          );
                        })}

                        {(!scope.sections || scope.sections.length === 0) && (
                          <div className="text-center py-6 border-2 border-dashed rounded-lg">
                            <p className="text-muted mb-3">No sections yet</p>
                            <button 
                              className="btn btn-primary"
                              onClick={() => { setActiveScopeId(scope.id); setShowAddSection(true); }}
                            >
                              <Plus size={16} /> Add Section
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* LEGACY SECTIONS */}
            {legacySections.length > 0 && (
              <div className="mt-8">
                <h3 className="font-medium text-muted mb-4">Legacy Sections</h3>
                <div className="space-y-4">
                  {legacySections.map((section) => (
                    <div key={section.id} className="section-card border rounded-lg">
                      <div 
                        className="section-header bg-gray-50 px-4 py-3 flex items-center justify-between cursor-pointer"
                        onClick={() => setActiveSectionId(activeSectionId === section.id ? null : section.id)}
                      >
                        <div className="flex items-center gap-3">
                          <h4 className="font-medium">{section.name}</h4>
                          <span className="badge badge-gray">{section.lineItems?.length || 0} items</span>
                        </div>
                        {activeSectionId === section.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </div>
                      {activeSectionId === section.id && (
                        <div className="p-4 border-t">
                          <div className="flex justify-end mb-3 gap-2">
                            <button className="btn btn-sm btn-primary" onClick={() => openItemEditor(undefined, section.id)}>
                              <Plus size={14} /> Add Item
                            </button>
                            <button className="btn btn-sm btn-danger" onClick={() => handleDeleteSection(section.id)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                          {section.lineItems?.length ? (
                            <table className="w-full">
                              <tbody>
                                {section.lineItems?.map(item => (
                                  <tr key={item.id} className="border-b">
                                    <td className="py-2">{item.name}</td>
                                    <td className="text-right">{item.quantity} {item.unit}</td>
                                    <td className="text-right">{formatCurrency(item.total)}</td>
                                    <td className="text-right">
                                      <button className="btn btn-sm btn-icon" onClick={() => openItemEditor(item, section.id)}>
                                        <Edit3 size={14} />
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <div className="text-center py-4 text-muted">No items</div>
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

        {/* FLOATING QUICK ADD */}
        <div className="fixed bottom-6 right-6 z-50">
          <div className="relative group">
            <button className="btn btn-primary btn-lg rounded-full w-14 h-14 flex items-center justify-center shadow-lg">
              <Plus size={24} />
            </button>
            <div className="absolute bottom-14 right-0 mb-2 space-y-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto">
              <button className="btn btn-secondary w-full justify-end" onClick={() => setShowAddScope(true)}>
                <CheckSquare size={16} /> Add Scope
              </button>
              <button className="btn btn-secondary w-full justify-end" onClick={() => setShowAddSection(true)}>
                <FolderOpen size={16} /> Add Section
              </button>
              <button className="btn btn-secondary w-full justify-end" onClick={() => setShowAddItem(true)}>
                <Plus size={16} /> Add Item
              </button>
              <button className="btn btn-secondary w-full justify-end" onClick={() => setShowAssemblyPicker(true)}>
                <Package size={16} /> Add Assembly
              </button>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex justify-between text-sm text-muted mt-8 pt-4 border-t">
          <div>Created {formatDate(estimate.createdAt)}</div>
          <div>Updated {formatDate(estimate.updatedAt)}</div>
        </div>
      </div>

      {/* MODALS */}
      <Modal isOpen={showAddScope} onClose={() => { setShowAddScope(false); setSelectedTemplate(null); setTemplatePickerStep('select'); }} title="Add Project Scope" size="lg">
        {templatePickerStep === 'select' ? (
          <>
            <div className="form-group">
              <label className="form-label">Scope Name *</label>
              <input
                className="form-input"
                value={newScopeName}
                onChange={e => setNewScopeName(e.target.value)}
                placeholder="e.g., Kitchen, Master Bath, Flooring"
              />
            </div>
            <div className="form-group">
              <label className="form-label">How would you like to create this scope?</label>
              <div className="space-y-2">
                <button
                  className="w-full text-left p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50"
                  onClick={() => {
                    if (!newScopeName.trim()) {
                      showToast('Please enter a scope name', 'error');
                      return;
                    }
                    const newScope: EstimateScope = {
                      id: crypto.randomUUID(),
                      name: newScopeName,
                      projectType: 'remodel',
                      sections: [],
                      subtotal: 0,
                      isOptional: false,
                      sortOrder: allScopes.length,
                    };
                    updateEstimate(estimate!.id, {
                      scopes: [...allScopes, newScope],
                    });
                    setNewScopeName('');
                    setShowAddScope(false);
                    setActiveScopeId(newScope.id);
                    showToast('Scope created');
                  }}
                >
                  <div className="font-medium">Create Empty Scope</div>
                  <div className="text-sm text-muted">Start with a blank scope and add items manually</div>
                </button>
                <div className="text-center text-muted my-2">— or select a template —</div>
                {projectTypeTemplates.length === 0 ? (
                  <div className="text-center py-4 text-muted">No templates available.</div>
                ) : (
                  projectTypeTemplates.map(template => (
                    <button
                      key={template.id}
                      className="w-full text-left p-4 border rounded-lg hover:bg-gray-50"
                      onClick={() => {
                        if (!newScopeName.trim()) {
                          showToast('Please enter a scope name', 'error');
                          return;
                        }
                        setSelectedTemplate(template);
                        const defaults: Record<string, boolean> = {};
                        const quantities: Record<string, number> = {};
                        template.sections?.forEach(ts => {
                          ts.items?.forEach(item => {
                            defaults[item.id] = item.isDefaultChecked || false;
                            quantities[item.id] = item.quantity;
                          });
                        });
                        setSelectedTemplateItems(defaults);
                        setChecklistQuantities(quantities);
                        setTemplatePickerStep('items');
                      }}
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
              <div className="text-sm text-muted mb-2">Check items to include. Default items are pre-selected.</div>
              <div className="max-h-96 overflow-y-auto space-y-4">
                {selectedTemplate?.sections?.map(section => (
                  <div key={section.id} className="border rounded-lg p-3">
                    <div className="font-medium mb-2">{section.name}</div>
                    {section.description && <div className="text-sm text-muted mb-2">{section.description}</div>}
                    <div className="space-y-2">
                      {section.items?.map(item => (
                        <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                          <input
                            type="checkbox"
                            checked={selectedTemplateItems[item.id] || false}
                            onChange={() => handleChecklistToggleItem(item.id)}
                          />
                          <input
                            type="number"
                            className="form-input w-20"
                            value={checklistQuantities[item.id] || item.quantity}
                            onChange={e => handleChecklistQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                          />
                          <div className="flex-1">
                            <div className="font-medium text-sm">{item.name}</div>
                            {item.description && <div className="text-xs text-muted">{item.description}</div>}
                          </div>
                          <div className="text-sm text-muted">
                            {item.unit} × {formatCurrency(item.unitPrice)}
                          </div>
                        </div>
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

      <Modal isOpen={showAddSection} onClose={() => setShowAddSection(false)} title="Add Section">
        <div className="form-group">
          <label className="form-label">Section Name</label>
          <input
            className="form-input"
            value={newSectionName}
            onChange={e => setNewSectionName(e.target.value)}
            placeholder="e.g., Demolition, Electrical, Plumbing"
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
                <div className="text-xs text-muted mt-1">{assembly.items?.length} items</div>
              </button>
            ))
          )}
        </div>
      </Modal>

      <Modal isOpen={showChecklist} onClose={() => setShowChecklist(false)} title="Smart Checklist" size="lg">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-medium">{selectedTemplate?.name}</span>
          <span className="badge badge-blue">{activeScopeId ? allScopes.find(s => s.id === activeScopeId)?.name : ''}</span>
        </div>
        <div className="max-h-[60vh] overflow-y-auto space-y-4">
          {selectedTemplate?.sections?.map(section => (
            <div key={section.id} className="border rounded-lg p-3">
              <div className="font-medium mb-2">{section.name}</div>
              <div className="space-y-2">
                {section.items?.map(item => (
                  <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedTemplateItems[item.id] || false}
                      onChange={() => handleChecklistToggleItem(item.id)}
                    />
                    <input
                      type="number"
                      className="form-input w-20"
                      value={checklistQuantities[item.id] || item.quantity}
                      onChange={e => handleChecklistQuantityChange(item.id, parseFloat(e.target.value) || 0)}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.name}</div>
                      {item.description && <div className="text-xs text-muted">{item.description}</div>}
                    </div>
                    <div className="text-sm text-muted">
                      {item.unit} × {formatCurrency(item.unitPrice)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowChecklist(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleAddChecklistItems}>Add Selected Items</button>
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

      <Modal isOpen={showEmailModal} onClose={() => setShowEmailModal(false)} title="Send Email">
        <div className="form-group">
          <label className="form-label">To *</label>
          <input className="form-input" type="email" value={emailForm.email} onChange={e => setEmailForm({...emailForm, email: e.target.value})} placeholder="customer@email.com" />
        </div>
        <div className="form-group">
          <label className="form-label">Subject</label>
          <input className="form-input" value={emailForm.subject} onChange={e => setEmailForm({...emailForm, subject: e.target.value})} />
        </div>
        <div className="form-group">
          <label className="form-label">Message</label>
          <textarea className="form-textarea" value={emailForm.body} onChange={e => setEmailForm({...emailForm, body: e.target.value})} />
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <button className="btn btn-secondary" onClick={() => setShowEmailModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSendEmail}>Open Email</button>
        </div>
      </Modal>

      <Modal isOpen={showEmailAllPreview} onClose={() => { setShowEmailAllPreview(false); }} title="Email Preview" size="lg">
        {emailAllPreview && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="branding-preview" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderBottom: '1px solid #ddd' }}>
              {branding.brandName && <strong>{branding.brandName}</strong>}
              {branding.logoUrl || branding.logoDataUrl ? (
                <img src={branding.logoUrl || branding.logoDataUrl} alt="logo" style={{ height: 20 }} />
              ) : null}
            </div>
            <div><strong>Subject:</strong> {emailAllPreview.subject}</div>
            <div style={{ display: 'flex', gap: 12 }}>
              <iframe title="Email HTML" srcDoc={emailAllPreview.html} style={{ width: '100%', height: 300, border: '1px solid #ddd', borderRadius: 6 }} />
            </div>
            <div>
              <strong>Plaintext</strong>
              <textarea className="form-textarea" value={emailAllPreview.text} readOnly style={{ width: '100%', height: 120 }} />
            </div>
            <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
              <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(emailAllPreview.html)}>Copy HTML</button>
              <button className="btn btn-secondary" onClick={() => navigator.clipboard.writeText(emailAllPreview.text)}>Copy Text</button>
              <button className="btn btn-primary" onClick={() => { window.location.href = `mailto:${emailForm.email || ''}?subject=${encodeURIComponent(emailAllPreview.subject)}&body=${encodeURIComponent(emailAllPreview.text)}`; }}>Open Email</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => { deleteEstimate(estimate!.id); navigate('/estimates'); }}
        title="Delete Estimate?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        danger
      />

      <ConfirmDialog
        isOpen={showConvertConfirm}
        onClose={() => setShowConvertConfirm(false)}
        onConfirm={() => {
          const jobId = convertEstimateToJob(estimate!.id);
          if (jobId) {
            showToast('Estimate converted to job!', 'success');
            navigate(`/jobs/${jobId}`);
          }
        }}
        title="Convert to Job?"
        message="This will create a new job from this estimate."
        confirmLabel="Convert"
      />
    </div>
  );
}
