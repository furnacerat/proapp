import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { Estimate, EstimateLineItem, MaterialOrder, MaterialOrderItem, MaterialOrderStatus } from '../../data/types';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle,
  ClipboardList,
  Edit3,
  FileText,
  Package,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';

const STATUS_CONFIG: Record<MaterialOrderStatus, { label: string; className: string; tone: string }> = {
  draft: { label: 'Draft', className: 'badge-gray', tone: 'draft' },
  sent: { label: 'Sent', className: 'badge-blue', tone: 'sent' },
  confirmed: { label: 'Confirmed', className: 'badge-blue', tone: 'confirmed' },
  partially_received: { label: 'Partial', className: 'badge-orange', tone: 'partial' },
  received: { label: 'Received', className: 'badge-green', tone: 'received' },
  cancelled: { label: 'Cancelled', className: 'badge-red', tone: 'cancelled' },
};

const pipelineStatuses: MaterialOrderStatus[] = ['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'];
const orderableCategories = new Set(['material', 'equipment', 'subcontractor', 'allowance', 'other']);

interface ManualOrderForm {
  supplierId: string;
  jobId: string;
  expectedDate: string;
  notes: string;
  itemName: string;
  quantity: string;
  unit: string;
  unitPrice: string;
}

const emptyManualForm: ManualOrderForm = {
  supplierId: '',
  jobId: '',
  expectedDate: '',
  notes: '',
  itemName: '',
  quantity: '1',
  unit: 'ea',
  unitPrice: '0',
};

const flattenEstimateItems = (estimate: Estimate): EstimateLineItem[] => {
  const scoped = (estimate.scopes || []).flatMap(scope => scope.sections?.flatMap(section => section.lineItems || []) || []);
  const legacy = (estimate.sections || []).flatMap(section => section.lineItems || []);
  return [...scoped, ...legacy].filter(item => !item.isExcluded && orderableCategories.has(item.category));
};

const getLineItemTotal = (item: EstimateLineItem) => {
  const unitPrice = item.unitCost ?? item.unitPrice ?? 0;
  return (item.quantity || 0) * unitPrice;
};

