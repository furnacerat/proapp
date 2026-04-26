import type { AppData, Job, Worker, TimeEntry, Expense, Task, Invoice, Payment, Note, Photo, ChangeOrder, JobTemplate, Alert, Customer, Estimate, LaborRate, Material, Assembly, Template, TemplateItem, ProjectTypeTemplate, ProjectTypeTemplateSection, ProjectTypeTemplateItem } from './types';
import { v4 as uuidv4 } from 'uuid';

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

const starterTemplateNames: Record<string, string[]> = {
  Bathroom: ['Basic Bathroom Refresh', 'Full Bathroom Remodel', 'Tub to Shower Conversion', 'Tile Shower Remodel', 'Half Bath Remodel', 'Luxury Bathroom Remodel'],
  Kitchen: ['Basic Kitchen Refresh', 'Full Kitchen Remodel', 'Cabinet Replacement', 'Countertop Replacement', 'Kitchen Flooring + Paint', 'Luxury Kitchen Remodel'],
  Flooring: ['LVP Flooring Install', 'Tile Flooring Install', 'Hardwood Install', 'Flooring Demo + Replacement', 'Subfloor Repair + Flooring'],
  Painting: ['Interior Room Paint', 'Whole House Interior Paint', 'Exterior Paint', 'Cabinet Painting', 'Trim and Door Painting'],
  Drywall: ['Drywall Patch + Repair', 'Full Room Drywall', 'Basement Drywall', 'Ceiling Repair', 'Texture Removal + Finish'],
  Remodel: ['Basement Finish', 'Room Addition', 'Whole Home Refresh', 'Rental Turnover', 'House Flip Make Ready'],
  Exterior: ['Deck Repair', 'New Deck Build', 'Fence Install', 'Siding Repair', 'Gutter Replacement'],
};

function starterRequiredItems(category: string): TemplateItem[] {
  const shared: TemplateItem[] = [
    { name: 'Site protection and setup', description: 'Protect adjacent finishes and stage work area.', quantity: 1, unit: 'ea', unitPrice: 250, category: 'labor', isLabor: true, quantityMode: 'fixed', clientVisible: true },
    { name: 'Project cleanup and closeout', description: 'Final cleanup, punch walkthrough, and closeout notes.', quantity: 1, unit: 'ea', unitPrice: 300, category: 'labor', isLabor: true, quantityMode: 'fixed', clientVisible: true },
  ];
  const byCategory: Record<string, TemplateItem[]> = {
    Bathroom: [
      { name: 'Toilet install', quantity: 1, defaultQuantity: 1, unit: 'ea', unitPrice: 225, category: 'labor', isLabor: true, quantityMode: 'fixed', notes: 'Fixed default quantity example.' },
      { name: 'Bathroom floor finish', quantity: null, unit: 'sf', unitPrice: 8, category: 'material', isLabor: false, quantityMode: 'user_required', measurementPrompt: 'Enter bathroom floor square footage.' },
      { name: 'Baseboard install', quantity: 0, unit: 'lf', unitPrice: 3.5, category: 'labor', isLabor: true, quantityMode: 'calculated', measurementPrompt: 'Calculate from room perimeter.' },
    ],
    Kitchen: [
      { name: 'Cabinet installation', quantity: null, unit: 'lf', unitPrice: 325, category: 'labor', isLabor: true, quantityMode: 'user_required', measurementPrompt: 'Enter cabinet linear feet.' },
      { name: 'Countertop allowance', quantity: null, unit: 'sf', unitPrice: 85, category: 'material', isLabor: false, quantityMode: 'user_required', measurementPrompt: 'Enter countertop square footage.' },
      { name: 'Plumbing reconnect', quantity: 1, unit: 'ea', unitPrice: 650, category: 'subcontractor', isLabor: false, quantityMode: 'fixed' },
    ],
    Flooring: [
      { name: 'Flooring material', quantity: null, unit: 'sf', unitPrice: 5.5, category: 'material', isLabor: false, quantityMode: 'user_required', measurementPrompt: 'Enter flooring square footage plus waste.' },
      { name: 'Flooring install labor', quantity: null, unit: 'sf', unitPrice: 4.25, category: 'labor', isLabor: true, quantityMode: 'user_required', measurementPrompt: 'Enter installed square footage.' },
      { name: 'Transition and trim allowance', quantity: 1, unit: 'ea', unitPrice: 225, category: 'material', isLabor: false, quantityMode: 'fixed' },
    ],
    Painting: [
      { name: 'Paint surface prep', quantity: null, unit: 'sf', unitPrice: 0.65, category: 'labor', isLabor: true, quantityMode: 'user_required', measurementPrompt: 'Enter paintable square footage.' },
      { name: 'Paint application', quantity: null, unit: 'sf', unitPrice: 1.1, category: 'labor', isLabor: true, quantityMode: 'user_required', measurementPrompt: 'Enter paintable square footage.' },
      { name: 'Paint and supplies', quantity: 1, unit: 'allowance', unitPrice: 350, category: 'material', isLabor: false, quantityMode: 'fixed' },
    ],
    Drywall: [
      { name: 'Drywall area', quantity: null, unit: 'sf', unitPrice: 2.75, category: 'labor', isLabor: true, quantityMode: 'user_required', measurementPrompt: 'Enter drywall square footage.' },
      { name: 'Tape and finish', quantity: null, unit: 'sf', unitPrice: 1.85, category: 'labor', isLabor: true, quantityMode: 'user_required', measurementPrompt: 'Enter finish square footage.' },
      { name: 'Drywall materials', quantity: null, unit: 'sf', unitPrice: 0.95, category: 'material', isLabor: false, quantityMode: 'user_required', measurementPrompt: 'Enter drywall square footage.' },
    ],
    Remodel: [
      { name: 'Demolition allowance', quantity: 1, unit: 'ea', unitPrice: 1800, category: 'labor', isLabor: true, quantityMode: 'fixed' },
      { name: 'Finish area', quantity: null, unit: 'sf', unitPrice: 8.5, category: 'material', isLabor: false, quantityMode: 'user_required', measurementPrompt: 'Enter finished square footage.' },
      { name: 'Trade allowance', quantity: 1, unit: 'ea', unitPrice: 3500, category: 'subcontractor', isLabor: false, quantityMode: 'fixed' },
    ],
    Exterior: [
      { name: 'Exterior work area', quantity: null, unit: 'sf', unitPrice: 12, category: 'labor', isLabor: true, quantityMode: 'user_required', measurementPrompt: 'Enter exterior square footage or equivalent work area.' },
      { name: 'Linear footage item', quantity: 0, unit: 'lf', unitPrice: 14, category: 'material', isLabor: false, quantityMode: 'calculated', measurementPrompt: 'Calculate linear footage from field measurement.' },
      { name: 'Fasteners and hardware', quantity: 1, unit: 'ea', unitPrice: 185, category: 'material', isLabor: false, quantityMode: 'fixed' },
    ],
  };
  return [...shared, ...(byCategory[category] || byCategory.Remodel)];
}

function generateStarterEstimateTemplates(): Template[] {
  return Object.entries(starterTemplateNames).flatMap(([category, names]) => names.map((name, index) => {
    const requiredItems = starterRequiredItems(category);
    const optionalItems: TemplateItem[] = [
      { name: 'Optional accessory or upgrade', description: 'Estimator can include if the current job needs it.', quantity: 0, unit: 'ea', unitPrice: 175, category: 'material', isLabor: false, quantityMode: 'optional', isOptional: true, clientVisible: false },
      { name: 'Hidden condition allowance', description: 'Use only if inspection shows likely repairs.', quantity: 0, unit: 'ea', unitPrice: 650, category: 'other', isLabor: false, quantityMode: 'optional', isOptional: true, clientVisible: false },
    ];
    const measurementPrompts = requiredItems.map(item => item.measurementPrompt).filter(Boolean) as string[];
    return {
      id: uuidv4(),
      name,
      category,
      description: `${name} starter template with editable scope reminders and quantity prompts.`,
      type: 'estimate' as const,
      scope: `${category} starter scope for ${name.toLowerCase()}. Copy into an estimate, then adjust quantities, units, materials, markup, visibility, and notes for the real job.`,
      scopeSections: [
        { name: 'Discovery and measurements', phase: 'Planning', description: 'Confirm dimensions, selections, access, protection, and hidden-condition risk.' },
        { name: 'Core work', phase: 'Production', description: 'Required labor, materials, and trade allowances for this project type.' },
        { name: 'Optional upgrades', phase: 'Alternates', description: 'Items to review with the client or keep internal until needed.' },
      ],
      laborAssumptions: requiredItems.filter(item => item.isLabor).map(item => item.name).join(', '),
      materialAssumptions: requiredItems.filter(item => !item.isLabor).map(item => item.name).join(', '),
      markupPercent: category === 'Remodel' || name.includes('Luxury') ? 25 : 20,
      recommendedAssemblies: category === 'Bathroom' ? ['Toilet Hookup', 'Faucet Install - Bathroom', 'Paint - Walls'] : category === 'Kitchen' ? ['Cabinet Demo', 'Faucet Install - Kitchen', 'Light Fixture'] : category === 'Flooring' ? ['Flooring Demo - Carpet', 'Trim Package'] : category === 'Painting' ? ['Paint - Walls', 'Paint - Trim'] : category === 'Drywall' ? ['Drywall Patch', 'Drywall - Room Walls'] : category === 'Exterior' ? ['Trim Package', 'Paint - Walls'] : ['Room Demolition', 'Drywall - Room Walls', 'Paint - Walls'],
      measurementPrompts,
      requiredItems,
      optionalItems,
      clientFacingNotes: 'Final scope and pricing are subject to field measurements, selections, hidden conditions, and approved changes.',
      internalEstimatorNotes: `Starter ${index + 1} in ${category}. Required quantity prompts must be resolved before sending.`,
      createdAt: now,
    };
  }));
}

