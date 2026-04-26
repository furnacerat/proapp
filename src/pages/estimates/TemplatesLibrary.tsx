import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Edit, Trash2, Copy, FileText, Search, Filter, Rocket,
  Clock, TrendingUp, Sparkles, Layers, BadgeDollarSign, Wand2,
  ChevronRight, PackageCheck,
} from 'lucide-react';
import type { Template } from '../../data/types';

type TemplateCategory = 'all' | 'kitchen' | 'bathroom' | 'roofing' | 'remodel' | 'custom';

const categories: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'roofing', label: 'Roofing' },
  { id: 'remodel', label: 'Remodel' },
  { id: 'custom', label: 'Custom' },
];

const starterTemplates = [
  { name: 'Kitchen Remodel - Basic', type: 'estimate' as const, scope: 'Complete kitchen remodel with cabinets, countertops, flooring', laborAssumptions: 'Demo, drywall, electrical, plumbing, install', materialAssumptions: 'Cabinets, countertops, flooring, fixtures', markupPercent: 20 },
  { name: 'Bathroom Remodel', type: 'estimate' as const, scope: 'Full bathroom renovation', laborAssumptions: 'Demo, plumbing, electrical, tile, fixtures', materialAssumptions: 'Tile, vanity, fixtures, plumbing', markupPercent: 20 },
  { name: 'Deck Build', type: 'estimate' as const, scope: 'Custom deck construction', laborAssumptions: 'Framing, decking, railings, stairs', materialAssumptions: 'Framing lumber, decking, hardware', markupPercent: 20 },
  { name: 'Flooring Install', type: 'estimate' as const, scope: 'Hardwood or tile flooring installation', laborAssumptions: 'Subfloor prep, installation, finishing', materialAssumptions: 'Flooring materials, underlayment', markupPercent: 20 },
  { name: 'Interior Paint', type: 'estimate' as const, scope: 'Interior painting - whole room', laborAssumptions: 'Prep, priming, painting, cleanup', materialAssumptions: 'Paint, primer, supplies', markupPercent: 20 },
  { name: 'Roofing', type: 'estimate' as const, scope: 'Complete roofing replacement', laborAssumptions: 'Tear-off, underlayment, shingles, flashing', materialAssumptions: 'Shingles, underlayment, flashing', markupPercent: 20 },
  { name: 'Whole House Rehab', type: 'estimate' as const, scope: 'Full house renovation', laborAssumptions: 'Demo, framing, electrical, plumbing, drywall, paint', materialAssumptions: 'All materials', markupPercent: 20 },
  { name: 'New Build Allowance', type: 'estimate' as const, scope: 'Custom new build budget', laborAssumptions: 'All trades - placeholder', materialAssumptions: 'Allowance-based', markupPercent: 15 },
];

function inferCategory(template: Template): TemplateCategory {
  const text = `${template.name} ${template.scope || ''}`.toLowerCase();
  if (text.includes('kitchen')) return 'kitchen';
  if (text.includes('bath')) return 'bathroom';
  if (text.includes('roof')) return 'roofing';
  if (text.includes('remodel') || text.includes('rehab') || text.includes('floor') || text.includes('paint')) return 'remodel';
  return 'custom';
}

function templateItems(template: Template, assemblyNames: string[] = []) {
  const explicitItems = template.items?.map(item => item.name).filter(Boolean) || [];
  const assumptions = [
    ...assemblyNames,
    template.scope,
    template.laborAssumptions ? `Labor: ${template.laborAssumptions}` : '',
    template.materialAssumptions ? `Materials: ${template.materialAssumptions}` : '',
  ].filter(Boolean) as string[];
  return explicitItems.length > 0 ? explicitItems : assumptions;
}

function estimateTemplateValue(template: Template) {
  const itemTotal = template.items?.reduce((sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0), 0) || 0;
  const fallback = Math.max(1500, templateItems(template).length * 1250);
  const cost = itemTotal || fallback;
  return {
    cost,
    price: cost * (1 + (template.markupPercent || 0) / 100),
    laborHours: Math.max(4, Math.round((template.laborAssumptions || '').split(',').filter(Boolean).length * 6)),
  };
}

