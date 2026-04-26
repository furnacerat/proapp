import { useState, useMemo, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../../data/types';
import type { Estimate, EstimateScope, EstimateSection, EstimateLineItem, EstimateLineCategory, Customer, JobType, EstimateStatus, Assembly, Material, LaborRate, Template, Allowance, AllowanceCategory } from '../../data/types';
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

type GuidedQuestionType = 'yesNo' | 'multipleChoice' | 'numeric' | 'dropdown';
type GuidedAnswerValue = boolean | string | number;
type GuidedAnswers = Record<string, GuidedAnswerValue>;

interface GuidedQuestion {
  id: string;
  title: string;
  helper?: string;
  type: GuidedQuestionType;
  unit?: string;
  options?: { label: string; value: string }[];
  showIf?: (answers: GuidedAnswers) => boolean;
}

interface GuidedGeneratedScope {
  sections: EstimateSection[];
  warnings: string[];
  suggestions: string[];
}

const isAffirmative = (value: GuidedAnswerValue | undefined) => value === true || value === 'yes';
const answerNumber = (value: GuidedAnswerValue | undefined, fallback = 0) => {
  const parsed = typeof value === 'number' ? value : parseFloat(String(value || ''));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const GUIDED_QUESTION_SETS: Record<string, GuidedQuestion[]> = {
  kitchen: [
    { id: 'cabinets', title: 'Are cabinets included?', helper: 'Include boxes, trim, hardware, and install labor.', type: 'yesNo' },
    { id: 'cabinetLf', title: 'How many linear feet of cabinets?', type: 'numeric', unit: 'lf', showIf: answers => isAffirmative(answers.cabinets) },
    { id: 'countertops', title: 'What countertop scope is included?', type: 'dropdown', options: [
      { label: 'None', value: 'none' },
      { label: 'Quartz', value: 'quartz' },
      { label: 'Granite', value: 'granite' },
      { label: 'Laminate', value: 'laminate' },
      { label: 'Butcher block', value: 'butcher-block' },
    ] },
    { id: 'countertopSf', title: 'Countertop square footage', type: 'numeric', unit: 'sq ft', showIf: answers => !!answers.countertops && answers.countertops !== 'none' },
    { id: 'flooring', title: 'Is flooring part of this estimate?', type: 'yesNo' },
    { id: 'flooringType', title: 'Flooring type', type: 'multipleChoice', options: [
      { label: 'Tile', value: 'tile' },
      { label: 'LVP', value: 'lvp' },
      { label: 'Hardwood', value: 'hardwood' },
    ], showIf: answers => isAffirmative(answers.flooring) },
    { id: 'flooringSf', title: 'Flooring area', type: 'numeric', unit: 'sq ft', showIf: answers => isAffirmative(answers.flooring) },
    { id: 'backsplash', title: 'Add backsplash?', type: 'yesNo' },
    { id: 'backsplashSf', title: 'Backsplash area', type: 'numeric', unit: 'sq ft', showIf: answers => isAffirmative(answers.backsplash) },
    { id: 'plumbing', title: 'Move or reconnect plumbing fixtures?', type: 'yesNo' },
    { id: 'electricalLevel', title: 'Electrical scope', type: 'dropdown', options: [
      { label: 'None', value: 'none' },
      { label: 'Basic device swaps', value: 'basic' },
      { label: 'Recessed/under-cabinet lighting', value: 'lighting' },
      { label: 'Dedicated circuits and lighting', value: 'circuits' },
    ] },
  ],
  bathroom: [
    { id: 'bathroomSf', title: 'Bathroom floor area', type: 'numeric', unit: 'sq ft' },
    { id: 'showerType', title: 'Shower or tub scope', type: 'multipleChoice', options: [
      { label: 'Vanity only', value: 'vanity-only' },
      { label: 'Tub/shower insert', value: 'insert' },
      { label: 'Walk-in shower', value: 'walk-in' },
      { label: 'Custom tile shower', value: 'tile-shower' },
    ] },
    { id: 'tileWalls', title: 'Tile shower walls?', type: 'yesNo', showIf: answers => ['walk-in', 'tile-shower'].includes(String(answers.showerType || '')) },
    { id: 'tileWallSf', title: 'Tile wall area', type: 'numeric', unit: 'sq ft', showIf: answers => isAffirmative(answers.tileWalls) },
    { id: 'flooring', title: 'Replace bathroom flooring?', type: 'yesNo' },
    { id: 'vanityWidth', title: 'Vanity size', type: 'dropdown', options: [
      { label: '24 inch', value: '24' },
      { label: '36 inch', value: '36' },
      { label: '48 inch', value: '48' },
      { label: '60 inch double vanity', value: '60' },
    ] },
    { id: 'fixtureCount', title: 'How many plumbing fixtures?', helper: 'Sink, toilet, tub, shower valve, and similar fixtures.', type: 'numeric', unit: 'fixtures' },
    { id: 'ventilation', title: 'Add or replace bath fan?', type: 'yesNo' },
  ],
  roofing: [
    { id: 'roofArea', title: 'Roof area', helper: 'Enter roof square footage including waste factor if known.', type: 'numeric', unit: 'sq ft' },
    { id: 'roofMaterial', title: 'Roofing material', type: 'multipleChoice', options: [
      { label: 'Architectural shingles', value: 'architectural-shingle' },
      { label: 'Metal roofing', value: 'metal' },
      { label: 'Flat membrane', value: 'membrane' },
    ] },
    { id: 'tearOff', title: 'Remove existing roof?', type: 'yesNo' },
    { id: 'deckingRepair', title: 'Include decking repair allowance?', type: 'yesNo' },
    { id: 'deckingSheets', title: 'Estimated decking sheets', type: 'numeric', unit: 'sheets', showIf: answers => isAffirmative(answers.deckingRepair) },
    { id: 'gutters', title: 'Replace gutters?', type: 'yesNo' },
    { id: 'gutterLf', title: 'Gutter length', type: 'numeric', unit: 'lf', showIf: answers => isAffirmative(answers.gutters) },
    { id: 'roofPitch', title: 'Roof pitch/access', type: 'dropdown', options: [
      { label: 'Standard access', value: 'standard' },
      { label: 'Steep pitch', value: 'steep' },
      { label: 'Difficult access', value: 'difficult' },
    ] },
  ],
  default: [
    { id: 'projectArea', title: 'Approximate project area', type: 'numeric', unit: 'sq ft' },
    { id: 'demo', title: 'Does this include demolition?', type: 'yesNo' },
    { id: 'flooring', title: 'Is flooring included?', type: 'yesNo' },
    { id: 'flooringType', title: 'Flooring type', type: 'multipleChoice', options: [
      { label: 'Tile', value: 'tile' },
      { label: 'LVP', value: 'lvp' },
      { label: 'Hardwood', value: 'hardwood' },
    ], showIf: answers => isAffirmative(answers.flooring) },
    { id: 'flooringSf', title: 'Flooring area', type: 'numeric', unit: 'sq ft', showIf: answers => isAffirmative(answers.flooring) },
    { id: 'paint', title: 'Include interior paint?', type: 'yesNo' },
    { id: 'paintRooms', title: 'Rooms to paint', type: 'numeric', unit: 'rooms', showIf: answers => isAffirmative(answers.paint) },
    { id: 'plumbing', title: 'Any plumbing work?', type: 'yesNo' },
    { id: 'electricalLevel', title: 'Electrical scope', type: 'dropdown', options: [
      { label: 'None', value: 'none' },
      { label: 'Minor devices/fixtures', value: 'basic' },
      { label: 'New circuits or layout changes', value: 'circuits' },
    ] },
  ],
};

const getGuidedQuestions = (projectTypeValue: string): GuidedQuestion[] => {
  return GUIDED_QUESTION_SETS[projectTypeValue] || GUIDED_QUESTION_SETS.default;
};

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
  const [estimateAllowances, setEstimateAllowances] = useState<Allowance[]>(estimate?.clientAllowances || []);
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
  const [showGuidedBuilder, setShowGuidedBuilder] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedAnswers>({});
  const [guidedDismissed, setGuidedDismissed] = useState(false);
  const [acceptedSuggestionIds, setAcceptedSuggestionIds] = useState<string[]>([]);
  const [editingItem, setEditingItem] = useState<{ item?: EstimateLineItem; sectionId: string } | null>(null);
  const [newItemForm, setNewItemForm] = useState({ name: '', quantity: '1', unit: 'ea', unitPrice: '0', category: 'material' as EstimateLineCategory });
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [quickCustomer, setQuickCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [convertOptions, setConvertOptions] = useState({ startDate: new Date().toISOString().split('T')[0], dueDate: '', copyLineItems: true, copyPricing: true, copyNotes: true });
  const [allowanceForm, setAllowanceForm] = useState({ name: '', category: 'materials' as AllowanceCategory, amount: '', notes: '', clientResponsible: true, includeInClientProposal: true });

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
      clientAllowances: estimateAllowances,
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
  }, [estimate, formData, scopes, legacySections, estimateAllowances]);

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

  const findMaterialByTerms = (terms: string[]) => {
    const normalizedTerms = terms.map(term => term.toLowerCase());
    return materials?.find(material => {
      const haystack = `${material.name} ${material.category || ''} ${material.description || ''}`.toLowerCase();
      return normalizedTerms.some(term => haystack.includes(term));
    });
  };

  const findLaborRateByTerms = (terms: string[]) => {
    const normalizedTerms = terms.map(term => term.toLowerCase());
    return laborRates?.find(rate => {
      const haystack = `${rate.name} ${rate.trade || ''}`.toLowerCase();
      return normalizedTerms.some(term => haystack.includes(term));
    });
  };

  const findAssemblyByTerms = (terms: string[]) => {
    const normalizedTerms = terms.map(term => term.toLowerCase());
    return assemblies?.find(assembly => {
      const haystack = `${assembly.name} ${assembly.category || ''} ${assembly.description || ''}`.toLowerCase();
      return normalizedTerms.every(term => haystack.includes(term));
    });
  };

  const makeGuidedPriceItem = (
    name: string,
    quantity: number,
    unit: string,
    fallbackUnitCost: number,
    category: EstimateLineCategory,
    terms: string[],
    description?: string
  ): EstimateLineItem => {
    const material = category !== 'labor' ? findMaterialByTerms(terms) : undefined;
    const rate = category === 'labor' ? findLaborRateByTerms(terms) : undefined;
    const unitCost = rate?.hourlyRate ?? material?.unitPrice ?? fallbackUnitCost;
    return normalizeLineItem({
      id: crypto.randomUUID(),
      sourceType: material || rate ? 'priceBook' : 'manual',
      sourceId: material?.id || rate?.id,
      name: material?.name || rate?.name || name,
      description: description || material?.description || material?.supplier || rate?.trade,
      quantity,
      unit: rate ? 'hr' : (material?.unit || unit),
      unitCost,
      unitPrice: unitCost,
      category,
      type: category === 'allowance' ? 'other' : category as EstimateLineItem['type'],
      isLabor: category === 'labor',
      hours: category === 'labor' ? quantity : undefined,
      linkedMaterialId: material?.id,
      linkedLaborRateId: rate?.id,
      priceBookSnapshot: material || rate ? { unitCost, unitPrice: unitCost, name: material?.name || rate?.name || name } : undefined,
      internalNotes: 'Added by Smart Scope Builder',
      notes: 'Generated from guided estimate answers',
      total: quantity * unitCost,
    }, material || rate ? 'priceBook' : 'manual');
  };

  const makeGuidedAssemblyItems = (terms: string[], multiplier: number) => {
    const assembly = findAssemblyByTerms(terms);
    if (!assembly) return [];
    return assemblyToLineItems(assembly).map(item => normalizeLineItem({
      ...item,
      id: crypto.randomUUID(),
      quantity: Number(((item.quantity || 1) * multiplier).toFixed(2)),
      hours: item.isLabor || item.category === 'labor' ? Number(((item.hours || item.quantity || 1) * multiplier).toFixed(2)) : item.hours,
      internalNotes: `Added by Smart Scope Builder using assembly ${assembly.name}`,
      notes: `Guided assembly: ${assembly.name}`,
    }, 'assembly'));
  };

  const buildGuidedScope = (): GuidedGeneratedScope => {
    const sections: EstimateSection[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    const project = String(formData.type || 'default');
    const addSection = (name: string, lineItems: EstimateLineItem[], description?: string) => {
      if (lineItems.length === 0) return;
      sections.push({ id: crypto.randomUUID(), name, description, lineItems });
    };

    if (project === 'kitchen') {
      if (isAffirmative(guidedAnswers.cabinets)) {
        const lf = answerNumber(guidedAnswers.cabinetLf, 12);
        addSection('Cabinets', [
          makeGuidedPriceItem('Cabinet package', lf, 'lf', 425, 'material', ['cabinet'], 'Cabinet allowance generated from linear footage'),
          makeGuidedPriceItem('Cabinet install labor', Number((lf * 1.1).toFixed(2)), 'hr', 55, 'labor', ['carp', 'cabinet'], 'Install cabinets, fillers, trim, and hardware'),
        ]);
        suggestions.push('Verify cabinet crown, fillers, toe kick, and hardware counts before sending.');
      }

      if (guidedAnswers.countertops && guidedAnswers.countertops !== 'none') {
        const sf = answerNumber(guidedAnswers.countertopSf, 45);
        addSection('Countertops', [
          makeGuidedPriceItem(`${String(guidedAnswers.countertops)} countertop allowance`, sf, 'sq ft', guidedAnswers.countertops === 'laminate' ? 42 : 95, 'material', ['counter', String(guidedAnswers.countertops)], 'Countertop material and fabrication allowance'),
          makeGuidedPriceItem('Countertop templating and install', Number((sf * 0.08).toFixed(2)), 'hr', 65, 'labor', ['install', 'finish'], 'Field template, set, and secure countertops'),
        ]);
        if (!isAffirmative(guidedAnswers.plumbing)) warnings.push('Countertops usually require sink/faucet disconnect and reconnect. Consider adding plumbing.');
      }

      if (isAffirmative(guidedAnswers.flooring)) {
        const sf = answerNumber(guidedAnswers.flooringSf, 200);
        const flooringType = String(guidedAnswers.flooringType || 'tile');
        const assemblyItems = makeGuidedAssemblyItems([flooringType === 'tile' ? 'tile' : flooringType, 'floor'], sf);
        addSection('Flooring', assemblyItems.length > 0 ? assemblyItems : [
          makeGuidedPriceItem(`${flooringType.toUpperCase()} flooring`, Number((sf * 1.08).toFixed(2)), 'sq ft', flooringType === 'tile' ? 5.25 : flooringType === 'hardwood' ? 8 : 4.5, 'material', [flooringType, 'floor'], 'Includes waste factor'),
          makeGuidedPriceItem(`${flooringType.toUpperCase()} installation labor`, Number((sf * (flooringType === 'tile' ? 0.1 : 0.05)).toFixed(2)), 'hr', 55, 'labor', ['floor'], 'Install flooring and related finish transitions'),
        ]);
        suggestions.push('Confirm floor prep, transitions, and underlayment before final approval.');
      }

      if (isAffirmative(guidedAnswers.backsplash)) {
        const sf = answerNumber(guidedAnswers.backsplashSf, 35);
        addSection('Backsplash', [
          makeGuidedPriceItem('Backsplash tile', Number((sf * 1.1).toFixed(2)), 'sq ft', 7, 'material', ['tile'], 'Tile material with waste'),
          makeGuidedPriceItem('Backsplash setting materials', sf, 'sq ft', 2.25, 'material', ['mortar', 'grout'], 'Thinset, grout, trim, and spacers'),
          makeGuidedPriceItem('Backsplash install labor', Number((sf * 0.16).toFixed(2)), 'hr', 58, 'labor', ['tile'], 'Set and grout backsplash tile'),
        ]);
      }

      if (isAffirmative(guidedAnswers.plumbing)) {
        addSection('Plumbing', [
          ...makeGuidedAssemblyItems(['faucet', 'kitchen'], 1),
          makeGuidedPriceItem('Kitchen plumbing allowance', 1, 'ls', 650, 'subcontractor', ['plumb'], 'Disconnect, reconnect, and minor rough-in adjustment allowance'),
        ]);
      }

      if (guidedAnswers.electricalLevel && guidedAnswers.electricalLevel !== 'none') {
        const level = String(guidedAnswers.electricalLevel);
        addSection('Electrical', [
          makeGuidedPriceItem('Kitchen electrical allowance', 1, 'ls', level === 'basic' ? 450 : level === 'lighting' ? 1250 : 2200, 'subcontractor', ['electric'], 'Electrical scope generated from guided answers'),
        ]);
      }
    } else if (project === 'bathroom') {
      const bathroomSf = answerNumber(guidedAnswers.bathroomSf, 60);
      if (isAffirmative(guidedAnswers.flooring)) {
        const floorAssembly = makeGuidedAssemblyItems(['tile', 'floor'], bathroomSf);
        addSection('Bathroom Floor', floorAssembly.length > 0 ? floorAssembly : [
          makeGuidedPriceItem('Bathroom floor tile', Number((bathroomSf * 1.1).toFixed(2)), 'sq ft', 5, 'material', ['tile'], 'Bathroom tile with waste'),
          makeGuidedPriceItem('Bathroom tile install labor', Number((bathroomSf * 0.12).toFixed(2)), 'hr', 58, 'labor', ['tile'], 'Install bathroom floor tile'),
        ]);
      }

      const showerType = String(guidedAnswers.showerType || 'insert');
      if (showerType !== 'vanity-only') {
        const showerItems = showerType === 'tile-shower' || showerType === 'walk-in'
          ? [
              makeGuidedPriceItem('Shower waterproofing system', answerNumber(guidedAnswers.tileWallSf, 120), 'sq ft', 2.5, 'material', ['waterproof'], 'Waterproofing membrane and accessories'),
              makeGuidedPriceItem('Shower wall tile', Number((answerNumber(guidedAnswers.tileWallSf, 120) * 1.1).toFixed(2)), 'sq ft', 6, 'material', ['tile'], 'Tile material with waste'),
              makeGuidedPriceItem('Shower tile install labor', Number((answerNumber(guidedAnswers.tileWallSf, 120) * 0.16).toFixed(2)), 'hr', 62, 'labor', ['tile'], 'Set shower wall tile and grout'),
            ]
          : [
              makeGuidedPriceItem('Tub/shower insert', 1, 'ea', 975, 'material', ['tub', 'shower'], 'Prefab tub/shower kit allowance'),
              makeGuidedPriceItem('Tub/shower install labor', 6, 'hr', 58, 'labor', ['plumb'], 'Install tub/shower kit'),
            ];
        addSection('Shower and Tub', showerItems);
        if (showerType === 'tile-shower' || showerType === 'walk-in') suggestions.push('Confirm niche, bench, curb, glass, and waterproofing details.');
      }

      addSection('Vanity and Fixtures', [
        ...makeGuidedAssemblyItems(['vanity'], 1),
        makeGuidedPriceItem(`${String(guidedAnswers.vanityWidth || '36')} inch vanity allowance`, 1, 'ea', Number(guidedAnswers.vanityWidth || 36) >= 60 ? 1250 : 650, 'material', ['vanity'], 'Vanity cabinet and top allowance'),
        makeGuidedPriceItem('Plumbing fixture set', answerNumber(guidedAnswers.fixtureCount, 3), 'ea', 225, 'material', ['faucet', 'toilet'], 'Fixture allowance based on fixture count'),
        makeGuidedPriceItem('Plumbing labor', answerNumber(guidedAnswers.fixtureCount, 3) * 1.25, 'hr', 68, 'labor', ['plumb'], 'Set and reconnect bathroom fixtures'),
      ]);

      if (isAffirmative(guidedAnswers.ventilation)) {
        addSection('Ventilation', [
          makeGuidedPriceItem('Bath fan', 1, 'ea', 175, 'material', ['fan'], 'Fan allowance'),
          makeGuidedPriceItem('Bath fan install labor', 2.5, 'hr', 62, 'labor', ['electric'], 'Install or replace bath fan'),
        ]);
      } else {
        warnings.push('Bathrooms typically need working ventilation. Confirm fan scope with the customer.');
      }
    } else if (project === 'roofing') {
      const roofArea = answerNumber(guidedAnswers.roofArea, 1800);
      const material = String(guidedAnswers.roofMaterial || 'architectural-shingle');
      addSection('Roof System', [
        makeGuidedPriceItem(`${material.replace('-', ' ')} roofing`, Number((roofArea * 1.08).toFixed(2)), 'sq ft', material === 'metal' ? 9.5 : material === 'membrane' ? 7.25 : 3.85, 'material', ['roof', material], 'Roof material with waste'),
        makeGuidedPriceItem('Roofing install labor', Number((roofArea * (material === 'metal' ? 0.075 : 0.06)).toFixed(2)), 'hr', 58, 'labor', ['roof'], 'Install selected roof system'),
      ]);

      if (isAffirmative(guidedAnswers.tearOff)) {
        const tearOff = makeGuidedAssemblyItems(['roofing', 'tear'], roofArea);
        addSection('Tear-off and Disposal', tearOff.length > 0 ? tearOff : [
          makeGuidedPriceItem('Roof tear-off labor', Number((roofArea * 0.04).toFixed(2)), 'hr', 48, 'labor', ['demo', 'roof'], 'Remove existing roofing'),
          makeGuidedPriceItem('Roofing debris disposal', 1, 'ls', 850, 'other', ['dump'], 'Dumpster and disposal allowance'),
        ]);
      } else {
        warnings.push('No tear-off selected. Confirm existing layers and code requirements.');
      }

      if (isAffirmative(guidedAnswers.deckingRepair)) {
        const sheets = answerNumber(guidedAnswers.deckingSheets, 5);
        addSection('Decking Repair', [
          makeGuidedPriceItem('Roof decking sheets', sheets, 'sheet', 42, 'material', ['plywood', 'osb'], 'Decking repair allowance'),
          makeGuidedPriceItem('Decking repair labor', sheets * 0.75, 'hr', 55, 'labor', ['roof', 'carp'], 'Replace damaged decking'),
        ]);
      }

      if (isAffirmative(guidedAnswers.gutters)) {
        const lf = answerNumber(guidedAnswers.gutterLf, 160);
        addSection('Gutters', [
          makeGuidedPriceItem('Gutter system', lf, 'lf', 9.5, 'material', ['gutter'], 'Gutters and accessories'),
          makeGuidedPriceItem('Gutter install labor', Number((lf * 0.04).toFixed(2)), 'hr', 55, 'labor', ['gutter'], 'Install gutters and downspouts'),
        ]);
      }

      if (['steep', 'difficult'].includes(String(guidedAnswers.roofPitch || ''))) {
        addSection('Access and Safety', [
          makeGuidedPriceItem('Steep roof/access allowance', 1, 'ls', guidedAnswers.roofPitch === 'steep' ? 950 : 1350, 'equipment', ['safety', 'lift'], 'Safety, staging, and access premium'),
        ]);
      }
    } else {
      const area = answerNumber(guidedAnswers.projectArea, 250);
      if (isAffirmative(guidedAnswers.demo)) {
        addSection('Demolition', [
          ...makeGuidedAssemblyItems(['room', 'demolition'], Math.max(1, Math.ceil(area / 150))),
          makeGuidedPriceItem('Demo and haul allowance', 1, 'ls', Math.max(650, area * 3.25), 'other', ['demo'], 'Demolition and disposal allowance'),
        ]);
      }
      if (isAffirmative(guidedAnswers.flooring)) {
        const sf = answerNumber(guidedAnswers.flooringSf, area);
        const flooringType = String(guidedAnswers.flooringType || 'lvp');
        const floorAssembly = makeGuidedAssemblyItems([flooringType === 'tile' ? 'tile' : flooringType, 'floor'], sf);
        addSection('Flooring', floorAssembly.length > 0 ? floorAssembly : [
          makeGuidedPriceItem(`${flooringType.toUpperCase()} flooring`, Number((sf * 1.08).toFixed(2)), 'sq ft', flooringType === 'hardwood' ? 8 : flooringType === 'tile' ? 5 : 4.5, 'material', [flooringType, 'floor'], 'Flooring material allowance'),
          makeGuidedPriceItem('Floor install labor', Number((sf * 0.06).toFixed(2)), 'hr', 55, 'labor', ['floor'], 'Flooring installation labor'),
        ]);
      }
      if (isAffirmative(guidedAnswers.paint)) {
        const rooms = answerNumber(guidedAnswers.paintRooms, 2);
        addSection('Paint', [
          makeGuidedPriceItem('Paint materials', rooms, 'room', 145, 'material', ['paint'], 'Paint, primer, sundries'),
          makeGuidedPriceItem('Interior paint labor', rooms * 6, 'hr', 48, 'labor', ['paint'], 'Prep and paint rooms'),
        ]);
      }
      if (isAffirmative(guidedAnswers.plumbing)) addSection('Plumbing', [makeGuidedPriceItem('Plumbing allowance', 1, 'ls', 850, 'subcontractor', ['plumb'], 'Plumbing rough-in or fixture allowance')]);
      if (guidedAnswers.electricalLevel && guidedAnswers.electricalLevel !== 'none') addSection('Electrical', [makeGuidedPriceItem('Electrical allowance', 1, 'ls', guidedAnswers.electricalLevel === 'basic' ? 550 : 1600, 'subcontractor', ['electric'], 'Electrical allowance')]);
      suggestions.push('Review permits, protection, cleanup, and customer exclusions before sending.');
    }

    const hasLabor = sections.some(section => section.lineItems.some(item => item.category === 'labor' || item.isLabor));
    const hasMaterials = sections.some(section => section.lineItems.some(item => item.category === 'material'));
    if (!hasLabor) warnings.push('No labor was generated. Add labor before sending the estimate.');
    if (!hasMaterials) warnings.push('No material items were generated. Confirm material allowances or price book items.');
    if (sections.length === 0) warnings.push('No scope was generated yet. Answer more guided questions or add items manually.');

    return { sections, warnings, suggestions };
  };

  const handleGuidedAnswer = (questionId: string, value: GuidedAnswerValue) => {
    setGuidedAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const handleGenerateGuidedEstimate = () => {
    const generated = buildGuidedScope();
    if (generated.sections.length === 0) {
      showToast('Answer a few scope questions before generating', 'warning');
      return;
    }

    const guidedScopeId = crypto.randomUUID();
    const firstSectionId = generated.sections[0]?.id || null;
    const label = projectType?.label || 'Project';
    const subtotal = generated.sections.reduce((sum, section) => sum + section.lineItems.reduce((sectionSum, item) => sectionSum + getItemCostTotal(item), 0), 0);
    const guidedScope: EstimateScope = {
      id: guidedScopeId,
      name: `${label} Guided Scope`,
      projectType: formData.type as JobType,
      sections: generated.sections,
      subtotal,
      isOptional: false,
      sortOrder: scopes.length,
    };

    setScopes([...scopes, guidedScope]);
    setActiveScopeId(guidedScopeId);
    setActiveSectionId(firstSectionId);
    setShowGuidedBuilder(false);
    setGuidedDismissed(true);
    setFormData(prev => ({
      ...prev,
      name: prev.name === 'New Estimate' ? `${label} Guided Estimate` : prev.name,
      notes: [
        prev.notes,
        generated.warnings.length ? `Guided scope warnings: ${generated.warnings.join('; ')}` : '',
        generated.suggestions.length ? `Guided scope suggestions: ${generated.suggestions.join('; ')}` : '',
      ].filter(Boolean).join('\n'),
    }));
    showToast('Guided estimate scope generated');
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
      clientAllowances: estimateAllowances,
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
  const guidedQuestions = useMemo(() => getGuidedQuestions(String(formData.type || 'default')), [formData.type]);
  const visibleGuidedQuestions = useMemo(() => guidedQuestions.filter(question => !question.showIf || question.showIf(guidedAnswers)), [guidedQuestions, guidedAnswers]);
  const currentGuidedQuestion = visibleGuidedQuestions[Math.min(guidedStep, Math.max(visibleGuidedQuestions.length - 1, 0))];
  const guidedProgress = visibleGuidedQuestions.length > 0 ? ((Math.min(guidedStep, visibleGuidedQuestions.length - 1) + 1) / visibleGuidedQuestions.length) * 100 : 0;
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

  const addEstimateAllowance = () => {
    if (!allowanceForm.name.trim() || !allowanceForm.amount) {
      showToast('Allowance name and amount required', 'error');
      return;
    }
    const amount = parseFloat(allowanceForm.amount) || 0;
    const allowance: Allowance = {
      id: crypto.randomUUID(),
      jobId: '',
      estimateId: estimate?.id,
      name: allowanceForm.name.trim(),
      category: allowanceForm.category,
      allowanceAmount: amount,
      usedAmount: 0,
      remainingAmount: amount,
      status: 'under',
      clientResponsible: allowanceForm.clientResponsible,
      affectsContractorCost: false,
      includeInClientProposal: allowanceForm.includeInClientProposal,
      notes: allowanceForm.notes,
      selections: [],
    };
    setEstimateAllowances([...estimateAllowances, allowance]);
    setAllowanceForm({ name: '', category: 'materials', amount: '', notes: '', clientResponsible: true, includeInClientProposal: true });
    showToast('Allowance added outside contractor cost math');
  };

  const guidedPreview = showGuidedBuilder ? buildGuidedScope() : null;
  const hasGuidedAnswer = currentGuidedQuestion
    ? guidedAnswers[currentGuidedQuestion.id] !== undefined && guidedAnswers[currentGuidedQuestion.id] !== ''
    : false;

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
                  onClick={() => {
                    setFormData({...formData, type: pt.value as JobType});
                    setShowProjectTypePicker(false);
                    setGuidedStep(0);
                    setGuidedAnswers({});
                    setGuidedDismissed(false);
                    setShowGuidedBuilder(false);
                  }}>
                  <div className="eb-typeIcon" style={{background: `${pt.color}20`, color: pt.color}}><pt.icon size={24} /></div>
                  <div className="eb-typeLabel">{pt.label}</div>
                </button>
              ))}
            </div>
          </div>

          {projectType && !showGuidedBuilder && !guidedDismissed && (
            <div className="eb-section eb-guidedPrompt">
              <div className="eb-guidedPromptCopy">
                <div className="eb-guidedIcon"><Zap size={20} /></div>
                <div>
                  <p className="eb-sectionEyebrow">Smart Scope Builder</p>
                  <h2>Build a guided {projectType.label.toLowerCase()} estimate in under 2 minutes</h2>
                  <p>Answer structured questions and the builder will add assemblies, price book items, quantities, labor hours, warnings, and related-work suggestions.</p>
                </div>
              </div>
              <div className="eb-guidedPromptActions">
                <button className="eb-actionBtn eb-actionBtnPrimary" onClick={() => { setShowGuidedBuilder(true); setGuidedStep(0); }}>
                  <Zap size={16} /><span>Start Guided Estimate</span>
                </button>
                <button className="eb-actionBtn" onClick={() => setGuidedDismissed(true)}>Build Manually</button>
              </div>
            </div>
          )}

          {showGuidedBuilder && currentGuidedQuestion && (
            <div className="eb-section eb-guidedBuilder">
              <div className="eb-sectionHeader">
                <div>
                  <p className="eb-sectionEyebrow">Guided Estimate System</p>
                  <h2>{projectType?.label || 'Project'} Scope Questions</h2>
                </div>
                <span className="eb-sectionPill">Step {Math.min(guidedStep + 1, visibleGuidedQuestions.length)} of {visibleGuidedQuestions.length}</span>
              </div>

              <div className="eb-guidedProgress">
                <div style={{ width: `${guidedProgress}%` }} />
              </div>

              <div className="eb-guidedQuestionCard">
                <div>
                  <h3>{currentGuidedQuestion.title}</h3>
                  {currentGuidedQuestion.helper && <p>{currentGuidedQuestion.helper}</p>}
                </div>

                {currentGuidedQuestion.type === 'yesNo' && (
                  <div className="eb-guidedChoices two">
                    <button className={guidedAnswers[currentGuidedQuestion.id] === true ? 'selected' : ''} onClick={() => handleGuidedAnswer(currentGuidedQuestion.id, true)}>Yes</button>
                    <button className={guidedAnswers[currentGuidedQuestion.id] === false ? 'selected' : ''} onClick={() => handleGuidedAnswer(currentGuidedQuestion.id, false)}>No</button>
                  </div>
                )}

                {currentGuidedQuestion.type === 'multipleChoice' && (
                  <div className="eb-guidedChoices">
                    {currentGuidedQuestion.options?.map(option => (
                      <button key={option.value} className={guidedAnswers[currentGuidedQuestion.id] === option.value ? 'selected' : ''} onClick={() => handleGuidedAnswer(currentGuidedQuestion.id, option.value)}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}

                {currentGuidedQuestion.type === 'numeric' && (
                  <div className="eb-guidedNumber">
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      value={String(guidedAnswers[currentGuidedQuestion.id] ?? '')}
                      onChange={event => handleGuidedAnswer(currentGuidedQuestion.id, event.target.value)}
                      placeholder="Enter quantity"
                    />
                    {currentGuidedQuestion.unit && <span>{currentGuidedQuestion.unit}</span>}
                  </div>
                )}

                {currentGuidedQuestion.type === 'dropdown' && (
                  <select className="form-select" value={String(guidedAnswers[currentGuidedQuestion.id] ?? '')} onChange={event => handleGuidedAnswer(currentGuidedQuestion.id, event.target.value)}>
                    <option value="">Select one...</option>
                    {currentGuidedQuestion.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                )}
              </div>

              {guidedPreview && (guidedPreview.warnings.length > 0 || guidedPreview.suggestions.length > 0) && (
                <div className="eb-guidedSignals">
                  {guidedPreview.warnings.map(warning => (
                    <div className="eb-guidedSignal warning" key={warning}><AlertTriangle size={15} />{warning}</div>
                  ))}
                  {guidedPreview.suggestions.map(suggestion => (
                    <div className="eb-guidedSignal suggestion" key={suggestion}><CheckCircle size={15} />{suggestion}</div>
                  ))}
                </div>
              )}

              <div className="eb-guidedFooter">
                <button className="eb-actionBtn" onClick={() => setShowGuidedBuilder(false)}>Switch to Manual</button>
                <div>
                  <button className="eb-actionBtn" disabled={guidedStep === 0} onClick={() => setGuidedStep(Math.max(0, guidedStep - 1))}>Back</button>
                  {guidedStep < visibleGuidedQuestions.length - 1 ? (
                    <button className="eb-actionBtn eb-actionBtnPrimary" disabled={!hasGuidedAnswer} onClick={() => setGuidedStep(Math.min(visibleGuidedQuestions.length - 1, guidedStep + 1))}>Next</button>
                  ) : (
                    <button className="eb-actionBtn eb-actionBtnPrimary" disabled={!hasGuidedAnswer} onClick={handleGenerateGuidedEstimate}>Generate Estimate</button>
                  )}
                </div>
              </div>
            </div>
          )}

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

          <div className="eb-section allowance-panel">
            <div className="eb-sectionHeader">
              <div>
                <p className="eb-sectionEyebrow">Client Allowances</p>
                <h2>Allowance Tracking</h2>
              </div>
              <span className="eb-sectionPill">Excluded from contractor cost</span>
            </div>
            <div className="allowance-form-grid">
              <input className="form-input" value={allowanceForm.name} onChange={e => setAllowanceForm({ ...allowanceForm, name: e.target.value })} placeholder="Allowance name" />
              <select className="form-select" value={allowanceForm.category} onChange={e => setAllowanceForm({ ...allowanceForm, category: e.target.value as AllowanceCategory })}>
                {['materials', 'fixtures', 'cabinets', 'flooring', 'lighting', 'plumbing', 'appliances', 'other'].map(category => <option key={category} value={category}>{category}</option>)}
              </select>
              <input className="form-input" type="number" value={allowanceForm.amount} onChange={e => setAllowanceForm({ ...allowanceForm, amount: e.target.value })} placeholder="Amount" />
              <button className="eb-actionBtn eb-actionBtnPrimary" onClick={addEstimateAllowance}>Add Allowance</button>
            </div>
            <div className="allowance-toggle-row">
              <label><input type="checkbox" checked={allowanceForm.clientResponsible} onChange={e => setAllowanceForm({ ...allowanceForm, clientResponsible: e.target.checked })} /> Client responsible</label>
              <label><input type="checkbox" checked={allowanceForm.includeInClientProposal} onChange={e => setAllowanceForm({ ...allowanceForm, includeInClientProposal: e.target.checked })} /> Show in client proposal</label>
            </div>
            <textarea className="form-textarea" value={allowanceForm.notes} onChange={e => setAllowanceForm({ ...allowanceForm, notes: e.target.value })} placeholder="Allowance description or client selection notes" />
            <div className="allowance-card-grid">
              {estimateAllowances.filter(item => !clientView || item.includeInClientProposal !== false).map(allowance => (
                <div className="allowance-card" key={allowance.id}>
                  <div><strong>{allowance.name}</strong><span>{allowance.category} allowance</span></div>
                  <b>{formatCurrency(allowance.allowanceAmount)}</b>
                  {!clientView && <small>Used {formatCurrency(allowance.usedAmount)} - Remaining {formatCurrency(allowance.remainingAmount)}</small>}
                  {!clientView && <em>Client Allowance - does not affect contractor cost, subtotal, profit, or margin.</em>}
                  {!clientView && <button className="eb-iconBtn" onClick={() => setEstimateAllowances(estimateAllowances.filter(item => item.id !== allowance.id))}><Trash2 size={14} /></button>}
                </div>
              ))}
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