export const initialData: AppData = {
  customers: [
    { id: uuidv4(), name: 'John Smith', company: 'Smith Properties', email: 'jsmith@email.com', phone: '(555) 123-4567', address: '123 Oak Street, Springfield, IL 62701', notes: 'Preferred customer', createdAt: now, updatedAt: now },
    { id: uuidv4(), name: 'Mike Johnson', company: 'Johnson Investments', email: 'mjohnson@email.com', phone: '(555) 234-5678', address: '456 Maple Ave, Springfield, IL 62702', notes: 'Real estate investor', createdAt: now, updatedAt: now },
    { id: uuidv4(), name: 'Sarah Williams', email: 'swilliams@email.com', phone: '(555) 345-6789', address: '789 Pine Lane, Springfield, IL 62703', createdAt: now, updatedAt: now },
    { id: uuidv4(), name: 'Tom Brown', phone: '(555) 456-7890', address: '321 Elm Street, Springfield, IL 62704', createdAt: now, updatedAt: now },
    { id: uuidv4(), name: 'Lisa Davis', company: 'Davis Realty', email: 'ldavis@email.com', phone: '(555) 567-8901', address: '654 Cedar Drive, Springfield, IL 62705', createdAt: now, updatedAt: now },
    { id: uuidv4(), name: 'Robert Garcia', email: 'rgarcia@email.com', phone: '(555) 678-9012', address: '987 Birch Rd, Springfield, IL 62706', createdAt: now, updatedAt: now },
    { id: uuidv4(), name: 'Jennifer Wilson', company: 'Wilson Design', email: 'jwilson@email.com', phone: '(555) 789-0123', address: '147 Oak Ave, Springfield, IL 62707', createdAt: now, updatedAt: now },
    { id: uuidv4(), name: 'David Martinez', email: 'dmartinez@email.com', phone: '(555) 890-1234', address: '258 Maple St, Springfield, IL 62708', createdAt: now, updatedAt: now },
  ],
  laborRates: [
    { id: uuidv4(), name: 'Lead Carpenter', trade: 'Carpentry', hourlyRate: 45, overtimeRate: 67.5, isActive: true },
    { id: uuidv4(), name: 'Skilled Carpenter', trade: 'Carpentry', hourlyRate: 35, overtimeRate: 52.5, isActive: true },
    { id: uuidv4(), name: 'Laborer', trade: 'General', hourlyRate: 25, overtimeRate: 37.5, isActive: true },
    { id: uuidv4(), name: 'Electrician', trade: 'Electrical', hourlyRate: 55, overtimeRate: 82.5, isActive: true },
    { id: uuidv4(), name: 'Plumber', trade: 'Plumbing', hourlyRate: 55, overtimeRate: 82.5, isActive: true },
    { id: uuidv4(), name: 'HVAC Tech', trade: 'HVAC', hourlyRate: 50, overtimeRate: 75, isActive: true },
    { id: uuidv4(), name: 'Painter', trade: 'Painting', hourlyRate: 30, overtimeRate: 45, isActive: true },
    { id: uuidv4(), name: 'Drywall Finisher', trade: 'Drywall', hourlyRate: 32, overtimeRate: 48, isActive: true },
  ],
  materials: [
    { id: uuidv4(), name: '2x4x8 Stud', category: 'Lumber', unit: 'ea', unitPrice: 4.50, supplier: 'BuildPro', isActive: true },
    { id: uuidv4(), name: '2x6x8 Stud', category: 'Lumber', unit: 'ea', unitPrice: 6.25, supplier: 'BuildPro', isActive: true },
    { id: uuidv4(), name: 'OSB 4x8 7/16"', category: 'Sheathing', unit: 'sheet', unitPrice: 18.00, supplier: 'BuildPro', isActive: true },
    { id: uuidv4(), name: 'Plywood 3/4"', category: 'Sheathing', unit: 'sheet', unitPrice: 45.00, supplier: 'BuildPro', isActive: true },
    { id: uuidv4(), name: 'Drywall 4x8', category: 'Drywall', unit: 'sheet', unitPrice: 12.00, supplier: 'BuildPro', isActive: true },
    { id: uuidv4(), name: 'Joint Compound 5gal', category: 'Drywall', unit: 'bucket', unitPrice: 18.00, supplier: 'BuildPro', isActive: true },
    { id: uuidv4(), name: 'Paper Tape', category: 'Drywall', unit: 'roll', unitPrice: 2.50, supplier: 'BuildPro', isActive: true },
    { id: uuidv4(), name: 'Cabinet Pull', category: 'Hardware', unit: 'ea', unitPrice: 3.50, supplier: 'Hardware Plus', isActive: true },
    { id: uuidv4(), name: 'Hinges (soft close)', category: 'Hardware', unit: 'pr', unitPrice: 12.00, supplier: 'Hardware Plus', isActive: true },
    { id: uuidv4(), name: 'Hardwood Flooring', category: 'Flooring', unit: 'sqft', unitPrice: 8.00, supplier: 'FloorCo', isActive: true },
    { id: uuidv4(), name: 'Ceramic Tile 12x12', category: 'Tile', unit: 'sqft', unitPrice: 4.00, supplier: 'TilePro', isActive: true },
    { id: uuidv4(), name: 'Grout 25lb', category: 'Tile', unit: 'bag', unitPrice: 15.00, supplier: 'TilePro', isActive: true },
    { id: uuidv4(), name: 'Mortar 50lb', category: 'Tile', unit: 'bag', unitPrice: 12.00, supplier: 'TilePro', isActive: true },
    { id: uuidv4(), name: 'PVC Pipe 2"', category: 'Plumbing', unit: 'ft', unitPrice: 2.50, supplier: 'PlumbSupply', isActive: true },
    { id: uuidv4(), name: 'Copper Wire 12/2', category: 'Electrical', unit: 'ft', unitPrice: 0.85, supplier: 'ElectricPro', isActive: true },
    { id: uuidv4(), name: 'Light Switch', category: 'Electrical', unit: 'ea', unitPrice: 2.25, supplier: 'ElectricPro', isActive: true },
  ],
  assemblies: [
    // ============ DEMOLITION ============
    { id: uuidv4(), name: 'Room Demolition', description: 'Remove all finish materials from one room', category: 'Demolition', unit: 'room', laborHours: 4, items: [
      { name: 'Demo Labor', quantity: 4, unit: 'hrs', unitPrice: 35, category: 'labor' },
      { name: 'Debris Hauling', quantity: 1, unit: 'ea', unitPrice: 150, category: 'other' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Cabinet Demo', description: 'Remove upper and base cabinets', category: 'Demolition', unit: 'lf', laborHours: 0.5, items: [
      { name: 'Demo Labor', quantity: 0.5, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Countertop Demo', description: 'Remove laminate or stone countertops', category: 'Demolition', unit: 'lf', laborHours: 0.25, items: [
      { name: 'Demo Labor', quantity: 0.25, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Flooring Demo - Carpet', description: 'Remove carpet and padding', category: 'Demolition', unit: 'sqft', laborHours: 0.02, items: [
      { name: 'Demo Labor', quantity: 0.02, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Flooring Demo - Tile', description: 'Remove ceramic or porcelain tile', category: 'Demolition', unit: 'sqft', laborHours: 0.05, items: [
      { name: 'Demo Labor', quantity: 0.05, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Drywall Remove', description: 'Remove drywall sheets', category: 'Demolition', unit: 'sheet', laborHours: 0.25, items: [
      { name: 'Demo Labor', quantity: 0.25, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Fixture Demo - Toilet', description: 'Remove toilet', category: 'Demolition', unit: 'ea', laborHours: 0.5, items: [
      { name: 'Demo Labor', quantity: 0.5, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Fixture Demo - Vanity', description: 'Remove vanity cabinet', category: 'Demolition', unit: 'ea', laborHours: 1, items: [
      { name: 'Demo Labor', quantity: 1, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Demolition Debris Container', description: '10 yard roll-off for demo debris', category: 'Demolition', unit: 'ea', laborHours: 0, items: [
      { name: 'Container Rental', quantity: 1, unit: 'wk', unitPrice: 350, category: 'other' },
    ], createdAt: now },

    // ============ FRAMING ============
    { id: uuidv4(), name: 'Wall Frame - 8ft', description: 'Standard 2x4 wall with 16" OC', category: 'Framing', unit: 'lf', laborHours: 0.15, items: [
      { name: '2x4 Stud', quantity: 0.7, unit: 'ea', unitPrice: 4.50, category: 'material' },
      { name: '2x4 Plate', quantity: 0.2, unit: 'ea', unitPrice: 4.50, category: 'material' },
      { name: 'Framing Nails', quantity: 0.05, unit: 'lb', unitPrice: 8, category: 'material' },
      { name: 'Framing Labor', quantity: 0.15, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Wall Frame - 9ft', description: 'Standard 2x4 wall 9ft tall', category: 'Framing', unit: 'lf', laborHours: 0.18, items: [
      { name: '2x4 Stud', quantity: 0.8, unit: 'ea', unitPrice: 5.50, category: 'material' },
      { name: '2x4 Plate', quantity: 0.2, unit: 'ea', unitPrice: 4.50, category: 'material' },
      { name: 'Framing Nails', quantity: 0.05, unit: 'lb', unitPrice: 8, category: 'material' },
      { name: 'Framing Labor', quantity: 0.18, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Partition Wall', description: 'Non-load bearing interior wall', category: 'Framing', unit: 'lf', laborHours: 0.2, items: [
      { name: '2x4 Stud', quantity: 0.7, unit: 'ea', unitPrice: 4.50, category: 'material' },
      { name: '2x4 Plate', quantity: 0.2, unit: 'ea', unitPrice: 4.50, category: 'material' },
      { name: 'Framing Labor', quantity: 0.2, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Window Rough-In', description: 'Rough opening for window', category: 'Framing', unit: 'ea', laborHours: 2, items: [
      { name: '2x4 Header', quantity: 3, unit: 'ea', unitPrice: 12, category: 'material' },
      { name: '2x4 Stud', quantity: 4, unit: 'ea', unitPrice: 4.50, category: 'material' },
      { name: 'Framing Labor', quantity: 2, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Door Rough-In', description: 'Rough opening for door', category: 'Framing', unit: 'ea', laborHours: 1.5, items: [
      { name: '2x4 Header', quantity: 2, unit: 'ea', unitPrice: 12, category: 'material' },
      { name: '2x4 Stud', quantity: 4, unit: 'ea', unitPrice: 4.50, category: 'material' },
      { name: 'Framing Labor', quantity: 1.5, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Floor Joist Sistering', description: 'Sister floor joists for reinforcement', category: 'Framing', unit: 'ea', laborHours: 1, items: [
      { name: '2x10 Joist', quantity: 1, unit: 'ea', unitPrice: 18, category: 'material' },
      { name: 'Joist Hangers', quantity: 2, unit: 'ea', unitPrice: 3.50, category: 'material' },
      { name: 'Framing Labor', quantity: 1, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },

    // ============ ELECTRICAL ============
    { id: uuidv4(), name: 'Receptacle Rough-In', description: 'New electrical outlet box', category: 'Electrical', unit: 'ea', laborHours: 1, items: [
      { name: 'Outlet Box', quantity: 1, unit: 'ea', unitPrice: 2.50, category: 'material' },
      { name: 'Romex 14/2', quantity: 8, unit: 'ft', unitPrice: 0.45, category: 'material' },
      { name: 'Wire Nuts', quantity: 3, unit: 'ea', unitPrice: 0.75, category: 'material' },
      { name: 'Elec Labor', quantity: 1, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Switch Rough-In', description: 'Light switch rough-in', category: 'Electrical', unit: 'ea', laborHours: 1, items: [
      { name: 'Switch Box', quantity: 1, unit: 'ea', unitPrice: 2, category: 'material' },
      { name: 'Romex 14/2', quantity: 8, unit: 'ft', unitPrice: 0.45, category: 'material' },
      { name: 'Wire Nuts', quantity: 2, unit: 'ea', unitPrice: 0.75, category: 'material' },
      { name: 'Elec Labor', quantity: 1, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Ceiling Fan Box', description: 'Install ceiling fan rated box', category: 'Electrical', unit: 'ea', laborHours: 1.5, items: [
      { name: 'Ceiling Fan Box', quantity: 1, unit: 'ea', unitPrice: 12, category: 'material' },
      { name: 'Romex 14/2', quantity: 12, unit: 'ft', unitPrice: 0.45, category: 'material' },
      { name: 'Elec Labor', quantity: 1.5, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'GFCI Outlet', description: 'Install GFCI outlet', category: 'Electrical', unit: 'ea', laborHours: 0.5, items: [
      { name: 'GFCI Outlet', quantity: 1, unit: 'ea', unitPrice: 18, category: 'material' },
      { name: 'Wall Plate', quantity: 1, unit: 'ea', unitPrice: 3, category: 'material' },
      { name: 'Elec Labor', quantity: 0.5, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Light Fixture', description: 'Install ceiling light', category: 'Electrical', unit: 'ea', laborHours: 1, items: [
      { name: 'Light Fixture', quantity: 1, unit: 'ea', unitPrice: 45, category: 'material' },
      { name: 'Wire Nuts', quantity: 3, unit: 'ea', unitPrice: 0.75, category: 'material' },
      { name: 'Elec Labor', quantity: 1, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },

    // ============ PLUMBING ============
    { id: uuidv4(), name: 'Toilet Hookup', description: 'Connect toilet supply and drain', category: 'Plumbing', unit: 'ea', laborHours: 1.5, items: [
      { name: 'Wax Ring', quantity: 1, unit: 'ea', unitPrice: 4, category: 'material' },
      { name: 'Supply Line', quantity: 1, unit: 'ea', unitPrice: 12, category: 'material' },
      { name: 'Plumb Labor', quantity: 1.5, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Faucet Install - Kitchen', description: 'Install kitchen faucet', category: 'Plumbing', unit: 'ea', laborHours: 1, items: [
      { name: 'Faucet', quantity: 1, unit: 'ea', unitPrice: 185, category: 'material' },
      { name: 'Supply Lines', quantity: 2, unit: 'ea', unitPrice: 8, category: 'material' },
      { name: 'Plumb Labor', quantity: 1, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Faucet Install - Bathroom', description: 'Install bathroom faucet', category: 'Plumbing', unit: 'ea', laborHours: 1, items: [
      { name: 'Faucet', quantity: 1, unit: 'ea', unitPrice: 125, category: 'material' },
      { name: 'Supply Lines', quantity: 2, unit: 'ea', unitPrice: 8, category: 'material' },
      { name: 'Plumb Labor', quantity: 1, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'P-Trap Install', description: 'Install p-trap for sink', category: 'Plumbing', unit: 'ea', laborHours: 0.75, items: [
      { name: 'P-Trap', quantity: 1, unit: 'ea', unitPrice: 15, category: 'material' },
      { name: 'Plumb Labor', quantity: 0.75, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Dishwasher Connect', description: 'Connect dishwasher', category: 'Plumbing', unit: 'ea', laborHours: 1.5, items: [
      { name: 'Dishwasher Connector', quantity: 1, unit: 'ea', unitPrice: 25, category: 'material' },
      { name: 'Plumb Labor', quantity: 1.5, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Gas Line - Range', description: 'Run gas line for range', category: 'Plumbing', unit: 'ea', laborHours: 3, items: [
      { name: 'Gas Pipe', quantity: 10, unit: 'ft', unitPrice: 4.50, category: 'material' },
      { name: 'Gas Fitting', quantity: 3, unit: 'ea', unitPrice: 5, category: 'material' },
      { name: 'Gas Valve', quantity: 1, unit: 'ea', unitPrice: 35, category: 'material' },
      { name: 'Plumb Labor', quantity: 3, unit: 'hrs', unitPrice: 55, category: 'labor' },
    ], createdAt: now },

    // ============ DRYWALL ============
    { id: uuidv4(), name: 'Drywall - Room Walls', description: 'Hang and finish drywall on walls', category: 'Drywall', unit: 'sqft', laborHours: 0.04, items: [
      { name: 'Drywall 4x8', quantity: 0.0625, unit: 'sheet', unitPrice: 12, category: 'material' },
      { name: 'Drywall Screws', quantity: 0.03, unit: 'lb', unitPrice: 7, category: 'material' },
      { name: 'Joint Compound', quantity: 0.005, unit: 'gal', unitPrice: 18, category: 'material' },
      { name: 'Paper Tape', quantity: 0.04, unit: 'ft', unitPrice: 0.10, category: 'material' },
      { name: 'Drywall Labor', quantity: 0.04, unit: 'hrs', unitPrice: 32, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Drywall - Room Ceiling', description: 'Hang and finish drywall on ceiling', category: 'Drywall', unit: 'sqft', laborHours: 0.05, items: [
      { name: 'Drywall 4x8', quantity: 0.0625, unit: 'sheet', unitPrice: 12, category: 'material' },
      { name: 'Drywall Screws', quantity: 0.03, unit: 'lb', unitPrice: 7, category: 'material' },
      { name: 'Joint Compound', quantity: 0.005, unit: 'gal', unitPrice: 18, category: 'material' },
      { name: 'Paper Tape', quantity: 0.04, unit: 'ft', unitPrice: 0.10, category: 'material' },
      { name: 'Drywall Labor', quantity: 0.05, unit: 'hrs', unitPrice: 32, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Drywall Patch', description: 'Repair small drywall area', category: 'Drywall', unit: 'sqft', laborHours: 0.1, items: [
      { name: 'Drywall Patch', quantity: 1, unit: 'sqft', unitPrice: 8, category: 'material' },
      { name: 'Joint Compound', quantity: 0.01, unit: 'gal', unitPrice: 18, category: 'material' },
      { name: 'Drywall Labor', quantity: 0.1, unit: 'hrs', unitPrice: 32, category: 'labor' },
    ], createdAt: now },

    // ============ PAINT ============
    { id: uuidv4(), name: 'Paint - Walls', description: 'Paint walls with primer and two coats', category: 'Paint', unit: 'sqft', laborHours: 0.025, items: [
      { name: 'Primer', quantity: 0.004, unit: 'gal', unitPrice: 28, category: 'material' },
      { name: 'Paint', quantity: 0.004, unit: 'gal', unitPrice: 45, category: 'material' },
      { name: 'Paint Supplies', quantity: 0.001, unit: 'sqft', unitPrice: 2, category: 'material' },
      { name: 'Paint Labor', quantity: 0.025, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Paint - Ceiling', description: 'Paint ceiling flat white', category: 'Paint', unit: 'sqft', laborHours: 0.02, items: [
      { name: 'Ceiling Paint', quantity: 0.004, unit: 'gal', unitPrice: 35, category: 'material' },
      { name: 'Paint Supplies', quantity: 0.001, unit: 'sqft', unitPrice: 2, category: 'material' },
      { name: 'Paint Labor', quantity: 0.02, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Paint - Trim', description: 'Paint door and window trim', category: 'Paint', unit: 'lf', laborHours: 0.08, items: [
      { name: 'Trim Paint', quantity: 0.005, unit: 'gal', unitPrice: 45, category: 'material' },
      { name: 'Primer', quantity: 0.003, unit: 'gal', unitPrice: 28, category: 'material' },
      { name: 'Paint Labor', quantity: 0.08, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Paint - Cabinetry', description: 'Paint cabinet boxes', category: 'Paint', unit: 'sqft', laborHours: 0.05, items: [
      { name: 'Cabinet Paint', quantity: 0.008, unit: 'gal', unitPrice: 55, category: 'material' },
      { name: 'Primer', quantity: 0.005, unit: 'gal', unitPrice: 35, category: 'material' },
      { name: 'Paint Labor', quantity: 0.05, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },

    // ============ FINISH CARPENTRY ============
    { id: uuidv4(), name: 'Baseboard Install', description: 'Install baseboard', category: 'Finish Carpentry', unit: 'lf', laborHours: 0.08, items: [
      { name: 'Baseboard', quantity: 1, unit: 'lf', unitPrice: 2.50, category: 'material' },
      { name: 'Base Shoe', quantity: 1, unit: 'lf', unitPrice: 1.25, category: 'material' },
      { name: 'Brad Nails', quantity: 0.05, unit: 'box', unitPrice: 8, category: 'material' },
      { name: 'Carp Labor', quantity: 0.08, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Casing Install - Door', description: 'Install door casing', category: 'Finish Carpentry', unit: 'lf', laborHours: 0.1, items: [
      { name: 'Door Casing', quantity: 1, unit: 'lf', unitPrice: 3, category: 'material' },
      { name: 'Brad Nails', quantity: 0.05, unit: 'box', unitPrice: 8, category: 'material' },
      { name: 'Carp Labor', quantity: 0.1, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Casing Install - Window', description: 'Install window casing', category: 'Finish Carpentry', unit: 'lf', laborHours: 0.12, items: [
      { name: 'Window Casing', quantity: 1, unit: 'lf', unitPrice: 3.50, category: 'material' },
      { name: 'Brad Nails', quantity: 0.05, unit: 'box', unitPrice: 8, category: 'material' },
      { name: 'Carp Labor', quantity: 0.12, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Crown Molding', description: 'Install crown molding', category: 'Finish Carpentry', unit: 'lf', laborHours: 0.15, items: [
      { name: 'Crown Molding', quantity: 1, unit: 'lf', unitPrice: 4.50, category: 'material' },
      { name: 'Brad Nails', quantity: 0.05, unit: 'box', unitPrice: 8, category: 'material' },
      { name: 'Carp Labor', quantity: 0.15, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Chair Rail', description: 'Install chair rail', category: 'Finish Carpentry', unit: 'lf', laborHours: 0.1, items: [
      { name: 'Chair Rail', quantity: 1, unit: 'lf', unitPrice: 3.50, category: 'material' },
      { name: 'Brad Nails', quantity: 0.05, unit: 'box', unitPrice: 8, category: 'material' },
      { name: 'Carp Labor', quantity: 0.1, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },

    // ============ CABINETS & FIXTURES ============
    { id: uuidv4(), name: 'Cabinet Install - Base', description: 'Install base cabinet', category: 'Cabinets', unit: 'ea', laborHours: 1.5, items: [
      { name: 'Base Cabinet', quantity: 1, unit: 'ea', unitPrice: 280, category: 'material' },
      { name: 'Cabinet Screws', quantity: 4, unit: 'ea', unitPrice: 1, category: 'material' },
      { name: 'Shims', quantity: 4, unit: 'ea', unitPrice: 0.50, category: 'material' },
      { name: 'Carp Labor', quantity: 1.5, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Cabinet Install - Upper', description: 'Install upper cabinet', category: 'Cabinets', unit: 'ea', laborHours: 1, items: [
      { name: 'Upper Cabinet', quantity: 1, unit: 'ea', unitPrice: 180, category: 'material' },
      { name: 'Cabinet Screws', quantity: 4, unit: 'ea', unitPrice: 1, category: 'material' },
      { name: 'French Cleat', quantity: 1, unit: 'ea', unitPrice: 12, category: 'material' },
      { name: 'Carp Labor', quantity: 1, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Vanity Install', description: 'Install vanity cabinet', category: 'Cabinets', unit: 'ea', laborHours: 2, items: [
      { name: 'Vanity Cabinet', quantity: 1, unit: 'ea', unitPrice: 450, category: 'material' },
      { name: 'Cabinet Screws', quantity: 4, unit: 'ea', unitPrice: 1, category: 'material' },
      { name: 'Shims', quantity: 6, unit: 'ea', unitPrice: 0.50, category: 'material' },
      { name: 'Carp Labor', quantity: 2, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Hardware Install', description: 'Install pulls and knobs', category: 'Cabinets', unit: 'ea', laborHours: 0.25, items: [
      { name: 'Pull/Knob', quantity: 2, unit: 'ea', unitPrice: 6, category: 'material' },
      { name: 'Screws', quantity: 4, unit: 'ea', unitPrice: 0.50, category: 'material' },
      { name: 'Carp Labor', quantity: 0.25, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Medicine Cabinet', description: 'Install medicine cabinet', category: 'Cabinets', unit: 'ea', laborHours: 1, items: [
      { name: 'Medicine Cabinet', quantity: 1, unit: 'ea', unitPrice: 85, category: 'material' },
      { name: 'Screws', quantity: 4, unit: 'ea', unitPrice: 1, category: 'material' },
      { name: 'Carp Labor', quantity: 1, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },

    // ============ FLOORING ============
    { id: uuidv4(), name: 'Floor Prep - Tile', description: 'Prepare subfloor for tile', category: 'Flooring', unit: 'sqft', laborHours: 0.03, items: [
      { name: 'Plywood 1/4"', quantity: 0.04, unit: 'sheet', unitPrice: 28, category: 'material' },
      { name: 'Screws', quantity: 0.1, unit: 'sqft', unitPrice: 0.15, category: 'material' },
      { name: 'Floor Labor', quantity: 0.03, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Floor Prep - Wood', description: 'Prepare subfloor for hardwood', category: 'Flooring', unit: 'sqft', laborHours: 0.02, items: [
      { name: 'Underlayment', quantity: 1, unit: 'sqft', unitPrice: 0.75, category: 'material' },
      { name: 'Tape', quantity: 0.05, unit: 'ft', unitPrice: 0.25, category: 'material' },
      { name: 'Floor Labor', quantity: 0.02, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Hardwood Install', description: 'Install 3/4" hardwood flooring', category: 'Flooring', unit: 'sqft', laborHours: 0.08, items: [
      { name: 'Hardwood Flooring', quantity: 1.05, unit: 'sqft', unitPrice: 8, category: 'material' },
      { name: 'Nails/Staples', quantity: 0.02, unit: 'lb', unitPrice: 4, category: 'material' },
      { name: 'Floor Labor', quantity: 0.08, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'LVP Install', description: 'Install luxury vinyl plank', category: 'Flooring', unit: 'sqft', laborHours: 0.04, items: [
      { name: 'LVP Flooring', quantity: 1.05, unit: 'sqft', unitPrice: 4.50, category: 'material' },
      { name: 'Transition', quantity: 0.02, unit: 'lf', unitPrice: 5, category: 'material' },
      { name: 'Floor Labor', quantity: 0.04, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Tile Install - Floor', description: 'Install ceramic/porcelain floor tile', category: 'Flooring', unit: 'sqft', laborHours: 0.1, items: [
      { name: 'Floor Tile', quantity: 1.05, unit: 'sqft', unitPrice: 4, category: 'material' },
      { name: 'Thinset', quantity: 0.05, unit: 'sqft', unitPrice: 1.50, category: 'material' },
      { name: 'Grout', quantity: 0.03, unit: 'sqft', unitPrice: 1, category: 'material' },
      { name: 'Floor Labor', quantity: 0.1, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Carpet Install', description: 'Install carpet and pad', category: 'Flooring', unit: 'sqft', laborHours: 0.03, items: [
      { name: 'Carpet', quantity: 1.1, unit: 'sqft', unitPrice: 4, category: 'material' },
      { name: 'Carpet Pad', quantity: 1.1, unit: 'sqft', unitPrice: 1.50, category: 'material' },
      { name: 'Floor Labor', quantity: 0.03, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Transition Strip', description: 'Install transition strip', category: 'Flooring', unit: 'ea', laborHours: 0.25, items: [
      { name: 'Transition Strip', quantity: 1, unit: 'ea', unitPrice: 12, category: 'material' },
      { name: 'Floor Labor', quantity: 0.25, unit: 'hrs', unitPrice: 30, category: 'labor' },
    ], createdAt: now },

    // ============ EXTERIOR ============
    { id: uuidv4(), name: 'Siding - Vinyl', description: 'Install vinyl siding', category: 'Exterior', unit: 'sqft', laborHours: 0.06, items: [
      { name: 'Vinyl Siding', quantity: 1.05, unit: 'sqft', unitPrice: 3.50, category: 'material' },
      { name: 'J-Channel', quantity: 0.08, unit: 'lf', unitPrice: 2.50, category: 'material' },
      { name: 'Siding Nails', quantity: 0.02, unit: 'lb', unitPrice: 6, category: 'material' },
      { name: 'Exterior Labor', quantity: 0.06, unit: 'hrs', unitPrice: 32, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Siding - Fiber Cement', description: 'Install fiber cement siding', category: 'Exterior', unit: 'sqft', laborHours: 0.1, items: [
      { name: 'Fiber Cement', quantity: 1.05, unit: 'sqft', unitPrice: 6, category: 'material' },
      { name: 'Siding Screws', quantity: 0.02, unit: 'lb', unitPrice: 8, category: 'material' },
      { name: 'Exterior Labor', quantity: 0.1, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Roofing Tear-Off', description: 'Remove existing shingles', category: 'Exterior', unit: 'sqft', laborHours: 0.04, items: [
      { name: 'Tear-Off Labor', quantity: 0.04, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Roofing - Architectural', description: 'Install architectural shingles', category: 'Exterior', unit: 'sqft', laborHours: 0.06, items: [
      { name: 'Architectural Shingles', quantity: 1.05, unit: 'bundle', unitPrice: 35, category: 'material' },
      { name: 'Underlayment', quantity: 1.05, unit: 'sqft', unitPrice: 0.75, category: 'material' },
      { name: 'Drip Edge', quantity: 0.04, unit: 'lf', unitPrice: 2, category: 'material' },
      { name: 'Roofing Nails', quantity: 0.01, unit: 'lb', unitPrice: 6, category: 'material' },
      { name: 'Roofing Labor', quantity: 0.06, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Window Install', description: 'Install replacement window', category: 'Exterior', unit: 'ea', laborHours: 2, items: [
      { name: 'Window', quantity: 1, unit: 'ea', unitPrice: 250, category: 'material' },
      { name: 'Flashing', quantity: 12, unit: 'ft', unitPrice: 1.50, category: 'material' },
      { name: 'Foam', quantity: 1, unit: 'can', unitPrice: 8, category: 'material' },
      { name: 'Exterior Labor', quantity: 2, unit: 'hrs', unitPrice: 40, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Deck - Pressure Treated', description: 'Build pressure treated deck', category: 'Exterior', unit: 'sqft', laborHours: 0.25, items: [
      { name: 'PT Decking', quantity: 1.05, unit: 'sqft', unitPrice: 4, category: 'material' },
      { name: 'PT Frame', quantity: 0.3, unit: 'lf', unitPrice: 3, category: 'material' },
      { name: 'Deck Screws', quantity: 0.05, unit: 'lb', unitPrice: 12, category: 'material' },
      { name: 'Exterior Labor', quantity: 0.25, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Deck - Composite', description: 'Build composite deck', category: 'Exterior', unit: 'sqft', laborHours: 0.2, items: [
      { name: 'Composite Decking', quantity: 1.05, unit: 'sqft', unitPrice: 8, category: 'material' },
      { name: 'Composite Frame', quantity: 0.2, unit: 'lf', unitPrice: 4, category: 'material' },
      { name: 'Composite Screws', quantity: 0.05, unit: 'lb', unitPrice: 15, category: 'material' },
      { name: 'Exterior Labor', quantity: 0.2, unit: 'hrs', unitPrice: 35, category: 'labor' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Gutter Install', description: 'Install aluminum gutters', category: 'Exterior', unit: 'lf', laborHours: 0.1, items: [
      { name: 'Gutter Section', quantity: 1, unit: 'lf', unitPrice: 6, category: 'material' },
      { name: 'Gutter Hanger', quantity: 0.5, unit: 'ea', unitPrice: 1.50, category: 'material' },
      { name: 'Downspout', quantity: 0.2, unit: 'lf', unitPrice: 4, category: 'material' },
      { name: 'Exterior Labor', quantity: 0.1, unit: 'hrs', unitPrice: 32, category: 'labor' },
    ], createdAt: now },

    // ============ ALLOWANCES ============
    { id: uuidv4(), name: 'Allowance - Lighting', description: 'Allowance for light fixtures', category: 'Allowances', unit: 'ea', laborHours: 0, items: [
      { name: 'Lighting Allowance', quantity: 1, unit: 'ea', unitPrice: 500, category: 'allowance' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Allowance - Plumbing Fixtures', description: 'Allowance for plumbing fixtures', category: 'Allowances', unit: 'ea', laborHours: 0, items: [
      { name: 'Plumbing Allowance', quantity: 1, unit: 'ea', unitPrice: 1000, category: 'allowance' },
    ], createdAt: now },
    { id: uuidv4(), name: 'Allowance - Appliances', description: 'Allowance for appliances', category: 'Allowances', unit: 'ea', laborHours: 0, items: [
      { name: 'Appliance Allowance', quantity: 1, unit: 'ea', unitPrice: 3000, category: 'allowance' },
    ], createdAt: now },
  ],
  templates: generateStarterEstimateTemplates(),
  projectTypeTemplates: [
    {
      id: uuidv4(),
      name: 'Kitchen Remodel',
      projectType: 'remodel',
      description: 'Full kitchen remodel with cabinets, countertops, flooring, and appliances',
      sections: [
        { id: uuidv4(), name: 'Demolition', sortOrder: 0, items: [
          { id: uuidv4(), name: 'Remove Existing Cabinets', description: 'Demo upper and base cabinets', quantity: 1, unit: 'ls', unitPrice: 800, category: 'labor', isLabor: true, hours: 4, isDefaultChecked: true },
          { id: uuidv4(), name: 'Remove Countertops', description: 'Remove laminate or stone countertops', quantity: 1, unit: 'ls', unitPrice: 300, category: 'labor', isLabor: true, hours: 2, isDefaultChecked: true },
          { id: uuidv4(), name: 'Demo Flooring', description: 'Remove existing flooring', quantity: 200, unit: 'sqft', unitPrice: 1, category: 'labor', isLabor: true, hours: 3, isDefaultChecked: false },
          { id: uuidv4(), name: 'Debris Removal', description: 'Haul away demo debris', quantity: 1, unit: 'ls', unitPrice: 400, category: 'other', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Cabinets', sortOrder: 1, items: [
          { id: uuidv4(), name: 'Upper Cabinets (Stock)', description: '24" upper cabinets', quantity: 8, unit: 'ea', unitPrice: 180, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Base Cabinets (Stock)', description: '34.5" base cabinets', quantity: 8, unit: 'ea', unitPrice: 280, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Cabinet Hardware', description: 'Knobs/pulls', quantity: 32, unit: 'ea', unitPrice: 3, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Cabinet Install Labor', description: 'Install all cabinets', quantity: 4, unit: 'hrs', unitPrice: 45, category: 'labor', isLabor: true, hours: 4, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Countertops', sortOrder: 2, items: [
          { id: uuidv4(), name: 'Quartz Countertops', description: 'Remove and replace with quartz', quantity: 40, unit: 'sqft', unitPrice: 65, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Countertop Template/Install', description: 'Template and install', quantity: 1, unit: 'ea', unitPrice: 350, category: 'labor', isLabor: true, hours: 3, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Flooring', sortOrder: 3, items: [
          { id: uuidv4(), name: 'Hardwood Flooring', description: '3/4" hardwood', quantity: 200, unit: 'sqft', unitPrice: 8, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Underlayment', description: 'Foam underlayment', quantity: 200, unit: 'sqft', unitPrice: 0.75, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Install Hardwood', description: 'Install and finish', quantity: 200, unit: 'sqft', unitPrice: 4, category: 'labor', isLabor: true, hours: 8, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Electrical', sortOrder: 4, items: [
          { id: uuidv4(), name: 'Receptacle Installation', description: 'Add, move, or update outlets', quantity: 4, unit: 'ea', unitPrice: 125, category: 'labor', isLabor: true, hours: 2, isDefaultChecked: true },
          { id: uuidv4(), name: 'Pendant Lighting', description: 'Install pendant lights', quantity: 3, unit: 'ea', unitPrice: 150, category: 'labor', isLabor: true, hours: 2, isDefaultChecked: false },
        ]},
        { id: uuidv4(), name: 'Plumbing', sortOrder: 5, items: [
          { id: uuidv4(), name: 'Dishwasher Hookup', description: 'Connect dishwasher', quantity: 1, unit: 'ea', unitPrice: 200, category: 'labor', isLabor: true, hours: 1, isDefaultChecked: true },
          { id: uuidv4(), name: 'Faucet Installation', description: 'Install new faucet', quantity: 1, unit: 'ea', unitPrice: 150, category: 'labor', isLabor: true, hours: 1, isDefaultChecked: true },
        ]},
      ],
      createdAt: now
    },
    {
      id: uuidv4(),
      name: 'Bathroom Remodel',
      projectType: 'remodel',
      description: 'Full bathroom renovation with tile, vanity, and fixtures',
      sections: [
        { id: uuidv4(), name: 'Demolition', sortOrder: 0, items: [
          { id: uuidv4(), name: 'Remove Fixtures', description: 'Remove toilet, vanity, tub/shower', quantity: 1, unit: 'ls', unitPrice: 400, category: 'labor', isLabor: true, hours: 3, isDefaultChecked: true },
          { id: uuidv4(), name: 'Remove Tile', description: 'Remove floor and shower tile', quantity: 80, unit: 'sqft', unitPrice: 2, category: 'labor', isLabor: true, hours: 4, isDefaultChecked: true },
          { id: uuidv4(), name: 'Demo & Haul', description: 'Demolition debris removal', quantity: 1, unit: 'ls', unitPrice: 350, category: 'other', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Vanity', sortOrder: 1, items: [
          { id: uuidv4(), name: 'Vanity 48"', description: 'Single sink vanity', quantity: 1, unit: 'ea', unitPrice: 650, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Vanity Faucet', description: 'Single handle faucet', quantity: 1, unit: 'ea', unitPrice: 180, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Vanity Install', description: 'Install vanity and connect plumbing', quantity: 3, unit: 'hrs', unitPrice: 45, category: 'labor', isLabor: true, hours: 3, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Shower/Tub', sortOrder: 2, items: [
          { id: uuidv4(), name: 'Shower Pan', description: 'Acrylic shower pan', quantity: 1, unit: 'ea', unitPrice: 450, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Shower Glass', description: 'Glass enclosure', quantity: 1, unit: 'ea', unitPrice: 850, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Shower Valve', description: 'New shower valve and trim', quantity: 1, unit: 'ea', unitPrice: 350, category: 'material', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Tile - Floor', sortOrder: 3, items: [
          { id: uuidv4(), name: 'Floor Tile', description: 'Ceramic or porcelain tile', quantity: 60, unit: 'sqft', unitPrice: 4, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Thinset Mortar', description: 'Tile mortar', quantity: 60, unit: 'sqft', unitPrice: 2, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Grout', description: 'Unsanded grout', quantity: 60, unit: 'sqft', unitPrice: 1, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Tile Install - Floor', description: 'Install floor tile', quantity: 60, unit: 'sqft', unitPrice: 5, category: 'labor', isLabor: true, hours: 4, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Tile - Shower', sortOrder: 4, items: [
          { id: uuidv4(), name: 'Shower Wall Tile', description: '3x6 subway tile', quantity: 140, unit: 'sqft', unitPrice: 3.50, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Shower Waterproofing', description: 'Waterproof membrane', quantity: 140, unit: 'sqft', unitPrice: 2, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Tile Install - Shower', description: 'Install shower walls', quantity: 140, unit: 'sqft', unitPrice: 6, category: 'labor', isLabor: true, hours: 8, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Toilet', sortOrder: 5, items: [
          { id: uuidv4(), name: 'Toilet', description: 'Two-piece elongated', quantity: 1, unit: 'ea', unitPrice: 350, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Toilet Install', description: 'Install toilet', quantity: 1, unit: 'ea', unitPrice: 125, category: 'labor', isLabor: true, hours: 1, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Accessories', sortOrder: 6, items: [
          { id: uuidv4(), name: 'Towel Bars', description: 'Towel bar set', quantity: 2, unit: 'ea', unitPrice: 85, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Toilet Paper Holder', description: 'Wall mount', quantity: 1, unit: 'ea', unitPrice: 45, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Mirror/Medicine Cabinet', description: 'Lighted medicine cabinet', quantity: 1, unit: 'ea', unitPrice: 250, category: 'material', isLabor: false, isDefaultChecked: false },
        ]},
      ],
      createdAt: now
    },
    {
      id: uuidv4(),
      name: 'Flooring Install',
      projectType: 'remodel',
      description: 'Hardwood or luxury vinyl plank flooring installation',
      sections: [
        { id: uuidv4(), name: 'Flooring', sortOrder: 0, items: [
          { id: uuidv4(), name: 'Hardwood Flooring', description: '3/4" solid hardwood', quantity: 200, unit: 'sqft', unitPrice: 8, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'LVP Flooring', description: 'Luxury vinyl plank', quantity: 200, unit: 'sqft', unitPrice: 4.50, category: 'material', isLabor: false, isDefaultChecked: false },
          { id: uuidv4(), name: 'Tile Flooring', description: 'Porcelain tile', quantity: 200, unit: 'sqft', unitPrice: 5, category: 'material', isLabor: false, isDefaultChecked: false },
        ]},
        { id: uuidv4(), name: 'Prep', sortOrder: 1, items: [
          { id: uuidv4(), name: 'Subfloor Prep', description: 'Level and repair subfloor', quantity: 200, unit: 'sqft', unitPrice: 2, category: 'labor', isLabor: true, hours: 2, isDefaultChecked: true },
          { id: uuidv4(), name: 'Underlayment', description: 'Foam or cork underlayment', quantity: 200, unit: 'sqft', unitPrice: 0.75, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Moisture Barrier', description: ' Vapor barrier', quantity: 200, unit: 'sqft', unitPrice: 0.50, category: 'material', isLabor: false, isDefaultChecked: false },
        ]},
        { id: uuidv4(), name: 'Installation', sortOrder: 2, items: [
          { id: uuidv4(), name: 'Install Hardwood', description: 'Install and finish hardwood', quantity: 200, unit: 'sqft', unitPrice: 4, category: 'labor', isLabor: true, hours: 8, isDefaultChecked: true },
          { id: uuidv4(), name: 'Install LVP', description: 'Click-lock LVP installation', quantity: 200, unit: 'sqft', unitPrice: 2.50, category: 'labor', isLabor: true, hours: 5, isDefaultChecked: false },
          { id: uuidv4(), name: 'Install Tile', description: 'Set and grout tile', quantity: 200, unit: 'sqft', unitPrice: 5, category: 'labor', isLabor: true, hours: 10, isDefaultChecked: false },
        ]},
        { id: uuidv4(), name: 'Trim', sortOrder: 3, items: [
          { id: uuidv4(), name: 'Base Shoe', description: '3/4" base shoe', quantity: 100, unit: 'lf', unitPrice: 1.50, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Quarter Round', description: '3/4" quarter round', quantity: 100, unit: 'lf', unitPrice: 1, category: 'material', isLabor: false, isDefaultChecked: false },
          { id: uuidv4(), name: 'Transition Strips', description: 'Wood transitions', quantity: 3, unit: 'ea', unitPrice: 35, category: 'material', isLabor: false, isDefaultChecked: true },
        ]},
      ],
      createdAt: now
    },
    {
      id: uuidv4(),
      name: 'Interior Paint',
      projectType: 'repair',
      description: 'Interior wall painting including prep and finish',
      sections: [
        { id: uuidv4(), name: 'Walls', sortOrder: 0, items: [
          { id: uuidv4(), name: 'Interior Paint', description: 'Premium interior latex', quantity: 4, unit: 'gal', unitPrice: 45, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Primer', description: 'Interior primer', quantity: 2, unit: 'gal', unitPrice: 28, category: 'material', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Prep', sortOrder: 1, items: [
          { id: uuidv4(), name: 'Fill & Sand', description: 'Fill holes, sand smooth', quantity: 800, unit: 'sqft', unitPrice: 0.50, category: 'labor', isLabor: true, hours: 2, isDefaultChecked: true },
          { id: uuidv4(), name: 'Caulk Trim', description: 'Caulk trim and corners', quantity: 200, unit: 'lf', unitPrice: 0.75, category: 'labor', isLabor: true, hours: 1, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Paint - Walls', sortOrder: 2, items: [
          { id: uuidv4(), name: 'Paint Walls - 2 Coats', description: 'Prime and 2 coats', quantity: 800, unit: 'sqft', unitPrice: 1.50, category: 'labor', isLabor: true, hours: 6, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Ceilings', sortOrder: 3, items: [
          { id: uuidv4(), name: 'Ceiling Paint', description: 'Flat ceiling paint', quantity: 2, unit: 'gal', unitPrice: 35, category: 'material', isLabor: false, isDefaultChecked: false },
          { id: uuidv4(), name: 'Paint Ceiling - 2 Coats', description: 'Prime and 2 coats', quantity: 200, unit: 'sqft', unitPrice: 1.25, category: 'labor', isLabor: true, hours: 3, isDefaultChecked: false },
        ]},
        { id: uuidv4(), name: 'Trim', sortOrder: 4, items: [
          { id: uuidv4(), name: 'Trim Paint', description: 'Semi-gloss trim paint', quantity: 1, unit: 'qt', unitPrice: 35, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Paint Trim', description: 'Paint doors, trim, casings', quantity: 60, unit: 'lf', unitPrice: 1.50, category: 'labor', isLabor: true, hours: 2, isDefaultChecked: true },
        ]},
      ],
      createdAt: now
    },
    {
      id: uuidv4(),
      name: 'Roofing',
      projectType: 'repair',
      description: 'Complete roofing replacement with shingles',
      sections: [
        { id: uuidv4(), name: 'Tear-Off', sortOrder: 0, items: [
          { id: uuidv4(), name: 'Tear Off Shingles', description: 'Remove existing shingles', quantity: 20, unit: 'sq', unitPrice: 35, category: 'labor', isLabor: true, hours: 8, isDefaultChecked: true },
          { id: uuidv4(), name: 'Remove Underlayment', description: 'Remove old felt', quantity: 20, unit: 'sq', unitPrice: 15, category: 'labor', isLabor: true, hours: 3, isDefaultChecked: true },
          { id: uuidv4(), name: 'Roof Debris Haul', description: 'Dumpster and haul', quantity: 1, unit: 'ea', unitPrice: 450, category: 'other', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Prep', sortOrder: 1, items: [
          { id: uuidv4(), name: 'Inspect Decking', description: 'Check and repair decking', quantity: 20, unit: 'sq', unitPrice: 15, category: 'labor', isLabor: true, hours: 4, isDefaultChecked: true },
          { id: uuidv4(), name: 'Synthetic Underlayment', description: 'Synthetic roof underlayment', quantity: 22, unit: 'sq', unitPrice: 35, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Drip Edge', description: 'Aluminum drip edge', quantity: 100, unit: 'lf', unitPrice: 2.50, category: 'material', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Shingles', sortOrder: 2, items: [
          { id: uuidv4(), name: 'Architectural Shingles', description: '30yr architectural shingles', quantity: 22, unit: 'sq', unitPrice: 125, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Starter Shingles', description: 'Starter strip', quantity: 8, unit: 'sq', unitPrice: 45, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Roofing Nails', description: 'Coil nails', quantity: 4, unit: 'coil', unitPrice: 25, category: 'material', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Flashing', sortOrder: 3, items: [
          { id: uuidv4(), name: 'Pipe Boot', description: 'Rubber pipe boot', quantity: 4, unit: 'ea', unitPrice: 15, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Step Flashing', description: 'Step flashing at walls', quantity: 30, unit: 'lf', unitPrice: 3.50, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Ridge Vent', description: 'Continuous ridge vent', quantity: 30, unit: 'lf', unitPrice: 4, category: 'material', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Install', sortOrder: 4, items: [
          { id: uuidv4(), name: 'Shingle Install Labor', description: 'Install shingles', quantity: 22, unit: 'sq', unitPrice: 85, category: 'labor', isLabor: true, hours: 16, isDefaultChecked: true },
          { id: uuidv4(), name: 'Ridge Cap', description: 'Cut and cap ridge', quantity: 30, unit: 'lf', unitPrice: 4, category: 'labor', isLabor: true, hours: 2, isDefaultChecked: false, isOptional: true },
        ]},
      ],
      createdAt: now
    },
    {
      id: uuidv4(),
      name: 'Deck Build',
      projectType: 'addition',
      description: 'Custom deck construction with framing and railings',
      sections: [
        { id: uuidv4(), name: 'Framing', sortOrder: 0, items: [
          { id: uuidv4(), name: 'Posts', description: '4x4 pressure treated posts', quantity: 6, unit: 'ea', unitPrice: 25, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Beams', description: '2x10 or 2x12 beams', quantity: 60, unit: 'lf', unitPrice: 8, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Joists', description: '2x8 joists 16" OC', quantity: 240, unit: 'lf', unitPrice: 3.50, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Decking', description: '2x6 or 5/4 decking', quantity: 240, unit: 'lf', unitPrice: 4, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Framing Labor', description: 'Build frame structure', quantity: 12, unit: 'hrs', unitPrice: 45, category: 'labor', isLabor: true, hours: 12, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Railings', sortOrder: 1, items: [
          { id: uuidv4(), name: 'Composite Rail Posts', description: '4x4 composite posts', quantity: 4, unit: 'ea', unitPrice: 45, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Rail Kit', description: 'Composite top rail and bottom', quantity: 40, unit: 'lf', unitPrice: 28, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Balusters', description: 'Aluminum balusters', quantity: 80, unit: 'ea', unitPrice: 4.50, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Railing Install', description: 'Install railings', quantity: 8, unit: 'hrs', unitPrice: 45, category: 'labor', isLabor: true, hours: 8, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Stairs', sortOrder: 2, items: [
          { id: uuidv4(), name: 'Stair Stringers', description: '2x12 PT stringers', quantity: 3, unit: 'ea', unitPrice: 35, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Stair Treads', description: 'Composite treads', quantity: 9, unit: 'ea', unitPrice: 45, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Stair Install', description: 'Build and install stairs', quantity: 4, unit: 'hrs', unitPrice: 45, category: 'labor', isLabor: true, hours: 4, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Finishing', sortOrder: 3, items: [
          { id: uuidv4(), name: 'Ledger Bolts', description: 'Bolts to house', quantity: 1, unit: 'ea', unitPrice: 85, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Post Base', description: 'Simson structural post base', quantity: 6, unit: 'ea', unitPrice: 18, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Surface Prep', description: 'Sand and prep', quantity: 200, unit: 'sqft', unitPrice: 0.50, category: 'labor', isLabor: true, hours: 2, isDefaultChecked: false },
        ]},
      ],
      createdAt: now
    },
    {
      id: uuidv4(),
      name: 'Whole House Rehab',
      projectType: 'flip',
      description: 'Comprehensive house renovation for flip',
      sections: [
        { id: uuidv4(), name: 'Demo - Entire House', sortOrder: 0, items: [
          { id: uuidv4(), name: 'Full House Demo', description: 'Remove all cabinets, flooring, fixtures', quantity: 2000, unit: 'sqft', unitPrice: 1.50, category: 'labor', isLabor: true, hours: 24, isDefaultChecked: true },
          { id: uuidv4(), name: 'Haul Away', description: 'Multiple dump runs', quantity: 4, unit: 'ea', unitPrice: 350, category: 'other', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Kitchen', sortOrder: 1, items: [
          { id: uuidv4(), name: 'Cabinets - Upper', description: 'Stock upper cabinets', quantity: 12, unit: 'ea', unitPrice: 180, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Cabinets - Base', description: 'Stock base cabinets', quantity: 10, unit: 'ea', unitPrice: 280, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Granite/Quartz', description: 'Installed countertops', quantity: 50, unit: 'sqft', unitPrice: 55, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'New Appliances', description: 'Basic stainless package', quantity: 1, unit: 'ea', unitPrice: 2500, category: 'allowance', isLabor: false, isAllowance: true, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Bathrooms (2)', sortOrder: 2, items: [
          { id: uuidv4(), name: 'Vanities', description: 'Two bath vanities', quantity: 2, unit: 'ea', unitPrice: 650, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Tub/Shower Units', description: 'Fiberglass tub/shower', quantity: 2, unit: 'ea', unitPrice: 650, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Tile - Floors', description: 'Bath floor tile', quantity: 150, unit: 'sqft', unitPrice: 4, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Tile - Shower Walls', description: 'Shower walls', quantity: 200, unit: 'sqft', unitPrice: 4, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Fixtures', description: 'Toilets, faucets, accessories', quantity: 1, unit: 'ea', unitPrice: 1200, category: 'allowance', isAllowance: true, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Flooring', sortOrder: 3, items: [
          { id: uuidv4(), name: 'Hardwood - Main', description: 'Main living areas', quantity: 1400, unit: 'sqft', unitPrice: 8, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Tile - Baths', description: 'Bath tile', quantity: 150, unit: 'sqft', unitPrice: 4, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Carpet - Bedrooms', description: 'Bedrooms', quantity: 600, unit: 'sqft', unitPrice: 3, category: 'material', isLabor: false, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Paint - Interior', sortOrder: 4, items: [
          { id: uuidv4(), name: 'Walls - Paint', description: 'Full interior walls', quantity: 4000, unit: 'sqft', unitPrice: 1, category: 'labor', isLabor: true, hours: 16, isDefaultChecked: true },
          { id: uuidv4(), name: 'Trim - Paint', description: 'Doors, casings, base', quantity: 400, unit: 'lf', unitPrice: 2, category: 'labor', isLabor: true, hours: 8, isDefaultChecked: true },
        ]},
        { id: uuidv4(), name: 'Exterior', sortOrder: 5, items: [
          { id: uuidv4(), name: 'Siding Repair', description: 'Replace damaged siding', quantity: 100, unit: 'sqft', unitPrice: 4, category: 'material', isLabor: false, isDefaultChecked: true },
          { id: uuidv4(), name: 'Exterior Paint', description: 'Full house exterior paint', quantity: 2500, unit: 'sqft', unitPrice: 1.50, category: 'labor', isLabor: true, hours: 20, isDefaultChecked: true },
          { id: uuidv4(), name: 'Landscaping Cleanup', description: 'Basic cleanup and mulch', quantity: 1, unit: 'ea', unitPrice: 850, category: 'allowance', isAllowance: true, isDefaultChecked: true },
        ]},
      ],
      createdAt: now
    },
  ],
  estimates: [],
  jobs: [
    {
      id: uuidv4(),
      name: 'Smith Kitchen Remodel',
      customer: 'John Smith',
      customerPhone: '(555) 123-4567',
      customerEmail: 'jsmith@email.com',
      address: '123 Oak Street, Springfield, IL 62701',
      type: 'remodel',
      contractAmount: 45000,
      estimatedCost: 35000,
      actualCost: 28500,
      startDate: lastWeek,
      dueDate: nextWeek,
      status: 'active',
      notes: 'Complete kitchen gut remodel with new cabinets, countertops, and appliances.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Johnson House Flip',
      customer: 'Mike Johnson',
      customerPhone: '(555) 234-5678',
      customerEmail: 'mjohnson@email.com',
      address: '456 Maple Ave, Springfield, IL 62702',
      type: 'flip',
      contractAmount: 125000,
      estimatedCost: 85000,
      actualCost: 72000,
      startDate: lastWeek,
      dueDate: twoWeeks,
      status: 'active',
      notes: 'Full flip - 4 bed, 2 bath. New roof, HVAC, kitchen, baths, flooring.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Williams New Build',
      customer: 'Sarah Williams',
      customerPhone: '(555) 345-6789',
      customerEmail: 'swilliams@email.com',
      address: '789 Pine Lane, Springfield, IL 62703',
      type: 'new_build',
      contractAmount: 285000,
      estimatedCost: 220000,
      actualCost: 180000,
      startDate: lastWeek,
      dueDate: new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0],
      status: 'active',
      notes: 'Custom 2500 sq ft home with garage.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Brown Bathroom Update',
      customer: 'Tom Brown',
      customerPhone: '(555) 456-7890',
      address: '321 Elm Street, Springfield, IL 62704',
      type: 'remodel',
      contractAmount: 12000,
      estimatedCost: 8500,
      actualCost: 6500,
      startDate: yesterday,
      dueDate: nextWeek,
      status: 'scheduled',
      notes: 'Master bath update - new tile, vanity, fixtures.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Davis Garage Addition',
      customer: 'Lisa Davis',
      customerPhone: '(555) 567-8901',
      customerEmail: 'ldavis@email.com',
      address: '654 Cedar Drive, Springfield, IL 62705',
      type: 'addition',
      contractAmount: 35000,
      estimatedCost: 28000,
      actualCost: 0,
      startDate: nextWeek,
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      status: 'approved',
      notes: '24x24 garage addition with overhead door.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Wilson Roof Replacement',
      customer: 'Robert Wilson',
      customerPhone: '(555) 678-9012',
      address: '987 Birch Road, Springfield, IL 62706',
      type: 'repair',
      contractAmount: 8500,
      estimatedCost: 6500,
      actualCost: 0,
      startDate: nextWeek,
      dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
      status: 'estimate_sent',
      notes: 'Full roof replacement - architectural shingles.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: uuidv4(),
      name: 'Miller Deck Build',
      customer: 'Paul Miller',
      customerPhone: '(555) 789-0123',
      address: '147 Walnut Court, Springfield, IL 62707',
      type: 'addition',
      contractAmount: 18000,
      estimatedCost: 14000,
      actualCost: 13500,
      startDate: lastWeek,
      dueDate: today,
      status: 'completed',
      notes: '12x20 composite deck with stairs.',
      createdAt: now,
      updatedAt: now,
    },
  ],
  workers: [
    {
      id: uuidv4(),
      name: 'Mike Thompson',
      type: 'employee',
      trade: 'Carpentry',
      phone: '(555) 111-2222',
      email: 'mthompson@company.com',
      payType: 'hourly',
      hourlyRate: 28,
      status: 'active',
      createdAt: now,
    },
    {
      id: uuidv4(),
      name: 'Carlos Rodriguez',
      type: 'subcontractor',
      trade: 'Electrical',
      phone: '(555) 222-3333',
      email: 'carlos@lectric.com',
      payType: 'flat',
      flatRate: 350,
      status: 'active',
      createdAt: now,
    },
    {
      id: uuidv4(),
      name: 'Steve Wilson',
      type: 'subcontractor',
      trade: 'Plumbing',
      phone: '(555) 333-4444',
      email: 'steve@plumbpro.com',
      payType: 'flat',
      flatRate: 400,
      status: 'active',
      createdAt: now,
    },
    {
      id: uuidv4(),
      name: 'Jake Martinez',
      type: 'employee',
      trade: 'General',
      phone: '(555) 444-5555',
      email: 'jmartinez@company.com',
      payType: 'hourly',
      hourlyRate: 22,
      status: 'active',
      createdAt: now,
    },
    {
      id: uuidv4(),
      name: 'Sarah Kim',
      type: 'employee',
      trade: 'Painting',
      phone: '(555) 555-6666',
      email: 'skim@company.com',
      payType: 'hourly',
      hourlyRate: 24,
      status: 'active',
      createdAt: now,
    },
    {
      id: uuidv4(),
      name: 'Dave HVAC Services',
      type: 'subcontractor',
      trade: 'HVAC',
      phone: '(555) 666-7777',
      email: 'dave@davehvac.com',
      payType: 'flat',
      flatRate: 500,
      status: 'active',
      createdAt: now,
    },
    {
      id: uuidv4(),
      name: 'Tom Anderson',
      type: 'subcontractor',
      trade: 'Roofing',
      phone: '(555) 777-8888',
      email: 'tom@andersonroofing.com',
      payType: 'flat',
      flatRate: 450,
      status: 'inactive',
      createdAt: now,
    },
  ],
  timeEntries: [],
  expenses: [],
  tasks: [],
  invoices: [],
  payments: [],
  notes: [],
  photos: [],
  changeOrders: [],
  jobTemplates: [],
  alerts: [],
};

export function generateCompleteSeedData(): AppData {
  const jobs = initialData.jobs;
  const workers = initialData.workers;
  
  const data = {
    ...initialData,
    timeEntries: generateSeedTimeEntries(jobs, workers),
    expenses: generateSeedExpenses(jobs),
    tasks: generateSeedTasks(jobs, workers),
    ...generateSeedInvoices(jobs),
    notes: generateSeedNotes(jobs),
    photos: generateSeedPhotos(jobs),
    changeOrders: generateSeedChangeOrders(jobs),
    jobTemplates: generateSeedTemplates(),
  };

  return data;
}

function generateSeedTimeEntries(jobs: Job[], workers: Worker[]) {
  const entries = [];
  const job1 = jobs[0];
  const job2 = jobs[1];
  const job3 = jobs[2];
  const job6 = jobs[6];
  
  const worker1 = workers[0];
  const worker4 = workers[3];
  const worker5 = workers[4];

  const timeIn = '07:00';
  const timeOut = '16:30';

  entries.push(
    { id: uuidv4(), jobId: job1.id, workerId: worker1.id, date: lastWeek, startTime: timeIn, endTime: '12:00', totalHours: 5, overtime: false, laborCost: 140, notes: 'Framing - north wall', createdAt: now },
    { id: uuidv4(), jobId: job1.id, workerId: worker1.id, date: lastWeek, startTime: '12:30', endTime: timeOut, totalHours: 4, overtime: false, laborCost: 112, notes: 'Cabinet prep', createdAt: now },
    { id: uuidv4(), jobId: job1.id, workerId: worker1.id, date: yesterday, startTime: timeIn, endTime: timeOut, totalHours: 9, overtime: true, laborCost: 308, notes: 'Cabinet install', createdAt: now },
    { id: uuidv4(), jobId: job2.id, workerId: worker4.id, date: lastWeek, startTime: timeIn, endTime: '12:00', totalHours: 5, overtime: false, laborCost: 110, notes: 'Demolition', createdAt: now },
    { id: uuidv4(), jobId: job2.id, workerId: worker4.id, date: lastWeek, startTime: '12:30', endTime: timeOut, totalHours: 4, overtime: false, laborCost: 88, notes: 'Framing', createdAt: now },
    { id: uuidv4(), jobId: job2.id, workerId: worker4.id, date: yesterday, startTime: timeIn, endTime: timeOut, totalHours: 9, overtime: true, laborCost: 242, notes: 'Drywall', createdAt: now },
    { id: uuidv4(), jobId: job3.id, workerId: worker1.id, date: lastWeek, startTime: timeIn, endTime: timeOut, totalHours: 9, overtime: true, laborCost: 308, notes: 'Foundation framing', createdAt: now },
    { id: uuidv4(), jobId: job3.id, workerId: worker1.id, date: yesterday, startTime: timeIn, endTime: '12:00', totalHours: 5, overtime: false, laborCost: 140, notes: 'Framing walls', createdAt: now },
    { id: uuidv4(), jobId: job6.id, workerId: worker5.id, date: lastWeek, startTime: timeIn, endTime: timeOut, totalHours: 9, overtime: true, laborCost: 264, notes: 'Deck staining', createdAt: now },
    { id: uuidv4(), jobId: job6.id, workerId: worker5.id, date: yesterday, startTime: timeIn, endTime: timeOut, totalHours: 9, overtime: true, laborCost: 264, notes: 'Railings and stairs', createdAt: now }
  );

  return entries;
}

function generateSeedExpenses(jobs: Job[]) {
  const expenses = [];
  const job1 = jobs[0];
  const job2 = jobs[1];
  const job3 = jobs[2];
  const job6 = jobs[6];

  expenses.push(
    { id: uuidv4(), jobId: job1.id, date: lastWeek, vendor: 'Lumber Liquidators', amount: 4500, category: 'materials', paymentSource: 'company_card', notes: 'Cabinets, hardwood flooring', createdAt: now },
    { id: uuidv4(), jobId: job1.id, date: yesterday, vendor: 'City of Springfield', amount: 850, category: 'permits', paymentSource: 'company_card', notes: 'Building permit', createdAt: now },
    { id: uuidv4(), jobId: job1.id, date: today, vendor: 'Habitat Hardware', amount: 320, category: 'materials', paymentSource: 'company_card', notes: 'Hardware, fasteners', createdAt: now },
    { id: uuidv4(), jobId: job2.id, date: lastWeek, vendor: 'Dumpster Direct', amount: 450, category: 'dump_fees', paymentSource: 'cash', notes: '20 yard dumpster', createdAt: now },
    { id: uuidv4(), jobId: job2.id, date: lastWeek, vendor: 'BuildPro Supply', amount: 2800, category: 'materials', paymentSource: 'company_card', notes: 'Drywall, tape, mud', createdAt: now },
    { id: uuidv4(), jobId: job2.id, date: yesterday, vendor: 'ABC Rental', amount: 250, category: 'rental', paymentSource: 'company_card', notes: 'Scissor lift - 3 days', createdAt: now },
    { id: uuidv4(), jobId: job2.id, date: yesterday, vendor: 'Shell Station', amount: 85, category: 'fuel', paymentSource: 'company_card', notes: 'Job site fuel', createdAt: now },
    { id: uuidv4(), jobId: job3.id, date: lastWeek, vendor: 'Concrete Ready-Mix', amount: 2400, category: 'materials', paymentSource: 'company_card', notes: 'Foundation pour', createdAt: now },
    { id: uuidv4(), jobId: job3.id, date: yesterday, vendor: 'BuildPro Supply', amount: 1800, category: 'materials', paymentSource: 'company_card', notes: 'Framing lumber', createdAt: now },
    { id: uuidv4(), jobId: job6.id, date: lastWeek, vendor: 'Deck Materials Co', amount: 8500, category: 'materials', paymentSource: 'finance', notes: 'Composite decking, railings', createdAt: now },
    { id: uuidv4(), jobId: job6.id, date: yesterday, vendor: 'FastenAll', amount: 180, category: 'materials', paymentSource: 'company_card', notes: 'Fasteners, brackets', createdAt: now }
  );

  return expenses;
}

function generateSeedTasks(jobs: Job[], workers: Worker[]) {
  const tasks = [];
  const taskDueSoon = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];

  tasks.push(
    { id: uuidv4(), title: 'Order cabinets - Smith Job', description: 'Call cabinet company to finalize specs and place order', dueDate: taskDueSoon, assignedTo: workers[0].id, jobId: jobs[0].id, priority: 'high', status: 'in_progress', createdAt: now, updatedAt: now },
    { id: uuidv4(), title: 'Schedule electrical inspection', description: 'City requires 24hr notice', dueDate: taskDueSoon, assignedTo: workers[1].id, jobId: jobs[1].id, priority: 'urgent', status: 'open', createdAt: now, updatedAt: now },
    { id: uuidv4(), title: 'Final walkthrough - Deck', description: 'Schedule with homeowner for final inspection', dueDate: today, assignedTo: workers[0].id, jobId: jobs[6].id, priority: 'high', status: 'done', createdAt: now, updatedAt: now },
    { id: uuidv4(), title: 'Order Roofing Materials', description: 'Get quotes from ABC and Gerard for shingles underlayment', dueDate: nextWeek, jobId: jobs[5].id, priority: 'medium', status: 'open', createdAt: now, updatedAt: now },
    { id: uuidv4(), title: 'Weekly team meeting', description: 'Monday morning coordination', dueDate: nextWeek, priority: 'medium', status: 'open', createdAt: now, updatedAt: now },
    { id: uuidv4(), title: 'Submit estimate - Wilson Roof', description: 'Finalize quote and send to customer', dueDate: taskDueSoon, priority: 'high', status: 'in_progress', createdAt: now, updatedAt: now },
    { id: uuidv4(), title: 'HVAC rough-in - Williams', description: 'Coordinate with Dave for ductwork', dueDate: nextWeek, jobId: jobs[2].id, priority: 'medium', status: 'blocked', createdAt: now, updatedAt: now }
  );

  return tasks;
}

function generateSeedInvoices(jobs: Job[]) {
  const invoices = [];
  const payments = [];
  
  const job1 = jobs[0];
  const job2 = jobs[1];
  const job3 = jobs[2];
  const job6 = jobs[6];

  invoices.push(
    { id: uuidv4(), invoiceNumber: 'INV-001', jobId: job1.id, amount: 10000, type: 'deposit', dueDate: lastWeek, status: 'paid', notes: '50% deposit per contract', createdAt: now },
    { id: uuidv4(), invoiceNumber: 'INV-002', jobId: job2.id, amount: 25000, type: 'deposit', dueDate: lastWeek, status: 'paid', notes: '20% deposit', createdAt: now },
    { id: uuidv4(), invoiceNumber: 'INV-003', jobId: job2.id, amount: 50000, type: 'progress', dueDate: nextWeek, status: 'partial', notes: 'Mid-construction draw', createdAt: now },
    { id: uuidv4(), invoiceNumber: 'INV-004', jobId: job3.id, amount: 50000, type: 'deposit', dueDate: lastWeek, status: 'paid', notes: 'Foundation deposit', createdAt: now },
    { id: uuidv4(), invoiceNumber: 'INV-005', jobId: job3.id, amount: 75000, type: 'progress', dueDate: twoWeeks, status: 'sent', notes: 'Framing complete', createdAt: now },
    { id: uuidv4(), invoiceNumber: 'INV-006', jobId: job6.id, amount: 13500, type: 'final', dueDate: today, status: 'sent', notes: 'Final payment - deck complete', createdAt: now }
  );

  const inv1 = invoices[0];
  const inv2 = invoices[1];
  const inv3 = invoices[2];
  const inv4 = invoices[3];

  payments.push(
    { id: uuidv4(), invoiceId: inv1.id, amount: 10000, date: lastWeek, method: 'check', checkNumber: '1001', notes: 'Check #1001', createdAt: now },
    { id: uuidv4(), invoiceId: inv2.id, amount: 25000, date: lastWeek, method: 'ach', notes: 'Wire transfer', createdAt: now },
    { id: uuidv4(), invoiceId: inv3.id, amount: 15000, date: yesterday, method: 'check', checkNumber: '1005', notes: 'Partial payment', createdAt: now },
    { id: uuidv4(), invoiceId: inv4.id, amount: 50000, date: lastWeek, method: 'ach', notes: 'Foundation payment', createdAt: now }
  );

  return { invoices, payments };
}

function generateSeedNotes(jobs: Job[]) {
  return [
    { id: uuidv4(), jobId: jobs[0].id, content: 'Customer requested white cabinets instead of oak. Approved change order for $1,200.', createdAt: now },
    { id: uuidv4(), jobId: jobs[1].id, content: 'Found water damage behind shower wall. Added to change order.', createdAt: now },
    { id: uuidv4(), jobId: jobs[2].id, content: 'Building inspector approved foundation pour on first try.', createdAt: now },
  ];
}

function generateSeedPhotos(jobs: Job[]) {
  return [
    { id: uuidv4(), jobId: jobs[0].id, url: '/photos/kitchen-before-1.jpg', category: 'before' as const, description: 'Original kitchen before demo', createdAt: now },
    { id: uuidv4(), jobId: jobs[0].id, url: '/photos/kitchen-progress-1.jpg', category: 'progress' as const, description: 'Cabinets installed', createdAt: now },
    { id: uuidv4(), jobId: jobs[6].id, url: '/photos/deck-complete.jpg', category: 'after' as const, description: 'Final deck view', createdAt: now },
  ];
}

function generateSeedChangeOrders(jobs: Job[]) {
  return [
    { id: uuidv4(), jobId: jobs[0].id, description: 'Cabinet color upgrade - white shaker', amount: 1200, status: 'approved' as const, createdAt: now, updatedAt: now },
    { id: uuidv4(), jobId: jobs[1].id, description: 'Shower tile repair', amount: 2400, status: 'pending' as const, createdAt: now, updatedAt: now },
  ];
}

function generateSeedTemplates(): JobTemplate[] {
  return [
    {
      id: uuidv4(),
      name: 'Kitchen Remodel Standard',
      type: 'remodel',
      estimatedCost: 35000,
      tasks: [
        { title: 'Kitchen design consultation', priority: 'high' },
        { title: 'Permit application', priority: 'high' },
        { title: 'Demolition', priority: 'medium' },
        { title: 'Electrical rough-in', priority: 'medium' },
        { title: 'Plumbing rough-in', priority: 'medium' },
        { title: 'Drywall repair', priority: 'medium' },
        { title: 'Cabinet installation', priority: 'high' },
        { title: 'Countertop installation', priority: 'high' },
        { title: 'Backsplash install', priority: 'medium' },
        { title: 'Final walkthrough', priority: 'high' },
      ],
      materials: [
        { name: 'Cabinets', category: 'materials', estimatedCost: 12000 },
        { name: 'Countertops', category: 'materials', estimatedCost: 5000 },
        { name: 'Sink & Faucet', category: 'materials', estimatedCost: 1500 },
        { name: 'Appliances', category: 'materials', estimatedCost: 4000 },
      ],
      createdAt: now,
    },
    {
      id: uuidv4(),
      name: 'Bathroom Update Standard',
      type: 'remodel',
      estimatedCost: 12000,
      tasks: [
        { title: 'Design consultation', priority: 'high' },
        { title: 'Demolition', priority: 'medium' },
        { title: 'Tile installation', priority: 'high' },
        { title: 'Vanity installation', priority: 'medium' },
        { title: 'Fixture install', priority: 'high' },
        { title: 'Final inspection', priority: 'high' },
      ],
      materials: [
        { name: 'Vanity', category: 'materials', estimatedCost: 2500 },
        { name: 'Tile', category: 'materials', estimatedCost: 2000 },
        { name: 'Fixtures', category: 'materials', estimatedCost: 1500 },
      ],
      createdAt: now,
    },
  ];
}