export function TemplatesLibrary() {
  const { templates, assemblies, addTemplate, updateTemplate, deleteTemplate } = useApp();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(true);
  const [activeCategory, setActiveCategory] = useState<TemplateCategory>('all');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(templates[0]?.id || null);

  const [formData, setFormData] = useState({
    name: '',
    type: 'estimate' as 'estimate' | 'job',
    scope: '',
    laborAssumptions: '',
    materialAssumptions: '',
    markupPercent: '20',
    assemblyIds: [] as string[],
  });

  const selectedTemplate = templates.find(template => template.id === selectedTemplateId) || templates[0] || null;

  const categoryCounts = useMemo(() => {
    return categories.reduce((acc, category) => {
      acc[category.id] = category.id === 'all'
        ? templates.length
        : templates.filter(template => inferCategory(template) === category.id).length;
      return acc;
    }, {} as Record<TemplateCategory, number>);
  }, [templates]);

  const filteredTemplates = useMemo(() => {
    const term = search.trim().toLowerCase();
    return templates.filter(template => {
      const category = inferCategory(template);
      const matchesCategory = activeCategory === 'all' || category === activeCategory;
      const haystack = `${template.name} ${template.scope || ''} ${template.laborAssumptions || ''} ${template.materialAssumptions || ''}`.toLowerCase();
      return matchesCategory && (!term || haystack.includes(term));
    });
  }, [templates, activeCategory, search]);

  const mostUsedTemplate = useMemo(() => {
    return templates.find(template => inferCategory(template) === 'kitchen') || templates[0] || null;
  }, [templates]);

  const averageValue = templates.length
    ? templates.reduce((sum, template) => sum + estimateTemplateValue(template).price, 0) / templates.length
    : 0;

  const handleSave = () => {
    if (!formData.name) {
      showToast('Name is required', 'error');
      return;
    }

    if (editingTemplate) {
      updateTemplate(editingTemplate.id, {
        ...formData,
        markupPercent: parseFloat(formData.markupPercent) || 20,
      });
      setSelectedTemplateId(editingTemplate.id);
      showToast('Template updated');
    } else {
      const id = addTemplate({
        name: formData.name,
        type: formData.type,
        scope: formData.scope,
        laborAssumptions: formData.laborAssumptions,
        materialAssumptions: formData.materialAssumptions,
        markupPercent: parseFloat(formData.markupPercent) || 20,
        assemblyIds: formData.assemblyIds,
        items: [],
      });
      setSelectedTemplateId(id);
      showToast('Template created');
    }

    setShowModal(false);
    setEditingTemplate(null);
    resetForm();
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'estimate',
      scope: '',
      laborAssumptions: '',
      materialAssumptions: '',
      markupPercent: '20',
      assemblyIds: [],
    });
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      scope: template.scope || '',
      laborAssumptions: template.laborAssumptions || '',
      materialAssumptions: template.materialAssumptions || '',
      markupPercent: template.markupPercent.toString(),
      assemblyIds: template.assemblyIds || [],
    });
    setShowModal(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTemplate(deleteId);
      showToast('Template deleted');
      setDeleteId(null);
      if (selectedTemplateId === deleteId) {
        setSelectedTemplateId(templates.find(template => template.id !== deleteId)?.id || null);
      }
    }
  };

  const handleAddStarter = () => {
    starterTemplates.forEach(template => addTemplate(template));
    showToast('Added 8 starter templates');
  };

  const handleUseTemplate = (template: Template) => {
    sessionStorage.setItem('buildops_template_draft', JSON.stringify(template));
    showToast(`Starting estimate from ${template.name}`);
    navigate('/estimates/new');
  };

  return (
    <div className="templates-page">
      <div className="templates-shell">
        <header className="templates-header">
          <div>
            <span className="templates-eyebrow"><Sparkles size={14} /> Estimate launch center</span>
            <h1>Templates Library</h1>
            <p>Start estimates instantly using pre-built project templates</p>
          </div>
          <div className="templates-header-actions">
            <label className="templates-search">
              <Search size={18} />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search templates..." />
            </label>
            <button className={`templates-icon-btn ${showFilters ? 'active' : ''}`} onClick={() => setShowFilters(!showFilters)}>
              <Filter size={18} />
              <span>Filters</span>
            </button>
            <button className="templates-primary-btn" onClick={() => { resetForm(); setEditingTemplate(null); setShowModal(true); }}>
              <Plus size={18} />
              <span>New Template</span>
            </button>
          </div>
        </header>

        <section className="templates-kpis">
          <div className="templates-kpi-card">
            <div className="templates-kpi-icon blue"><Layers size={20} /></div>
            <span>Total Templates</span>
            <strong>{templates.length}</strong>
            <small>{categoryCounts.all} ready to launch</small>
          </div>
          <div className="templates-kpi-card">
            <div className="templates-kpi-icon purple"><Rocket size={20} /></div>
            <span>Most Used Template</span>
            <strong>{mostUsedTemplate?.name || 'None yet'}</strong>
            <small>Suggested first pick</small>
          </div>
          <div className="templates-kpi-card">
            <div className="templates-kpi-icon cyan"><BadgeDollarSign size={20} /></div>
            <span>Average Estimate Value</span>
            <strong>{averageValue ? formatCurrency(averageValue) : '$0'}</strong>
            <small>Based on template pricing</small>
          </div>
          <div className="templates-kpi-card">
            <div className="templates-kpi-icon green"><Clock size={20} /></div>
            <span>Time Saved</span>
            <strong>{templates.length ? `${templates.length * 2.5} hrs` : '0 hrs'}</strong>
            <small>Estimated setup savings</small>
          </div>
        </section>

        {showFilters && (
          <nav className="templates-category-bar">
            {categories.map(category => (
              <button
                key={category.id}
                className={activeCategory === category.id ? 'active' : ''}
                onClick={() => setActiveCategory(category.id)}
              >
                {category.label}
                <span>{categoryCounts[category.id] || 0}</span>
              </button>
            ))}
          </nav>
        )}

        {templates.length === 0 ? (
          <section className="templates-empty">
            <div className="templates-empty-icon"><FileText size={34} /></div>
            <h2>Create your first template to speed up future estimates</h2>
            <p>Save reusable scopes, labor assumptions, materials, and markup so your next estimate starts with a strong baseline.</p>
            <div className="templates-empty-actions">
              <button className="templates-primary-btn" onClick={() => setShowModal(true)}><Plus size={18} /> New Template</button>
              <button className="templates-secondary-btn" onClick={handleAddStarter}><Copy size={18} /> Import Starter Templates</button>
            </div>
          </section>
        ) : (
          <main className="templates-workspace">
            <section className="templates-main">
              <div className="templates-insights">
                <div>
                  <span><Wand2 size={16} /> Smart Suggestions</span>
                  <strong>{mostUsedTemplate ? `Start with ${mostUsedTemplate.name}` : 'Import starter templates'}</strong>
                  <p>{mostUsedTemplate ? 'This template has the strongest reuse profile for fast estimate starts.' : 'Starter templates give you reusable pricing structures immediately.'}</p>
                </div>
                <button onClick={() => mostUsedTemplate ? handleUseTemplate(mostUsedTemplate) : handleAddStarter()}>
                  {mostUsedTemplate ? 'Use Suggested' : 'Import Starters'} <ChevronRight size={16} />
                </button>
              </div>

              <div className="templates-grid">
                {filteredTemplates.map(template => {
                  const category = inferCategory(template);
                  const value = estimateTemplateValue(template);
                  const assemblyNames = (template.assemblyIds || [])
                    .map(id => assemblies.find(assembly => assembly.id === id)?.name)
                    .filter(Boolean) as string[];
                  const items = templateItems(template, assemblyNames).slice(0, 4);
                  const isSelected = selectedTemplate?.id === template.id;

                  return (
                    <article
                      key={template.id}
                      className={`template-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => setSelectedTemplateId(template.id)}
                    >
                      <div className="template-card-top">
                        <div className="template-thumb"><PackageCheck size={24} /></div>
                        <span className={`template-category ${category}`}>{category}</span>
                      </div>
                      <h2>{template.name}</h2>
                      <p>{template.scope || 'Reusable estimate template ready for scope, labor, and material assumptions.'}</p>
                      <ul>
                        {items.length > 0 ? items.map((item, index) => <li key={`${template.id}-${index}`}>{item}</li>) : <li>Add included items to make this launch-ready.</li>}
                      </ul>
                      <div className="template-card-meta">
                        <span>{template.markupPercent}% markup</span>
                        <span>{formatCurrency(value.price)} est.</span>
                      </div>
                      <div className="template-card-actions" onClick={event => event.stopPropagation()}>
                        <button className="template-use-btn" onClick={() => handleUseTemplate(template)}><Rocket size={16} /> Use Template</button>
                        <button className="template-icon-action" onClick={() => handleEdit(template)}><Edit size={16} /></button>
                        <button className="template-icon-action danger" onClick={() => setDeleteId(template.id)}><Trash2 size={16} /></button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <aside className="template-detail-panel">
              {selectedTemplate ? (
                <>
                  <div className="template-detail-hero">
                    <div className="template-detail-icon"><FileText size={28} /></div>
                    <span className={`template-category ${inferCategory(selectedTemplate)}`}>{inferCategory(selectedTemplate)}</span>
                  </div>
                  <h2>{selectedTemplate.name}</h2>
                  <p>{selectedTemplate.scope || 'No scope has been added yet.'}</p>

                  <div className="template-detail-stats">
                    <div><span>Labor Hours</span><strong>{estimateTemplateValue(selectedTemplate).laborHours}</strong></div>
                    <div><span>Cost</span><strong>{formatCurrency(estimateTemplateValue(selectedTemplate).cost)}</strong></div>
                    <div><span>Price</span><strong>{formatCurrency(estimateTemplateValue(selectedTemplate).price)}</strong></div>
                    <div><span>Markup</span><strong>{selectedTemplate.markupPercent}%</strong></div>
                  </div>

                  <div className="template-detail-section">
                    <h3>Included Items</h3>
                    <div className="template-detail-items">
                      {templateItems(selectedTemplate, (selectedTemplate.assemblyIds || []).map(id => assemblies.find(assembly => assembly.id === id)?.name).filter(Boolean) as string[]).map((item, index) => (
                        <div key={`${selectedTemplate.id}-detail-${index}`}>
                          <Copy size={14} />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="template-detail-actions">
                    <button className="templates-primary-btn" onClick={() => handleUseTemplate(selectedTemplate)}><Rocket size={18} /> Use Template</button>
                    <button className="templates-secondary-btn" onClick={() => handleEdit(selectedTemplate)}><Edit size={18} /> Edit Template</button>
                    <button className="templates-danger-btn" onClick={() => setDeleteId(selectedTemplate.id)}><Trash2 size={18} /> Delete Template</button>
                  </div>
                </>
              ) : (
                <div className="template-detail-empty">
                  <FileText size={30} />
                  <p>Select a template to inspect scope, assumptions, and launch actions.</p>
                </div>
              )}
            </aside>
          </main>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingTemplate(null); resetForm(); }} title={editingTemplate ? 'Edit Template' : 'New Template'} size="lg">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Template Name *</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Kitchen Remodel - Basic"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              className="form-select"
              value={formData.type}
              onChange={e => setFormData({ ...formData, type: e.target.value as 'estimate' | 'job' })}
            >
              <option value="estimate">Estimate</option>
              <option value="job">Job</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Scope</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.scope}
              onChange={e => setFormData({ ...formData, scope: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Labor Assumptions</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.laborAssumptions}
              onChange={e => setFormData({ ...formData, laborAssumptions: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Material Assumptions</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.materialAssumptions}
              onChange={e => setFormData({ ...formData, materialAssumptions: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Markup %</label>
            <input
              className="form-input"
              type="number"
              value={formData.markupPercent}
              onChange={e => setFormData({ ...formData, markupPercent: e.target.value })}
            />
          </div>
          {assemblies.length > 0 && (
            <div className="form-group">
              <label className="form-label">Included Assemblies</label>
              <div className="templates-assembly-select">
                {assemblies.map(assembly => (
                  <label key={assembly.id}>
                    <input
                      type="checkbox"
                      checked={formData.assemblyIds.includes(assembly.id)}
                      onChange={e => setFormData({
                        ...formData,
                        assemblyIds: e.target.checked
                          ? [...formData.assemblyIds, assembly.id]
                          : formData.assemblyIds.filter(id => id !== assembly.id),
                      })}
                    />
                    <span>{assembly.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ padding: 0, borderTop: 'none', marginTop: '16px' }}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingTemplate(null); resetForm(); }}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>
            {editingTemplate ? 'Update' : 'Create'} Template
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Delete Template?"
        message="This will remove the template from your library."
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
