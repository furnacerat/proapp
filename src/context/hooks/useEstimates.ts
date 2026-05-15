import type { Dispatch, SetStateAction } from 'react';
import type {
  Allowance,
  AllowanceSelection,
  AppData,
  Estimate,
  EstimateLineItem,
  Job,
  MaterialOrder,
  ShoppingList,
  Task,
} from '../../data/types';
import { dataService } from '../../services/dataService';

interface EstimateHookDeps {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
  addJob: (job: Omit<Job, 'id' | 'createdAt' | 'updatedAt' | 'actualCost'>) => string;
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  addAllowance: (allowance: Omit<Allowance, 'id' | 'usedAmount' | 'remainingAmount' | 'status' | 'selections'> & { selections?: AllowanceSelection[] }) => string;
  addShoppingList: (list: Omit<ShoppingList, 'id' | 'createdAt'>) => string;
  addMaterialOrder: (order: Omit<MaterialOrder, 'id' | 'createdAt' | 'updatedAt'>) => string;
}

export function useEstimates({
  data,
  setData,
  addJob,
  addTask,
  addAllowance,
  addShoppingList,
  addMaterialOrder,
}: EstimateHookDeps) {
  const calculateEstimateTotals = (estimate: Partial<Estimate>) => {
    const allScopes = estimate.scopes || [];
    const legacySections = estimate.sections || [];
    let allItems: EstimateLineItem[] = [];
    const scopeTotals: Record<string, number> = {};
    const lineTotal = (item: EstimateLineItem) => (item.quantity || 0) * (item.unitPrice || 0);
    const isCounted = (item: EstimateLineItem) => !item.isExcluded;

    allScopes.forEach(scope => {
      const scopeItems = (scope.sections?.flatMap(s => s.lineItems || []) || []).filter(isCounted);
      allItems = [...allItems, ...scopeItems];

      scopeTotals[scope.id] = scopeItems.reduce((sum, i) => sum + lineTotal(i), 0);
    });

    legacySections.forEach(section => {
      allItems = [...allItems, ...(section.lineItems || []).filter(isCounted)];
    });

    const laborTotal = allItems.filter(i => i.isLabor || i.category === 'labor').reduce((sum, i) => sum + lineTotal(i), 0);
    const materialTotal = allItems.filter(i => i.category === 'material').reduce((sum, i) => sum + lineTotal(i), 0);
    const equipmentTotal = allItems.filter(i => i.category === 'equipment').reduce((sum, i) => sum + lineTotal(i), 0);
    const subcontractorTotal = allItems.filter(i => i.category === 'subcontractor').reduce((sum, i) => sum + lineTotal(i), 0);

    const subtotal = allItems.reduce((sum, i) => sum + lineTotal(i), 0);
    const markupAmount = subtotal * ((estimate.markupPercent || 0) / 100);
    const total = subtotal + markupAmount;

    const projectedLaborHours = allItems.filter(i => i.isLabor || i.category === 'labor').reduce((sum, i) => sum + (i.hours || 0), 0);
    const projectedMaterialCost = materialTotal;
    const projectedLaborCost = laborTotal;

    return {
      laborTotal,
      materialTotal,
      equipmentTotal,
      subcontractorTotal,
      subtotal,
      markupAmount,
      total,
      projectedLaborHours,
      projectedMaterialCost,
      projectedLaborCost,
      marginAmount: 0,
      marginPercent: 0,
      scopeTotals,
    };
  };

  const addEstimate = (estimate: Omit<Estimate, 'id' | 'createdAt' | 'updatedAt' | 'laborTotal' | 'materialTotal' | 'equipmentTotal' | 'subcontractorTotal' | 'subtotal' | 'markupAmount' | 'total' | 'projectedLaborHours' | 'projectedMaterialCost' | 'projectedLaborCost' | 'marginAmount' | 'marginPercent'>) => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const totals = calculateEstimateTotals({ ...estimate, markupPercent: estimate.markupPercent || 20 });
    const newEstimate: Estimate = {
      ...estimate,
      ...totals,
      id,
      createdAt: now,
      updatedAt: now,
      taxable: estimate.taxable || 'none',
    };
    setData(prev => {
      const next = { ...prev, estimates: [...prev.estimates, newEstimate] };
      dataService.local.saveAppData(next);
      return next;
    });
    void dataService.estimates.createWithItems(newEstimate, [
      ...(newEstimate.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
      ...(newEstimate.sections || []).flatMap(section => section.lineItems || []),
    ]).catch(() => undefined);
    return id;
  };

  const updateEstimate = (id: string, updates: Partial<Estimate>) => {
    setData(prev => {
      const existing = prev.estimates.find(e => e.id === id);
      if (!existing) return prev;
      const merged = { ...existing, ...updates };
      const totals = calculateEstimateTotals(merged);
      return {
        ...prev,
        estimates: prev.estimates.map(e => e.id === id ? { ...e, ...updates, ...totals, updatedAt: new Date().toISOString() } : e),
      };
    });
    const existing = data.estimates.find(e => e.id === id);
    if (existing) {
      const merged = { ...existing, ...updates };
      const totals = calculateEstimateTotals(merged);
      const updated = { ...merged, ...totals, updatedAt: new Date().toISOString() };
      void dataService.estimates.updateWithItems(id, updated, [
        ...(updated.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
        ...(updated.sections || []).flatMap(section => section.lineItems || []),
      ]).catch(() => undefined);
    }
  };

  const duplicateEstimate = (id: string) => {
    const estimate = data.estimates.find(e => e.id === id);
    if (!estimate) return '';

    const duplicateSections = (sections: NonNullable<Estimate['sections']> = []) => sections.map(section => ({
      ...section,
      id: crypto.randomUUID(),
      lineItems: section.lineItems?.map(item => ({ ...item, id: crypto.randomUUID() })) || [],
    }));

    const newId = addEstimate({
      estimateNumber: `EST-${new Date().getFullYear()}-${String(data.estimates.length + 1).padStart(3, '0')}`,
      customerId: estimate.customerId,
      name: `${estimate.name} (Copy)`,
      address: estimate.address,
      type: estimate.type || 'remodel',
      status: 'draft',
      scopes: estimate.scopes?.map(scope => ({
        ...scope,
        id: crypto.randomUUID(),
        sections: duplicateSections(scope.sections || []),
      })) || [],
      sections: duplicateSections(estimate.sections || []),
      markupPercent: estimate.markupPercent,
      taxable: estimate.taxable,
      notes: estimate.notes,
      validUntil: estimate.validUntil,
    });
    return newId;
  };

  const archiveEstimate = (id: string) => {
    updateEstimate(id, { status: 'archived', archivedAt: new Date().toISOString() });
  };

  const deleteEstimate = (id: string) => {
    setData(prev => ({ ...prev, estimates: prev.estimates.filter(e => e.id !== id) }));
    void dataService.estimates.delete(id).catch(() => undefined);
  };

  const convertEstimateToJob = (estimateId: string, options?: { startDate?: string; dueDate?: string; copyLineItems?: boolean; copyPricing?: boolean; copyNotes?: boolean }) => {
    const estimate = data.estimates.find(e => e.id === estimateId);
    if (!estimate) return '';

    const customer = data.customers.find(c => c.id === estimate.customerId);
    const opt = options || {};
    const jobId = addJob({
      name: estimate.name,
      customerId: estimate.customerId,
      customer: customer?.name || '',
      customerPhone: customer?.phone || '',
      customerEmail: customer?.email || '',
      address: estimate.address,
      type: estimate.type || 'remodel',
      contractAmount: opt.copyPricing !== false ? estimate.total : 0,
      estimatedCost: opt.copyPricing !== false ? estimate.subtotal : 0,
      startDate: opt.startDate || new Date().toISOString().split('T')[0],
      dueDate: opt.dueDate || '',
      status: 'active',
      estimateId: estimate.id,
      notes: opt.copyNotes ? estimate.notes : '',
    });

    updateEstimate(estimateId, { status: 'converted', convertedToJobId: jobId });
    void dataService.jobs.copyEstimateItemsToJob(jobId, estimateId).catch(() => undefined);
    (estimate.clientAllowances || []).forEach(allowance => {
      addAllowance({
        ...allowance,
        jobId,
        estimateId,
        affectsContractorCost: false,
      });
    });
    const estimateItems = [
      ...(estimate.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || [])),
      ...(estimate.sections || []).flatMap(section => section.lineItems || []),
    ];
    const materialItems = estimateItems.filter(item => item.category === 'material' && !item.isExcluded);
    if (materialItems.length > 0) {
      addShoppingList({
        jobId,
        jobName: estimate.name,
        customerId: estimate.customerId,
        estimateId,
        title: `${estimate.name} Material List`,
        status: 'open',
        notes: 'Created from approved estimate during job conversion.',
        items: materialItems.map(item => ({
          id: crypto.randomUUID(),
          name: item.name,
          category: 'material' as const,
          quantity: item.quantity || item.defaultQuantity || 0,
          unit: item.unit,
          estimatedCost: (item.quantity || item.defaultQuantity || 0) * (item.unitCost || item.unitPrice || 0),
          purchased: false,
          urgent: false,
          notes: item.notes,
          linkedPriceBookItemId: item.linkedMaterialId,
          linkedEstimateLineItemId: item.id,
          addOnStatus: 'included_expense' as const,
          allowanceId: item.isAllowance ? item.id : undefined,
        })),
      });
      addMaterialOrder({
        estimateId,
        jobId,
        customerId: estimate.customerId,
        poNumber: `PO-${Date.now().toString().slice(-6)}`,
        status: 'draft',
        items: materialItems.map(item => {
          const quantity = item.quantity || item.defaultQuantity || 0;
          const unitPrice = item.unitCost || item.unitPrice || 0;
          return {
            id: crypto.randomUUID(),
            name: item.name,
            description: item.description,
            quantity,
            unit: item.unit,
            unitPrice,
            category: 'material' as const,
            lineTotal: quantity * unitPrice,
            allowanceId: item.isAllowance ? item.id : undefined,
          };
        }),
        subtotal: materialItems.reduce((sum, item) => {
          const quantity = item.quantity || item.defaultQuantity || 0;
          return sum + quantity * (item.unitCost || item.unitPrice || 0);
        }, 0),
        total: materialItems.reduce((sum, item) => {
          const quantity = item.quantity || item.defaultQuantity || 0;
          return sum + quantity * (item.unitCost || item.unitPrice || 0);
        }, 0),
        notes: 'Draft material order created from approved estimate.',
      });
    }
    [
      { title: 'Collect deposit', priority: 'high' as const, taskType: 'follow_up' as const },
      { title: 'Order materials', priority: 'high' as const, taskType: 'order' as const },
      { title: 'Schedule kickoff / inspection', priority: 'medium' as const, taskType: 'inspection' as const },
      { title: 'Start demo / first work phase', priority: 'medium' as const, taskType: 'task' as const },
    ].forEach(task => addTask({
      title: task.title,
      description: `Auto-created from approved estimate ${estimate.estimateNumber}.`,
      dueDate: new Date().toISOString().split('T')[0],
      customerId: estimate.customerId,
      estimateId,
      jobId,
      priority: task.priority,
      status: 'open',
      taskType: task.taskType,
      assignmentRole: 'office',
      sourceType: 'approved_estimate',
      sourceId: estimateId,
    }));
    return jobId;
  };

  return {
    addEstimate,
    updateEstimate,
    deleteEstimate,
    duplicateEstimate,
    archiveEstimate,
    convertEstimateToJob,
  };
}