export function MaterialOrders() {
  const {
    materialOrders,
    suppliers,
    estimates,
    jobs,
    materials,
    allowances,
    addMaterialOrder,
    updateMaterialOrder,
    deleteMaterialOrder,
  } = useApp();
  const { showToast } = useToast();

  const [statusFilter, setStatusFilter] = useState<MaterialOrderStatus | 'all'>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');
  const [jobFilter, setJobFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(materialOrders[0]?.id || null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [showEstimateOrder, setShowEstimateOrder] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [manualForm, setManualForm] = useState<ManualOrderForm>(emptyManualForm);
  const [estimateId, setEstimateId] = useState('');
  const [selectedEstimateItems, setSelectedEstimateItems] = useState<string[]>([]);

  const selectedOrder = useMemo(() => {
    return materialOrders.find(order => order.id === selectedId) || materialOrders[0] || null;
  }, [materialOrders, selectedId]);

  const selectedEstimate = useMemo(() => {
    return estimates.find(estimate => estimate.id === estimateId) || null;
  }, [estimates, estimateId]);

  const estimateItems = useMemo(() => {
    return selectedEstimate ? flattenEstimateItems(selectedEstimate) : [];
  }, [selectedEstimate]);

  const filtered = useMemo(() => {
    let list = materialOrders;
    if (statusFilter !== 'all') list = list.filter(order => order.status === statusFilter);
    if (supplierFilter !== 'all') list = list.filter(order => order.supplierId === supplierFilter || order.supplierName === supplierFilter);
    if (jobFilter !== 'all') list = list.filter(order => order.jobId === jobFilter);
    if (dateFrom) list = list.filter(order => new Date(order.expectedDate || order.createdAt).getTime() >= new Date(dateFrom).getTime());
    if (dateTo) list = list.filter(order => new Date(order.expectedDate || order.createdAt).getTime() <= new Date(dateTo).getTime());

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(order => {
        const job = order.jobId ? jobs.find(j => j.id === order.jobId) : null;
        return (
          order.poNumber.toLowerCase().includes(q) ||
          order.supplierName?.toLowerCase().includes(q) ||
          job?.name.toLowerCase().includes(q) ||
          order.items.some(item => item.name.toLowerCase().includes(q) || item.supplier?.toLowerCase().includes(q))
        );
      });
    }

    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [materialOrders, statusFilter, supplierFilter, jobFilter, dateFrom, dateTo, search, jobs]);

  const kpis = useMemo(() => {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    return [
      {
        label: 'Open Orders',
        value: materialOrders.filter(order => !['received', 'cancelled'].includes(order.status)).length.toString(),
        sub: 'Draft through partial',
        icon: ClipboardList,
      },
      {
        label: 'Pending Delivery',
        value: materialOrders.filter(order => ['sent', 'confirmed', 'partially_received'].includes(order.status)).length.toString(),
        sub: 'Expected or in transit',
        icon: Truck,
      },
      {
        label: 'Delivered This Week',
        value: materialOrders.filter(order => order.status === 'received' && order.receivedDate && new Date(order.receivedDate) >= startOfWeek).length.toString(),
        sub: 'Received POs',
        icon: CheckCircle,
      },
      {
        label: 'Total Spend',
        value: formatCurrency(materialOrders.reduce((sum, order) => sum + order.total, 0)),
        sub: 'All purchase orders',
        icon: BadgeDollarSign,
      },
    ];
  }, [materialOrders]);

  const smartAlerts = useMemo(() => {
    const alerts: { title: string; detail: string; tone: string }[] = [];
    const activeJobs = jobs.filter(job => ['active', 'scheduled', 'approved', 'awaiting_materials'].includes(job.status));
    const orderedJobIds = new Set(materialOrders.filter(order => order.status !== 'cancelled').map(order => order.jobId).filter(Boolean));
    const jobsMissingMaterials = activeJobs.filter(job => !orderedJobIds.has(job.id));
    if (jobsMissingMaterials.length > 0) {
      alerts.push({
        title: 'Missing materials for active jobs',
        detail: `${jobsMissingMaterials.length} active job${jobsMissingMaterials.length === 1 ? '' : 's'} have no material order linked.`,
        tone: 'warning',
      });
    }

    const now = new Date();
    const delayed = materialOrders.filter(order => order.expectedDate && !['received', 'cancelled'].includes(order.status) && new Date(order.expectedDate) < now);
    if (delayed.length > 0) {
      alerts.push({
        title: 'Delayed deliveries',
        detail: `${delayed.length} order${delayed.length === 1 ? '' : 's'} are past the expected delivery date.`,
        tone: 'danger',
      });
    }

    const sentNotReceived = materialOrders.filter(order => ['sent', 'confirmed'].includes(order.status));
    if (sentNotReceived.length > 0) {
      alerts.push({
        title: 'Orders not received',
        detail: `${sentNotReceived.length} order${sentNotReceived.length === 1 ? '' : 's'} still need receiving confirmation.`,
        tone: 'info',
      });
    }

    return alerts.slice(0, 3);
  }, [jobs, materialOrders]);

  const handleStatusChange = (id: string, status: MaterialOrderStatus) => {
    const updates: Partial<MaterialOrder> = { status };
    if (status === 'received') {
      const order = materialOrders.find(item => item.id === id);
      updates.receivedDate = new Date().toISOString();
      if (order) {
        updates.items = order.items.map(item => ({ ...item, receivedQuantity: item.quantity }));
      }
    }
    if (status === 'sent') updates.sentDate = new Date().toISOString();
    updateMaterialOrder(id, updates);
    showToast(`Order marked as ${STATUS_CONFIG[status].label}`);
  };

  const handleDelete = (id: string) => {
    deleteMaterialOrder(id);
    showToast('Order deleted');
    setDeleteConfirm(null);
    if (selectedId === id) setSelectedId(materialOrders.find(order => order.id !== id)?.id || null);
  };

  const createOrder = (order: Omit<MaterialOrder, 'id' | 'createdAt' | 'updatedAt'>) => {
    const id = addMaterialOrder(order);
    setSelectedId(id);
    showToast('Material order created');
  };

  const resetManualOrderModal = () => {
    setManualForm(emptyManualForm);
    setEditingOrderId(null);
    setShowNewOrder(false);
  };

  const openNewManualOrder = () => {
    setManualForm(emptyManualForm);
    setEditingOrderId(null);
    setShowNewOrder(true);
  };

  const openEditOrder = (order: MaterialOrder) => {
    const firstItem = order.items[0];
    setManualForm({
      supplierId: order.supplierId || '',
      jobId: order.jobId || '',
      expectedDate: order.expectedDate || '',
      notes: order.notes || '',
      itemName: firstItem?.name || '',
      quantity: String(firstItem?.quantity ?? 1),
      unit: firstItem?.unit || 'ea',
      unitPrice: String(firstItem?.unitPrice ?? 0),
    });
    setEditingOrderId(order.id);
    setShowNewOrder(true);
  };

  const handleSaveManualOrder = () => {
    if (!manualForm.itemName.trim()) {
      showToast('Add at least one item', 'error');
      return;
    }
    const supplier = suppliers.find(item => item.id === manualForm.supplierId);
    const quantity = parseFloat(manualForm.quantity) || 0;
    const unitPrice = parseFloat(manualForm.unitPrice) || 0;
    const lineTotal = quantity * unitPrice;
    const item: MaterialOrderItem = {
      id: crypto.randomUUID(),
      name: manualForm.itemName.trim(),
      quantity,
      unit: manualForm.unit || 'ea',
      unitPrice,
      category: 'material',
      supplier: supplier?.name,
      supplierId: supplier?.id,
      orderedQuantity: quantity,
      receivedQuantity: 0,
      lineTotal,
      costTreatment: 'contractor_cost',
    };

    if (editingOrderId) {
      const order = materialOrders.find(existing => existing.id === editingOrderId);
      const items = order?.items.length
        ? order.items.map((existing, index) => index === 0 ? { ...existing, ...item, id: existing.id } : existing)
        : [item];
      const subtotal = items.reduce((sum, orderItem) => sum + orderItem.lineTotal, 0);
      updateMaterialOrder(editingOrderId, {
        supplierId: supplier?.id,
        supplierName: supplier?.name,
        jobId: manualForm.jobId || undefined,
        items,
        subtotal,
        total: subtotal,
        expectedDate: manualForm.expectedDate || undefined,
        notes: manualForm.notes,
      });
      showToast('Order updated');
      resetManualOrderModal();
      return;
    }

    createOrder({
      poNumber: `PO-${new Date().getFullYear()}-${String(materialOrders.length + 1).padStart(3, '0')}`,
      supplierId: supplier?.id,
      supplierName: supplier?.name,
      jobId: manualForm.jobId || undefined,
      status: 'draft',
      items: [item],
      subtotal: lineTotal,
      total: lineTotal,
      expectedDate: manualForm.expectedDate || undefined,
      notes: manualForm.notes,
    });
    resetManualOrderModal();
  };

  const handleCreateFromEstimate = () => {
    if (!selectedEstimate) {
      showToast('Select an estimate', 'error');
      return;
    }
    const chosen = estimateItems.filter(item => selectedEstimateItems.includes(item.id));
    if (chosen.length === 0) {
      showToast('Select at least one material item', 'error');
      return;
    }

    const orderItems: MaterialOrderItem[] = chosen.map(item => {
      const linkedMaterial = item.linkedMaterialId ? materials.find(material => material.id === item.linkedMaterialId) : undefined;
      const supplier = suppliers.find(s => s.name === linkedMaterial?.supplier);
      const unitPrice = item.unitCost ?? item.unitPrice ?? 0;
      return {
        id: crypto.randomUUID(),
        name: item.name,
        description: item.description,
        quantity: item.quantity || 0,
        unit: item.unit,
        unitPrice,
        category: item.category,
        supplier: linkedMaterial?.supplier,
        supplierId: supplier?.id,
        orderedQuantity: item.quantity || 0,
        receivedQuantity: 0,
        lineTotal: (item.quantity || 0) * unitPrice,
        costTreatment: 'contractor_cost',
      };
    });

    const firstSupplierId = orderItems.find(item => item.supplierId)?.supplierId;
    const supplier = firstSupplierId ? suppliers.find(item => item.id === firstSupplierId) : undefined;
    const job = jobs.find(item => item.estimateId === selectedEstimate.id);
    const subtotal = orderItems.reduce((sum, item) => sum + item.lineTotal, 0);

    createOrder({
      poNumber: `PO-${new Date().getFullYear()}-${String(materialOrders.length + 1).padStart(3, '0')}`,
      estimateId: selectedEstimate.id,
      jobId: job?.id,
      supplierId: supplier?.id,
      supplierName: supplier?.name || orderItems.find(item => item.supplier)?.supplier,
      status: 'draft',
      items: orderItems,
      subtotal,
      total: subtotal,
      notes: `Generated from estimate ${selectedEstimate.estimateNumber}`,
    });
    setEstimateId('');
    setSelectedEstimateItems([]);
    setShowEstimateOrder(false);
  };

  const reorderSelected = () => {
    if (!selectedOrder) return;
    createOrder({
      poNumber: `PO-${new Date().getFullYear()}-${String(materialOrders.length + 1).padStart(3, '0')}`,
      estimateId: selectedOrder.estimateId,
      jobId: selectedOrder.jobId,
      supplierId: selectedOrder.supplierId,
      supplierName: selectedOrder.supplierName,
      status: 'draft',
      items: selectedOrder.items.map(item => ({
        ...item,
        id: crypto.randomUUID(),
        receivedQuantity: 0,
        orderedQuantity: item.quantity,
      })),
      subtotal: selectedOrder.subtotal,
      tax: selectedOrder.tax,
      total: selectedOrder.total,
      notes: `Reorder from ${selectedOrder.poNumber}`,
    });
  };

  const selectedSupplier = selectedOrder?.supplierId ? suppliers.find(supplier => supplier.id === selectedOrder.supplierId) : null;
  const selectedJob = selectedOrder?.jobId ? jobs.find(job => job.id === selectedOrder.jobId) : null;
  const selectedEstimateForOrder = selectedOrder?.estimateId ? estimates.find(estimate => estimate.id === selectedOrder.estimateId) : null;
  const selectedJobAllowances = selectedOrder?.jobId ? allowances.filter(allowance => allowance.jobId === selectedOrder.jobId) : [];
  const updateSelectedOrderItem = (itemId: string, updates: Partial<MaterialOrderItem>) => {
    if (!selectedOrder) return;
    updateMaterialOrder(selectedOrder.id, {
      items: selectedOrder.items.map(item => item.id === itemId ? { ...item, ...updates } : item),
    });
  };

  return (
    <div className="orders-page">
      <div className="orders-shell">
        <header className="orders-header">
          <div className="orders-title-group">
            <Link to="/estimates" className="orders-icon-btn"><ArrowLeft size={18} /></Link>
            <div>
              <div className="orders-eyebrow">Procurement Command Center</div>
              <h1>Material Orders</h1>
              <p>Track purchases, deliveries, and job materials in real time</p>
            </div>
          </div>
          <div className="orders-header-actions">
            <button className="orders-primary-btn" onClick={openNewManualOrder}>
              <Plus size={18} /> New Order
            </button>
            <button className="orders-secondary-btn" onClick={() => setShowEstimateOrder(true)}>
              <FileText size={18} /> New Order From Estimate
            </button>
          </div>
        </header>

        <section className="orders-kpis">
          {kpis.map(({ label, value, sub, icon: Icon }) => (
            <div className="orders-kpi-card" key={label}>
              <div className="orders-kpi-icon"><Icon size={20} /></div>
              <div>
                <span>{label}</span>
                <strong>{value}</strong>
                <small>{sub}</small>
              </div>
            </div>
          ))}
        </section>

        <section className="orders-pipeline">
          {pipelineStatuses.map(status => {
            const config = STATUS_CONFIG[status];
            const count = materialOrders.filter(order => order.status === status).length;
            return (
              <button
                key={status}
                className={`orders-pipeline-chip ${statusFilter === status ? 'active' : ''}`}
                onClick={() => setStatusFilter(statusFilter === status ? 'all' : status)}
              >
                <span className={`orders-status-dot ${config.tone}`} />
                <strong>{count}</strong>
                {config.label}
              </button>
            );
          })}
        </section>

        <section className="orders-alerts">
          {smartAlerts.length === 0 ? (
            <div className="orders-alert healthy">
              <CheckCircle size={18} />
              <div>
                <strong>Procurement is current</strong>
                <span>No delayed deliveries or missing order links detected.</span>
              </div>
            </div>
          ) : smartAlerts.map(alert => (
            <div className={`orders-alert ${alert.tone}`} key={alert.title}>
              <AlertTriangle size={18} />
              <div>
                <strong>{alert.title}</strong>
                <span>{alert.detail}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="orders-filter-card">
          <div className="orders-search">
            <Search size={18} />
            <input placeholder="Search PO #, supplier, item, or job..." value={search} onChange={event => setSearch(event.target.value)} />
          </div>
          <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as MaterialOrderStatus | 'all')}>
            <option value="all">All Statuses</option>
            {pipelineStatuses.map(status => <option key={status} value={status}>{STATUS_CONFIG[status].label}</option>)}
          </select>
          <select value={supplierFilter} onChange={event => setSupplierFilter(event.target.value)}>
            <option value="all">All Suppliers</option>
            {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
          </select>
          <select value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
            <option value="all">All Jobs</option>
            {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
          </select>
          <input type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} title="Date from" />
          <input type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} title="Date to" />
        </section>

        {materialOrders.length === 0 ? (
          <section className="orders-empty-card">
            <div className="orders-empty-icon"><ShoppingCart size={34} /></div>
            <h2>Create your first material order</h2>
            <p>Generate orders directly from your estimates</p>
            <div className="orders-empty-actions">
              <button className="orders-primary-btn" onClick={openNewManualOrder}><Plus size={18} /> New Order</button>
              <button className="orders-secondary-btn" onClick={() => setShowEstimateOrder(true)}><FileText size={18} /> Create From Estimate</button>
            </div>
          </section>
        ) : (
          <div className="orders-workspace">
            <section className="orders-list-card">
              <div className="orders-list-heading">
                <span>{filtered.length} order{filtered.length === 1 ? '' : 's'}</span>
                <span>{statusFilter === 'all' ? 'All statuses' : STATUS_CONFIG[statusFilter].label}</span>
              </div>
              <div className="orders-list">
                {filtered.length === 0 ? (
                  <div className="orders-no-results">
                    <Search size={28} />
                    <h3>No orders match these filters</h3>
                    <p>Try a different supplier, job, date range, or status.</p>
                  </div>
                ) : filtered.map(order => {
                  const supplier = order.supplierId ? suppliers.find(s => s.id === order.supplierId) : null;
                  const job = order.jobId ? jobs.find(j => j.id === order.jobId) : null;
                  const config = STATUS_CONFIG[order.status];
                  return (
                    <div
                      key={order.id}
                      role="button"
                      tabIndex={0}
                      className={`order-card ${selectedOrder?.id === order.id ? 'selected' : ''}`}
                      onClick={() => setSelectedId(order.id)}
                      onKeyDown={event => {
                        if (event.currentTarget !== event.target) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedId(order.id);
                        }
                      }}
                    >
                      <div className="order-card-top">
                        <div>
                          <strong>{order.poNumber}</strong>
                          <span>{supplier?.name || order.supplierName || 'Supplier not assigned'}</span>
                        </div>
                        <span className={`orders-status ${config.tone}`}>{config.label}</span>
                      </div>
                      <div className="order-card-grid">
                        <span><Package size={14} /> {order.items.length} item{order.items.length === 1 ? '' : 's'}</span>
                        <span><BadgeDollarSign size={14} /> {formatCurrency(order.total)}</span>
                        <span><Truck size={14} /> {order.expectedDate ? formatDate(order.expectedDate) : 'No delivery date'}</span>
                        <span><ClipboardList size={14} /> {job?.name || 'No job linked'}</span>
                      </div>
                      <div className="order-card-actions" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
                        <button className="orders-secondary-btn small" onClick={() => setSelectedId(order.id)}>View</button>
                        {order.status === 'draft' && (
                          <button className="orders-secondary-btn small" onClick={() => handleStatusChange(order.id, 'sent')}>Mark Sent</button>
                        )}
                        {order.status !== 'received' && order.status !== 'cancelled' && (
                          <button className="orders-primary-btn small" onClick={() => handleStatusChange(order.id, 'received')}>Mark Received</button>
                        )}
                        <button className="orders-secondary-btn small danger" onClick={() => setDeleteConfirm(order.id)}>Delete</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <aside className="order-detail-panel">
              {selectedOrder ? (
                <>
                  <div className="order-detail-hero">
                    <div className="orders-kpi-icon"><ShoppingCart size={22} /></div>
                    <div>
                      <h2>{selectedOrder.poNumber}</h2>
                      <p>{selectedSupplier?.name || selectedOrder.supplierName || 'Supplier not assigned'}</p>
                      <span className={`orders-status ${STATUS_CONFIG[selectedOrder.status].tone}`}>{STATUS_CONFIG[selectedOrder.status].label}</span>
                    </div>
                  </div>

                  <div className="order-detail-actions">
                    {selectedOrder.status === 'draft' && (
                      <>
                        <button className="orders-secondary-btn" onClick={() => handleStatusChange(selectedOrder.id, 'sent')}><Truck size={16} /> Mark Sent</button>
                        <button className="orders-primary-btn" onClick={() => handleStatusChange(selectedOrder.id, 'confirmed')}><CheckCircle size={16} /> Confirm</button>
                      </>
                    )}
                    {selectedOrder.status !== 'received' && selectedOrder.status !== 'cancelled' && (
                      <button className="orders-primary-btn" onClick={() => handleStatusChange(selectedOrder.id, 'received')}><CheckCircle size={16} /> Mark as Received</button>
                    )}
                    <button className="orders-secondary-btn" onClick={() => openEditOrder(selectedOrder)}><Edit3 size={16} /> Edit</button>
                    {selectedOrder.status !== 'cancelled' && (
                      <button className="orders-secondary-btn danger" onClick={() => handleStatusChange(selectedOrder.id, 'cancelled')}><XCircle size={16} /> Cancel</button>
                    )}
                    <button className="orders-secondary-btn" onClick={reorderSelected}><RefreshCcw size={16} /> Reorder</button>
                    <button className="orders-secondary-btn" onClick={() => window.print()}><Printer size={16} /> Print</button>
                    <button className="orders-secondary-btn danger" onClick={() => setDeleteConfirm(selectedOrder.id)}><Trash2 size={16} /> Delete</button>
                  </div>

                  <div className="order-detail-meta">
                    <div><span>Job</span><strong>{selectedJob?.name || 'Not linked'}</strong></div>
                    <div><span>Estimate</span><strong>{selectedEstimateForOrder?.estimateNumber || 'Not linked'}</strong></div>
                    <div><span>Expected</span><strong>{selectedOrder.expectedDate ? formatDate(selectedOrder.expectedDate) : 'Not set'}</strong></div>
                    <div><span>Total</span><strong>{formatCurrency(selectedOrder.total)}</strong></div>
                  </div>

                  <div className="order-items-list">
                    <div className="order-detail-section-title">Items</div>
                    {selectedOrder.items.map(item => (
                      <div className="order-item-row" key={item.id}>
                        <div>
                          <strong>{item.name}</strong>
                          <span>{item.description || item.supplier || 'Material item'}</span>
                          <select className="form-select allowance-mini-select" value={item.costTreatment || 'contractor_cost'} onChange={event => updateSelectedOrderItem(item.id, { costTreatment: event.target.value as MaterialOrderItem['costTreatment'] })}>
                            <option value="contractor_cost">Contractor Cost</option>
                            <option value="allowance_item">Client Allowance</option>
                            <option value="client_direct_purchase">Client Paid Direct</option>
                            <option value="reimbursable_allowance">Reimbursable</option>
                          </select>
                          {item.costTreatment && item.costTreatment !== 'contractor_cost' && (
                            <select className="form-select allowance-mini-select" value={item.allowanceId || ''} onChange={event => updateSelectedOrderItem(item.id, { allowanceId: event.target.value || undefined })}>
                              <option value="">Link allowance...</option>
                              {selectedJobAllowances.map(allowance => <option key={allowance.id} value={allowance.id}>{allowance.name}</option>)}
                            </select>
                          )}
                        </div>
                        <div className="order-item-qty">{item.quantity} {item.unit}</div>
                        <div>{formatCurrency(item.lineTotal)}</div>
                      </div>
                    ))}
                  </div>

                  <div className="order-delivery-card">
                    <div className="order-detail-section-title">Delivery Info</div>
                    <div className="order-delivery-grid">
                      <span>Supplier</span><strong>{selectedSupplier ? `${selectedSupplier.name}${selectedSupplier.location ? ` - ${selectedSupplier.location}` : ''}` : selectedOrder.supplierName || 'Not assigned'}</strong>
                      <span>Sent</span><strong>{selectedOrder.sentDate ? formatDate(selectedOrder.sentDate) : 'Not sent'}</strong>
                      <span>Received</span><strong>{selectedOrder.receivedDate ? formatDate(selectedOrder.receivedDate) : 'Not received'}</strong>
                      <span>Notes</span><strong>{selectedOrder.notes || 'No notes'}</strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="orders-no-results">
                  <ShoppingCart size={30} />
                  <h3>Select an order</h3>
                  <p>Order details, delivery tracking, and receiving actions appear here.</p>
                </div>
              )}
            </aside>
          </div>
        )}
      </div>

      <Modal isOpen={showNewOrder} onClose={resetManualOrderModal} title={editingOrderId ? 'Edit Material Order' : 'New Material Order'} size="lg">
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <select className="form-select" value={manualForm.supplierId} onChange={event => setManualForm({ ...manualForm, supplierId: event.target.value })}>
              <option value="">Select supplier...</option>
              {suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Job</label>
            <select className="form-select" value={manualForm.jobId} onChange={event => setManualForm({ ...manualForm, jobId: event.target.value })}>
              <option value="">Select job...</option>
              {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-row form-row-2">
          <div className="form-group">
            <label className="form-label">Expected Delivery</label>
            <input className="form-input" type="date" value={manualForm.expectedDate} onChange={event => setManualForm({ ...manualForm, expectedDate: event.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Item Name *</label>
            <input className="form-input" value={manualForm.itemName} onChange={event => setManualForm({ ...manualForm, itemName: event.target.value })} placeholder="Lumber, drywall, cabinets..." />
          </div>
        </div>
        <div className="form-row form-row-3">
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input className="form-input" type="number" value={manualForm.quantity} onChange={event => setManualForm({ ...manualForm, quantity: event.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Unit</label>
            <input className="form-input" value={manualForm.unit} onChange={event => setManualForm({ ...manualForm, unit: event.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Unit Price</label>
            <input className="form-input" type="number" value={manualForm.unitPrice} onChange={event => setManualForm({ ...manualForm, unitPrice: event.target.value })} />
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-textarea" value={manualForm.notes} onChange={event => setManualForm({ ...manualForm, notes: event.target.value })} placeholder="Delivery instructions, vendor notes, jobsite contact..." />
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: '16px' }}>
          <button className="orders-secondary-btn" onClick={resetManualOrderModal}>Cancel</button>
          <button className="orders-primary-btn" onClick={handleSaveManualOrder}>{editingOrderId ? 'Save Order' : 'Create Order'}</button>
        </div>
      </Modal>

      <Modal isOpen={showEstimateOrder} onClose={() => setShowEstimateOrder(false)} title="Create Order From Estimate" size="lg">
        <div className="form-group">
          <label className="form-label">Estimate</label>
          <select
            className="form-select"
            value={estimateId}
            onChange={event => {
              const nextEstimateId = event.target.value;
              setEstimateId(nextEstimateId);
              const estimate = estimates.find(item => item.id === nextEstimateId);
              setSelectedEstimateItems(estimate ? flattenEstimateItems(estimate).map(item => item.id) : []);
            }}
          >
            <option value="">Select estimate...</option>
            {estimates.map(estimate => <option key={estimate.id} value={estimate.id}>{estimate.estimateNumber} - {estimate.name}</option>)}
          </select>
        </div>
        {selectedEstimate && (
          <div className="estimate-material-picker">
            <div className="order-detail-section-title">Material Items</div>
            {estimateItems.length === 0 ? (
              <div className="orders-no-results">
                <Package size={28} />
                <h3>No orderable materials found</h3>
                <p>This estimate does not have material, equipment, subcontractor, allowance, or other line items.</p>
              </div>
            ) : estimateItems.map(item => {
              const linkedMaterial = item.linkedMaterialId ? materials.find(material => material.id === item.linkedMaterialId) : undefined;
              return (
                <label key={item.id} className="estimate-material-row">
                  <input
                    type="checkbox"
                    checked={selectedEstimateItems.includes(item.id)}
                    onChange={event => {
                      setSelectedEstimateItems(current => event.target.checked
                        ? [...current, item.id]
                        : current.filter(id => id !== item.id)
                      );
                    }}
                  />
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.quantity} {item.unit} - {linkedMaterial?.supplier || 'Supplier auto-fill unavailable'}</span>
                  </div>
                  <strong>{formatCurrency(getLineItemTotal(item))}</strong>
                </label>
              );
            })}
          </div>
        )}
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: '16px' }}>
          <button className="orders-secondary-btn" onClick={() => setShowEstimateOrder(false)}>Cancel</button>
          <button className="orders-primary-btn" onClick={handleCreateFromEstimate}>Create Order</button>
        </div>
      </Modal>

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-box orders-delete-box">
            <h3>Delete Order?</h3>
            <p>This will permanently delete purchase order {materialOrders.find(order => order.id === deleteConfirm)?.poNumber}.</p>
            <div className="flex gap-2 justify-end">
              <button className="orders-secondary-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="orders-secondary-btn danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
