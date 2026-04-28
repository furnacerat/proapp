import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Edit, Trash2, Hammer, Package, DollarSign, Search, Filter,
  Clock, TrendingUp, Zap, ChevronRight, Boxes, Users, AlertTriangle, RefreshCw, ExternalLink,
} from 'lucide-react';
import type { LaborRate, Material } from '../../data/types';
import { lookupPricing } from '../../services/pricingLookupService';
import {
  confirmedUpdates,
  findPricingMatches,
  rejectedUpdates,
  scorePricingResult,
  suggestionUpdates,
  type ScoredPricingMatch,
} from '../../utils/priceMatching';
import {
  applyPricingResult,
  fetchLatestMaterialPrice,
  getPriceAgeDays,
  getPricingPreferences,
  isPriceOutdated,
  savePricingPreferences,
  type PricingPreferences,
} from '../../utils/pricing';

type PriceTab = 'all' | 'labor' | 'materials' | 'equipment' | 'subcontractors';
type SelectedPriceItem =
  | { type: 'labor'; item: LaborRate }
  | { type: 'material'; item: Material }
  | null;

export function PriceBook() {
  const {
    laborRates,
    materials,
    estimates,
    timeEntries,
    addLaborRate,
    updateLaborRate,
    deleteLaborRate,
    addMaterial,
    updateMaterial,
    deleteMaterial,
  } = useApp();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<PriceTab>('labor');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [editingRate, setEditingRate] = useState<LaborRate | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'labor' | 'material'>('labor');
  const [selectedItem, setSelectedItem] = useState<SelectedPriceItem>(laborRates[0] ? { type: 'labor', item: laborRates[0] } : null);
  const [pricingPrefs, setPricingPrefs] = useState<PricingPreferences>(() => getPricingPreferences());
  const [updatingPrices, setUpdatingPrices] = useState<string[]>([]);
  const [lookupMaterial, setLookupMaterial] = useState<Material | null>(null);
  const [lookupResults, setLookupResults] = useState<ScoredPricingMatch[]>([]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [autoMatchingIds, setAutoMatchingIds] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    trade: '',
    hourlyRate: '0',
    overtimeRate: '0',
    isActive: true,
  });

  const [materialForm, setMaterialForm] = useState({
    name: '',
    category: '',
    unit: 'ea',
    unitPrice: '0',
    supplier: '',
    sku: '',
    modelNumber: '',
    productUrl: '',
    lastUpdated: '',
    isActive: true,
  });

  const handleSaveRate = () => {
    if (!formData.name || !formData.trade) {
      showToast('Name and trade are required', 'error');
      return;
    }

    const payload = {
      name: formData.name,
      trade: formData.trade,
      hourlyRate: parseFloat(formData.hourlyRate) || 0,
      overtimeRate: parseFloat(formData.overtimeRate) || 0,
      isActive: formData.isActive,
    };

    if (editingRate) {
      updateLaborRate(editingRate.id, payload);
      setSelectedItem({ type: 'labor', item: { ...editingRate, ...payload } });
      showToast('Labor rate updated');
    } else {
      const id = addLaborRate(payload);
      setSelectedItem({ type: 'labor', item: { id, ...payload } });
      showToast('Labor rate created');
    }

    setShowModal(false);
    setEditingRate(null);
    setFormData({ name: '', trade: '', hourlyRate: '0', overtimeRate: '0', isActive: true });
  };

  const handleEditRate = (rate: LaborRate) => {
    setEditingRate(rate);
    setFormData({
      name: rate.name,
      trade: rate.trade,
      hourlyRate: rate.hourlyRate.toString(),
      overtimeRate: rate.overtimeRate?.toString() || '0',
      isActive: rate.isActive,
    });
    setShowModal(true);
  };

  const handleSaveMaterial = () => {
    if (!materialForm.name) {
      showToast('Name is required', 'error');
      return;
    }

    const payload = {
      name: materialForm.name,
      category: materialForm.category,
      unit: materialForm.unit,
      unitPrice: parseFloat(materialForm.unitPrice) || 0,
      basePrice: editingMaterial?.basePrice ?? (parseFloat(materialForm.unitPrice) || 0),
      supplier: materialForm.supplier,
      sku: materialForm.sku,
      modelNumber: materialForm.modelNumber,
      productUrl: materialForm.productUrl,
      lastUpdated: materialForm.lastUpdated || editingMaterial?.lastUpdated,
      preferredSupplier: editingMaterial?.preferredSupplier || materialForm.supplier,
      matchedProductTitle: editingMaterial?.matchedProductTitle,
      currentPrice: editingMaterial?.currentPrice ?? (parseFloat(materialForm.unitPrice) || 0),
      priceSource: editingMaterial?.priceSource || editingMaterial?.pricingSource || 'manual' as const,
      pricingSource: editingMaterial?.pricingSource || 'manual' as const,
      pricingVerified: editingMaterial?.pricingVerified || false,
      priceEstimateOnly: editingMaterial?.priceEstimateOnly || false,
      matchConfidence: editingMaterial?.matchConfidence,
      matchStatus: editingMaterial?.matchStatus || 'unmatched' as const,
      preferredStoreLocation: pricingPrefs.preferredStoreLocation,
      isActive: materialForm.isActive,
    };

    if (editingMaterial) {
      updateMaterial(editingMaterial.id, payload);
      setSelectedItem({ type: 'material', item: { ...editingMaterial, ...payload } });
      showToast('Material updated');
    } else {
      const id = addMaterial(payload);
      setSelectedItem({ type: 'material', item: { id, ...payload } });
      showToast('Material created');
    }

    setShowMaterialModal(false);
    setEditingMaterial(null);
    setMaterialForm({ name: '', category: '', unit: 'ea', unitPrice: '0', supplier: '', sku: '', modelNumber: '', productUrl: '', lastUpdated: '', isActive: true });
  };

  const handleEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setMaterialForm({
      name: material.name,
      category: material.category,
      unit: material.unit,
      unitPrice: material.unitPrice.toString(),
      supplier: material.supplier || '',
      sku: material.sku || '',
      modelNumber: material.modelNumber || '',
      productUrl: material.productUrl || '',
      lastUpdated: material.lastUpdated || '',
      isActive: material.isActive,
    });
    setShowMaterialModal(true);
  };

  const handleDelete = () => {
    if (!deleteId) return;
    if (deleteType === 'labor') {
      deleteLaborRate(deleteId);
      showToast('Labor rate deleted');
    } else {
      deleteMaterial(deleteId);
      showToast('Material deleted');
    }
    setDeleteId(null);
    setSelectedItem(null);
  };

  const openDelete = (type: 'labor' | 'material', id: string) => {
    setDeleteType(type);
    setDeleteId(id);
  };

  const trades = ['Carpentry', 'Electrical', 'Plumbing', 'HVAC', 'Roofing', 'Drywall', 'Painting', 'Flooring', 'General', 'Demolition', 'Landscaping', 'Other'];
  const materialCategories = ['Lumber', 'Sheathing', 'Drywall', 'Hardware', 'Flooring', 'Tile', 'Plumbing', 'Electrical', 'Paint', 'Fasteners', 'Other'];

  const laborUsage = useMemo(() => {
    const usage: Record<string, number> = {};
    estimates.forEach(estimate => {
      JSON.stringify(estimate).replace(/"linkedLaborRateId":"([^"]+)"/g, (_match, id) => {
        usage[id] = (usage[id] || 0) + 1;
        return '';
      });
    });
    timeEntries.forEach(entry => {
      const workerKey = entry.workerId;
      usage[workerKey] = (usage[workerKey] || 0) + 1;
    });
    return usage;
  }, [estimates, timeEntries]);

  const filteredLabor = useMemo(() => {
    const term = search.trim().toLowerCase();
    return laborRates.filter(rate => !term || rate.name.toLowerCase().includes(term) || rate.trade.toLowerCase().includes(term));
  }, [laborRates, search]);

  const filteredMaterials = useMemo(() => {
    const term = search.trim().toLowerCase();
    return materials.filter(material => !term ||
      material.name.toLowerCase().includes(term) ||
      material.category?.toLowerCase().includes(term) ||
      material.supplier?.toLowerCase().includes(term) ||
      material.sku?.toLowerCase().includes(term)
    );
  }, [materials, search]);

  const avgRate = laborRates.length > 0 ? laborRates.reduce((sum, rate) => sum + rate.hourlyRate, 0) / laborRates.length : 0;
  const tradeUsage = laborRates.reduce((acc, rate) => {
    acc[rate.trade] = (acc[rate.trade] || 0) + (laborUsage[rate.id] || 1);
    return acc;
  }, {} as Record<string, number>);
  const mostUsedTrade = Object.entries(tradeUsage).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None yet';
  const lastUpdated = laborRates.length + materials.length > 0 ? 'Today' : 'No updates';
  const lowRateCount = laborRates.filter(rate => rate.hourlyRate > 0 && rate.hourlyRate < Math.max(45, avgRate * 0.8)).length;
  const missingOvertimeCount = laborRates.filter(rate => !rate.overtimeRate || rate.overtimeRate <= rate.hourlyRate).length;

  const tabs: { id: PriceTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: laborRates.length + materials.length },
    { id: 'labor', label: 'Labor', count: laborRates.length },
    { id: 'materials', label: 'Materials', count: materials.length },
    { id: 'equipment', label: 'Equipment', count: materials.filter(m => m.category?.toLowerCase().includes('equipment')).length },
    { id: 'subcontractors', label: 'Subcontractors', count: laborRates.filter(r => r.trade?.toLowerCase().includes('sub')).length },
  ];

  const showLaborTable = activeTab === 'labor' || activeTab === 'all' || activeTab === 'subcontractors';
  const showMaterialTable = activeTab === 'materials' || activeTab === 'equipment' || activeTab === 'all';
  const tableLabor = activeTab === 'subcontractors'
    ? filteredLabor.filter(rate => rate.trade.toLowerCase().includes('sub'))
    : filteredLabor;
  const tableMaterials = activeTab === 'equipment'
    ? filteredMaterials.filter(material => material.category?.toLowerCase().includes('equipment'))
    : filteredMaterials;

  const selectedUsage = selectedItem?.type === 'labor' ? laborUsage[selectedItem.item.id] || 0 : 0;
  const hasPriceBookItems = laborRates.length + materials.length > 0;

  const importStarterRates = () => {
    [
      { name: 'Lead Carpenter', trade: 'Carpentry', hourlyRate: 72, overtimeRate: 108, isActive: true },
      { name: 'Journeyman Electrician', trade: 'Electrical', hourlyRate: 88, overtimeRate: 132, isActive: true },
      { name: 'Plumber', trade: 'Plumbing', hourlyRate: 92, overtimeRate: 138, isActive: true },
      { name: 'Painter', trade: 'Painting', hourlyRate: 54, overtimeRate: 81, isActive: true },
    ].forEach(rate => addLaborRate(rate));
    showToast('Starter labor rates imported');
  };

  const savePrefs = (updates: Partial<PricingPreferences>) => {
    const next = { ...pricingPrefs, ...updates };
    setPricingPrefs(next);
    savePricingPreferences(next);
  };

  const updateMaterialPrice = async (material: Material, force = true) => {
    setUpdatingPrices(prev => [...prev, material.id]);
    try {
      const result = await fetchLatestMaterialPrice(material, pricingPrefs, force);
      const updates = applyPricingResult(material, result);
      updateMaterial(material.id, updates);
      if (selectedItem?.type === 'material' && selectedItem.item.id === material.id) {
        setSelectedItem({ type: 'material', item: { ...material, ...updates } });
      }
      showToast(result.estimateOnly ? 'Estimated pricing refreshed' : 'Live pricing updated');
    } catch {
      showToast('Pricing update failed', 'error');
    } finally {
      setUpdatingPrices(prev => prev.filter(id => id !== material.id));
    }
  };

  const updateAllMaterialPricing = async () => {
    const targets = pricingPrefs.autoRefreshWeekly
      ? filteredMaterials.filter(material => isPriceOutdated(material, 7))
      : filteredMaterials;
    if (targets.length === 0) {
      showToast('All visible prices are current');
      return;
    }
    for (const material of targets.slice(0, 20)) {
      await updateMaterialPrice(material, !pricingPrefs.autoRefreshWeekly);
    }
    showToast(`Pricing checked for ${Math.min(targets.length, 20)} items`);
  };

  const setUpdatedMaterial = (material: Material, updates: Partial<Material>) => {
    updateMaterial(material.id, updates);
    const updatedMaterial = { ...material, ...updates };
    if (selectedItem?.type === 'material' && selectedItem.item.id === material.id) {
      setSelectedItem({ type: 'material', item: updatedMaterial });
    }
    if (lookupMaterial?.id === material.id) setLookupMaterial(updatedMaterial);
  };

  const autoMatchMaterial = async (material: Material, openReview = true) => {
    if (material.matchStatus === 'confirmed') {
      showToast('Confirmed matches are protected. Use Refresh Price to update pricing.', 'info');
      return;
    }
    setAutoMatchingIds(prev => [...prev, material.id]);
    try {
      const matches = await findPricingMatches(material, pricingPrefs);
      if (!matches.bestMatch) {
        setUpdatedMaterial(material, { matchStatus: 'unmatched', matchConfidence: 0 });
        showToast('No confident match found', 'warning');
        return;
      }
      setUpdatedMaterial(material, suggestionUpdates(matches.bestMatch));
      if (openReview) {
        setLookupMaterial({ ...material, ...suggestionUpdates(matches.bestMatch) });
        setLookupResults([matches.bestMatch, ...matches.alternativeMatches]);
      }
      showToast(`Suggested match found (${matches.bestMatch.confidence}% confidence)`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Auto match failed', 'error');
    } finally {
      setAutoMatchingIds(prev => prev.filter(id => id !== material.id));
    }
  };

  const autoMatchUnmatchedItems = async () => {
    const targets = filteredMaterials.filter(material => material.matchStatus !== 'confirmed').slice(0, 20);
    if (targets.length === 0) {
      showToast('No unmatched items to auto match');
      return;
    }
    for (const material of targets) {
      await autoMatchMaterial(material, false);
    }
    showToast(`Auto matched ${targets.length} item${targets.length === 1 ? '' : 's'} for review`);
  };

  const lookupCurrentPrice = async (material: Material) => {
    setLookupMaterial(material);
    setLookupResults([]);
    setLookupLoading(true);
    try {
      const results = await lookupPricing({
        query: material.sku || material.modelNumber || material.matchedProductTitle || material.name,
        supplier: pricingPrefs.preferredSupplier || material.supplier,
        location: pricingPrefs.preferredStoreLocation,
      });
      const scored = results
        .map(result => ({ ...result, confidence: scorePricingResult(material, result) }))
        .sort((a, b) => b.confidence - a.confidence);
      setLookupResults(scored);
      if (results.length === 0) showToast('No pricing matches found', 'warning');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Pricing lookup failed', 'error');
    } finally {
      setLookupLoading(false);
    }
  };

  const confirmMatch = (material: Material, result?: ScoredPricingMatch) => {
    const updates = result
      ? confirmedUpdates(result)
      : {
          unitPrice: material.currentPrice ?? material.unitPrice,
          currentPrice: material.currentPrice ?? material.unitPrice,
          lastUpdated: new Date().toISOString(),
          matchStatus: 'confirmed' as const,
          pricingVerified: true,
          priceEstimateOnly: false,
        };
    setUpdatedMaterial(material, updates);
    setLookupResults([]);
    setLookupMaterial(null);
    showToast('Match confirmed');
  };

  const rejectMatch = (material: Material) => {
    setUpdatedMaterial(material, rejectedUpdates());
    setLookupResults([]);
    setLookupMaterial(null);
    showToast('Match rejected');
  };

  const refreshConfirmedPrice = async (material: Material) => {
    if (material.matchStatus !== 'confirmed') {
      await autoMatchMaterial(material);
      return;
    }
    setUpdatingPrices(prev => [...prev, material.id]);
    try {
      const results = await lookupPricing({
        query: material.sku || material.modelNumber || material.matchedProductTitle || material.name,
        supplier: material.preferredSupplier || pricingPrefs.preferredSupplier || material.supplier,
        location: pricingPrefs.preferredStoreLocation,
      });
      const scored = results
        .map(result => ({ ...result, confidence: scorePricingResult(material, result) }))
        .sort((a, b) => {
          const aSame = material.productUrl && a.link === material.productUrl ? 1 : 0;
          const bSame = material.productUrl && b.link === material.productUrl ? 1 : 0;
          return bSame - aSame || b.confidence - a.confidence;
        });
      const match = scored[0];
      if (!match) {
        showToast('No refreshed price found', 'warning');
        return;
      }
      const updates: Partial<Material> = {
        currentPrice: match.price,
        unitPrice: match.price,
        supplier: match.source || material.supplier,
        lastUpdated: new Date().toISOString(),
        priceSource: 'serpapi',
        pricingSource: 'serpapi',
        pricingVerified: true,
        priceEstimateOnly: false,
        matchConfidence: match.confidence,
      };
      setUpdatedMaterial(material, updates);
      showToast('Confirmed match price refreshed');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Refresh failed', 'error');
    } finally {
      setUpdatingPrices(prev => prev.filter(id => id !== material.id));
    }
  };

  const applyLookupResult = (result: ScoredPricingMatch) => {
    if (!lookupMaterial) return;
    confirmMatch(lookupMaterial, result);
  };

  return (
    <div className="pricebook-page">
      <div className="pricebook-shell">
        <div className="pricebook-header">
          <div>
            <div className="pricebook-eyebrow">Pricing command center</div>
            <h1>Price Book</h1>
            <p>Manage labor rates, material pricing, and cost structures for accurate estimates.</p>
          </div>
          <div className="pricebook-header-actions">
            <div className="pricebook-search">
              <Search size={18} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search labor, materials, trades..." />
            </div>
            <button className={`pricebook-filter-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}><Filter size={17} /> Filter</button>
            <button className="pricebook-filter-btn" onClick={updateAllMaterialPricing}><RefreshCw size={17} /> Update Pricing</button>
            <button className="pricebook-filter-btn" onClick={autoMatchUnmatchedItems}><Zap size={17} /> Auto Match Unmatched Items</button>
            <button className="pricebook-secondary-btn" onClick={() => setShowModal(true)}><Plus size={18} /> Add Rate</button>
            <button className="pricebook-primary-btn" onClick={() => setShowMaterialModal(true)}><Plus size={18} /> Add Item</button>
          </div>
        </div>

        <div className="pricebook-kpis">
          <div className="pricebook-kpi-card"><div className="pricebook-kpi-icon"><Users size={20} /></div><span>Total Labor Roles</span><strong>{laborRates.length}</strong></div>
          <div className="pricebook-kpi-card"><div className="pricebook-kpi-icon"><DollarSign size={20} /></div><span>Average Hourly Rate</span><strong>{formatCurrency(avgRate)}</strong></div>
          <div className="pricebook-kpi-card"><div className="pricebook-kpi-icon"><TrendingUp size={20} /></div><span>Most Used Trade</span><strong>{mostUsedTrade}</strong></div>
          <div className="pricebook-kpi-card"><div className="pricebook-kpi-icon"><Clock size={20} /></div><span>Last Updated</span><strong>{lastUpdated}</strong></div>
        </div>

        {showFilters && (
          <div className="pricebook-filter-stack">
            <div className="pricebook-tabs">
              {tabs.map(tab => (
                <button key={tab.id} className={`pricebook-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                  {tab.label}<span>{tab.count}</span>
                </button>
              ))}
            </div>
            <div className="pricebook-pricing-controls">
              <select value={pricingPrefs.provider} onChange={e => savePrefs({ provider: e.target.value as PricingPreferences['provider'] })}>
                <option value="serpapi">SerpApi</option>
                <option value="rainforest">Rainforest API</option>
                <option value="apify">Apify Scraper</option>
              </select>
              <input value={pricingPrefs.preferredSupplier} onChange={e => savePrefs({ preferredSupplier: e.target.value })} placeholder="Preferred supplier" />
              <input value={pricingPrefs.preferredStoreLocation} onChange={e => savePrefs({ preferredStoreLocation: e.target.value })} placeholder="Store location" />
              <label><input type="checkbox" checked={pricingPrefs.autoRefreshWeekly} onChange={e => savePrefs({ autoRefreshWeekly: e.target.checked })} /> Weekly auto-refresh</label>
            </div>
          </div>
        )}

        {!hasPriceBookItems ? (
          <div className="pricebook-empty">
            <div className="pricebook-empty-icon"><Hammer size={42} /></div>
            <h2>Set up your price book to start building accurate estimates</h2>
            <p>Create reusable labor rates and material items so every estimate starts with reliable pricing.</p>
            <div className="pricebook-empty-actions">
              <button className="pricebook-primary-btn" onClick={() => setShowModal(true)}><Plus size={18} /> Add Labor Rate</button>
              <button className="pricebook-primary-btn" onClick={() => setShowMaterialModal(true)}><Plus size={18} /> Add Item</button>
              <button className="pricebook-secondary-btn" onClick={importStarterRates}><Package size={18} /> Import Starter Rates</button>
            </div>
          </div>
        ) : (
          <div className="pricebook-workspace">
            <div className="pricebook-main">
              <div className="pricebook-insights">
                <div><Zap size={18} /><strong>Smart Insights</strong></div>
                <p>{lowRateCount > 0 ? `${lowRateCount} labor roles look underpriced against your current average.` : 'Labor rates look consistent across active roles.'}</p>
                <p>{missingOvertimeCount > 0 ? `${missingOvertimeCount} roles need overtime rates reviewed.` : `Most used trade: ${mostUsedTrade}. Keep it current for accurate bids.`}</p>
              </div>

              {showLaborTable && (
                <div className="pricebook-table-card">
                  <div className="pricebook-table-head">
                    <span>Role Name</span><span>Category</span><span>Base Rate</span><span>Overtime Rate</span><span>Usage Count</span><span>Actions</span>
                  </div>
                  <div className="pricebook-table-body">
                    {tableLabor.map(rate => (
                      <button key={rate.id} className={`pricebook-row ${selectedItem?.type === 'labor' && selectedItem.item.id === rate.id ? 'selected' : ''}`} onClick={() => setSelectedItem({ type: 'labor', item: rate })}>
                        <span className="pricebook-row-main"><span className="pricebook-thumb"><Hammer size={18} /></span><strong>{rate.name}</strong></span>
                        <span><em className="pricebook-badge">{rate.trade}</em></span>
                        <span onClick={e => e.stopPropagation()}><input className="pricebook-inline-input" type="number" value={rate.hourlyRate} onChange={e => updateLaborRate(rate.id, { hourlyRate: parseFloat(e.target.value) || 0 })} /></span>
                        <span onClick={e => e.stopPropagation()}><input className="pricebook-inline-input" type="number" value={rate.overtimeRate || 0} onChange={e => updateLaborRate(rate.id, { overtimeRate: parseFloat(e.target.value) || 0 })} /></span>
                        <span>{laborUsage[rate.id] || 0}</span>
                        <span className="pricebook-row-actions" onClick={e => e.stopPropagation()}>
                          <button onClick={() => handleEditRate(rate)}><Edit size={14} /></button>
                          <button onClick={() => openDelete('labor', rate.id)}><Trash2 size={14} /></button>
                        </span>
                      </button>
                    ))}
                    {tableLabor.length === 0 && <div className="pricebook-no-results">No labor rates match this view.</div>}
                  </div>
                </div>
              )}

              {showMaterialTable && (
                <div className="pricebook-table-card">
                  <div className="pricebook-material-head pricebook-live-material-head">
                    <span>Item</span><span>Category</span><span>Unit</span><span>Unit Price</span><span>Supplier</span><span>Last Updated</span><span>Actions</span>
                  </div>
                  <div className="pricebook-table-body">
                    {tableMaterials.map(material => (
                      <button key={material.id} className={`pricebook-row pricebook-material-row pricebook-live-material-row ${selectedItem?.type === 'material' && selectedItem.item.id === material.id ? 'selected' : ''}`} onClick={() => setSelectedItem({ type: 'material', item: material })}>
                        <span className="pricebook-row-main"><span className="pricebook-thumb"><Boxes size={18} /></span><strong>{material.name}</strong></span>
                        <span><em className="pricebook-badge">{material.category || 'Material'}</em></span>
                        <span>{material.unit}</span>
                        <span>{formatCurrency(material.unitPrice)}</span>
                        <span>{material.supplier || '-'}</span>
                        <span>
                          <em className={`pricebook-price-status ${isPriceOutdated(material) ? 'outdated' : material.priceEstimateOnly ? 'estimate' : 'fresh'}`}>
                            {material.lastUpdated ? `${getPriceAgeDays(material.lastUpdated)}d ago` : 'No update'}
                          </em>
                        </span>
                        <span className="pricebook-row-actions" onClick={e => e.stopPropagation()}>
                          <button onClick={() => autoMatchMaterial(material)} disabled={autoMatchingIds.includes(material.id)} title="Auto match product" aria-label={`Auto match ${material.name}`}><Zap size={14} /></button>
                          <button onClick={() => refreshConfirmedPrice(material)} disabled={updatingPrices.includes(material.id)} title="Refresh price" aria-label={`Refresh price for ${material.name}`}><RefreshCw size={14} /></button>
                          <button onClick={() => handleEditMaterial(material)} title="Edit item" aria-label={`Edit ${material.name}`}><Edit size={14} /></button>
                          <button onClick={() => openDelete('material', material.id)} title="Delete item" aria-label={`Delete ${material.name}`}><Trash2 size={14} /></button>
                        </span>
                      </button>
                    ))}
                    {tableMaterials.length === 0 && <div className="pricebook-no-results">No material items match this view.</div>}
                  </div>
                </div>
              )}
            </div>

            <aside className="pricebook-detail-panel">
              {selectedItem ? (
                <>
                  <div className="pricebook-detail-hero">
                    <div className="pricebook-detail-icon">{selectedItem.type === 'labor' ? <Hammer size={42} /> : <Boxes size={42} />}</div>
                    <div>
                      <em className="pricebook-badge">{selectedItem.type === 'labor' ? selectedItem.item.trade : selectedItem.item.category || 'Material'}</em>
                      <h2>{selectedItem.item.name}</h2>
                      <p>{selectedItem.type === 'labor' ? 'Labor role used for estimate line-item pricing.' : `${selectedItem.item.unit} pricing${selectedItem.item.supplier ? ` from ${selectedItem.item.supplier}` : ''}.`}</p>
                    </div>
                  </div>
                  <div className="pricebook-detail-stats">
                    {selectedItem.type === 'labor' ? (
                      <>
                        <div><span>Base rate</span><strong>{formatCurrency(selectedItem.item.hourlyRate)}/hr</strong></div>
                        <div><span>OT rate</span><strong>{formatCurrency(selectedItem.item.overtimeRate || 0)}/hr</strong></div>
                        <div><span>Estimate usage</span><strong>{selectedUsage}</strong></div>
                        <div><span>Status</span><strong>{selectedItem.item.isActive ? 'Active' : 'Inactive'}</strong></div>
                      </>
                    ) : (
                      <>
                        <div><span>Unit price</span><strong>{formatCurrency(selectedItem.item.currentPrice ?? selectedItem.item.unitPrice)}</strong></div>
                        <div><span>Unit</span><strong>{selectedItem.item.unit}</strong></div>
                        <div><span>Supplier</span><strong>{selectedItem.item.supplier || '-'}</strong></div>
                        <div><span>Match</span><strong>{selectedItem.item.matchStatus || 'unmatched'}{selectedItem.item.matchConfidence !== undefined ? ` (${selectedItem.item.matchConfidence}%)` : ''}</strong></div>
                        <div><span>Status</span><strong>{selectedItem.item.isActive ? 'Active' : 'Inactive'}</strong></div>
                        <div><span>SKU / Model</span><strong>{selectedItem.item.sku || selectedItem.item.modelNumber || '-'}</strong></div>
                        <div><span>Last updated</span><strong>{selectedItem.item.lastUpdated ? `${getPriceAgeDays(selectedItem.item.lastUpdated)} days ago` : 'Never'}</strong></div>
                      </>
                    )}
                  </div>
                  <div className="pricebook-detail-actions">
                    <button className="pricebook-secondary-btn" onClick={() => selectedItem.type === 'labor' ? handleEditRate(selectedItem.item) : handleEditMaterial(selectedItem.item)}><Edit size={16} /> Edit</button>
                    {selectedItem.type === 'material' && <button className="pricebook-secondary-btn" onClick={() => autoMatchMaterial(selectedItem.item)}><Zap size={16} /> Auto Match</button>}
                    {selectedItem.type === 'material' && <button className="pricebook-secondary-btn" onClick={() => refreshConfirmedPrice(selectedItem.item)}><RefreshCw size={16} /> Refresh Price</button>}
                    {selectedItem.type === 'material' && selectedItem.item.productUrl && <a className="pricebook-secondary-btn" href={selectedItem.item.productUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Product</a>}
                    <button className="pricebook-danger-btn" onClick={() => openDelete(selectedItem.type === 'labor' ? 'labor' : 'material', selectedItem.item.id)}><Trash2 size={16} /> Delete</button>
                    <Link to="/estimates/new" className="pricebook-primary-btn"><Plus size={16} /> Apply to Estimate</Link>
                  </div>
                  {selectedItem.type === 'material' && isPriceOutdated(selectedItem.item) && (
                    <div className="pricebook-warning"><AlertTriangle size={16} /> Price outdated. Refresh before using this item in a new estimate.</div>
                  )}
                  {selectedItem.type === 'material' && selectedItem.item.priceEstimateOnly && (
                    <div className="pricebook-warning"><AlertTriangle size={16} /> Price estimate only. Verify with supplier before sending final pricing.</div>
                  )}
                  {selectedItem.type === 'material' && selectedItem.item.matchStatus === 'suggested' && (
                    <div className="pricebook-warning">
                      <AlertTriangle size={16} /> Suggested match: {selectedItem.item.matchedProductTitle || 'Review match'} ({selectedItem.item.matchConfidence || 0}% confidence)
                      <button className="btn btn-sm btn-primary" onClick={() => confirmMatch(selectedItem.item)}>Confirm Match</button>
                      <button className="btn btn-sm btn-secondary" onClick={() => lookupCurrentPrice(selectedItem.item)}>View Alternatives</button>
                      <button className="btn btn-sm btn-danger" onClick={() => rejectMatch(selectedItem.item)}>Reject</button>
                    </div>
                  )}
                  {selectedItem.type === 'labor' && selectedItem.item.hourlyRate < Math.max(45, avgRate * 0.8) && (
                    <div className="pricebook-warning"><AlertTriangle size={16} /> This role may be underpriced. Consider increasing the base rate or reviewing markup.</div>
                  )}
                </>
              ) : (
                <div className="pricebook-no-results">Select a pricing row to inspect details.</div>
              )}
            </aside>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingRate(null); }} title={editingRate ? 'Edit Labor Rate' : 'New Labor Rate'} size="md">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Rate Name *</label>
            <input className="form-input" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="e.g., Lead Carpenter" />
          </div>
          <div className="form-group">
            <label className="form-label">Trade *</label>
            <select className="form-select" value={formData.trade} onChange={e => setFormData({...formData, trade: e.target.value})}>
              <option value="">Select trade...</option>
              {trades.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Hourly Rate</label>
              <input className="form-input" type="number" value={formData.hourlyRate} onChange={e => setFormData({...formData, hourlyRate: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Overtime Rate</label>
              <input className="form-input" type="number" value={formData.overtimeRate} onChange={e => setFormData({...formData, overtimeRate: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.isActive} onChange={e => setFormData({...formData, isActive: e.target.checked})} />
              Active
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingRate(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveRate}>{editingRate ? 'Update' : 'Create'} Rate</button>
        </div>
      </Modal>

      <Modal isOpen={showMaterialModal} onClose={() => { setShowMaterialModal(false); setEditingMaterial(null); }} title={editingMaterial ? 'Edit Material' : 'New Material'} size="md">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Material Name *</label>
            <input className="form-input" value={materialForm.name} onChange={e => setMaterialForm({...materialForm, name: e.target.value})} placeholder="e.g., 2x4x8 Stud" />
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <select className="form-select" value={materialForm.category} onChange={e => setMaterialForm({...materialForm, category: e.target.value})}>
              <option value="">Select category...</option>
              {materialCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">Unit</label>
              <input className="form-input" value={materialForm.unit} onChange={e => setMaterialForm({...materialForm, unit: e.target.value})} placeholder="ea, sqft, lf, etc." />
            </div>
            <div className="form-group">
              <label className="form-label">Unit Price</label>
              <input className="form-input" type="number" value={materialForm.unitPrice} onChange={e => setMaterialForm({...materialForm, unitPrice: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Supplier</label>
            <input className="form-input" value={materialForm.supplier} onChange={e => setMaterialForm({...materialForm, supplier: e.target.value})} />
          </div>
          <div className="grid-2 gap-4">
            <div className="form-group">
              <label className="form-label">SKU</label>
              <input className="form-input" value={materialForm.sku} onChange={e => setMaterialForm({...materialForm, sku: e.target.value})} />
            </div>
            <div className="form-group">
              <label className="form-label">Model Number</label>
              <input className="form-input" value={materialForm.modelNumber} onChange={e => setMaterialForm({...materialForm, modelNumber: e.target.value})} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Product URL</label>
            <input className="form-input" value={materialForm.productUrl} onChange={e => setMaterialForm({...materialForm, productUrl: e.target.value})} placeholder="https://..." />
          </div>
          <div className="form-group">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={materialForm.isActive} onChange={e => setMaterialForm({...materialForm, isActive: e.target.checked})} />
              Active
            </label>
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowMaterialModal(false); setEditingMaterial(null); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveMaterial}>{editingMaterial ? 'Update' : 'Create'} Material</button>
        </div>
      </Modal>

      <Modal isOpen={!!lookupMaterial} onClose={() => { setLookupMaterial(null); setLookupResults([]); }} title="Current Price Lookup" size="lg">
        <div className="space-y-4">
          <div>
            <h3 className="card-title">{lookupMaterial?.name}</h3>
            <p className="text-sm text-muted">Review suggested matches before changing this Price Book item.</p>
          </div>
          {lookupLoading ? (
            <div className="card"><div className="card-body">Searching current prices...</div></div>
          ) : lookupResults.length === 0 ? (
            <div className="card"><div className="card-body text-muted">No matching products yet.</div></div>
          ) : (
            <div className="pricebook-table-body">
              {lookupResults.map((result, index) => (
                <div className="pricebook-row pricebook-material-row pricebook-live-material-row" key={`${result.link}-${index}`}>
                  <span className="pricebook-row-main">
                    {result.thumbnail ? <img src={result.thumbnail} alt="" style={{ width: 42, height: 42, objectFit: 'cover', borderRadius: 8 }} /> : <span className="pricebook-thumb"><Boxes size={18} /></span>}
                    <strong>{result.title}</strong>
                  </span>
                  <span>{result.source || 'Unknown source'}</span>
                  <span>{result.displayPrice || formatCurrency(result.price)}</span>
                  <span>{result.confidence}% confidence</span>
                  <span>{result.rating ? `${result.rating} stars` : '-'}</span>
                  <span>{result.reviews ? `${result.reviews} reviews` : '-'}</span>
                  <span className="pricebook-row-actions">
                    {result.link && <a href={result.link} target="_blank" rel="noreferrer" title="Open product"><ExternalLink size={14} /></a>}
                    <button onClick={() => applyLookupResult(result)}>Confirm Match</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          {lookupMaterial && !lookupLoading && (
            <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
              <button className="btn btn-secondary" onClick={() => rejectMatch(lookupMaterial)}>Reject</button>
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title={`Delete ${deleteType === 'labor' ? 'Labor Rate' : 'Material'}?`}
        message={`This will remove the ${deleteType === 'labor' ? 'rate' : 'material'} from your price book.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
