import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatCurrency, formatDate } from '../utils/formatters';
import { ESTIMATE_STATUSES, JOB_TYPES } from '../data/types';
import type { EstimateLineItem, EstimateStatus, JobType } from '../data/types';
import { useToast } from '../components/common/Toast';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { Modal } from '../components/common/Modal';
import { 
  Plus, Trash2, Save, Send, CheckCircle, ArrowLeft, Edit2, FileText, 
  Hammer, Package, Clock, DollarSign, Printer
} from 'lucide-react';

export function EstimateDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { estimates, customers, materials, laborRates, addEstimate, updateEstimate, deleteEstimate, convertEstimateToJob, getEstimateCustomer } = useApp();
  const { showToast } = useToast();
  
  const estimate = estimates.find(e => e.id === id);
  const customer = estimate ? getEstimateCustomer(estimate.id) : undefined;
  
  const [isEditing, setIsEditing] = useState(false);
  const [showLineItemModal, setShowLineItemModal] = useState(false);
  const [editingLineItem, setEditingLineItem] = useState<EstimateLineItem | null>(null);
  const [deleteLineItemId, setDeleteLineItemId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showConvertConfirm, setShowConvertConfirm] = useState(false);
  
  const [formData, setFormData] = useState({
    name: estimate?.name || '',
    customerId: estimate?.customerId || '',
    address: estimate?.address || '',
    type: estimate?.type || 'remodel',
    status: estimate?.status || 'draft',
    markupPercent: estimate?.markupPercent.toString() || '20',
    notes: estimate?.notes || '',
    validUntil: estimate?.validUntil || '',
  });
  
  const [lineItemForm, setLineItemForm] = useState({
    name: '',
    description: '',
    quantity: '1',
    unit: 'ea',
    unitPrice: '0',
    category: 'Materials',
    isLabor: false,
    hours: '0',
  });

  const lineItems = useMemo(() => {
    return estimate?.lineItems || [];
  }, [estimate]);

  const totals = useMemo(() => {
    if (!estimate) return { laborTotal: 0, materialTotal: 0, subtotal: 0, markupAmount: 0, total: 0, hours: 0 };
    
    const laborTotal = lineItems.filter(i => i.isLabor).reduce((sum, i) => sum + i.total, 0);
    const materialTotal = lineItems.filter(i => !i.isLabor).reduce((sum, i) => sum + i.total, 0);
    const subtotal = laborTotal + materialTotal;
    const markupAmount = subtotal * (estimate.markupPercent / 100);
    const total = subtotal + markupAmount;
    const hours = lineItems.filter(i => i.isLabor).reduce((sum, i) => sum + (i.hours || 0), 0);
    
    return { laborTotal, materialTotal, subtotal, markupAmount, total, hours };
  }, [estimate, lineItems]);

  if (!estimate) {
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
      notes: formData.notes,
      validUntil: formData.validUntil,
    });
    
    setIsEditing(false);
    showToast('Estimate updated');
  };

  const handleAddLineItem = () => {
    const qty = parseFloat(lineItemForm.quantity) || 1;
    const price = parseFloat(lineItemForm.unitPrice) || 0;
    const hours = parseFloat(lineItemForm.hours) || 0;
    const isLabor = lineItemForm.isLabor === true || lineItemForm.category === 'Labor';
    
    const newItem: EstimateLineItem = {
      id: crypto.randomUUID(),
      name: lineItemForm.name,
      description: lineItemForm.description,
      quantity: qty,
      unit: lineItemForm.unit,
      unitPrice: price,
      category: lineItemForm.category,
      isLabor,
      hours: isLabor ? hours : undefined,
      total: qty * price,
    };
    
    updateEstimate(estimate.id, {
      lineItems: [...estimate.lineItems, newItem],
    });
    
    setShowLineItemModal(false);
    setLineItemForm({
      name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
      category: 'Materials', isLabor: false, hours: '0',
    });
    showToast('Line item added');
  };

  const handleUpdateLineItem = () => {
    if (!editingLineItem) return;
    
    const qty = parseFloat(lineItemForm.quantity) || 1;
    const price = parseFloat(lineItemForm.unitPrice) || 0;
    const hours = parseFloat(lineItemForm.hours) || 0;
    const isLabor = lineItemForm.isLabor === true || lineItemForm.category === 'Labor';
    
    const updatedItem: EstimateLineItem = {
      ...editingLineItem,
      name: lineItemForm.name,
      description: lineItemForm.description,
      quantity: qty,
      unit: lineItemForm.unit,
      unitPrice: price,
      category: lineItemForm.category,
      isLabor,
      hours: isLabor ? hours : undefined,
      total: qty * price,
    };
    
    const updatedItems = estimate.lineItems.map(item => 
      item.id === editingLineItem.id ? updatedItem : item
    );
    
    updateEstimate(estimate.id, { lineItems: updatedItems });
    
    setShowLineItemModal(false);
    setEditingLineItem(null);
    showToast('Line item updated');
  };

  const handleDeleteLineItem = () => {
    if (!deleteLineItemId) return;
    
    const updatedItems = estimate.lineItems.filter(item => item.id !== deleteLineItemId);
    updateEstimate(estimate.id, { lineItems: updatedItems });
    
    setDeleteLineItemId(null);
    showToast('Line item deleted');
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

  const openLineItemModal = (item?: EstimateLineItem) => {
    if (item) {
      setEditingLineItem(item);
      setLineItemForm({
        name: item.name,
        description: item.description || '',
        quantity: item.quantity.toString(),
        unit: item.unit,
        unitPrice: item.unitPrice.toString(),
        category: item.category,
        isLabor: item.isLabor,
        hours: (item.hours || 0).toString(),
      });
    } else {
      setEditingLineItem(null);
      setLineItemForm({
        name: '', description: '', quantity: '1', unit: 'ea', unitPrice: '0',
        category: 'Materials', isLabor: false, hours: '0',
      });
    }
    setShowLineItemModal(true);
  };

  const getStatusBadge = (status: EstimateStatus) => {
    const colors: Record<EstimateStatus, string> = {
      draft: 'bg-gray-100 text-gray-700',
      sent: 'bg-blue-100 text-blue-700',
      approved: 'bg-green-100 text-green-700',
      rejected: 'bg-red-100 text-red-700',
      expired: 'bg-yellow-100 text-yellow-700',
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
          {estimate.status === 'draft' && (
            <button className="btn btn-secondary" onClick={() => updateEstimate(estimate.id, { status: 'sent' })}>
              <Send size={18} /> Mark as Sent
            </button>
          )}
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
          {isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={() => setIsEditing(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={18} /> Save Changes
              </button>
            </>
          ) : (
            <button className="btn btn-primary" onClick={() => setIsEditing(true)}>
              <Edit2 size={18} /> Edit
            </button>
          )}
        </div>
      </div>

      <div className="page-content">
        <div className="grid-3 gap-6 mb-6">
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Customer</h3>
            </div>
            <div className="card-body">
              {isEditing ? (
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
              ) : (
                <div>
                  <div className="font-medium">{customer?.name || '—'}</div>
                  {customer?.phone && <div className="text-sm text-muted">{customer.phone}</div>}
                  {customer?.email && <div className="text-sm text-muted">{customer.email}</div>}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Details</h3>
            </div>
            <div className="card-body">
              {isEditing ? (
                <div className="space-y-3">
                  <div>
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
                  <div>
                    <label className="form-label">Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value as EstimateStatus})}
                    >
                      {ESTIMATE_STATUSES.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`badge ${getStatusBadge(estimate.status)}`}>
                      {ESTIMATE_STATUSES.find(s => s.value === estimate.status)?.label}
                    </span>
                  </div>
                  <div className="text-sm">
                    {JOB_TYPES.find(t => t.value === estimate.type)?.label}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Address</h3>
            </div>
            <div className="card-body">
              {isEditing ? (
                <input
                  className="form-input"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Project address"
                />
              ) : (
                <div>{estimate.address || '—'}</div>
              )}
            </div>
          </div>
        </div>

        <div className="grid-3 gap-6 mb-6">
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign size={18} className="text-primary" />
              <span className="kpi-label">Total</span>
            </div>
            <div className="kpi-value">{formatCurrency(totals.total)}</div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <Hammer size={18} className="text-accent" />
              <span className="kpi-label">Labor</span>
            </div>
            <div className="kpi-value">{formatCurrency(totals.laborTotal)}</div>
            <div className="kpi-sub">{totals.hours} hours</div>
          </div>
          <div className="kpi-card">
            <div className="flex items-center gap-2 mb-2">
              <Package size={18} className="text-success" />
              <span className="kpi-label">Materials</span>
            </div>
            <div className="kpi-value">{formatCurrency(totals.materialTotal)}</div>
          </div>
        </div>

        <div className="card mb-6">
          <div className="card-header">
            <div className="flex items-center justify-between">
              <h3 className="card-title">Line Items</h3>
              <button className="btn btn-sm btn-primary" onClick={() => openLineItemModal()}>
                <Plus size={16} /> Add Item
              </button>
            </div>
          </div>
          <div className="card-body">
            {!lineItems.length ? (
              <div className="text-center text-muted py-8">
                No line items yet. Add items to build your estimate.
              </div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map(item => (
                    <tr key={item.id}>
                      <td>
                        <div className="font-medium">{item.name}</div>
                        {item.description && (
                          <div className="text-xs text-muted">{item.description}</div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${item.isLabor ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                          {item.category}
                        </span>
                      </td>
                      <td>{item.quantity}</td>
                      <td>{item.unit}</td>
                      <td>{formatCurrency(item.unitPrice)}</td>
                      <td className="font-medium">{formatCurrency(item.total)}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button
                            className="btn btn-sm btn-icon"
                            title="Edit"
                            onClick={() => openLineItemModal(item)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className="btn btn-sm btn-icon btn-danger"
                            title="Delete"
                            onClick={() => setDeleteLineItemId(item.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2">
                    <td colSpan={5} className="text-right font-medium">Subtotal</td>
                    <td className="font-medium">{formatCurrency(totals.subtotal)}</td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan={5} className="text-right">
                      Markup ({estimate.markupPercent}%)
                    </td>
                    <td>{formatCurrency(totals.markupAmount)}</td>
                    <td></td>
                  </tr>
                  <tr className="border-t-2 bg-gray-50">
                    <td colSpan={5} className="text-right font-bold text-lg">Total</td>
                    <td className="font-bold text-lg">{formatCurrency(totals.total)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="card mb-6">
            <div className="card-header">
              <h3 className="card-title">Settings</h3>
            </div>
            <div className="card-body">
              <div className="grid-2 gap-4">
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
        )}

        <div className="flex justify-between">
          <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
            <Trash2 size={16} /> Delete Estimate
          </button>
          <div className="text-sm text-muted">
            Created {formatDate(estimate.createdAt)} • Updated {formatDate(estimate.updatedAt)}
          </div>
        </div>
      </div>

      <Modal isOpen={showLineItemModal} onClose={() => setShowLineItemModal(false)} 
        title={editingLineItem ? 'Edit Line Item' : 'Add Line Item'} size="lg">
        <div className="form-group">
          <label className="form-label">Item Name *</label>
          <input
            className="form-input"
            value={lineItemForm.name}
            onChange={e => setLineItemForm({...lineItemForm, name: e.target.value})}
            placeholder="e.g., Cabinets, Demo, Installation"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <input
            className="form-input"
            value={lineItemForm.description}
            onChange={e => setLineItemForm({...lineItemForm, description: e.target.value})}
          />
        </div>
        <div className="grid-2 gap-4">
          <div className="form-group">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={lineItemForm.category}
              onChange={e => setLineItemForm({...lineItemForm, category: e.target.value})}
            >
              <option value="Materials">Materials</option>
              <option value="Labor">Labor</option>
              <option value="Equipment">Equipment</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Is Labor?</label>
            <select
              className="form-select"
              value={lineItemForm.isLabor.toString()}
              onChange={e => setLineItemForm({...lineItemForm, isLabor: e.target.value === 'true'})}
            >
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>
        <div className="grid-3 gap-4">
          <div className="form-group">
            <label className="form-label">Quantity</label>
            <input
              className="form-input"
              type="number"
              value={lineItemForm.quantity}
              onChange={e => setLineItemForm({...lineItemForm, quantity: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Unit</label>
            <input
              className="form-input"
              value={lineItemForm.unit}
              onChange={e => setLineItemForm({...lineItemForm, unit: e.target.value})}
              placeholder="ea, sqft, hrs, etc."
            />
          </div>
          <div className="form-group">
            <label className="form-label">Unit Price</label>
            <input
              className="form-input"
              type="number"
              value={lineItemForm.unitPrice}
              onChange={e => setLineItemForm({...lineItemForm, unitPrice: e.target.value})}
            />
          </div>
        </div>
        {(lineItemForm.isLabor || lineItemForm.category === 'Labor') && (
          <div className="form-group">
            <label className="form-label">Hours</label>
            <input
              className="form-input"
              type="number"
              value={lineItemForm.hours}
              onChange={e => setLineItemForm({...lineItemForm, hours: e.target.value})}
            />
          </div>
        )}
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowLineItemModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={editingLineItem ? handleUpdateLineItem : handleAddLineItem}>
            {editingLineItem ? 'Update' : 'Add'} Item
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteLineItemId}
        onClose={() => setDeleteLineItemId(null)}
        onConfirm={handleDeleteLineItem}
        title="Delete Line Item?"
        message="This will remove the item from the estimate."
        confirmLabel="Delete"
        danger
      />

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Estimate?"
        message="This action cannot be undone."
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