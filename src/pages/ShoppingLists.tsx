import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import type { ShoppingList, ShoppingListItemCategory, ShoppingListStatus } from '../data/types';
import { Modal } from '../components/common/Modal';
import { useToast } from '../components/common/Toast';
import {
  AlertTriangle,
  CheckCircle,
  ClipboardList,
  DollarSign,
  Plus,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  Zap,
} from 'lucide-react';

const statusLabels: Record<ShoppingListStatus, string> = {
  open: 'Open',
  shopping: 'Shopping',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const categories: ShoppingListItemCategory[] = ['material', 'hardware', 'supply', 'tool', 'rental', 'other'];
type AllowanceHandling = 'track_only' | 'contractor_paid_reimbursable' | 'client_paid_direct';

export function ShoppingLists() {
  const [params] = useSearchParams();
  const {
    jobs,
    suppliers,
    materials,
    estimates,
    shoppingLists,
    receipts,
    addShoppingList,
    updateShoppingList,
    deleteShoppingList,
    addShoppingListItem,
    updateShoppingListItem,
    deleteShoppingListItem,
    addShoppingReceipt,
    allowances,
    addAllowanceSelection,
  } = useApp();
  const { showToast } = useToast();

  const requestedJobId = params.get('jobId') || '';
  const [statusFilter, setStatusFilter] = useState<ShoppingListStatus | 'all'>('all');
  const [jobFilter, setJobFilter] = useState(requestedJobId || 'all');
  const [urgentOnly, setUrgentOnly] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(shoppingLists[0]?.id || null);
  const [shoppingMode, setShoppingMode] = useState(false);
  const [showNewList, setShowNewList] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [listForm, setListForm] = useState({ jobId: requestedJobId, title: '', supplierId: '', store: '', notes: '' });
  const [itemForm, setItemForm] = useState<{ name: string; quantity: string; unit: string; category: ShoppingListItemCategory; estimatedCost: string; urgent: boolean; notes: string; supplierId: string; linkedPriceBookItemId: string; allowanceId: string; allowanceHandling: AllowanceHandling }>({ name: '', quantity: '1', unit: 'ea', category: 'material', estimatedCost: '', urgent: false, notes: '', supplierId: '', linkedPriceBookItemId: '', allowanceId: '', allowanceHandling: 'track_only' });
  const [receiptForm, setReceiptForm] = useState({ vendor: '', date: new Date().toISOString().split('T')[0], total: '', tax: '', imageUrl: '', notes: '' });

  const selectedList = useMemo(() => shoppingLists.find(list => list.id === selectedId) || shoppingLists[0] || null, [shoppingLists, selectedId]);

  const filteredLists = useMemo(() => {
    let list = shoppingLists;
    if (statusFilter !== 'all') list = list.filter(item => item.status === statusFilter);
    if (jobFilter !== 'all') list = list.filter(item => item.jobId === jobFilter);
    if (urgentOnly) list = list.filter(item => item.items.some(row => row.urgent && !row.purchased));
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(item =>
        item.title.toLowerCase().includes(q) ||
        item.jobName.toLowerCase().includes(q) ||
        item.store?.toLowerCase().includes(q) ||
        item.supplierName?.toLowerCase().includes(q) ||
        item.items.some(row => row.name.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [shoppingLists, statusFilter, jobFilter, urgentOnly, search]);

  const kpis = useMemo(() => {
    const openLists = shoppingLists.filter(list => ['open', 'shopping'].includes(list.status));
    const itemsNeeded = openLists.reduce((sum, list) => sum + list.items.filter(item => !item.purchased).length, 0);
    const estimatedSpend = openLists.reduce((sum, list) => sum + list.items.reduce((itemSum, item) => itemSum + (item.estimatedCost || 0), 0), 0);
    const receiptsPending = shoppingLists.filter(list => list.status === 'completed' && !receipts.some(receipt => receipt.shoppingListId === list.id)).length;
    return [
      { label: 'Open Lists', value: openLists.length, icon: ClipboardList },
      { label: 'Items Needed', value: itemsNeeded, icon: ShoppingCart },
      { label: 'Estimated Spend', value: formatCurrency(estimatedSpend), icon: DollarSign },
      { label: 'Receipts Pending', value: receiptsPending, icon: Receipt },
    ];
  }, [shoppingLists, receipts]);

  const selectedReceipt = selectedList ? receipts.find(receipt => receipt.shoppingListId === selectedList.id) : undefined;
  const selectedJob = selectedList ? jobs.find(job => job.id === selectedList.jobId) : undefined;
  const selectedSupplier = selectedList?.supplierId ? suppliers.find(supplier => supplier.id === selectedList.supplierId) : undefined;
  const jobAllowances = selectedList ? allowances.filter(allowance => allowance.jobId === selectedList.jobId) : [];
  const selectedEstimate = selectedJob?.estimateId ? estimates.find(estimate => estimate.id === selectedJob.estimateId) : undefined;
  const selectedEstimatedTotal = selectedList?.items.reduce((sum, item) => sum + (item.estimatedCost || 0), 0) || 0;
  const selectedActualTotal = selectedList?.items.reduce((sum, item) => sum + (item.actualCost || 0), 0) || selectedReceipt?.total || 0;
  const selectedPurchased = selectedList?.items.filter(item => item.purchased).length || 0;

  const createList = () => {
    const job = jobs.find(item => item.id === listForm.jobId);
    const supplier = suppliers.find(item => item.id === listForm.supplierId);
    if (!job || !listForm.title.trim()) {
      showToast('Select a job and title', 'error');
      return;
    }
    const id = addShoppingList({
      jobId: job.id,
      jobName: job.name,
      title: listForm.title.trim(),
      status: 'open',
      supplierId: supplier?.id,
      supplierName: supplier?.name,
      store: listForm.store.trim() || supplier?.name || undefined,
      notes: listForm.notes.trim() || undefined,
      items: [],
    });
    setSelectedId(id);
    setShowNewList(false);
    setListForm({ jobId: requestedJobId, title: '', supplierId: '', store: '', notes: '' });
    showToast('Shopping list created');
  };

  const quickAddItem = () => {
    const target = selectedList;
    if (!target || !itemForm.name.trim()) {
      showToast(target ? 'Enter an item name' : 'Create or select a list first', 'error');
      return;
    }
    const material = materials.find(item => item.id === itemForm.linkedPriceBookItemId);
    const supplier = suppliers.find(item => item.id === itemForm.supplierId) || (target.supplierId ? suppliers.find(item => item.id === target.supplierId) : undefined);
    addShoppingListItem(target.id, {
      name: itemForm.name.trim(),
      category: itemForm.category,
      quantity: parseFloat(itemForm.quantity) || 1,
      unit: itemForm.unit || material?.unit || 'ea',
      estimatedCost: itemForm.estimatedCost ? parseFloat(itemForm.estimatedCost) : material?.unitPrice,
      purchased: false,
      urgent: itemForm.urgent,
      notes: itemForm.notes.trim() || undefined,
      supplierId: supplier?.id,
      supplierName: supplier?.name,
      linkedPriceBookItemId: material?.id,
      addOnStatus: 'included_expense',
      allowanceId: itemForm.allowanceId || undefined,
      allowanceHandling: itemForm.allowanceId ? itemForm.allowanceHandling : undefined,
    });
    if (itemForm.allowanceId) {
      addAllowanceSelection(itemForm.allowanceId, {
        itemName: itemForm.name.trim(),
        vendor: supplier?.name || target.supplierName || target.store,
        quantity: parseFloat(itemForm.quantity) || 1,
        unitCost: itemForm.estimatedCost ? parseFloat(itemForm.estimatedCost) : material?.unitPrice,
        total: itemForm.estimatedCost ? parseFloat(itemForm.estimatedCost) : material?.unitPrice || 0,
        date: new Date().toISOString().split('T')[0],
        notes: itemForm.allowanceHandling === 'client_paid_direct' ? 'Client paid direct allowance item' : itemForm.notes,
        status: 'planned',
      }, itemForm.allowanceHandling === 'contractor_paid_reimbursable');
    }
    setItemForm({ name: '', quantity: '1', unit: 'ea', category: 'material', estimatedCost: '', urgent: false, notes: '', supplierId: target.supplierId || '', linkedPriceBookItemId: '', allowanceId: '', allowanceHandling: 'track_only' });
    setShowQuickAdd(false);
    showToast('Item added');
  };

  const addFromEstimate = () => {
    if (!selectedList || !selectedEstimate) return;
    const lineItems = (selectedEstimate.scopes || []).flatMap(scope => scope.sections.flatMap(section => section.lineItems || []));
    lineItems.filter(item => ['material', 'equipment', 'other', 'allowance'].includes(item.category)).slice(0, 8).forEach(item => {
      const material = item.linkedMaterialId ? materials.find(row => row.id === item.linkedMaterialId) : undefined;
      const supplier = suppliers.find(row => row.name === material?.supplier) || selectedSupplier;
      addShoppingListItem(selectedList.id, {
        name: item.name,
        category: item.category === 'equipment' ? 'rental' : item.category === 'other' || item.category === 'allowance' ? 'supply' : 'material',
        quantity: item.quantity || 0,
        unit: item.unit,
        estimatedCost: item.unitCost ?? item.unitPrice,
        purchased: false,
        urgent: false,
        notes: 'Added from original estimate material scope',
        supplierId: supplier?.id,
        supplierName: supplier?.name,
        linkedEstimateLineItemId: item.id,
      });
    });
    showToast('Estimate materials added');
  };

  const completeWithReceipt = () => {
    if (!selectedList || !receiptForm.vendor || !receiptForm.total) {
      showToast('Vendor and total are required', 'error');
      return;
    }
    addShoppingReceipt({
      shoppingListId: selectedList.id,
      jobId: selectedList.jobId,
      vendor: receiptForm.vendor,
      date: receiptForm.date,
      total: parseFloat(receiptForm.total) || 0,
      tax: receiptForm.tax ? parseFloat(receiptForm.tax) : undefined,
      imageUrl: receiptForm.imageUrl || undefined,
      notes: receiptForm.notes || `Shopping list: ${selectedList.title}`,
    });
    setReceiptForm({ vendor: '', date: new Date().toISOString().split('T')[0], total: '', tax: '', imageUrl: '', notes: '' });
    setShowReceipt(false);
    showToast('Receipt converted to job expense');
  };

  const alerts = selectedList ? [
    selectedList.items.some(item => item.urgent && !item.purchased) ? 'This list has urgent items' : '',
    selectedList.status === 'completed' && !selectedReceipt ? 'Receipt missing for completed shopping list' : '',
    selectedActualTotal > selectedEstimatedTotal && selectedEstimatedTotal > 0 ? 'Actual cost is higher than estimated' : '',
    selectedList.items.some(item => !item.linkedEstimateLineItemId && item.addOnStatus !== 'included_expense') ? 'This item was not in the original estimate - mark as add-on?' : '',
    selectedJob && selectedActualTotal + selectedJob.actualCost > selectedJob.estimatedCost && selectedJob.estimatedCost > 0 ? 'Job is trending over budget after this run' : '',
  ].filter(Boolean) : [];

  return (
    <div className="shopping-page">
      <header className="shopping-header">
        <div>
          <div className="shopping-eyebrow">Field Procurement</div>
          <h1>Shopping Lists</h1>
          <p>Track job-site material runs, forgotten items, shortages, and add-ons.</p>
        </div>
        <div className="shopping-actions">
          <button className="shopping-primary" onClick={() => setShowNewList(true)}><Plus size={18} /> New Shopping List</button>
          <button className="shopping-secondary" onClick={() => setShowQuickAdd(true)}><Zap size={18} /> Quick Add Item</button>
        </div>
      </header>

      <section className="shopping-kpis">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div className="shopping-kpi" key={label}><Icon size={20} /><span>{label}</span><strong>{value}</strong></div>
        ))}
      </section>

      <section className="shopping-filters">
        <div className="shopping-search"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search list, job, store, item..." /></div>
        {(['all', 'open', 'shopping', 'completed'] as const).map(status => (
          <button key={status} className={statusFilter === status ? 'active' : ''} onClick={() => setStatusFilter(status)}>{status === 'all' ? 'All' : statusLabels[status]}</button>
        ))}
        <select value={jobFilter} onChange={event => setJobFilter(event.target.value)}>
          <option value="all">By Job</option>
          {jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}
        </select>
        <button className={urgentOnly ? 'active urgent' : ''} onClick={() => setUrgentOnly(!urgentOnly)}>Urgent</button>
      </section>

      {shoppingLists.length === 0 ? (
        <section className="shopping-empty">
          <ShoppingCart size={42} />
          <h2>Create your first job-site shopping list</h2>
          <p>Track forgotten items, shortages, and add-ons without losing profit.</p>
          <div className="shopping-actions"><button className="shopping-primary" onClick={() => setShowNewList(true)}>New Shopping List</button><button className="shopping-secondary" onClick={() => setShowNewList(true)}>Add From Active Job</button></div>
        </section>
      ) : (
        <main className={`shopping-workspace ${shoppingMode ? 'store-mode' : ''}`}>
          <section className="shopping-list-column">
            {filteredLists.map(list => {
              const purchased = list.items.filter(item => item.purchased).length;
              const urgent = list.items.filter(item => item.urgent && !item.purchased).length;
              const total = list.items.reduce((sum, item) => sum + (item.estimatedCost || 0), 0);
              return (
                <button className={`shopping-list-card ${selectedList?.id === list.id ? 'selected' : ''}`} key={list.id} onClick={() => setSelectedId(list.id)}>
                  <div><strong>{list.title}</strong><span>{list.jobName}</span></div>
                  <span className={`shopping-status ${list.status}`}>{statusLabels[list.status]}</span>
                  <div className="shopping-card-grid">
                    <span>{list.items.length} items</span><span>{purchased} purchased</span><span>{formatCurrency(total)}</span><span>{urgent} urgent</span>
                  </div>
                  {(list.supplierName || list.store) && <small>{list.supplierName || list.store}</small>}
                </button>
              );
            })}
          </section>

          <aside className="shopping-detail">
            {selectedList && (
              <>
                <div className="shopping-detail-head">
                  <div><h2>{selectedList.title}</h2><p>{selectedList.jobName} {selectedSupplier?.name || selectedList.supplierName || selectedList.store ? `- ${selectedSupplier?.name || selectedList.supplierName || selectedList.store}` : ''}</p></div>
                  <span className={`shopping-status ${selectedList.status}`}>{statusLabels[selectedList.status]}</span>
                </div>
                <div className="shopping-detail-actions">
                  <button className="shopping-primary" onClick={() => setShowQuickAdd(true)}><Plus size={16} /> Add Item</button>
                  <button className="shopping-secondary" onClick={() => updateShoppingList(selectedList.id, { status: selectedList.status === 'shopping' ? 'open' : 'shopping' })}>Hardware Store Mode</button>
                  <button className="shopping-secondary" onClick={() => setShoppingMode(!shoppingMode)}>{shoppingMode ? 'Detail View' : 'Store View'}</button>
                  {selectedEstimate && <button className="shopping-secondary" onClick={addFromEstimate}>Add From Estimate</button>}
                  <button className="shopping-secondary" onClick={() => setShowReceipt(true)}><Receipt size={16} /> Attach Receipt</button>
                </div>
                <div className="shopping-progress"><div><span style={{ width: `${selectedList.items.length ? (selectedPurchased / selectedList.items.length) * 100 : 0}%` }} /></div><strong>{selectedPurchased} of {selectedList.items.length} items purchased</strong></div>
                {alerts.length > 0 && <div className="shopping-alerts">{alerts.map(alert => <div key={alert}><AlertTriangle size={15} />{alert}</div>)}</div>}
                {selectedList.notes && <p className="shopping-notes">{selectedList.notes}</p>}
                <div className="shopping-items">
                  {categories.map(category => {
                    const rows = selectedList.items.filter(item => item.category === category);
                    if (rows.length === 0) return null;
                    return (
                      <div className="shopping-category" key={category}>
                        <h3>{category}</h3>
                        {rows.map(item => (
                          <div className={`shopping-item ${item.purchased ? 'done' : ''}`} key={item.id}>
                            <input type="checkbox" checked={item.purchased} onChange={event => updateShoppingListItem(selectedList.id, item.id, { purchased: event.target.checked })} />
                            <div><strong>{item.name}</strong><span>{item.quantity} {item.unit} {item.supplierName ? `- ${item.supplierName}` : ''} {item.notes ? `- ${item.notes}` : ''}</span></div>
                            {item.urgent && <b>Urgent</b>}
                            <input className="shopping-cost-input" type="number" value={item.actualCost ?? ''} placeholder={String(item.estimatedCost || '')} onChange={event => updateShoppingListItem(selectedList.id, item.id, { actualCost: event.target.value ? parseFloat(event.target.value) : undefined })} />
                            <select value={item.addOnStatus || 'included_expense'} onChange={event => updateShoppingListItem(selectedList.id, item.id, { addOnStatus: event.target.value as any })}>
                              <option value="included_expense">Included</option>
                              <option value="client_add_on">Client add-on</option>
                              <option value="change_order_needed">Change order</option>
                            </select>
                            {item.allowanceId && <span className="shopping-allowance-chip">{item.allowanceHandling === 'contractor_paid_reimbursable' ? 'Reimbursable' : item.allowanceHandling === 'client_paid_direct' ? 'Client Paid Direct' : 'Client Allowance'}</span>}
                            <button onClick={() => deleteShoppingListItem(selectedList.id, item.id)}><Trash2 size={15} /></button>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div className="shopping-footer">
                  <span>Estimate {formatCurrency(selectedEstimatedTotal)}</span>
                  <span>Actual {formatCurrency(selectedActualTotal)}</span>
                  <button className="shopping-secondary danger" onClick={() => deleteShoppingList(selectedList.id)}>Delete List</button>
                </div>
              </>
            )}
          </aside>
        </main>
      )}

      <Modal isOpen={showNewList} onClose={() => setShowNewList(false)} title="New Shopping List" size="md">
        <div className="form-group"><label className="form-label">Job</label><select className="form-select" value={listForm.jobId} onChange={event => setListForm({ ...listForm, jobId: event.target.value })}><option value="">Select job...</option>{jobs.map(job => <option key={job.id} value={job.id}>{job.name}</option>)}</select></div>
        <div className="form-group"><label className="form-label">Title</label><input className="form-input" value={listForm.title} onChange={event => setListForm({ ...listForm, title: event.target.value })} placeholder="Friday hardware run" /></div>
        <div className="form-row form-row-2"><div className="form-group"><label className="form-label">Supplier</label><select className="form-select" value={listForm.supplierId} onChange={event => { const supplier = suppliers.find(item => item.id === event.target.value); setListForm({ ...listForm, supplierId: event.target.value, store: supplier?.name || listForm.store }); }}><option value="">Manual / no supplier</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div><div className="form-group"><label className="form-label">Store</label><input className="form-input" value={listForm.store} onChange={event => setListForm({ ...listForm, store: event.target.value, supplierId: '' })} /></div></div>
        <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={listForm.notes} onChange={event => setListForm({ ...listForm, notes: event.target.value })} /></div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 16 }}><button className="shopping-secondary" onClick={() => setShowNewList(false)}>Cancel</button><button className="shopping-primary" onClick={createList}>Create List</button></div>
      </Modal>

      <Modal isOpen={showQuickAdd} onClose={() => setShowQuickAdd(false)} title="Quick Add Item" size="lg">
        <div className="form-row form-row-2"><div className="form-group"><label className="form-label">Item</label><input className="form-input" value={itemForm.name} onChange={event => setItemForm({ ...itemForm, name: event.target.value })} /></div><div className="form-group"><label className="form-label">Price Book Link</label><select className="form-select" value={itemForm.linkedPriceBookItemId} onChange={event => { const material = materials.find(item => item.id === event.target.value); setItemForm({ ...itemForm, linkedPriceBookItemId: event.target.value, name: material?.name || itemForm.name, unit: material?.unit || itemForm.unit, estimatedCost: material ? String(material.unitPrice) : itemForm.estimatedCost }); }}><option value="">Manual</option>{materials.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div></div>
        <div className="form-group"><label className="form-label">Supplier</label><select className="form-select" value={itemForm.supplierId || selectedList?.supplierId || ''} onChange={event => setItemForm({ ...itemForm, supplierId: event.target.value })}><option value="">Use list supplier / manual</option>{suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
        <div className="form-row form-row-3"><div className="form-group"><label className="form-label">Qty</label><input className="form-input" type="number" value={itemForm.quantity} onChange={event => setItemForm({ ...itemForm, quantity: event.target.value })} /></div><div className="form-group"><label className="form-label">Unit</label><input className="form-input" value={itemForm.unit} onChange={event => setItemForm({ ...itemForm, unit: event.target.value })} /></div><div className="form-group"><label className="form-label">Category</label><select className="form-select" value={itemForm.category} onChange={event => setItemForm({ ...itemForm, category: event.target.value as ShoppingListItemCategory })}>{categories.map(category => <option key={category} value={category}>{category}</option>)}</select></div></div>
        <div className="form-row form-row-2"><div className="form-group"><label className="form-label">Estimated Cost</label><input className="form-input" type="number" value={itemForm.estimatedCost} onChange={event => setItemForm({ ...itemForm, estimatedCost: event.target.value })} /></div><label className="shopping-toggle"><input type="checkbox" checked={itemForm.urgent} onChange={event => setItemForm({ ...itemForm, urgent: event.target.checked })} /> Urgent</label></div>
        <div className="form-row form-row-2"><div className="form-group"><label className="form-label">Link Allowance</label><select className="form-select" value={itemForm.allowanceId} onChange={event => setItemForm({ ...itemForm, allowanceId: event.target.value })}><option value="">No allowance</option>{jobAllowances.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select></div><div className="form-group"><label className="form-label">Allowance Handling</label><select className="form-select" value={itemForm.allowanceHandling} onChange={event => setItemForm({ ...itemForm, allowanceHandling: event.target.value as any })}><option value="track_only">Track only against allowance</option><option value="contractor_paid_reimbursable">Contractor paid - reimbursable</option><option value="client_paid_direct">Client paid direct</option></select></div></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={itemForm.notes} onChange={event => setItemForm({ ...itemForm, notes: event.target.value })} /></div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 16 }}><button className="shopping-secondary" onClick={() => setShowQuickAdd(false)}>Cancel</button><button className="shopping-primary" onClick={quickAddItem}>Add Item</button></div>
      </Modal>

      <Modal isOpen={showReceipt} onClose={() => setShowReceipt(false)} title="Attach Receipt" size="md">
        <div className="form-row form-row-2"><div className="form-group"><label className="form-label">Vendor</label><input className="form-input" value={receiptForm.vendor} onChange={event => setReceiptForm({ ...receiptForm, vendor: event.target.value })} /></div><div className="form-group"><label className="form-label">Date</label><input className="form-input" type="date" value={receiptForm.date} onChange={event => setReceiptForm({ ...receiptForm, date: event.target.value })} /></div></div>
        <div className="form-row form-row-2"><div className="form-group"><label className="form-label">Total</label><input className="form-input" type="number" value={receiptForm.total} onChange={event => setReceiptForm({ ...receiptForm, total: event.target.value })} /></div><div className="form-group"><label className="form-label">Tax</label><input className="form-input" type="number" value={receiptForm.tax} onChange={event => setReceiptForm({ ...receiptForm, tax: event.target.value })} /></div></div>
        <div className="form-group"><label className="form-label">Receipt URL/Base64</label><input className="form-input" value={receiptForm.imageUrl} onChange={event => setReceiptForm({ ...receiptForm, imageUrl: event.target.value })} /></div>
        <div className="form-group"><label className="form-label">Notes</label><textarea className="form-textarea" value={receiptForm.notes} onChange={event => setReceiptForm({ ...receiptForm, notes: event.target.value })} /></div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: 16 }}><button className="shopping-secondary" onClick={() => setShowReceipt(false)}>Cancel</button><button className="shopping-primary" onClick={completeWithReceipt}><CheckCircle size={16} /> Complete and Add Expense</button></div>
      </Modal>
    </div>
  );
}
