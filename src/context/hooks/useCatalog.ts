import type { Dispatch, SetStateAction } from 'react';
import type { AppData, Assembly, JobType, LaborRate, Material, ProjectTypeTemplate, Template } from '../../data/types';

interface CatalogHookDeps {
  data: AppData;
  setData: Dispatch<SetStateAction<AppData>>;
}

export function useCatalog({ data, setData }: CatalogHookDeps) {
  const addLaborRate = (rate: Omit<LaborRate, 'id'>) => {
    const id = crypto.randomUUID();
    const newRate: LaborRate = { ...rate, id };
    setData(prev => ({ ...prev, laborRates: [...prev.laborRates, newRate] }));
    return id;
  };

  const updateLaborRate = (id: string, updates: Partial<LaborRate>) => {
    setData(prev => ({
      ...prev,
      laborRates: prev.laborRates.map(r => r.id === id ? { ...r, ...updates } : r),
    }));
  };

  const deleteLaborRate = (id: string) => {
    setData(prev => ({ ...prev, laborRates: prev.laborRates.filter(r => r.id !== id) }));
  };

  const addMaterial = (material: Omit<Material, 'id'>) => {
    const id = crypto.randomUUID();
    const newMaterial: Material = { ...material, id };
    setData(prev => ({ ...prev, materials: [...prev.materials, newMaterial] }));
    return id;
  };

  const updateMaterial = (id: string, updates: Partial<Material>) => {
    setData(prev => ({
      ...prev,
      materials: prev.materials.map(m => m.id === id ? { ...m, ...updates } : m),
    }));
  };

  const deleteMaterial = (id: string) => {
    setData(prev => ({ ...prev, materials: prev.materials.filter(m => m.id !== id) }));
  };

  const addAssembly = (assembly: Omit<Assembly, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newAssembly: Assembly = { ...assembly, id, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, assemblies: [...prev.assemblies, newAssembly] }));
    return id;
  };

  const updateAssembly = (id: string, updates: Partial<Assembly>) => {
    setData(prev => ({
      ...prev,
      assemblies: prev.assemblies.map(a => a.id === id ? { ...a, ...updates } : a),
    }));
  };

  const deleteAssembly = (id: string) => {
    setData(prev => ({ ...prev, assemblies: prev.assemblies.filter(a => a.id !== id) }));
  };

  const addTemplate = (template: Omit<Template, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newTemplate: Template = { ...template, id, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, templates: [...prev.templates, newTemplate] }));
    return id;
  };

  const updateTemplate = (id: string, updates: Partial<Template>) => {
    setData(prev => ({
      ...prev,
      templates: prev.templates.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  };

  const deleteTemplate = (id: string) => {
    setData(prev => ({ ...prev, templates: prev.templates.filter(t => t.id !== id) }));
  };

  const addProjectTypeTemplate = (template: Omit<ProjectTypeTemplate, 'id' | 'createdAt'>) => {
    const id = crypto.randomUUID();
    const newTemplate: ProjectTypeTemplate = { ...template, id, createdAt: new Date().toISOString() };
    setData(prev => ({ ...prev, projectTypeTemplates: [...prev.projectTypeTemplates, newTemplate] }));
    return id;
  };

  const updateProjectTypeTemplate = (id: string, updates: Partial<ProjectTypeTemplate>) => {
    setData(prev => ({
      ...prev,
      projectTypeTemplates: prev.projectTypeTemplates.map(t => t.id === id ? { ...t, ...updates } : t),
    }));
  };

  const deleteProjectTypeTemplate = (id: string) => {
    setData(prev => ({ ...prev, projectTypeTemplates: prev.projectTypeTemplates.filter(t => t.id !== id) }));
  };

  const getProjectTypeTemplate = (projectType: JobType) =>
    data.projectTypeTemplates.find(t => t.projectType === projectType);

  return {
    addLaborRate,
    updateLaborRate,
    deleteLaborRate,
    addMaterial,
    updateMaterial,
    deleteMaterial,
    addAssembly,
    updateAssembly,
    deleteAssembly,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    addProjectTypeTemplate,
    updateProjectTypeTemplate,
    deleteProjectTypeTemplate,
    getProjectTypeTemplate,
  };
}
