import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import { Plus, Edit, Trash2, Copy, FileText, ChevronRight } from 'lucide-react';
import type { Template } from '../../data/types';

export function TemplatesLibrary() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useApp();
  const { showToast } = useToast();
  
  const [showModal, setShowModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'estimate' as 'estimate' | 'job',
    scope: '',
    laborAssumptions: '',
    materialAssumptions: '',
    markupPercent: '20',
  });

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
      showToast('Template updated');
    } else {
      addTemplate({
        name: formData.name,
        type: formData.type,
        scope: formData.scope,
        laborAssumptions: formData.laborAssumptions,
        materialAssumptions: formData.materialAssumptions,
        markupPercent: parseFloat(formData.markupPercent) || 20,
        items: [],
      });
      showToast('Template created');
    }
    
    setShowModal(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      type: 'estimate',
      scope: '',
      laborAssumptions: '',
      materialAssumptions: '',
      markupPercent: '20',
    });
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      scope: template.scope,
      laborAssumptions: template.laborAssumptions,
      materialAssumptions: template.materialAssumptions,
      markupPercent: template.markupPercent.toString(),
    });
    setShowModal(true);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteTemplate(deleteId);
      showToast('Template deleted');
      setDeleteId(null);
    }
  };

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

  const handleAddStarter = () => {
    starterTemplates.forEach(t => {
      addTemplate(t);
    });
    showToast('Added 8 starter templates');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Templates Library</h1>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={18} /> New Template
        </button>
      </div>

      <div className="page-content">
        {templates.length === 0 && starterTemplates.length > 0 && (
          <div className="card mb-6">
            <div className="card-body text-center">
              <p className="text-muted mb-4">No templates yet. Add starter templates to get going quickly.</p>
              <button className="btn btn-primary" onClick={handleAddStarter}>
                Add Starter Templates
              </button>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted">
                No templates. Create your first template to reuse across estimates.
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map(template => (
                  <div key={template.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        <span className="badge badge-gray">{template.type}</span>
                      </div>
                      <div className="text-sm text-muted mt-1">{template.scope}</div>
                      {template.laborAssumptions && (
                        <div className="text-xs text-muted">Labor: {template.laborAssumptions}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted text-sm">{template.markupPercent}% markup</span>
                      <button className="btn btn-sm btn-icon" onClick={() => handleEdit(template)}>
                        <Edit size={14} />
                      </button>
                      <button className="btn btn-sm btn-icon btn-danger" onClick={() => setDeleteId(template.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); setEditingTemplate(null); }} title={editingTemplate ? 'Edit Template' : 'New Template'} size="lg">
        <div className="space-y-4">
          <div className="form-group">
            <label className="form-label">Template Name *</label>
            <input
              className="form-input"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              placeholder="e.g., Kitchen Remodel - Basic"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Type</label>
            <select
              className="form-select"
              value={formData.type}
              onChange={e => setFormData({...formData, type: e.target.value as 'estimate' | 'job'})}
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
              onChange={e => setFormData({...formData, scope: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Labor Assumptions</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.laborAssumptions}
              onChange={e => setFormData({...formData, laborAssumptions: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Material Assumptions</label>
            <textarea
              className="form-input"
              rows={2}
              value={formData.materialAssumptions}
              onChange={e => setFormData({...formData, materialAssumptions: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Markup %</label>
            <input
              className="form-input"
              type="number"
              value={formData.markupPercent}
              onChange={e => setFormData({...formData, markupPercent: e.target.value})}
            />
          </div>
        </div>
        <div className="modal-footer" style={{padding: 0, borderTop: 'none', marginTop: '16px'}}>
          <button className="btn btn-secondary" onClick={() => { setShowModal(false); setEditingTemplate(null); }}>Cancel</button>
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