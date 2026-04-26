import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../../data/types';
import type { Estimate, EstimateScope, EstimateSection, EstimateLineItem, EstimateLineCategory, Customer, JobType, EstimateStatus, Assembly, Material, LaborRate, Template } from '../../data/types';
import { useToast } from '../../components/common/Toast';
import { Modal } from '../../components/common/Modal';
import { getEstimateSuggestions } from '../../utils/insights';
import { PrintTemplateModal } from '../../components/print/PrintTemplateModal';
import { buildClientEstimatePrintData } from '../../utils/buildPrintData';
import { renderEmailAll } from '../../utils/emailTemplates';
import {
  Plus, Trash2, Save, Send, ArrowLeft, Copy, FileText, Printer,
  Package, Clock, DollarSign, ChevronDown, ChevronUp,
  Calculator, X, Eye, CheckSquare, Search, Zap, Briefcase,
  Users, Wrench, Truck, Home, Building, Building2, LayoutGrid,
  EyeOff, RotateCcw, CheckCircle, Edit3, AlertTriangle
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
  const { branding, estimates, customers, materials, laborRates, assemblies, templates, projectTypeTemplates, jobs, expenses, timeEntries, addCustomer, addEstimate, updateEstimate, getEstimateCustomer, convertEstimateToJob, sendEmail, addTemplate, updateTemplate, addAssembly, updateAssembly } = useApp();
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
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [showProjectTypePicker, setShowProjectTypePicker] = useState(!estimate?.type);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showAssemblyPicker, setShowAssemblyPicker] = useState(false);
  const [assemblySearch, setAssemblySearch] = useState('');
  const [assemblyCategory, setAssemblyCategory] = useState('all');
  const [assemblyTarget, setAssemblyTarget] = useState<{ scopeId?: string; sectionId?: string } | null>(null);
  const [showPricePicker, setShowPricePicker] = useState(false);
  const [priceSearch, setPriceSearch] = useState('');
  const [pricePickerTab, setPricePickerTab] = useState<'materials' | 'labor' | 'equipment' | 'subcontractors'>('materials');
  const [priceTarget, setPriceTarget] = useState<{ scopeId?: string; sectionId?: string } | null>(null);
  const [acceptedSuggestionIds, setAcceptedSuggestionIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<{ item?: EstimateLineItem; sectionId: string } | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: '', quantity: '1', unit: 'ea', unitPrice: '0', category: 'material' as EstimateLineCategory });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [convertOptions, setConvertOptions] = useState({ startDate: new Date().toISOString().split('T')[0], dueDate: '', copyLineItems: true, copyPricing: true, copyNotes: true });

  const defaultMarkup = parseFloat(formData.markupPercent) || 0;

  const getItemCost = (item: EstimateLineItem) => {
    return item.unitCost ?? item.unitPrice ?? 0;
  };

  const getItemMarkup = (item: EstimateLineItem) => {
    return item.markupPercent ?? defaultMarkup;
  };

  const getItemCostTotal = (item: EstimateLineItem) => {
    return (item.quantity || 0) * getItemCost(item);
  };

  const getItemPriceTotal = (item: EstimateLineItem) => {
    return getItemCostTotal(item) * (1 + getItemMarkup(item) / 100);
  };

  const normalizeLineItem = (item: EstimateLineItem, sourceType: EstimateLineItem['sourceType'] = item.sourceType || 'manual'): EstimateLineItem => {
    const unitCost = item.unitCost ?? item.unitPrice ?? 0;
    const category = (item.category || (item.isLabor ? 'labor' : 'material')) as EstimateLineCategory;
    const type = item.type || (category === 'allowance' ? 'other' : category);
    const markupPercent = item.markupPercent ?? defaultMarkup;
    const costTotal = (item.quantity || 0) * unitCost;
    const priceTotal = costTotal * (1 + markupPercent / 100);

    return {
      ...item,
      sourceType,
      category,
      type: type as EstimateLineItem['type'],
      unitCost,
      unitPrice: unitCost,
      markupPercent,
      costTotal,
      priceTotal,
      total: costTotal,
      clientVisible: item.clientVisible !== false,
      isLabor: item.isLabor || category === 'labor',
    };
  };

  useEffect(() => {
    if (!isNew || estimate) return;

    const rawTemplate = sessionStorage.getItem('buildops_template_draft');
    if (!rawTemplate) return;

    try {
      const template = JSON.parse(rawTemplate) as Template;
      const templateTypeText = `${template.name} ${template.scope || ''}`.toLowerCase();
      const inferredType = templateTypeText.includes('kitchen')
        ? 'remodel'
        : templateTypeText.includes('bath')
          ? 'remodel'
          : templateTypeText.includes('roof')
            ? 'repair'
            : templateTypeText.includes('addition')
              ? 'addition'
              : templateTypeText.includes('new build')
                ? 'new_build'
                : 'remodel';

      const templateLineItems: EstimateLineItem[] = (template.items || []).map((item, index) => normalizeLineItem({
        id: crypto.randomUUID(),
        sourceType: 'template',
        sourceId: template.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity || 1,
        unit: 'ea',
        unitPrice: item.unitPrice || 0,
        unitCost: item.unitPrice || 0,
        markupPercent: template.markupPercent || defaultMarkup,
        category: (item.isLabor ? 'labor' : item.category || 'material') as EstimateLineCategory,
        isLabor: item.isLabor,
        total: (item.quantity || 1) * (item.unitPrice || 0),
        sortOrder: index + 1,
      }, 'template'));
      const templateAssemblies = (template.assemblyIds || [])
        .map(assemblyId => assemblies?.find(assembly => assembly.id === assemblyId))
        .filter(Boolean) as Assembly[];
      const lineItems = [
        ...templateAssemblies.flatMap(assembly => assemblyToLineItems(assembly).map(item => ({
          ...item,
          sourceType: 'template' as const,
          sourceId: template.id,
          internalNotes: `Added from template ${template.name} via assembly ${assembly.name}`,
        }))),
        ...templateLineItems,
      ];

      setFormData(prev => ({
        ...prev,
        name: template.name,
        type: inferredType as JobType,
        markupPercent: String(template.markupPercent || 20),
        notes: [
          template.scope ? `Scope: ${template.scope}` : '',
          template.laborAssumptions ? `Labor: ${template.laborAssumptions}` : '',
          template.materialAssumptions ? `Materials: ${template.materialAssumptions}` : '',
        ].filter(Boolean).join('\n'),
      }));

      setScopes([{
        id: crypto.randomUUID(),
        name: template.name,
        projectType: inferredType as JobType,
        subtotal: lineItems.reduce((sum, item) => sum + item.total, 0),
        isOptional: false,
        sortOrder: 1,
        sections: [{
          id: crypto.randomUUID(),
          name: 'Template Scope',
          description: template.laborAssumptions || template.materialAssumptions,
          lineItems,
        }],
      }]);
    } catch {
      showToast('Could not load the selected template', 'error');
    } finally {
      sessionStorage.removeItem('buildops_template_draft');
    }
  }, [isNew, estimate, showToast]);

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

  const openAssemblyPicker = (target?: { scopeId?: string; sectionId?: string }) => {
    setAssemblyTarget(target || null);
    setAssemblySearch('');
    setShowAssemblyPicker(true);
  };

  const openPricePicker = (target?: { scopeId?: string; sectionId?: string }, tab: 'materials' | 'labor' | 'equipment' | 'subcontractors' = 'materials') => {
    setPriceTarget(target || null);
    setPricePickerTab(tab);
    setPriceSearch('');
    setShowPricePicker(true);
  };

  // Auto-save
  const buildCurrentEstimate = useCallback((): Estimate => {
    const totals = calculateTotals;
    const now = new Date().toISOString();
    return {
      ...(estimate || {}),
      ...formData,
      id: estimate?.id || 'draft',
      estimateNumber: estimate?.estimateNumber || `EST-${new Date().getFullYear()}-DRAFT`,
      customerId: formData.customerId,
      status: formData.status as EstimateStatus,
      type: formData.type as JobType,
      markupPercent: parseFloat(formData.markupPercent) || 0,
      scopes,
      sections: legacySections,
      taxable: estimate?.taxable || 'none',
      createdAt: estimate?.createdAt || now,
      updatedAt: estimate?.updatedAt || now,
      projectedLaborHours: totals.laborHours,
      projectedMaterialCost: totals.materialTotal,
      projectedLaborCost: totals.laborTotal,
      marginPercent: totals.profitPercent,
      marginAmount: totals.profit,
      ...totals,
    } as Estimate;
  }, [estimate, formData, scopes, legacySections]);

  const saveEstimate = useCallback((notify = false) => {
    if (isNew || !estimate) return false;
    const current = buildCurrentEstimate();
    updateEstimate(estimate!.id, {
      ...current,
    });
    setLastSaved(new Date());
    if (notify) showToast('Estimate saved');
    return true;
  }, [estimate, buildCurrentEstimate, isNew, updateEstimate, showToast]);

  useEffect(() => {
    if (!isNew && estimate) {
      const timer = setTimeout(saveEstimate, 2000);
      return () => clearTimeout(timer);
    }
  }, [formData, scopes, legacySections, saveEstimate, isNew, estimate]);

  // Calculate totals
  const calculateTotals = useMemo(() => {
    const allItems: EstimateLineItem[] = [];
    scopes.forEach(s => s.sections?.forEach(sec => sec.lineItems?.forEach(item => { if (!item.isExcluded) allItems.push(normalizeLineItem(item)); })));
    legacySections.forEach(sec => sec.lineItems?.forEach(item => { if (!item.isExcluded) allItems.push(normalizeLineItem(item)); }));

    const laborTotal = allItems.filter(i => i.isLabor || i.category === 'labor').reduce((s, i) => s + getItemCostTotal(i), 0);
    const materialTotal = allItems.filter(i => i.category === 'material' || i.category === 'allowance' || i.category === 'other').reduce((s, i) => s + getItemCostTotal(i), 0);
    const equipmentTotal = allItems.filter(i => i.category === 'equipment').reduce((s, i) => s + getItemCostTotal(i), 0);
    const subcontractorTotal = allItems.filter(i => i.category === 'subcontractor').reduce((s, i) => s + getItemCostTotal(i), 0);

    const subtotal = laborTotal + materialTotal + equipmentTotal + subcontractorTotal;
    const total = allItems.reduce((s, i) => s + getItemPriceTotal(i), 0);
    const markupAmount = total - subtotal;
    const laborHours = allItems.filter(i => i.isLabor || i.category === 'labor').reduce((s, i) => s + (i.hours || 0), 0);

    const internalCost = laborTotal + materialTotal + equipmentTotal + subcontractorTotal;
    const profit = total - internalCost;
    const profitPercent = total > 0 ? (profit / total) * 100 : 0;

    return { laborTotal, materialTotal, equipmentTotal, subcontractorTotal, subtotal, markupAmount, total, laborHours, internalCost, profit, profitPercent };
  }, [scopes, legacySections, formData.markupPercent]);

  const allEstimateItems = useMemo(() => {
    const items: EstimateLineItem[] = [];
    scopes.forEach(scope => scope.sections?.forEach(section => section.lineItems?.forEach(item => items.push(normalizeLineItem(item)))));
    legacySections.forEach(section => section.lineItems?.forEach(item => items.push(normalizeLineItem(item))));
    return items;
  }, [scopes, legacySections, formData.markupPercent]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, EstimateLineItem[]> = { labor: [], material: [], equipment: [], subcontractor: [], other: [] };
    allEstimateItems.filter(item => !item.isExcluded).forEach(item => {
      const key = item.category === 'allowance' ? 'other' : item.category;
      (groups[key] || groups.other).push(item);
    });
    return groups;
  }, [allEstimateItems]);

  const smartWarnings = useMemo(() => {
    const warnings: string[] = [];
    const defaultMarkupValue = parseFloat(formData.markupPercent) || 0;
    const visibleItems = allEstimateItems.filter(item => !item.isExcluded);

    if (visibleItems.some(item => getItemCost(item) === 0)) warnings.push('This estimate has items with $0 cost');
    if (visibleItems.some(item => (item.category === 'labor' || item.isLabor) && !(item.hours || item.quantity))) warnings.push('Labor is missing hours');
    if (defaultMarkupValue < 15) warnings.push('Markup is below your default target');
    if (visibleItems.some(item => item.clientVisible === false)) warnings.push('This estimate has items hidden from client view');
    if (visibleItems.some(item => {
      if (item.linkedMaterialId) {
        const material = materials?.find(m => m.id === item.linkedMaterialId);
        return material && item.priceBookSnapshot?.unitCost !== undefined && material.unitPrice !== item.priceBookSnapshot.unitCost;
      }
      if (item.linkedLaborRateId) {
        const rate = laborRates?.find(r => r.id === item.linkedLaborRateId);
        return rate && item.priceBookSnapshot?.unitCost !== undefined && rate.hourlyRate !== item.priceBookSnapshot.unitCost;
      }
      return false;
    })) warnings.push('Price Book rate has changed since an item was added');

    return warnings;
  }, [allEstimateItems, formData.markupPercent, materials, laborRates]);

  // Add scope
  const addScope = (name: string) => {
    const newScope: EstimateScope = { id: crypto.randomUUID(), name, projectType: formData.type as any, sections: [], subtotal: 0, isOptional: false, sortOrder: scopes.length };
    setScopes([...scopes, newScope]);
    setActiveScopeId(newScope.id);
  };

  const getAssemblyTotal = (assembly: Assembly) => {
    return assemblyToLineItems(assembly).reduce((sum, item) => sum + getItemCostTotal(item), 0);
  };

  const assemblyToLineItems = (assembly: Assembly): EstimateLineItem[] => {
    return (assembly.items || []).map((item, index) => {
      const material = item.linkedMaterialId ? materials?.find(m => m.id === item.linkedMaterialId) : undefined;
      const rate = item.linkedLaborRateId ? laborRates?.find(r => r.id === item.linkedLaborRateId) : undefined;
      const unitCost = rate?.hourlyRate ?? material?.unitPrice ?? item.unitPrice ?? 0;
      const category = (rate ? 'labor' : item.category) as EstimateLineCategory;

      return normalizeLineItem({
        id: crypto.randomUUID(),
        sourceType: 'assembly',
        sourceId: assembly.id,
        name: item.name || material?.name || rate?.name || assembly.name,
        description: item.description || material?.description || rate?.trade || assembly.name,
        quantity: item.quantity || 0,
        unit: item.unit || material?.unit || (rate ? 'hr' : 'ea'),
        unitCost,
        unitPrice: unitCost,
        category,
        type: category === 'allowance' ? 'other' : category as EstimateLineItem['type'],
        isLabor: category === 'labor',
        hours: category === 'labor' ? item.quantity : undefined,
        linkedMaterialId: item.linkedMaterialId,
        linkedLaborRateId: item.linkedLaborRateId,
        priceBookSnapshot: { unitCost, unitPrice: unitCost, name: material?.name || rate?.name || item.name },
        internalNotes: `Added from assembly: ${assembly.name}`,
        notes: `Assembly: ${assembly.name}`,
        sortOrder: index,
        total: (item.quantity || 0) * unitCost,
      }, 'assembly');
    });
  };

  const handleSelectAssembly = (assembly: Assembly) => {
    const lineItems = assemblyToLineItems(assembly);

    if (assemblyTarget?.sectionId) {
      setScopes(scopes.map(scope => ({
        ...scope,
        sections: scope.sections?.map(section => section.id === assemblyTarget.sectionId
          ? { ...section, lineItems: [...(section.lineItems || []), ...lineItems] }
          : section)
      })));
      setActiveSectionId(assemblyTarget.sectionId);
    } else if (assemblyTarget?.scopeId) {
      const newSection: EstimateSection = { id: crypto.randomUUID(), name: assembly.name, lineItems };
      setScopes(scopes.map(scope => scope.id === assemblyTarget.scopeId
        ? { ...scope, sections: [...(scope.sections || []), newSection] }
        : scope));
      setActiveScopeId(assemblyTarget.scopeId);
      setActiveSectionId(newSection.id);
    } else {
      const sectionId = crypto.randomUUID();
      const newScope: EstimateScope = {
        id: crypto.randomUUID(),
        name: assembly.name,
        projectType: formData.type as any,
        sections: [{ id: sectionId, name: assembly.name, lineItems }],
        subtotal: getAssemblyTotal(assembly),
        isOptional: false,
        sortOrder: scopes.length,
      };
      setScopes([...scopes, newScope]);
      setActiveScopeId(newScope.id);
      setActiveSectionId(sectionId);
    }

    setShowAssemblyPicker(false);
    setAssemblyTarget(null);
    setAssemblySearch('');
    showToast('Assembly added to estimate');
  };

  const filteredAssemblies = useMemo(() => {
    const term = assemblySearch.trim().toLowerCase();
    return (assemblies || [])
      .filter(assembly => assemblyCategory === 'all' || (assembly.category || '').toLowerCase() === assemblyCategory)
      .filter(assembly => !term ||
        assembly.name.toLowerCase().includes(term) ||
        assembly.category?.toLowerCase().includes(term) ||
        assembly.description?.toLowerCase().includes(term)
      );
  }, [assemblies, assemblySearch, assemblyCategory]);

  const assemblyCategories = useMemo(() => {
    return ['all', ...Array.from(new Set((assemblies || []).map(assembly => (assembly.category || 'uncategorized').toLowerCase())))];
  }, [assemblies]);

  const addPriceLineItem = (item: EstimateLineItem) => {
    if (priceTarget?.sectionId) {
      setScopes(scopes.map(scope => ({
        ...scope,
        sections: scope.sections?.map(section => section.id === priceTarget.sectionId
          ? { ...section, lineItems: [...(section.lineItems || []), item] }
          : section)
      })));
      setActiveSectionId(priceTarget.sectionId);
    } else if (priceTarget?.scopeId) {
      const sectionId = crypto.randomUUID();
      const newSection: EstimateSection = { id: sectionId, name: 'Price Book Items', lineItems: [item] };
      setScopes(scopes.map(scope => scope.id === priceTarget.scopeId
        ? { ...scope, sections: [...(scope.sections || []), newSection] }
        : scope));
      setActiveScopeId(priceTarget.scopeId);
      setActiveSectionId(sectionId);
    } else {
      const sectionId = crypto.randomUUID();
      const newScope: EstimateScope = {
        id: crypto.randomUUID(),
        name: 'Price Book Items',
        projectType: formData.type as any,
        sections: [{ id: sectionId, name: 'Price Book Items', lineItems: [item] }],
        subtotal: item.total,
        isOptional: false,
        sortOrder: scopes.length,
      };
      setScopes([...scopes, newScope]);
      setActiveScopeId(newScope.id);
      setActiveSectionId(sectionId);
    }

    setShowPricePicker(false);
    setPriceTarget(null);
    setPriceSearch('');
    showToast('Price book item added');
  };

  const handleSelectMaterial = (material: Material) => {
    const lowerCategory = (material.category || '').toLowerCase();
    const category: EstimateLineCategory = lowerCategory.includes('equipment')
      ? 'equipment'
      : lowerCategory.includes('sub')
        ? 'subcontractor'
        : 'material';

    addPriceLineItem(normalizeLineItem({
      id: crypto.randomUUID(),
      sourceType: 'priceBook',
      sourceId: material.id,
      name: material.name,
      description: material.description || material.supplier || material.category,
      quantity: 1,
      unit: material.unit || 'ea',
      unitCost: material.unitPrice || 0,
      unitPrice: material.unitPrice || 0,
      category,
      type: category,
      isLabor: false,
      linkedMaterialId: material.id,
      priceBookSnapshot: { unitCost: material.unitPrice || 0, unitPrice: material.unitPrice || 0, name: material.name },
      total: material.unitPrice || 0,
    }, 'priceBook'));
  };

  const handleSelectLaborRate = (rate: LaborRate) => {
    addPriceLineItem(normalizeLineItem({
      id: crypto.randomUUID(),
      sourceType: 'priceBook',
      sourceId: rate.id,
      name: rate.name,
      description: rate.trade,
      quantity: 1,
      unit: 'hr',
      unitCost: rate.hourlyRate || 0,
      unitPrice: rate.hourlyRate || 0,
      category: 'labor',
      type: 'labor',
      isLabor: true,
      hours: 1,
      linkedLaborRateId: rate.id,
      priceBookSnapshot: { unitCost: rate.hourlyRate || 0, unitPrice: rate.hourlyRate || 0, name: rate.name },
      total: rate.hourlyRate || 0,
    }, 'priceBook'));
  };

  const filteredMaterials = useMemo(() => {
    const term = priceSearch.trim().toLowerCase();
    const tabCategory = pricePickerTab === 'equipment' ? 'equipment' : pricePickerTab === 'subcontractors' ? 'sub' : '';
    return (materials || [])
      .filter(material => material.isActive !== false)
      .filter(material => pricePickerTab === 'materials'
        ? !(material.category || '').toLowerCase().includes('equipment') && !(material.category || '').toLowerCase().includes('sub')
        : pricePickerTab === 'labor'
          ? true
          : (material.category || '').toLowerCase().includes(tabCategory)
      )
      .filter(material => !term ||
        material.name.toLowerCase().includes(term) ||
        material.category?.toLowerCase().includes(term) ||
        material.supplier?.toLowerCase().includes(term) ||
        material.sku?.toLowerCase().includes(term)
      );
  }, [materials, priceSearch, pricePickerTab]);

  const filteredLaborRates = useMemo(() => {
    const term = priceSearch.trim().toLowerCase();
    return (laborRates || [])
      .filter(rate => rate.isActive !== false)
      .filter(rate => !term ||
        rate.name.toLowerCase().includes(term) ||
        rate.trade?.toLowerCase().includes(term)
      );
  }, [laborRates, priceSearch]);

  // Add item
  const addItem = (sectionId: string, item: EstimateLineItem) => {
    const newItem = normalizeLineItem({ ...item, id: crypto.randomUUID(), sourceType: item.sourceType || 'manual' });
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
        lineItems: sec.lineItems?.map(item => item.id === itemId ? normalizeLineItem({ ...item, ...updates }) : item)
      }))
    })));
  };

  // Create new estimate
  const handleCreate = () => {
    if (!formData.name || !formData.customerId) { showToast('Name and customer required', 'error'); return; }
    const totals = calculateTotals;
    const newId = addEstimate({
      ...formData,
      estimateNumber: `EST-${new Date().getFullYear()}-${String(estimates.length + 1).padStart(3, '0')}`,
      status: formData.status as EstimateStatus,
      type: formData.type as JobType,
      markupPercent: parseFloat(formData.markupPercent) || 0,
      scopes,
      sections: legacySections,
      taxable: 'none',
      ...totals,
    } as any);
    navigate(`/estimates/${newId}`);
    showToast('Estimate created');
  };

  const handleQuickAddCustomer = () => {
    if (!quickCustomer.name.trim()) {
      showToast('Customer name required', 'error');
      return;
    }
    const customerId = addCustomer({
      name: quickCustomer.name.trim(),
      email: quickCustomer.email.trim(),
      phone: quickCustomer.phone.trim(),
      address: quickCustomer.address.trim(),
    });
    setFormData({ ...formData, customerId, address: formData.address || quickCustomer.address.trim() });
    setQuickCustomer({ name: '', email: '', phone: '', address: '' });
    setShowCustomerPicker(false);
    showToast('Customer added');
  };

  const handleOpenPrint = () => {
    if (!estimate && isNew) {
      showToast('Create the estimate before printing', 'warning');
      return;
    }
    saveEstimate(false);
    setShowPrintPreview(true);
  };

  const handleSend = async () => {
    if (!estimate && isNew) {
      showToast('Create the estimate before sending', 'warning');
      return;
    }
    const current = buildCurrentEstimate();
    const currentCustomer = customers?.find(c => c.id === current.customerId);
    if (!currentCustomer?.email) {
      showToast('Add a customer email before sending', 'warning');
      return;
    }

    saveEstimate(false);
    const email = renderEmailAll('estimate', branding, {
      estimate: current,
      customer: currentCustomer,
      totals: { total: formatCurrency(calculateTotals.total) },
    });
    const delivered = await sendEmail({
      to: currentCustomer.email,
      subject: email.subject,
      html: email.html,
      text: email.text,
    });
    showToast(delivered ? 'Estimate sent' : 'Email draft opened');
  };

  const badge = (status: string) => {
    const m: Record<string, string> = { draft: 'status-draft', sent: 'status-sent', viewed: 'status-sent', in_review: 'status-review', approved: 'status-approved', rejected: 'status-rejected', archived: 'status-draft', converted: 'status-approved' };
    return m[status] || 'status-draft';
  };

  const selectedCustomer = customers?.find(c => c.id === formData.customerId);
  const projectType = PROJECT_TYPES.find(p => p.value === formData.type);
  const smartEnabled = branding.smartFeaturesEnabled !== false;
  const estimateSuggestions = useMemo(() => smartEnabled
    ? getEstimateSuggestions(formData.type as JobType, materials || [], laborRates || [], projectTypeTemplates || [], jobs || [], expenses || [], timeEntries || [])
    : [],
  [smartEnabled, formData.type, materials, laborRates, projectTypeTemplates, jobs, expenses, timeEntries]);

  const suggestionToLineItem = (suggestion: typeof estimateSuggestions[number]): EstimateLineItem => normalizeLineItem({
    id: crypto.randomUUID(),
    sourceType: suggestion.linkedMaterialId || suggestion.linkedLaborRateId ? 'priceBook' : 'manual',
    sourceId: suggestion.linkedMaterialId || suggestion.linkedLaborRateId,
    name: suggestion.name,
    description: suggestion.description,
    quantity: suggestion.quantity,
    unit: suggestion.unit,
    unitCost: suggestion.unitPrice,
    unitPrice: suggestion.unitPrice,
    category: suggestion.category,
    type: suggestion.category === 'allowance' ? 'other' : suggestion.category,
    isLabor: suggestion.isLabor,
    hours: suggestion.isLabor ? suggestion.quantity : undefined,
    linkedMaterialId: suggestion.linkedMaterialId,
    linkedLaborRateId: suggestion.linkedLaborRateId,
    priceBookSnapshot: { unitCost: suggestion.unitPrice, unitPrice: suggestion.unitPrice, name: suggestion.name },
    notes: suggestion.reason,
    total: suggestion.quantity * suggestion.unitPrice,
  });

  const addSmartSuggestions = (suggestionsToAdd: typeof estimateSuggestions) => {
    if (suggestionsToAdd.length === 0) return;
    const lineItems = suggestionsToAdd.map(suggestionToLineItem);
    const sectionId = crypto.randomUUID();
    const scopeId = crypto.randomUUID();
    const total = lineItems.reduce((sum, item) => sum + item.total, 0);
    const smartScope: EstimateScope = {
      id: scopeId,
      name: `${projectType?.label || 'Project'} Smart Suggestions`,
      projectType: formData.type as JobType,
      sections: [{ id: sectionId, name: 'Recommended Items', lineItems }],
      subtotal: total,
      isOptional: false,
      sortOrder: scopes.length,
    };
    setScopes([...scopes, smartScope]);
    setActiveScopeId(scopeId);
    setActiveSectionId(sectionId);
    setAcceptedSuggestionIds([...acceptedSuggestionIds, ...suggestionsToAdd.map(suggestion => suggestion.id)]);
    showToast('Smart suggestions added');
  };

  const addSmartSuggestion = (suggestion: typeof estimateSuggestions[number]) => {
    addSmartSuggestions([suggestion]);
  };

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.trim().toLowerCase();
    return (templates || []).filter(template => !term ||
      template.name.toLowerCase().includes(term) ||
      template.scope?.toLowerCase().includes(term) ||
      template.laborAssumptions?.toLowerCase().includes(term) ||
      template.materialAssumptions?.toLowerCase().includes(term)
    );
  }, [templates, templateSearch]);

  const handleSelectTemplate = (template: Template) => {
    const templateAssemblies = (template.assemblyIds || [])
      .map(assemblyId => assemblies?.find(assembly => assembly.id === assemblyId))
      .filter(Boolean) as Assembly[];
    const assemblyItems = templateAssemblies.flatMap(assembly => assemblyToLineItems(assembly).map(item => ({
      ...item,
      sourceType: 'template' as const,
      sourceId: template.id,
      internalNotes: `Added from template ${template.name} via assembly ${assembly.name}`,
    })));
    const templateItems: EstimateLineItem[] = (template.items || []).map((item, index) => normalizeLineItem({
      id: crypto.randomUUID(),
      sourceType: 'template',
      sourceId: template.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity || 1,
      unit: 'ea',
      unitCost: item.unitPrice || 0,
      unitPrice: item.unitPrice || 0,
      markupPercent: template.markupPercent || defaultMarkup,
      category: (item.isLabor ? 'labor' : item.category || 'material') as EstimateLineCategory,
      type: (item.isLabor ? 'labor' : item.category || 'material') as EstimateLineItem['type'],
      isLabor: item.isLabor,
      total: (item.quantity || 1) * (item.unitPrice || 0),
      sortOrder: index,
    }, 'template'));

    const lineItems = [...assemblyItems, ...templateItems];
    const sectionId = crypto.randomUUID();
    const scopeId = crypto.randomUUID();
    setFormData(prev => ({
      ...prev,
      name: template.name,
      markupPercent: String(template.markupPercent || prev.markupPercent || 20),
      notes: [
        template.scope ? `Scope: ${template.scope}` : '',
        template.laborAssumptions ? `Labor: ${template.laborAssumptions}` : '',
        template.materialAssumptions ? `Materials: ${template.materialAssumptions}` : '',
      ].filter(Boolean).join('\n'),
    }));
    setScopes([{
      id: scopeId,
      name: template.name,
      projectType: formData.type as JobType,
      sections: [{ id: sectionId, name: 'Template Scope', description: template.scope, lineItems }],
      subtotal: lineItems.reduce((sum, item) => sum + getItemCostTotal(item), 0),
      isOptional: false,
      sortOrder: 0,
    }]);
    setActiveScopeId(scopeId);
    setActiveSectionId(sectionId);
    setShowTemplatePicker(false);
    setTemplateSearch('');
    showToast('Template loaded into estimate');
  };

  const handleSaveAsTemplate = () => {
    const items = allEstimateItems.filter(item => !item.isExcluded).map(item => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unitPrice: getItemCost(item),
      category: item.category,
      isLabor: item.isLabor || item.category === 'labor',
    }));
    addTemplate({
      name: `${formData.name || 'Estimate'} Template`,
      type: 'estimate',
      scope: formData.notes || formData.address,
      laborAssumptions: groupedItems.labor.map(item => item.name).join(', '),
      materialAssumptions: groupedItems.material.map(item => item.name).join(', '),
      markupPercent: parseFloat(formData.markupPercent) || 20,
      items,
    });
    showToast('Saved estimate as new template');
  };

  const handleSaveSelectionAsAssembly = () => {
    const items = allEstimateItems.filter(item => !item.isExcluded).map(item => ({
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: getItemCost(item),
      category: item.category === 'allowance' ? 'other' as const : item.category as any,
      linkedMaterialId: item.linkedMaterialId,
      linkedLaborRateId: item.linkedLaborRateId,
    }));
    addAssembly({
      name: `${formData.name || 'Estimate'} Assembly`,
      description: 'Saved from estimate builder',
      category: formData.type || 'custom',
      unit: 'ea',
      laborHours: groupedItems.labor.reduce((sum, item) => sum + (item.hours || item.quantity || 0), 0),
      items,
      markupPercent: parseFloat(formData.markupPercent) || 20,
    } as any);
    showToast('Saved line items as new assembly');
  };

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
          <button className="eb-actionBtn" onClick={() => setShowTemplatePicker(true)}>
            <CheckSquare size={16} /><span>Start From Template</span>
          </button>
          <button className={`eb-viewToggle ${clientView ? 'active' : ''}`} onClick={() => setClientView(!clientView)}>
            <Eye size={16} /><span>{clientView ? 'Client' : 'Internal'}</span>
          </button>
          {!isNew && estimate?.status === 'approved' && !estimate.convertedToJobId && (
            <button className="eb-actionBtn" onClick={() => setShowConvertModal(true)}><Briefcase size={16} /><span>Convert</span></button>
          )}
          {!isNew && <button className="eb-actionBtn" onClick={() => saveEstimate(true)}><Save size={16} /><span>Save</span></button>}
          {isNew ? (
            <button className="eb-actionBtn eb-actionBtnPrimary" onClick={handleCreate}><Plus size={16} /><span>Create</span></button>
          ) : (
            <>
              <button className="eb-actionBtn" onClick={handleOpenPrint}><Printer size={16} /><span>Print</span></button>
              <button className="eb-actionBtn" onClick={handleSend}><Send size={16} /><span>Send</span></button>
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

          {smartEnabled && estimateSuggestions.length > 0 && (
            <div className="eb-section eb-smartAssist">
              <div className="eb-sectionHeader">
                <div>
                  <p className="eb-sectionEyebrow">Smart Estimate Assistance</p>
                  <h2>Recommended Items</h2>
                </div>
                <button className="btn btn-sm btn-primary" onClick={() => addSmartSuggestions(estimateSuggestions.filter(item => !acceptedSuggestionIds.includes(item.id)))}>
                  <CheckCircle size={15} /> Accept All
                </button>
              </div>
              <div className="eb-suggestionList">
                {estimateSuggestions.map(suggestion => {
                  const accepted = acceptedSuggestionIds.includes(suggestion.id);
                  return (
                    <div key={suggestion.id} className={`eb-suggestionItem ${accepted ? 'accepted' : ''}`}>
                      <div>
                        <div className="eb-suggestionTitle">{suggestion.name}</div>
                        <div className="eb-suggestionMeta">
                          <span>{suggestion.quantity} {suggestion.unit}</span>
                          <span>{formatCurrency(suggestion.unitPrice)}</span>
                          <span>{suggestion.category}</span>
                        </div>
                        <div className="eb-suggestionReason">{suggestion.reason}</div>
                      </div>
                      <button className="btn btn-sm btn-secondary" disabled={accepted} onClick={() => addSmartSuggestion(suggestion)}>
                        {accepted ? 'Added' : 'Add'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

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
                <button className="btn btn-secondary btn-lg" onClick={() => openAssemblyPicker()}><Package size={18} /><span>Add Assembly</span></button>
                <button className="btn btn-secondary btn-lg" onClick={() => openPricePicker()}><DollarSign size={18} /><span>From Price Book</span></button>
                <button className="btn btn-secondary btn-lg" onClick={() => setShowTemplatePicker(true)}><CheckSquare size={18} /><span>From Template</span></button>
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
                    <button className="eb-iconBtn" onClick={(e) => { e.stopPropagation(); openAssemblyPicker({ scopeId: scope.id }); }} title="Add assembly"><Package size={14} /></button>
                    <button className="eb-iconBtn" onClick={(e) => { e.stopPropagation(); openPricePicker({ scopeId: scope.id }); }} title="Add from price book"><DollarSign size={14} /></button>
                    <button className="eb-iconBtn eb-iconBtnDanger" onClick={(e) => { e.stopPropagation(); handleDeleteScope(scope.id); }}><Trash2 size={14} /></button>
                    {activeScopeId === scope.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {activeScopeId === scope.id && (
                  <div className="eb-scopeBody">
                    {(scope.sections?.length || 0) === 0 ? (
                      <div className="eb-noSections">
                        <button className="btn btn-secondary" onClick={() => handleAddSection(scope.id)}><Plus size={14} /><span>Add Section</span></button>
                        <button className="btn btn-secondary" onClick={() => openAssemblyPicker({ scopeId: scope.id })}><Package size={14} /><span>Add Assembly</span></button>
                        <button className="btn btn-secondary" onClick={() => openPricePicker({ scopeId: scope.id })}><DollarSign size={14} /><span>From Price Book</span></button>
                      </div>
                    ) : (
                      scope.sections?.map(section => (
                        <div key={section.id} className="eb-sectionCard">
                          <div className="eb-sectionHeader" onClick={() => handleToggleSection(section.id)}>
                            <input className="eb-sectionNameInput" value={section.name} onChange={e => handleSectionNameUpdate(section.id, e.target.value)} />
                            <div className="eb-sectionActions">
                              <button className="eb-iconBtn" onClick={(e) => { e.stopPropagation(); handleAddItemToSection(section.id); }}><Plus size={14} /></button>
                              <button className="eb-iconBtn" onClick={(e) => { e.stopPropagation(); openAssemblyPicker({ sectionId: section.id }); }} title="Add assembly"><Package size={14} /></button>
                              <button className="eb-iconBtn" onClick={(e) => { e.stopPropagation(); openPricePicker({ sectionId: section.id }); }} title="Add from price book"><DollarSign size={14} /></button>
                              {activeSectionId === section.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            </div>
                          </div>
                          {activeSectionId === section.id && (
                            <div className="eb-sectionBody">
                              {section.lineItems?.length === 0 ? (
                                <div className="eb-noItems">No items yet</div>
                              ) : (
                                <table className="eb-itemsTable">
                                  <thead><tr><th>Item</th><th>Qty</th><th>Unit</th>{!clientView && <th>Cost</th>}{!clientView && <th>Markup</th>}<th>Total</th><th></th></tr></thead>
                                  <tbody>
                                    {section.lineItems?.map(rawItem => {
                                      const item = normalizeLineItem(rawItem);
                                      const sourceLabel = item.sourceType === 'priceBook' ? 'Price Book' : item.sourceType === 'assembly' ? 'Assembly' : item.sourceType === 'template' ? 'Template' : 'Manual';
                                      return (
                                      <tr key={item.id} className={item.isExcluded ? 'excluded' : ''}>
                                        <td>
                                          <div className="eb-itemName">
                                            {item.name}
                                            <span className={`eb-sourceBadge ${item.sourceType || 'manual'}`}>{sourceLabel}</span>
                                            {item.clientVisible === false && <span className="eb-sourceBadge hidden">Hidden</span>}
                                          </div>
                                          {item.description && !clientView && <div className="eb-itemDesc">{item.description}</div>}
                                          {!clientView && item.internalNotes && <div className="eb-itemDesc">{item.internalNotes}</div>}
                                        </td>
                                        <td className="eb-qtyCell">
                                          <input className="eb-inlineInput" type="number" value={item.quantity} onChange={e => updateItem(section.id, item.id, { quantity: parseFloat(e.target.value) || 0, hours: item.isLabor ? parseFloat(e.target.value) || 0 : item.hours })} />
                                        </td>
                                        <td className="eb-unitCell">
                                          <input className="eb-inlineInput eb-inlineInputUnit" value={item.unit} onChange={e => updateItem(section.id, item.id, { unit: e.target.value })} />
                                        </td>
                                        {!clientView && (
                                          <td className="eb-priceCell">
                                            <input className="eb-inlineInput" type="number" value={getItemCost(item)} onChange={e => updateItem(section.id, item.id, { unitCost: parseFloat(e.target.value) || 0, unitPrice: parseFloat(e.target.value) || 0 })} />
                                          </td>
                                        )}
                                        {!clientView && (
                                          <td className="eb-priceCell">
                                            <input className="eb-inlineInput" type="number" value={getItemMarkup(item)} onChange={e => updateItem(section.id, item.id, { markupPercent: parseFloat(e.target.value) || 0 })} />
                                          </td>
                                        )}
                                        <td className="eb-totalCell">{formatCurrency(clientView ? getItemPriceTotal(item) : getItemCostTotal(item))}</td>
                                        <td className="eb-actionsCell">
                                          {!clientView && <button className="eb-iconBtn" title="Toggle client visibility" onClick={() => updateItem(section.id, item.id, { clientVisible: item.clientVisible === false })}>{item.clientVisible === false ? <EyeOff size={12} /> : <Eye size={12} />}</button>}
                                          <button className="eb-iconBtn" onClick={() => handleEditItem(section.id, item)}><Edit3 size={12} /></button>
                                          <button className="eb-iconBtn eb-iconBtnDanger" onClick={() => handleDeleteItem(section.id, item.id)}><Trash2 size={12} /></button>
                                        </td>
                                      </tr>
                                    );})}
                                  </tbody>
                                </table>
                              )}
                              <div className="eb-sectionFooter">
                                <button className="eb-addItemBtn" onClick={() => handleAddItemFromFooter(section.id)}><Plus size={14} />Add Item</button>
                                <button className="eb-addItemBtn" onClick={() => openAssemblyPicker({ sectionId: section.id })}><Package size={14} />Add Assembly</button>
                                <button className="eb-addItemBtn" onClick={() => openPricePicker({ sectionId: section.id })}><DollarSign size={14} />From Price Book</button>
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
            <div className="eb-builderActions">
              <button className="eb-addScopeBtn" onClick={() => addScope(`Scope ${scopes.length + 1}`)}>
                <Plus size={18} /><span>Add Another Scope</span>
              </button>
              <button className="eb-addScopeBtn" onClick={() => openAssemblyPicker()}>
                <Package size={18} /><span>Add Assembly as Scope</span>
              </button>
              <button className="eb-addScopeBtn" onClick={() => openPricePicker()}>
                <DollarSign size={18} /><span>Add Price Book Item</span>
              </button>
            </div>
          )}
        </div>

        {/* RIGHT: Live Summary Panel */}
        <div className={`eb-summary ${clientView ? 'eb-summaryClient' : ''}`}>
          <div className="eb-summaryHeader">
            <h3>Pricing Summary</h3>
            {lastSaved && <span className="eb-savedTime">Saved {lastSaved.toLocaleTimeString()}</span>}
          </div>

          <div className="eb-summaryBody">
            {!clientView && smartWarnings.length > 0 && (
              <div className="eb-warningStack">
                {smartWarnings.map(warning => (
                  <div key={warning} className="eb-warningItem">
                    <AlertTriangle size={15} />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}

            {!clientView && allEstimateItems.length > 0 && (
              <div className="eb-connectedGroups">
                <div className="eb-profitTitle">Connected Items</div>
                {Object.entries(groupedItems).map(([group, items]) => items.length > 0 && (
                  <div key={group} className="eb-groupLine">
                    <span>{group === 'material' ? 'Materials' : group.charAt(0).toUpperCase() + group.slice(1)}</span>
                    <strong>{items.length}</strong>
                  </div>
                ))}
              </div>
            )}

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
                    <span className="eb-profitLabel">Margin %</span>
                    <span className="eb-profitValue eb-profitValueGreen">{calculateTotals.profitPercent.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            )}

            {!clientView && allEstimateItems.length > 0 && (
              <div className="eb-saveBackCard">
                <div className="eb-profitTitle">Save Back</div>
                <button className="eb-saveBackBtn" onClick={handleSaveAsTemplate}><CheckSquare size={14} /> Save as New Template</button>
                <button className="eb-saveBackBtn" onClick={handleSaveSelectionAsAssembly}><Package size={14} /> Save Items as Assembly</button>
                {allEstimateItems.some(item => item.sourceType === 'template' && item.sourceId) && (
                  <button className="eb-saveBackBtn" onClick={() => {
                    const sourceId = allEstimateItems.find(item => item.sourceType === 'template' && item.sourceId)?.sourceId;
                    if (sourceId && confirm('Update the original template with current estimate items?')) {
                      updateTemplate(sourceId, {
                        name: formData.name,
                        markupPercent: parseFloat(formData.markupPercent) || 20,
                        scope: formData.notes,
                        items: allEstimateItems.map(item => ({ name: item.name, description: item.description, quantity: item.quantity, unitPrice: getItemCost(item), category: item.category, isLabor: item.isLabor })),
                      });
                      showToast('Original template updated');
                    }
                  }}><RotateCcw size={14} /> Update Original Template</button>
                )}
                {allEstimateItems.some(item => item.sourceType === 'assembly' && item.sourceId) && (
                  <button className="eb-saveBackBtn" onClick={() => {
                    const sourceId = allEstimateItems.find(item => item.sourceType === 'assembly' && item.sourceId)?.sourceId;
                    if (sourceId && confirm('Update the original assembly with current estimate items?')) {
                      updateAssembly(sourceId, {
                        items: allEstimateItems.map(item => ({ name: item.name, description: item.description, quantity: item.quantity, unit: item.unit, unitPrice: getItemCost(item), category: item.category === 'allowance' ? 'other' : item.category as any, linkedMaterialId: item.linkedMaterialId, linkedLaborRateId: item.linkedLaborRateId })),
                      } as any);
                      showToast('Original assembly updated');
                    }
                  }}><RotateCcw size={14} /> Update Original Assembly</button>
                )}
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

      {/* Template Picker Modal */}
      <Modal isOpen={showTemplatePicker} onClose={() => { setShowTemplatePicker(false); setTemplateSearch(''); }} title="Start From Template" size="lg">
        <div className="eb-templatePicker">
          <div className="search-bar mb-4">
            <Search size={18} />
            <input
              className="form-input"
              value={templateSearch}
              onChange={e => setTemplateSearch(e.target.value)}
              placeholder="Search templates by name, scope, labor, or materials"
            />
          </div>
          {(templates?.length || 0) === 0 ? (
            <div className="eb-assemblyEmpty">
              <CheckSquare size={34} />
              <div>
                <div className="eb-assemblyEmptyTitle">No templates yet</div>
                <p>Create templates in the library, then start estimates from them here.</p>
              </div>
              <Link to="/estimates/templates" className="btn btn-primary" onClick={() => setShowTemplatePicker(false)}>Open Templates</Link>
            </div>
          ) : (
            <div className="eb-priceList">
              {filteredTemplates.map(template => {
                const templateCost = (template.items || []).reduce((sum, item) => sum + ((item.quantity || 1) * (item.unitPrice || 0)), 0);
                const estimatedPrice = templateCost * (1 + (template.markupPercent || defaultMarkup) / 100);
                return (
                  <button key={template.id} className="eb-priceOption" onClick={() => handleSelectTemplate(template)}>
                    <div className="eb-priceOptionMain">
                      <div className="eb-priceOptionIcon"><CheckSquare size={18} /></div>
                      <div>
                        <div className="eb-priceOptionName">{template.name}</div>
                        <div className="eb-assemblyOptionDesc">{template.scope || 'Template starting point'}</div>
                        <div className="eb-priceOptionMeta">
                          <span>{template.items?.length || 0} line items</span>
                          <span>{template.markupPercent || defaultMarkup}% markup</span>
                          {template.laborAssumptions && <span>Labor included</span>}
                        </div>
                      </div>
                    </div>
                    <div className="eb-priceOptionTotal">
                      <span>{formatCurrency(estimatedPrice)}</span>
                      <small>Start</small>
                    </div>
                  </button>
                );
              })}
              {filteredTemplates.length === 0 && <div className="eb-priceNoResults">No templates match your search.</div>}
            </div>
          )}
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
        <div className="eb-quickCustomer">
          <div className="eb-quickCustomerTitle">Add Customer</div>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-input" value={quickCustomer.name} onChange={e => setQuickCustomer({...quickCustomer, name: e.target.value})} placeholder="Customer name" />
          </div>
          <div className="form-group">
            <label className="form-label">Email</label>
            <input className="form-input" type="email" value={quickCustomer.email} onChange={e => setQuickCustomer({...quickCustomer, email: e.target.value})} placeholder="customer@email.com" />
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" value={quickCustomer.phone} onChange={e => setQuickCustomer({...quickCustomer, phone: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Address</label>
              <input className="form-input" value={quickCustomer.address} onChange={e => setQuickCustomer({...quickCustomer, address: e.target.value})} />
            </div>
          </div>
          <button className="btn btn-primary w-full" onClick={handleQuickAddCustomer}><Plus size={16} /> Add & Select Customer</button>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none'}}>
          <Link to="/customers" className="btn btn-secondary" onClick={() => setShowCustomerPicker(false)}>Manage Customers</Link>
        </div>
      </Modal>

      {/* Assembly Picker Modal */}
      <Modal isOpen={showAssemblyPicker} onClose={() => { setShowAssemblyPicker(false); setAssemblyTarget(null); setAssemblySearch(''); }} title="Select Assembly" size="lg">
        <div className="eb-assemblyPicker">
          <div className="eb-priceTabs">
            {assemblyCategories.map(category => (
              <button key={category} className={`eb-priceTab ${assemblyCategory === category ? 'active' : ''}`} onClick={() => setAssemblyCategory(category)}>
                <Package size={16} /> {category === 'all' ? 'All Assemblies' : category}
              </button>
            ))}
          </div>
          <div className="search-bar mb-4">
            <Search size={18} />
            <input
              className="form-input"
              value={assemblySearch}
              onChange={e => setAssemblySearch(e.target.value)}
              placeholder="Search assemblies by name, category, or description"
            />
          </div>

          {(assemblies?.length || 0) === 0 ? (
            <div className="eb-assemblyEmpty">
              <Package size={34} />
              <div>
                <div className="eb-assemblyEmptyTitle">No assemblies yet</div>
                <p>Create assemblies in the library, then select them here for estimates.</p>
              </div>
              <Link to="/estimates/assemblies" className="btn btn-primary" onClick={() => setShowAssemblyPicker(false)}>Open Assemblies</Link>
            </div>
          ) : (
            <div className="eb-assemblyList">
              {filteredAssemblies.map(assembly => (
                <button key={assembly.id} className="eb-assemblyOption" onClick={() => handleSelectAssembly(assembly)}>
                  <div className="eb-assemblyOptionMain">
                    <div className="eb-assemblyOptionIcon"><Package size={18} /></div>
                    <div>
                      <div className="eb-assemblyOptionName">{assembly.name}</div>
                      {assembly.description && <div className="eb-assemblyOptionDesc">{assembly.description}</div>}
                      <div className="eb-assemblyOptionMeta">
                        <span>{assembly.category || 'Uncategorized'}</span>
                        <span>{assembly.laborHours || 0}h labor</span>
                        <span>{assembly.items?.length || 0} items</span>
                        <span>Copies current Price Book values</span>
                      </div>
                    </div>
                  </div>
                  <div className="eb-assemblyOptionTotal">
                    <span>{formatCurrency(getAssemblyTotal(assembly))}</span>
                    <small>Select</small>
                  </div>
                </button>
              ))}
              {filteredAssemblies.length === 0 && (
                <div className="eb-assemblyNoResults">No assemblies match your search.</div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Price Book Picker Modal */}
      <Modal isOpen={showPricePicker} onClose={() => { setShowPricePicker(false); setPriceTarget(null); setPriceSearch(''); }} title="Select from Price Book" size="lg">
        <div className="eb-pricePicker">
          <div className="eb-priceTabs">
            <button className={`eb-priceTab ${pricePickerTab === 'materials' ? 'active' : ''}`} onClick={() => setPricePickerTab('materials')}>
              <Package size={16} /> Materials ({materials?.filter(m => m.isActive !== false).length || 0})
            </button>
            <button className={`eb-priceTab ${pricePickerTab === 'labor' ? 'active' : ''}`} onClick={() => setPricePickerTab('labor')}>
              <Users size={16} /> Labor ({laborRates?.filter(r => r.isActive !== false).length || 0})
            </button>
            <button className={`eb-priceTab ${pricePickerTab === 'equipment' ? 'active' : ''}`} onClick={() => setPricePickerTab('equipment')}>
              <Wrench size={16} /> Equipment ({materials?.filter(m => m.isActive !== false && (m.category || '').toLowerCase().includes('equipment')).length || 0})
            </button>
            <button className={`eb-priceTab ${pricePickerTab === 'subcontractors' ? 'active' : ''}`} onClick={() => setPricePickerTab('subcontractors')}>
              <Truck size={16} /> Subcontractors ({materials?.filter(m => m.isActive !== false && (m.category || '').toLowerCase().includes('sub')).length || 0})
            </button>
          </div>

          <div className="search-bar mb-4">
            <Search size={18} />
            <input
              className="form-input"
              value={priceSearch}
              onChange={e => setPriceSearch(e.target.value)}
              placeholder={pricePickerTab === 'labor' ? 'Search labor rates or trades' : 'Search price book items, categories, suppliers, or SKU'}
            />
          </div>

          {pricePickerTab !== 'labor' ? (
            <div className="eb-priceList">
              {filteredMaterials.map(material => (
                <button key={material.id} className="eb-priceOption" onClick={() => handleSelectMaterial(material)}>
                  <div className="eb-priceOptionMain">
                    <div className="eb-priceOptionIcon"><Package size={18} /></div>
                    <div>
                      <div className="eb-priceOptionName">{material.name}</div>
                      <div className="eb-priceOptionMeta">
                        <span>{material.category || 'Uncategorized'}</span>
                        {material.supplier && <span>{material.supplier}</span>}
                        {material.sku && <span>SKU {material.sku}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="eb-priceOptionTotal">
                    <span>{formatCurrency(material.unitPrice)}</span>
                    <small>/{material.unit || 'ea'}</small>
                  </div>
                </button>
              ))}
              {filteredMaterials.length === 0 && <div className="eb-priceNoResults">No active materials match your search.</div>}
            </div>
          ) : (
            <div className="eb-priceList">
              {filteredLaborRates.map(rate => (
                <button key={rate.id} className="eb-priceOption" onClick={() => handleSelectLaborRate(rate)}>
                  <div className="eb-priceOptionMain">
                    <div className="eb-priceOptionIcon"><Users size={18} /></div>
                    <div>
                      <div className="eb-priceOptionName">{rate.name}</div>
                      <div className="eb-priceOptionMeta">
                        <span>{rate.trade || 'General'}</span>
                        {rate.overtimeRate ? <span>OT {formatCurrency(rate.overtimeRate)}/hr</span> : null}
                      </div>
                    </div>
                  </div>
                  <div className="eb-priceOptionTotal">
                    <span>{formatCurrency(rate.hourlyRate)}</span>
                    <small>/hr</small>
                  </div>
                </button>
              ))}
              {filteredLaborRates.length === 0 && <div className="eb-priceNoResults">No active labor rates match your search.</div>}
            </div>
          )}

          {(materials?.length || 0) === 0 && (laborRates?.length || 0) === 0 && (
            <div className="eb-priceEmpty">
              <DollarSign size={34} />
              <div>
                <div className="eb-assemblyEmptyTitle">No price book items yet</div>
                <p>Add materials or labor rates in the Price Book, then select them here for estimates.</p>
              </div>
              <Link to="/estimates/pricebook" className="btn btn-primary" onClick={() => setShowPricePicker(false)}>Open Price Book</Link>
            </div>
          )}
        </div>
      </Modal>

      {showPrintPreview && (
        <PrintTemplateModal
          isOpen={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          title="Client Estimate Preview"
          data={buildClientEstimatePrintData(buildCurrentEstimate(), selectedCustomer, branding)}
        />
      )}

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
