import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { MaterialOrderStatus } from '../../data/types';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../components/common/Toast';
import { Package, Printer, CheckCircle, Clock, Truck, XCircle, ArrowLeft, FileText } from 'lucide-react';

const STATUS_CONFIG: Record<MaterialOrderStatus, { label: string; className: string; icon: any }> = {
  draft: { label: 'Draft', className: 'badge-gray', icon: FileText },
  sent: { label: 'Sent', className: 'badge-blue', icon: Clock },
  confirmed: { label: 'Confirmed', className: 'badge-blue', icon: CheckCircle },
  partially_received: { label: 'Partial', className: 'badge-orange', icon: Truck },
  received: { label: 'Received', className: 'badge-green', icon: CheckCircle },
  cancelled: { label: 'Cancelled', className: 'badge-red', icon: XCircle },
};

export function MaterialOrders() {
  const { materialOrders, suppliers, estimates, jobs, updateMaterialOrder, deleteMaterialOrder } = useApp();
  const { showToast } = useToast();
  const [statusFilter, setStatusFilter] = useState<MaterialOrderStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let list = materialOrders;
    if (statusFilter !== 'all') list = list.filter(o => o.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(o =>
        o.poNumber.toLowerCase().includes(q) ||
        o.supplierName?.toLowerCase().includes(q) ||
        o.items.some(i => i.name.toLowerCase().includes(q))
      );
    }
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [materialOrders, statusFilter, search]);

  const selected = useMemo(() => materialOrders.find(o => o.id === showDetail), [materialOrders, showDetail]);

  const handleStatusChange = (id: string, status: MaterialOrderStatus) => {
    const updates: Partial<typeof selected> = { status };
    if (status === 'received') updates.receivedDate = new Date().toISOString();
    if (status === 'sent') updates.sentDate = new Date().toISOString();
    updateMaterialOrder(id, updates as any);
    showToast(`Order marked as ${STATUS_CONFIG[status].label}`);
  };

  const handleDelete = (id: string) => {
    deleteMaterialOrder(id);
    showToast('Order deleted');
    setDeleteConfirm(null);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div className="flex items-center gap-4">
          <Link to="/estimates" className="btn btn-secondary btn-icon"><ArrowLeft size={18} /></Link>
          <div>
            <h1>Material Orders</h1>
            <p className="text-muted text-sm">Track purchase orders and fulfillment status</p>
          </div>
        </div>
        <Link to="/estimates" className="btn btn-primary"><Package size={18} /> New Order from Estimate</Link>
      </div>

      <div className="card mb-4">
        <div className="card-body flex items-center gap-4 flex-wrap">
          <input className="form-input flex-1 min-w-48" placeholder="Search PO#, supplier, item..." value={search} onChange={e => setSearch(e.target.value)} />
          <div className="flex gap-2 flex-wrap">
            <button className={`btn btn-sm ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter('all')}>All</button>
            {(Object.keys(STATUS_CONFIG) as MaterialOrderStatus[]).map(s => (
              <button key={s} className={`btn btn-sm ${statusFilter === s ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setStatusFilter(s)}>{STATUS_CONFIG[s].label}</button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="card"><p className="text-muted text-center py-8">No material orders found</p></div>
      )}

      <div className="space-y-3">
        {filtered.map(order => {
          const supplier = order.supplierId ? suppliers.find(s => s.id === order.supplierId) : null;
          const estimate = order.estimateId ? estimates.find(e => e.id === order.estimateId) : null;
          const job = order.jobId ? jobs.find(j => j.id === order.jobId) : null;
          const sc = STATUS_CONFIG[order.status];
          return (
            <div key={order.id} className="card">
              <div className="card-header">
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{order.poNumber}</span>
                  <span className={`badge ${sc.className}`}>{sc.label}</span>
                  {supplier && <span className="text-sm text-muted">{supplier.name}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-semibold">{formatCurrency(order.total)}</span>
                  <button className="btn btn-sm btn-secondary btn-icon" onClick={() => setShowDetail(order.id)} title="View Details"><FileText size={14} /></button>
                  <button className="btn btn-sm btn-danger btn-icon" onClick={() => setDeleteConfirm(order.id)} title="Delete"><XCircle size={14} /></button>
                </div>
              </div>
              <div className="card-body">
                <div className="flex items-center justify-between">
                  <div className="flex gap-6 text-sm">
                    {estimate && <div><span className="text-muted">Estimate:</span> {estimate.estimateNumber}</div>}
                    {job && <div><span className="text-muted">Job:</span> {job.name}</div>}
                    {order.sentDate && <div><span className="text-muted">Sent:</span> {formatDate(order.sentDate)}</div>}
                    {order.expectedDate && <div><span className="text-muted">Expected:</span> {formatDate(order.expectedDate)}</div>}
                    {order.receivedDate && <div><span className="text-muted">Received:</span> {formatDate(order.receivedDate)}</div>}
                    <div><span className="text-muted">Items:</span> {order.items.length}</div>
                  </div>
                  <div className="flex gap-1">
                    {order.status === 'draft' && <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(order.id, 'sent')}>Mark Sent</button>}
                    {(order.status === 'sent' || order.status === 'confirmed') && <button className="btn btn-sm btn-secondary" onClick={() => handleStatusChange(order.id, 'received')}>Mark Received</button>}
                    {order.status === 'draft' && <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(order.id, 'confirmed')}>Confirm</button>}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={selected?.poNumber || 'Order Details'} size="lg">
        {selected && (
          <>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-muted">Supplier:</span> {selected.supplierName || '—'}</div>
                <div><span className="text-muted">Status:</span> <span className={`badge ${STATUS_CONFIG[selected.status].className}`}>{STATUS_CONFIG[selected.status].label}</span></div>
                <div><span className="text-muted">Sent:</span> {selected.sentDate ? formatDate(selected.sentDate) : '—'}</div>
                <div><span className="text-muted">Expected:</span> {selected.expectedDate ? formatDate(selected.expectedDate) : '—'}</div>
                <div><span className="text-muted">Received:</span> {selected.receivedDate ? formatDate(selected.receivedDate) : '—'}</div>
                <div><span className="text-muted">Created:</span> {formatDate(selected.createdAt)}</div>
              </div>
              {selected.notes && <div className="mt-2 border-t pt-2"><span className="text-muted">Notes:</span> {selected.notes}</div>}
            </div>
            <table className="table">
              <thead><tr><th>Item</th><th>Supplier</th><th className="text-right">Qty</th><th className="text-right">Unit</th><th className="text-right">Unit Price</th><th className="text-right">Total</th><th className="text-center">Received</th></tr></thead>
              <tbody>
                {selected.items.map(item => {
                  const received = item.receivedQuantity ?? 0;
                  return (
                    <tr key={item.id}>
                      <td><div className="font-medium">{item.name}</div>{item.description && <div className="text-xs text-muted">{item.description}</div>}</td>
                      <td className="text-sm">{item.supplier || '—'}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{item.unit}</td>
                      <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                      <td className="text-center">
                        {received === item.quantity ? <CheckCircle size={16} className="text-green-600 mx-auto" /> :
                         received > 0 ? <span className="text-orange-600">{received}/{item.quantity}</span> : <span className="text-muted">—</span>}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2">
                  <td colSpan={5} className="text-right font-semibold">Subtotal</td>
                  <td className="text-right font-semibold">{formatCurrency(selected.subtotal)}</td>
                  <td />
                </tr>
                {selected.tax ? (
                  <tr><td colSpan={5} className="text-right">Tax</td><td className="text-right">{formatCurrency(selected.tax)}</td><td /></tr>
                ) : null}
                <tr className="font-bold text-lg">
                  <td colSpan={5} className="text-right">Total</td>
                  <td className="text-right">{formatCurrency(selected.total)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
            <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setShowDetail(null)}>Close</button>
              <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
            </div>
          </>
        )}
      </Modal>

      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 className="text-lg font-semibold mb-4">Delete Order?</h3>
            <p className="text-muted mb-6">This will permanently delete purchase order {materialOrders.find(o => o.id === deleteConfirm)?.poNumber}.</p>
            <div className="flex gap-2 justify-end">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}