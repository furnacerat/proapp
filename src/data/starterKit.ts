import type { Assembly, LaborRate, Material, Template } from './types';

export const starterLaborRates: Omit<LaborRate, 'id'>[] = [
  { name: 'Owner / Project Manager', trade: 'General', hourlyRate: 85, overtimeRate: 127.5, isActive: true },
  { name: 'Lead Carpenter', trade: 'Carpentry', hourlyRate: 72, overtimeRate: 108, isActive: true },
  { name: 'Skilled Carpenter', trade: 'Carpentry', hourlyRate: 58, overtimeRate: 87, isActive: true },
  { name: 'Painter', trade: 'Painting', hourlyRate: 48, overtimeRate: 72, isActive: true },
  { name: 'General Labor', trade: 'General', hourlyRate: 38, overtimeRate: 57, isActive: true },
];

export const starterMaterials: Omit<Material, 'id'>[] = [
  { name: '2x4x8 Framing Stud', category: 'Framing', unit: 'each', unitPrice: 4.25, currentPrice: 4.25, basePrice: 4.25, priceSource: 'manual', pricingSource: 'manual', pricingVerified: false, isActive: true },
  { name: '1/2 in Drywall Sheet', category: 'Drywall', unit: 'sheet', unitPrice: 15.5, currentPrice: 15.5, basePrice: 15.5, priceSource: 'manual', pricingSource: 'manual', pricingVerified: false, isActive: true },
  { name: 'Interior Wall Paint', category: 'Paint', unit: 'gal', unitPrice: 42, currentPrice: 42, basePrice: 42, priceSource: 'manual', pricingSource: 'manual', pricingVerified: false, isActive: true },
  { name: 'LVP Flooring', category: 'Flooring', unit: 'sf', unitPrice: 4.25, currentPrice: 4.25, basePrice: 4.25, priceSource: 'manual', pricingSource: 'manual', pricingVerified: false, isActive: true },
  { name: 'Tile Setting Materials', category: 'Tile', unit: 'sf', unitPrice: 2.15, currentPrice: 2.15, basePrice: 2.15, priceSource: 'manual', pricingSource: 'manual', pricingVerified: false, isActive: true },
  { name: 'Cabinet Hardware', category: 'Finish', unit: 'each', unitPrice: 7.5, currentPrice: 7.5, basePrice: 7.5, priceSource: 'manual', pricingSource: 'manual', pricingVerified: false, isActive: true },
];

export const starterAssemblies: Omit<Assembly, 'id' | 'createdAt'>[] = [
  {
    name: 'Interior Wall Paint',
    category: 'Painting',
    unit: 'sf',
    laborHours: 0.03,
    markupPercent: 20,
    isDefault: true,
    description: 'Prep, paint, and standard supplies priced per wall square foot.',
    items: [
      { name: 'Paint labor', quantity: 0.03, unit: 'hr', unitPrice: 48, category: 'labor', quantityMode: 'calculated', measurementPrompt: 'Enter wall square footage.', clientVisible: true },
      { name: 'Paint and supplies', quantity: 1, unit: 'sf', unitPrice: 0.45, category: 'material', quantityMode: 'calculated', measurementPrompt: 'Enter wall square footage.', clientVisible: true },
    ],
  },
  {
    name: 'LVP Flooring Install',
    category: 'Flooring',
    unit: 'sf',
    laborHours: 0.08,
    markupPercent: 20,
    isDefault: true,
    description: 'Install LVP flooring with standard trim and transition allowance.',
    items: [
      { name: 'LVP install labor', quantity: 1, unit: 'sf', unitPrice: 3.25, category: 'labor', quantityMode: 'user_required', measurementPrompt: 'Enter installed square footage.', clientVisible: true },
      { name: 'LVP flooring material', quantity: 1, unit: 'sf', unitPrice: 4.25, category: 'material', quantityMode: 'user_required', measurementPrompt: 'Enter material square footage including waste.', clientVisible: true },
      { name: 'Transitions and trim allowance', quantity: 1, unit: 'allowance', unitPrice: 185, category: 'material', quantityMode: 'fixed', clientVisible: true },
    ],
  },
  {
    name: 'Drywall Patch',
    category: 'Drywall',
    unit: 'sf',
    laborHours: 0.18,
    markupPercent: 20,
    isDefault: true,
    description: 'Patch, tape, finish, texture blend, and spot prime.',
    items: [
      { name: 'Patch labor', quantity: 1, unit: 'sf', unitPrice: 12, category: 'labor', quantityMode: 'user_required', measurementPrompt: 'Enter patch square footage.', clientVisible: true },
      { name: 'Patch materials', quantity: 1, unit: 'ea', unitPrice: 85, category: 'material', quantityMode: 'fixed', clientVisible: true },
    ],
  },
  {
    name: 'Bathroom Fixture Set',
    category: 'Plumbing',
    unit: 'set',
    laborHours: 5,
    markupPercent: 20,
    isDefault: true,
    description: 'Common toilet, vanity faucet, and accessory install allowance.',
    items: [
      { name: 'Toilet install', quantity: 1, unit: 'ea', unitPrice: 225, category: 'labor', quantityMode: 'fixed', clientVisible: true },
      { name: 'Vanity faucet install', quantity: 1, unit: 'ea', unitPrice: 180, category: 'labor', quantityMode: 'fixed', clientVisible: true },
      { name: 'Accessory install allowance', quantity: 1, unit: 'allowance', unitPrice: 160, category: 'labor', quantityMode: 'fixed', clientVisible: true },
    ],
  },
];

