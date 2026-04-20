import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency, formatDate } from '../../utils/formatters';
import type { EstimateLineItem, EstimateLineCategory, EstimateScope, EstimateSection } from '../../data/types';
import { Modal } from '../../components/common/Modal';
import { 
  ArrowLeft, Printer, Package, Briefcase, Wrench, FileText, CheckSquare, Square, Truck
} from 'lucide-react';
import { renderEmailHTML, renderEmailAll } from '../../utils/emailTemplates';

interface PrintMaterialsData {
  estimateName: string;
  estimateNumber: string;
  customerName: string;
  customerAddress: string;
  jobAddress: string;
  createdAt: string;
  materials: GroupedItem[];
  equipment: GroupedItem[];
  subcontractor: GroupedItem[];
  totalMaterialCost: number;
  totalEquipmentCost: number;
  totalSubcontractorCost: number;
  grandTotal: number;
}

interface GroupedItem {
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  category: EstimateLineCategory;
}

export function MaterialsList() {
  const { id } = useParams();
  const { estimates, customers, getEstimateCustomer, branding } = useApp();
  
  const estimate = estimates?.find(e => e.id === id);
  const customer = estimate ? getEstimateCustomer(estimate.id) : undefined;
  
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [groupBy, setGroupBy] = useState<'category' | 'none'>('category');
  
  const allScopes = estimate?.scopes || [];
  const legacySections = estimate?.sections || [];
  
  const getAllLineItems = (): EstimateLineItem[] => {
    const items: EstimateLineItem[] = [];
    
    allScopes.forEach(scope => {
      scope.sections?.forEach(section => {
        section.lineItems?.forEach(item => {
          if (!item.isExcluded && !item.isOptional) {
            items.push(item);
          }
        });
      });
    });
    
    legacySections.forEach(section => {
      section.lineItems?.forEach(item => {
        if (!item.isExcluded && !item.isOptional) {
          items.push(item);
        }
      });
    });
    
    return items;
  };
  
  const allItems = useMemo(() => getAllLineItems(), [estimate, allScopes, legacySections]);
  
  const groupedItems = useMemo(() => {
    const materials: GroupedItem[] = [];
    const equipment: GroupedItem[] = [];
    const subcontractor: GroupedItem[] = [];
    
    allItems.forEach(item => {
      const groupedItem: GroupedItem = {
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        total: item.total,
        category: item.category,
      };
      
      if (item.category === 'material' || item.category === 'other') {
        materials.push(groupedItem);
      } else if (item.category === 'equipment') {
        equipment.push(groupedItem);
      } else if (item.category === 'subcontractor') {
        subcontractor.push(groupedItem);
      }
    });
    
    return { materials, equipment, subcontractor };
  }, [allItems]);
  
  const totals = useMemo(() => {
    const totalMaterialCost = groupedItems.materials.reduce((sum, item) => sum + item.total, 0);
    const totalEquipmentCost = groupedItems.equipment.reduce((sum, item) => sum + item.total, 0);
    const totalSubcontractorCost = groupedItems.subcontractor.reduce((sum, item) => sum + item.total, 0);
    
    return {
      totalMaterialCost,
      totalEquipmentCost,
      totalSubcontractorCost,
      grandTotal: totalMaterialCost + totalEquipmentCost + totalSubcontractorCost,
    };
  }, [groupedItems]);
  
  const toggleItem = (name: string) => {
    setSelectedItems(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };
  
  const selectAll = () => {
    const allNames = [
      ...groupedItems.materials.map(i => i.name),
      ...groupedItems.equipment.map(i => i.name),
      ...groupedItems.subcontractor.map(i => i.name),
    ];
    setSelectedItems(new Set(allNames));
  };
  
  const selectNone = () => {
    setSelectedItems(new Set());
  };
  
  const printData: PrintMaterialsData = {
    estimateName: estimate?.name || '',
    estimateNumber: estimate?.estimateNumber || '',
    customerName: customer?.name || '',
    customerAddress: customer?.address || '',
    jobAddress: estimate?.address || '',
    createdAt: estimate?.createdAt || '',
    materials: groupedItems.materials,
    equipment: groupedItems.equipment,
    subcontractor: groupedItems.subcontractor,
    ...totals,
  };
  
  const handlePrint = () => {
    setShowPrintPreview(true);
  };
  
  if (!estimate) {
    return (
      <div className="page-container">
        <div className="flex items-center gap-4 mb-6">
          <Link to="/estimates" className="btn btn-secondary">
            <ArrowLeft size={18} />
          </Link>
          <h1>Materials List</h1>
        </div>
        <div className="card">
          <p className="text-muted">Estimate not found.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="page-container">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Link to={`/estimates/${id}`} className="btn btn-secondary">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Materials & Equipment List</h1>
            <p className="text-muted text-sm">{estimate.estimateNumber} - {estimate.name}</p>
          </div>
        </div>
        <button className="btn btn-primary" onClick={handlePrint}>
          <Printer size={18} />
          <span className="ml-2">Print List</span>
        </button>
      </div>
      
      <div className="card mb-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted">Customer:</span>
            <p className="font-medium">{customer?.name}</p>
          </div>
          <div>
            <span className="text-muted">Address:</span>
            <p className="font-medium">{estimate.address || '-'}</p>
          </div>
          <div>
            <span className="text-muted">Created:</span>
            <p className="font-medium">{formatDate(estimate.createdAt)}</p>
          </div>
          <div>
            <span className="text-muted">Total:</span>
            <p className="font-medium text-lg">{formatCurrency(totals.grandTotal)}</p>
          </div>
        </div>
      </div>
      
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          <button className="btn btn-secondary text-sm" onClick={selectAll}>
            Select All
          </button>
          <button className="btn btn-secondary text-sm" onClick={selectNone}>
            Select None
          </button>
        </div>
        <div className="text-sm text-muted">
          {selectedItems.size} items selected for ordering
        </div>
      </div>
      
      <div className="space-y-6">
        {groupedItems.materials.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Package className="text-blue-600" size={20} />
              <h2 className="text-lg font-semibold">Materials</h2>
              <span className="ml-auto text-muted">{formatCurrency(totals.totalMaterialCost)}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 w-8"></th>
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2 w-20">Qty</th>
                  <th className="text-right py-2 w-20">Unit</th>
                  <th className="text-right py-2 w-24">Unit Price</th>
                  <th className="text-right py-2 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {groupedItems.materials.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2">
                      <button
                        onClick={() => toggleItem(item.name)}
                        className="text-muted hover:text-primary"
                      >
                        {selectedItems.has(item.name) ? (
                          <CheckSquare size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-muted">{item.description}</div>
                      )}
                    </td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{item.unit}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {groupedItems.equipment.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Wrench className="text-orange-600" size={20} />
              <h2 className="text-lg font-semibold">Equipment</h2>
              <span className="ml-auto text-muted">{formatCurrency(totals.totalEquipmentCost)}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 w-8"></th>
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2 w-20">Qty</th>
                  <th className="text-right py-2 w-20">Unit</th>
                  <th className="text-right py-2 w-24">Unit Price</th>
                  <th className="text-right py-2 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {groupedItems.equipment.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2">
                      <button
                        onClick={() => toggleItem(item.name)}
                        className="text-muted hover:text-primary"
                      >
                        {selectedItems.has(item.name) ? (
                          <CheckSquare size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-muted">{item.description}</div>
                      )}
                    </td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{item.unit}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {groupedItems.subcontractor.length > 0 && (
          <div className="card">
            <div className="flex items-center gap-2 mb-4">
              <Truck className="text-purple-600" size={20} />
              <h2 className="text-lg font-semibold">Subcontractor</h2>
              <span className="ml-auto text-muted">{formatCurrency(totals.totalSubcontractorCost)}</span>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 w-8"></th>
                  <th className="text-left py-2">Item</th>
                  <th className="text-right py-2 w-20">Qty</th>
                  <th className="text-right py-2 w-20">Unit</th>
                  <th className="text-right py-2 w-24">Unit Price</th>
                  <th className="text-right py-2 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {groupedItems.subcontractor.map((item, idx) => (
                  <tr key={idx} className="border-b last:border-0">
                    <td className="py-2">
                      <button
                        onClick={() => toggleItem(item.name)}
                        className="text-muted hover:text-primary"
                      >
                        {selectedItems.has(item.name) ? (
                          <CheckSquare size={18} />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    </td>
                    <td className="py-2">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-sm text-muted">{item.description}</div>
                      )}
                    </td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{item.unit}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {groupedItems.materials.length === 0 && groupedItems.equipment.length === 0 && groupedItems.subcontractor.length === 0 && (
          <div className="card">
            <p className="text-muted text-center py-8">
              No materials, equipment, or subcontractor items found in this estimate.
            </p>
          </div>
        )}
      </div>
      
      <Modal isOpen={showPrintPreview} onClose={() => setShowPrintPreview(false)} title="Materials List Print Preview" size="lg">
        <div className="print-preview p-8 bg-white">
          <div className="text-center border-b pb-4 mb-6">
            <h2 className="text-2xl font-bold">Materials & Equipment List</h2>
            <p className="text-muted">{estimate.estimateNumber}</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
            <div>
              <strong>Customer:</strong> {customer?.name}
            </div>
            <div>
              <strong>Job Address:</strong> {estimate.address}
            </div>
            <div>
              <strong>Date:</strong> {formatDate(estimate.createdAt)}
            </div>
          </div>
          
          {groupedItems.materials.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold border-b mb-2">Materials</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.materials.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{item.unit}</td>
                      <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={4} className="text-right">Materials Subtotal</td>
                    <td className="text-right">{formatCurrency(totals.totalMaterialCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          
          {groupedItems.equipment.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold border-b mb-2">Equipment</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.equipment.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{item.unit}</td>
                      <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={4} className="text-right">Equipment Subtotal</td>
                    <td className="text-right">{formatCurrency(totals.totalEquipmentCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          
          {groupedItems.subcontractor.length > 0 && (
            <div className="mb-6">
              <h3 className="font-bold border-b mb-2">Subcontractor</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th>Item</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Unit Price</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedItems.subcontractor.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.name}</td>
                      <td className="text-right">{item.quantity}</td>
                      <td className="text-right">{item.unit}</td>
                      <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  <tr className="font-bold">
                    <td colSpan={4} className="text-right">Subcontractor Subtotal</td>
                    <td className="text-right">{formatCurrency(totals.totalSubcontractorCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
          
          <div className="border-t pt-4">
            <div className="flex justify-between text-xl font-bold">
              <span>Grand Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => setShowPrintPreview(false)}>Close</button>
          <button className="btn btn-primary" onClick={() => window.print()}>Print</button>
        </div>
      </Modal>
    </div>
  );
}