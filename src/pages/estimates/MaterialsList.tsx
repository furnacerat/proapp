import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { EstimateLineItem, EstimateLineCategory, EstimateScope, EstimateSection, MaterialOrderItem, MaterialOrderStatus } from '../../data/types';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { ArrowLeft, Printer, Package, Wrench, Truck, CheckSquare, Square, ShoppingCart, FileText, TruckIcon } from 'lucide-react';

interface OrderDraft {
  supplierId: string;
  supplierName: string;
  poNumber: string;
  expectedDate: string;
  notes: string;
}

export function MaterialsList() {
  const { id } = useParams();
  const { estimates, customers, suppliers, materialOrders, getEstimateCustomer, addMaterialOrder, branding } = useApp();
  const { showToast } = useToast();

  const estimate = estimates?.find(e => e.id === id);
  const customer = estimate ? getEstimateCustomer(estimate.id) : undefined;

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [showCreateOrder, setShowCreateOrder] = useState(false);
  const [orderDraft, setOrderDraft] = useState<OrderDraft>({ supplierId: '', supplierName: '', poNumber: `PO-${new Date().getFullYear()}-${String((materialOrders?.length || 0) + 1).padStart(3, '0')}`, expectedDate: '', notes: '' });

  const allScopes = estimate?.scopes || [];
  const legacySections = estimate?.sections || [];

  const getAllLineItems = (): EstimateLineItem[] => {
    const items: EstimateLineItem[] = [];
    allScopes.forEach(scope => scope.sections?.forEach(section => section.lineItems?.forEach(item => {
      if (!item.isExcluded && !item.isOptional) items.push(item);
    })));
    legacySections.forEach(section => section.lineItems?.forEach(item => {
      if (!item.isExcluded && !item.isOptional) items.push(item);
    }));
    return items;
  };

  const allItems = useMemo(() => getAllLineItems(), [estimate, allScopes, legacySections]);

  const itemKey = (item: EstimateLineItem, idx: number) =>
    `${idx}-${item.name}-${item.category}-${item.unit}`;

  const groupedItems = useMemo(() => {
    const materials: EstimateLineItem[] = [];
    const equipment: EstimateLineItem[] = [];
    const subcontractor: EstimateLineItem[] = [];
    allItems.forEach(item => {
      if (item.category === 'material' || item.category === 'allowance' || item.category === 'other') materials.push(item);
      else if (item.category === 'equipment') equipment.push(item);
      else if (item.category === 'subcontractor') subcontractor.push(item);
    });
    return { materials, equipment, subcontractor };
  }, [allItems]);

  const totals = useMemo(() => {
    const m = groupedItems.materials.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const e = groupedItems.equipment.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const sc = groupedItems.subcontractor.reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    return { materials: m, equipment: e, subcontractor: sc, grand: m + e + sc };
  }, [groupedItems]);

  const selectedItems = useMemo(() => {
    const keys = new Set(selectedKeys);
    return allItems.filter((item, idx) => keys.has(itemKey(item, idx)));
  }, [allItems, selectedKeys]);

  const selectedTotals = useMemo(() => {
    const m = selectedItems.filter(i => i.category === 'material' || i.category === 'allowance' || i.category === 'other').reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const e = selectedItems.filter(i => i.category === 'equipment').reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    const sc = selectedItems.filter(i => i.category === 'subcontractor').reduce((s, i) => s + (i.quantity || 0) * (i.unitPrice || 0), 0);
    return { materials: m, equipment: e, subcontractor: sc, grand: m + e + sc };
  }, [selectedItems]);

  const toggleItem = (key: string) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectAll = () => setSelectedKeys(new Set(allItems.map((item, idx) => itemKey(item, idx))));
  const selectNone = () => setSelectedKeys(new Set());
  const selectCategory = (cat: 'materials' | 'equipment' | 'subcontractor') => {
    setSelectedKeys(prev => {
      const n = new Set(prev);
      groupedItems[cat].forEach((item, idx) => n.add(itemKey(item, idx)));
      return n;
    });
  };

  const handleSupplierChange = (supplierId: string) => {
    const supplier = suppliers.find(s => s.id === supplierId);
    setOrderDraft(prev => ({ ...prev, supplierId, supplierName: supplier?.name || '' }));
  };

  const handleCreateOrder = () => {
    if (!orderDraft.supplierId) { showToast('Select a supplier', 'error'); return; }
    if (selectedItems.length === 0) { showToast('Select at least one item', 'error'); return; }

    const items: MaterialOrderItem[] = selectedItems.map(item => ({
      id: crypto.randomUUID(),
      name: item.name,
      description: item.description,
      quantity: item.quantity || 0,
      unit: item.unit,
      unitPrice: item.unitPrice || 0,
      category: item.category as EstimateLineCategory,
      lineTotal: (item.quantity || 0) * (item.unitPrice || 0),
      supplier: orderDraft.supplierName,
      supplierId: orderDraft.supplierId,
    }));

    const subtotal = items.reduce((s, i) => s + i.lineTotal, 0);

    addMaterialOrder({
      estimateId: estimate?.id,
      supplierId: orderDraft.supplierId,
      supplierName: orderDraft.supplierName,
      poNumber: orderDraft.poNumber,
      status: 'draft' as MaterialOrderStatus,
      items,
      subtotal,
      total: subtotal,
      notes: orderDraft.notes,
      expectedDate: orderDraft.expectedDate || undefined,
    });

    showToast(`Purchase order ${orderDraft.poNumber} created`);
    setShowCreateOrder(false);
    setSelectedKeys(new Set());
    setOrderDraft(prev => ({ ...prev, poNumber: `PO-${new Date().getFullYear()}-${String((materialOrders?.length || 0) + 2).padStart(3, '0')}` }));
  };

  const handlePrintSelected = () => {
    if (selectedItems.length === 0) { showToast('Select items to print', 'error'); return; }
    setShowPrintPreview(true);
  };

  if (!estimate) {
    return (
      <div className="page-container">
        <div className="page-header">
          <Link to="/estimates" className="btn btn-secondary"><ArrowLeft size={18} /></Link>
          <h1>Materials List</h1>
        </div>
        <div className="card"><p className="text-muted">Estimate not found.</p></div>
      </div>
    );
  }

  const printItems = selectedItems;

  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/estimates/${id}`} className="btn btn-secondary"><ArrowLeft size={18} /></Link>
          <div>
            <h1 className="text-2xl font-bold">Materials & Equipment</h1>
            <p className="text-muted text-sm">{estimate.estimateNumber} — {estimate.name}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={handlePrintSelected} disabled={selectedKeys.size === 0}>
            <Printer size={18} /><span className="ml-2">Print Selected ({selectedKeys.size})</span>
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateOrder(true)} disabled={selectedKeys.size === 0}>
            <ShoppingCart size={18} /><span className="ml-2">Create Order ({selectedKeys.size})</span>
          </button>
        </div>
      </div>

      <div className="card mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-muted">Customer:</span><p className="font-medium">{customer?.name || '—'}</p></div>
          <div><span className="text-muted">Address:</span><p className="font-medium">{estimate.address || '—'}</p></div>
          <div><span className="text-muted">Total:</span><p className="font-medium text-lg">{formatCurrency(totals.grand)}</p></div>
          <div><span className="text-muted">Selected:</span><p className="font-medium text-lg text-primary">{formatCurrency(selectedTotals.grand)}</p></div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button className="btn btn-secondary text-sm" onClick={selectAll}>Select All</button>
          <button className="btn btn-secondary text-sm" onClick={selectNone}>Clear</button>
          <button className="btn btn-secondary text-sm" onClick={() => selectCategory('materials')}>Materials</button>
          <button className="btn btn-secondary text-sm" onClick={() => selectCategory('equipment')}>Equipment</button>
        </div>
        <div className="text-sm text-muted">{selectedKeys.size} items selected</div>
      </div>

      <div className="space-y-6">
        {groupedItems.materials.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Package className="text-blue-600" size={20} />
              <h2 className="text-lg font-semibold">Materials</h2>
              <span className="ml-auto text-muted">{formatCurrency(totals.materials)}</span>
            </div>
            <table className="w-full">
              <thead><tr className="border-b text-sm text-muted">
                <th className="text-left py-2 w-8"></th>
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2 w-16">Qty</th>
                <th className="text-right py-2 w-16">Unit</th>
                <th className="text-right py-2 w-24">Unit Price</th>
                <th className="text-right py-2 w-24">Total</th>
              </tr></thead>
              <tbody>
                {groupedItems.materials.map((item, idx) => {
                  const key = itemKey(item, idx);
                  return (
                    <tr key={idx} className={`border-b last:border-0 ${selectedKeys.has(key) ? 'bg-blue-50' : ''}`}>
                      <td className="py-2">
                        <button onClick={() => toggleItem(key)} className="text-muted hover:text-primary">
                          {selectedKeys.has(key) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                        </button>
                      </td>
                      <td className="py-2">
                        <div className="font-medium">{item.name}</div>
                        {item.description && <div className="text-sm text-muted">{item.description}</div>}
                      </td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{item.unit}</td>
                      <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {groupedItems.equipment.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="text-orange-600" size={20} />
              <h2 className="text-lg font-semibold">Equipment</h2>
              <span className="ml-auto text-muted">{formatCurrency(totals.equipment)}</span>
            </div>
            <table className="w-full">
              <thead><tr className="border-b text-sm text-muted">
                <th className="text-left py-2 w-8"></th>
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2 w-16">Qty</th>
                <th className="text-right py-2 w-16">Unit</th>
                <th className="text-right py-2 w-24">Unit Price</th>
                <th className="text-right py-2 w-24">Total</th>
              </tr></thead>
              <tbody>
                {groupedItems.equipment.map((item, idx) => {
                  const key = itemKey(item, idx);
                  return (
                    <tr key={idx} className={`border-b last:border-0 ${selectedKeys.has(key) ? 'bg-blue-50' : ''}`}>
                      <td className="py-2">
                        <button onClick={() => toggleItem(key)} className="text-muted hover:text-primary">
                          {selectedKeys.has(key) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                        </button>
                      </td>
                      <td className="py-2">
                        <div className="font-medium">{item.name}</div>
                        {item.description && <div className="text-sm text-muted">{item.description}</div>}
                      </td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{item.unit}</td>
                      <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {groupedItems.subcontractor.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="text-purple-600" size={20} />
              <h2 className="text-lg font-semibold">Subcontractor</h2>
              <span className="ml-auto text-muted">{formatCurrency(totals.subcontractor)}</span>
            </div>
            <table className="w-full">
              <thead><tr className="border-b text-sm text-muted">
                <th className="text-left py-2 w-8"></th>
                <th className="text-left py-2">Item</th>
                <th className="text-right py-2 w-16">Qty</th>
                <th className="text-right py-2 w-16">Unit</th>
                <th className="text-right py-2 w-24">Unit Price</th>
                <th className="text-right py-2 w-24">Total</th>
              </tr></thead>
              <tbody>
                {groupedItems.subcontractor.map((item, idx) => {
                  const key = itemKey(item, idx);
                  return (
                    <tr key={idx} className={`border-b last:border-0 ${selectedKeys.has(key) ? 'bg-blue-50' : ''}`}>
                      <td className="py-2">
                        <button onClick={() => toggleItem(key)} className="text-muted hover:text-primary">
                          {selectedKeys.has(key) ? <CheckSquare size={18} className="text-primary" /> : <Square size={18} />}
                        </button>
                      </td>
                      <td className="py-2">
                        <div className="font-medium">{item.name}</div>
                        {item.description && <div className="text-sm text-muted">{item.description}</div>}
                      </td>
                      <td className="py-2 text-right">{item.quantity}</td>
                      <td className="py-2 text-right">{item.unit}</td>
                      <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {allItems.length === 0 && (
          <div className="card"><p className="text-muted text-center py-8">No billable items in this estimate.</p></div>
        )}
      </div>

      <Modal isOpen={showPrintPreview} onClose={() => setShowPrintPreview(false)} title="Purchase Order Print Preview" size="lg">
        <div className="print-preview p-8 bg-white">
          <div className="flex items-start justify-between border-b pb-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold">{branding?.brandName || 'Your Company'}</h2>
              <p className="text-muted text-sm mt-1">Purchase Order: {orderDraft.poNumber}</p>
            </div>
            <div className="text-right text-sm">
              <strong>Supplier:</strong> {orderDraft.supplierName}<br />
              <strong>Date:</strong> {formatDate(new Date().toISOString())}<br />
              {orderDraft.expectedDate && <><strong>Expected:</strong> {formatDate(orderDraft.expectedDate)}</>}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div><strong>Customer:</strong> {customer?.name}</div>
            <div><strong>Job Address:</strong> {estimate.address}</div>
            <div><strong>Estimate:</strong> {estimate.estimateNumber}</div>
          </div>
          <table className="w-full text-sm">
            <thead><tr className="text-left border-b"><th>Item</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Unit Price</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {printItems.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.name}{item.description ? <div className="text-xs text-muted">{item.description}</div> : null}</td>
                  <td className="text-right">{item.quantity}</td>
                  <td className="text-right">{item.unit}</td>
                  <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
              <tr className="font-bold border-t"><td colSpan={4} className="text-right">Subtotal</td><td className="text-right">{formatCurrency(selectedTotals.grand)}</td></tr>
              <tr className="text-lg font-bold"><td colSpan={4} className="text-right">Total</td><td className="text-right">{formatCurrency(selectedTotals.grand)}</td></tr>
            </tbody>
          </table>
          {orderDraft.notes && <div className="mt-4 border-t pt-4"><strong>Notes:</strong> {orderDraft.notes}</div>}
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={() => setShowPrintPreview(false)}>Close</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
        </div>
      </Modal>

      <Modal isOpen={showCreateOrder} onClose={() => setShowCreateOrder(false)} title="Create Purchase Order" size="md">
        <div className="form-stack">
          <div className="p-4 bg-blue-50 rounded-lg text-sm">
            <strong>{selectedKeys.size}</strong> items selected &nbsp;&nbsp;
            <span>Subtotal: <strong className="text-primary">{formatCurrency(selectedTotals.grand)}</strong></span>
          </div>
          <div className="form-group">
            <label className="form-label">Supplier *</label>
            <select className="form-select" value={orderDraft.supplierId} onChange={e => handleSupplierChange(e.target.value)}>
              <option value="">Select supplier...</option>
              {suppliers.filter(s => s.isActive).map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.leadTimeDays ? ` — ${s.leadTimeDays}d lead` : ''}</option>
              ))}
            </select>
            <Link to="/estimates/suppliers" className="text-sm text-primary mt-1 block">+ Manage Suppliers</Link>
          </div>
          <div className="form-group">
            <label className="form-label">PO Number</label>
            <input className="form-input" value={orderDraft.poNumber} onChange={e => setOrderDraft(prev => ({ ...prev, poNumber: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Expected Delivery Date</label>
            <input className="form-input" type="date" value={orderDraft.expectedDate} onChange={e => setOrderDraft(prev => ({ ...prev, expectedDate: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" value={orderDraft.notes} onChange={e => setOrderDraft(prev => ({ ...prev, notes: e.target.value }))} />
          </div>
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
          <button className="btn btn-secondary" onClick={() => setShowCreateOrder(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreateOrder}><ShoppingCart size={16} /> Create Order</button>
        </div>
      </Modal>
    </div>
  );
}