const templateItem = (name: string, quantity: number | null, unit: string, unitPrice: number, category: string, isLabor = false) => ({
  name,
  quantity,
  unit,
  unitPrice,
  category,
  isLabor,
  quantityMode: quantity === null ? 'user_required' as const : 'fixed' as const,
  measurementPrompt: quantity === null ? `Enter ${name.toLowerCase()} quantity.` : undefined,
  clientVisible: true,
});

export const starterTemplates: Omit<Template, 'id' | 'createdAt'>[] = [
  {
    name: 'Bathroom Refresh Starter',
    category: 'bathroom',
    type: 'estimate',
    scope: 'Cosmetic bathroom refresh with fixture swaps, flooring allowance, paint, and closeout.',
    markupPercent: 20,
    recommendedAssemblies: ['Bathroom Fixture Set', 'Interior Wall Paint'],
    measurementPrompts: ['Bathroom floor square footage', 'Wall paint square footage', 'Fixture count'],
    requiredItems: [
      templateItem('Site protection and setup', 1, 'allowance', 275, 'labor', true),
      templateItem('Flooring allowance', null, 'sf', 7, 'material'),
      templateItem('Wall paint', null, 'sf', 1.15, 'labor', true),
      templateItem('Toilet install', 1, 'ea', 225, 'labor', true),
      templateItem('Vanity faucet install', 1, 'ea', 180, 'labor', true),
    ],
    optionalItems: [
      templateItem('Mirror replacement', 1, 'ea', 180, 'material'),
      templateItem('Bath fan replacement', 1, 'ea', 225, 'labor', true),
    ],
    clientFacingNotes: 'Final pricing depends on selections, field measurements, hidden conditions, and approved scope changes.',
    internalEstimatorNotes: 'Confirm flooring square footage, fixture count, and whether plumbing rough-in changes are needed.',
  },
  {
    name: 'Kitchen Refresh Starter',
    category: 'kitchen',
    type: 'estimate',
    scope: 'Kitchen refresh with hardware, faucet, paint, trim, and optional backsplash.',
    markupPercent: 20,
    recommendedAssemblies: ['Interior Wall Paint'],
    measurementPrompts: ['Wall paint square footage', 'Backsplash square footage', 'Hardware count'],
    requiredItems: [
      templateItem('Kitchen protection and prep', 1, 'allowance', 350, 'labor', true),
      templateItem('Cabinet hardware swap', 1, 'allowance', 325, 'labor', true),
      templateItem('Sink faucet install', 1, 'ea', 260, 'labor', true),
      templateItem('Wall paint', null, 'sf', 1.15, 'labor', true),
    ],
    optionalItems: [
      templateItem('Tile backsplash', null, 'sf', 18, 'material'),
      templateItem('Light fixture swap', 1, 'ea', 175, 'labor', true),
      templateItem('Disposal replacement', 1, 'ea', 225, 'labor', true),
    ],
    clientFacingNotes: 'Selections and site conditions can change final price after walkthrough.',
    internalEstimatorNotes: 'Confirm appliance movement, backsplash scope, cabinet condition, and electrical changes.',
  },
  {
    name: 'Interior Paint Starter',
    category: 'painting',
    type: 'estimate',
    scope: 'Interior wall, ceiling, trim, and door paint starter scope.',
    markupPercent: 20,
    recommendedAssemblies: ['Interior Wall Paint'],
    measurementPrompts: ['Wall square footage', 'Ceiling square footage', 'Trim linear feet', 'Door count'],
    requiredItems: [
      templateItem('Wall paint labor', null, 'sf', 1.15, 'labor', true),
      templateItem('Paint and supplies', null, 'sf', 0.45, 'material'),
      templateItem('Ceiling paint labor', null, 'sf', 1.05, 'labor', true),
    ],
    optionalItems: [
      templateItem('Trim paint', null, 'lf', 2.5, 'labor', true),
      templateItem('Door paint', null, 'ea', 85, 'labor', true),
      templateItem('Drywall touch-up allowance', 1, 'allowance', 225, 'labor', true),
    ],
    clientFacingNotes: 'Includes standard prep. Major repairs, stain blocking, or color changes may require approval.',
    internalEstimatorNotes: 'Confirm wall condition, number of colors, ceiling height, and furniture moving.',
  },
  {
    name: 'Flooring Replacement Starter',
    category: 'flooring',
    type: 'estimate',
    scope: 'Remove existing flooring and install new LVP or similar finish floor.',
    markupPercent: 20,
    recommendedAssemblies: ['LVP Flooring Install'],
    measurementPrompts: ['Demo square footage', 'Installed square footage', 'Room perimeter'],
    requiredItems: [
      templateItem('Flooring demolition', null, 'sf', 1.75, 'labor', true),
      templateItem('New flooring material', null, 'sf', 5.5, 'material'),
      templateItem('Flooring install labor', null, 'sf', 4.25, 'labor', true),
    ],
    optionalItems: [
      templateItem('Dump fees', 1, 'allowance', 350, 'other'),
      templateItem('Subfloor repairs', 1, 'allowance', 650, 'labor', true),
      templateItem('Transition strips', 1, 'allowance', 185, 'material'),
    ],
    clientFacingNotes: 'Subfloor issues and leveling needs are priced after existing flooring is removed.',
    internalEstimatorNotes: 'Measure waste factor, transitions, furniture moving, and subfloor condition.',
  },
];
