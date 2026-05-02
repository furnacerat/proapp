import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { formatCurrency } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../components/common/Toast';
import {
  Plus, Edit, Trash2, Copy, FileText, Search, Filter, Rocket,
  Clock, Sparkles, Layers, BadgeDollarSign, Wand2,
  ChevronRight, PackageCheck,
} from 'lucide-react';
import type { Template, TemplateItem } from '../../data/types';

type TemplateCategory = 'all' | 'bathroom' | 'kitchen' | 'flooring' | 'painting' | 'drywall' | 'remodel' | 'exterior' | 'custom';

const categories: { id: TemplateCategory; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'flooring', label: 'Flooring' },
  { id: 'painting', label: 'Painting' },
  { id: 'drywall', label: 'Drywall' },
  { id: 'remodel', label: 'Remodel' },
  { id: 'exterior', label: 'Exterior' },
  { id: 'custom', label: 'Custom' },
];

const hasTemplateName = (templates: Template[], name: string) =>
  templates.some(template => template.name.trim().toLowerCase() === name.trim().toLowerCase());

const fixed = (name: string, unitPrice: number, category = 'labor', quantity = 1, unit = 'ea'): TemplateItem => ({ name, quantity, unit, unitPrice, category, isLabor: category === 'labor', quantityMode: 'fixed' });
const required = (name: string, unitPrice: number, unit: string, prompt: string, category = 'material'): TemplateItem => ({ name, quantity: null, unit, unitPrice, category, isLabor: category === 'labor', quantityMode: 'user_required', measurementPrompt: prompt });
const calculated = (name: string, unitPrice: number, unit: string, prompt: string, category = 'labor'): TemplateItem => ({ name, quantity: 0, unit, unitPrice, category, isLabor: category === 'labor', quantityMode: 'calculated', measurementPrompt: prompt });
const optional = (name: string, unitPrice: number, unitOrCategory = 'ea', category = 'material'): TemplateItem => {
  const categories = ['material', 'labor', 'equipment', 'subcontractor', 'other', 'allowance'];
  const isCategoryOnly = categories.includes(unitOrCategory) && category === 'material';
  const resolvedCategory = isCategoryOnly ? unitOrCategory : category;
  const unit = isCategoryOnly ? 'ea' : unitOrCategory;
  return { name, quantity: 0, unit, unitPrice, category: resolvedCategory, isLabor: resolvedCategory === 'labor', quantityMode: 'optional', isOptional: true, clientVisible: false };
};

const makeStarter = (name: string, category: TemplateCategory, scope: string, requiredItems: TemplateItem[], optionalItems: TemplateItem[], recommendedAssemblies: string[], prompts: string[], markupPercent = 20): Omit<Template, 'id' | 'createdAt'> => ({
  name,
  category,
  description: `${name} starter scope with editable required and optional line items.`,
  type: 'estimate',
  scope,
  scopeSections: [
    { name: 'Discovery + Protection', phase: 'Planning', description: 'Confirm measurements, selections, site access, and protection needs.' },
    { name: 'Core Scope', phase: 'Build', description: 'Labor and material items that commonly belong in this project type.' },
    { name: 'Finish + Closeout', phase: 'Closeout', description: 'Punch list, cleanup, client walkthrough, and documentation.' },
  ],
  laborAssumptions: requiredItems.filter(item => item.isLabor).map(item => item.name).join(', '),
  materialAssumptions: requiredItems.filter(item => !item.isLabor).map(item => item.name).join(', '),
  markupPercent,
  recommendedAssemblies,
  measurementPrompts: prompts,
  requiredItems,
  optionalItems,
  clientFacingNotes: 'Final pricing may change after field measurements, selections, hidden conditions, and owner-approved scope changes.',
  internalEstimatorNotes: 'Review required quantity badges before sending. Optional items start excluded or at zero so the estimator can decide whether they belong.',
});

const starterTemplates: Omit<Template, 'id' | 'createdAt'>[] = [
  makeStarter('Basic Bathroom Refresh', 'bathroom', 'Cosmetic bathroom update with fixtures, paint, and minor finish work.', [fixed('Site protection + demo setup', 275), fixed('Toilet install', 225), fixed('Vanity faucet install', 180), required('Flooring allowance', 7, 'sf', 'Enter bathroom floor square footage.'), calculated('Baseboard install', 3.5, 'lf', 'Calculate from room perimeter.')], [optional('Towel bar', 65), optional('Mirror replacement', 180), optional('Bath fan replacement', 225, 'labor')], ['Toilet Hookup', 'Faucet Install - Bathroom', 'Paint - Walls'], ['Bathroom floor square footage', 'Room perimeter', 'Fixture count']),
  makeStarter('Full Bathroom Remodel', 'bathroom', 'Full gut or heavy remodel including demo, plumbing, tile, fixtures, and finishes.', [fixed('Bathroom demolition', 1250), fixed('Plumbing rough-in allowance', 1800, 'subcontractor'), fixed('Electrical update allowance', 950, 'subcontractor'), required('Tile floor install', 12, 'sf', 'Enter floor tile square footage.'), required('Shower wall tile', 18, 'sf', 'Enter shower wall square footage.'), fixed('Toilet install', 225), fixed('Vanity install', 450)], [optional('Heated floor mat', 950), optional('Shower niche', 275, 'labor'), optional('Glass shower door', 1200)], ['Room Demolition', 'Toilet Hookup', 'Faucet Install - Bathroom', 'Tile Floor'], ['Floor square footage', 'Shower wall square footage', 'Fixture count']),
  makeStarter('Tub to Shower Conversion', 'bathroom', 'Convert existing tub/shower area into walk-in shower.', [fixed('Tub removal', 650), fixed('Shower valve rough-in', 750, 'subcontractor'), required('Shower pan system', 18, 'sf', 'Enter shower pan footprint.'), required('Shower wall finish', 20, 'sf', 'Enter shower wall square footage.'), fixed('Waterproofing system', 650)], [optional('Glass enclosure', 1450), optional('Grab bars', 95), optional('Bench framing', 425, 'labor')], ['Fixture Demo - Toilet', 'Tile Shower Walls', 'Shower Waterproofing'], ['Shower footprint', 'Shower wall square footage']),
  makeStarter('Tile Shower Remodel', 'bathroom', 'Tile shower rebuild with waterproofing and finish details.', [fixed('Shower demolition', 900), required('Waterproof wall board', 7, 'sf', 'Enter shower wall board square footage.'), required('Tile shower walls', 18, 'sf', 'Enter tile wall square footage.'), required('Shower floor tile', 22, 'sf', 'Enter pan square footage.'), fixed('Grout, sealant, trims', 350)], [optional('Shower niche', 275, 'labor'), optional('Linear drain upgrade', 650), optional('Accent tile band', 18, 'lf')], ['Tile Shower Walls', 'Tile Floor', 'Shower Waterproofing'], ['Wall square footage', 'Pan square footage', 'Linear accent length']),
  makeStarter('Half Bath Remodel', 'bathroom', 'Small powder room remodel with vanity, toilet, floor, paint, and accessories.', [fixed('Half bath demo', 550), fixed('Toilet install', 225), fixed('Pedestal or vanity install', 375), required('Floor finish', 8, 'sf', 'Enter half bath floor square footage.'), required('Wall paint', 1.35, 'sf', 'Enter wall paint square footage.')], [optional('Wallpaper install', 3.5, 'sf'), optional('New mirror', 180), optional('Accessory set', 160)], ['Toilet Hookup', 'Faucet Install - Bathroom', 'Paint - Walls'], ['Floor square footage', 'Paint wall square footage']),
  makeStarter('Luxury Bathroom Remodel', 'bathroom', 'Premium bathroom remodel with custom shower, upgraded fixtures, tile, and finish carpentry.', [fixed('Premium demo + protection', 1850), fixed('Plumbing rework allowance', 3200, 'subcontractor'), required('Large format floor tile', 16, 'sf', 'Enter floor tile square footage.'), required('Custom shower tile', 28, 'sf', 'Enter shower wall square footage.'), fixed('Freestanding tub install', 950), fixed('Double vanity install', 850)], [optional('Heated floors', 1450), optional('Custom glass enclosure', 2200), optional('Built-in linen storage', 1800)], ['Room Demolition', 'Tile Shower Walls', 'Toilet Hookup'], ['Floor square footage', 'Shower wall square footage', 'Vanity width']),

  makeStarter('Basic Kitchen Refresh', 'kitchen', 'Kitchen refresh with paint, hardware, fixtures, and light finish updates.', [fixed('Kitchen protection + prep', 350), fixed('Cabinet hardware swap', 325, 'labor'), fixed('Sink faucet install', 260), required('Wall paint', 1.15, 'sf', 'Enter wall square footage.'), calculated('Baseboard or shoe molding', 3.25, 'lf', 'Calculate from room perimeter.')], [optional('Backsplash refresh', 15, 'sf'), optional('Light fixture swap', 175, 'labor'), optional('Disposal replacement', 225)], ['Faucet Install - Kitchen', 'Paint - Walls', 'Trim Package'], ['Wall paint square footage', 'Room perimeter', 'Backsplash square footage']),
  makeStarter('Full Kitchen Remodel', 'kitchen', 'Full kitchen remodel including demo, cabinets, countertops, plumbing, electrical, and finishes.', [fixed('Kitchen demolition', 2200), required('Cabinet installation', 325, 'lf', 'Enter linear feet of cabinets.', 'labor'), required('Cabinet package allowance', 650, 'lf', 'Enter linear feet of cabinets.'), required('Countertop allowance', 85, 'sf', 'Enter countertop square footage.'), required('Flooring install', 9, 'sf', 'Enter kitchen floor square footage.'), fixed('Plumbing reconnect', 650, 'subcontractor'), fixed('Electrical trim-out', 1250, 'subcontractor')], [optional('Tile backsplash', 18, 'sf'), optional('Under-cabinet lighting', 750, 'subcontractor'), optional('Appliance install package', 850, 'labor')], ['Cabinet Demo', 'Faucet Install - Kitchen', 'Light Fixture'], ['Cabinet linear feet', 'Countertop square footage', 'Floor square footage']),
  makeStarter('Cabinet Replacement', 'kitchen', 'Remove and replace kitchen cabinets with trim and hardware.', [required('Cabinet removal', 65, 'lf', 'Enter linear feet of cabinets to remove.', 'labor'), required('New cabinet package', 650, 'lf', 'Enter linear feet of new cabinets.'), required('Cabinet installation labor', 325, 'lf', 'Enter linear feet of new cabinets.', 'labor'), fixed('Hardware install allowance', 350, 'labor')], [optional('Crown molding', 8, 'lf'), optional('Soft-close upgrade', 18), optional('Paint touch-up', 450, 'labor')], ['Cabinet Demo', 'Cabinet Install - Base'], ['Cabinet linear feet', 'Number of pulls/knobs']),
  makeStarter('Countertop Replacement', 'kitchen', 'Countertop tear-out, templating, installation coordination, sink/faucet reconnect.', [required('Countertop demo', 28, 'lf', 'Enter countertop linear feet.', 'labor'), required('Countertop material allowance', 85, 'sf', 'Enter countertop square footage.'), fixed('Countertop template coordination', 350, 'labor'), fixed('Sink and faucet reconnect', 450, 'subcontractor')], [optional('Undermount sink', 425), optional('Disposal reconnect', 185, 'subcontractor'), optional('Backsplash removal', 450, 'labor')], ['Countertop Demo', 'Faucet Install - Kitchen'], ['Countertop square footage', 'Countertop linear feet']),
  makeStarter('Kitchen Flooring + Paint', 'kitchen', 'Kitchen floor replacement with wall/trim paint.', [required('Flooring demo', 1.5, 'sf', 'Enter floor demo square footage.', 'labor'), required('New flooring install', 8.5, 'sf', 'Enter flooring square footage.'), required('Wall paint', 1.15, 'sf', 'Enter wall square footage.'), calculated('Shoe molding', 3.25, 'lf', 'Calculate from room perimeter.')], [optional('Subfloor patching allowance', 650, 'labor'), optional('Door casing paint', 75, 'ea', 'labor')], ['Flooring Demo - Carpet', 'Paint - Walls', 'Paint - Trim'], ['Floor square footage', 'Wall paint square footage', 'Room perimeter']),
  makeStarter('Luxury Kitchen Remodel', 'kitchen', 'Premium kitchen remodel with custom cabinetry, stone, lighting, and finish upgrades.', [fixed('Premium protection + demo', 3200), required('Custom cabinetry', 950, 'lf', 'Enter cabinet linear feet.'), required('Cabinet install labor', 425, 'lf', 'Enter cabinet linear feet.', 'labor'), required('Premium countertop', 135, 'sf', 'Enter countertop square footage.'), required('Tile or hardwood floor', 16, 'sf', 'Enter floor square footage.'), fixed('Electrical and lighting allowance', 2800, 'subcontractor'), fixed('Plumbing allowance', 1600, 'subcontractor')], [optional('Panel-ready appliance install', 1800, 'labor'), optional('Walk-in pantry build-out', 4500), optional('Custom range hood', 2200)], ['Room Demolition', 'Light Fixture', 'Faucet Install - Kitchen'], ['Cabinet linear feet', 'Countertop square footage', 'Floor square footage']),

  makeStarter('LVP Flooring Install', 'flooring', 'LVP installation with prep, underlayment, transitions, and trim.', [required('LVP flooring material', 4.25, 'sf', 'Enter installed square footage plus waste.'), required('LVP install labor', 3.25, 'sf', 'Enter installed square footage.', 'labor'), calculated('Base shoe install', 2.75, 'lf', 'Calculate from room perimeter.')], [optional('Flooring demo', 1.25, 'sf', 'labor'), optional('Furniture moving', 350, 'labor'), optional('Subfloor leveling', 2.5, 'sf', 'labor')], ['Flooring Demo - Carpet', 'Trim Package'], ['Floor square footage', 'Room perimeter']),
  makeStarter('Tile Flooring Install', 'flooring', 'Tile floor install with prep, setting materials, grout, and transitions.', [required('Tile material allowance', 6.5, 'sf', 'Enter tile square footage plus waste.'), required('Tile install labor', 9, 'sf', 'Enter tile square footage.', 'labor'), required('Mortar and grout', 1.85, 'sf', 'Enter tile square footage.')], [optional('Tile demo', 3.5, 'sf', 'labor'), optional('Uncoupling membrane', 2.25, 'sf'), optional('Heated floor system', 12, 'sf')], ['Flooring Demo - Tile', 'Tile Floor'], ['Tile square footage']),
  makeStarter('Hardwood Install', 'flooring', 'Hardwood flooring installation with underlayment, install, and trim.', [required('Hardwood material', 8.5, 'sf', 'Enter hardwood square footage plus waste.'), required('Hardwood install labor', 5.75, 'sf', 'Enter installed square footage.', 'labor'), calculated('Base shoe install', 2.75, 'lf', 'Calculate from room perimeter.')], [optional('Old flooring demo', 1.5, 'sf', 'labor'), optional('Stair nosing', 85, 'lf'), optional('Floor finish touch-up', 650, 'labor')], ['Flooring Install - Hardwood', 'Trim Package'], ['Floor square footage', 'Room perimeter']),
  makeStarter('Flooring Demo + Replacement', 'flooring', 'Remove existing flooring and install new finish floor.', [required('Existing flooring demolition', 1.75, 'sf', 'Enter demolition square footage.', 'labor'), required('New flooring material', 5.5, 'sf', 'Enter replacement square footage.'), required('New flooring install', 4.25, 'sf', 'Enter replacement square footage.', 'labor')], [optional('Dump fees', 350, 'other'), optional('Transition strips', 38), optional('Subfloor repairs', 650, 'labor')], ['Flooring Demo - Carpet', 'Flooring Demo - Tile'], ['Demo square footage', 'Replacement square footage']),
  makeStarter('Subfloor Repair + Flooring', 'flooring', 'Subfloor patching or replacement before finish flooring.', [required('Subfloor demo', 2.25, 'sf', 'Enter damaged subfloor square footage.', 'labor'), required('Subfloor sheathing', 3.75, 'sf', 'Enter repaired square footage.'), required('Subfloor repair labor', 5.5, 'sf', 'Enter repaired square footage.', 'labor'), required('Finish flooring', 6.5, 'sf', 'Enter finish flooring square footage.')], [optional('Joist sistering', 125, 'ea', 'labor'), optional('Moisture mitigation', 2.75, 'sf')], ['Floor Joist Sistering', 'Flooring Install - Hardwood'], ['Damaged square footage', 'Finish flooring square footage']),

  makeStarter('Interior Room Paint', 'painting', 'Prep and paint walls, ceiling, trim for one room.', [required('Wall paint labor', 1.15, 'sf', 'Enter wall square footage.', 'labor'), required('Paint and supplies', 0.45, 'sf', 'Enter wall square footage.'), required('Ceiling paint', 1.05, 'sf', 'Enter ceiling square footage.', 'labor')], [optional('Trim paint', 2.5, 'lf', 'labor'), optional('Door paint', 85, 'ea', 'labor'), optional('Drywall touch-up', 225, 'labor')], ['Paint - Walls', 'Paint - Ceiling', 'Paint - Trim'], ['Wall square footage', 'Ceiling square footage', 'Trim linear feet']),
  makeStarter('Whole House Interior Paint', 'painting', 'Whole-home interior paint with wall, ceiling, trim, and door options.', [required('Wall paint labor', 0.95, 'sf', 'Enter wall square footage.', 'labor'), required('Paint and supplies', 0.38, 'sf', 'Enter wall square footage.'), required('Ceiling paint labor', 0.85, 'sf', 'Enter ceiling square footage.', 'labor')], [optional('Trim and door painting', 2.25, 'lf', 'labor'), optional('Cabinet painting', 95, 'door', 'labor'), optional('Color change premium', 750, 'labor')], ['Paint - Walls', 'Paint - Ceiling'], ['Wall square footage', 'Ceiling square footage', 'Trim linear feet']),
  makeStarter('Exterior Paint', 'painting', 'Exterior wash, prep, caulk, prime, and paint.', [required('Exterior wash and prep', 0.65, 'sf', 'Enter exterior paintable square footage.', 'labor'), required('Exterior paint labor', 1.25, 'sf', 'Enter exterior paintable square footage.', 'labor'), required('Paint and caulk materials', 0.55, 'sf', 'Enter exterior paintable square footage.')], [optional('Siding repairs', 7.5, 'sf', 'labor'), optional('Shutter painting', 65, 'ea', 'labor'), optional('Deck staining', 3.25, 'sf', 'labor')], ['Paint - Walls'], ['Exterior paintable square footage']),
  makeStarter('Cabinet Painting', 'painting', 'Prep, prime, and paint cabinet doors, drawers, and boxes.', [required('Cabinet door/drawer prep', 55, 'ea', 'Enter door and drawer count.', 'labor'), required('Cabinet box painting', 42, 'lf', 'Enter cabinet linear feet.', 'labor'), fixed('Primer and enamel supplies', 425)], [optional('New hardware install', 6, 'ea', 'labor'), optional('Soft-close hinge install', 18, 'pr')], ['Paint - Cabinetry'], ['Door and drawer count', 'Cabinet linear feet']),
  makeStarter('Trim and Door Painting', 'painting', 'Paint trim, casing, base, and doors.', [calculated('Trim prep and paint', 2.75, 'lf', 'Calculate trim linear footage.'), required('Door painting', 95, 'ea', 'Enter door count.', 'labor'), fixed('Trim paint and supplies', 185)], [optional('Caulk gaps', 1.25, 'lf', 'labor'), optional('Stain-grade conversion premium', 450, 'labor')], ['Paint - Trim'], ['Trim linear feet', 'Door count']),

  makeStarter('Drywall Patch + Repair', 'drywall', 'Patch damaged drywall, tape, finish, texture, and spot prime.', [required('Patch area', 12, 'sf', 'Enter patch square footage.', 'labor'), fixed('Patch materials', 85), fixed('Texture blend allowance', 175, 'labor')], [optional('Paint repaired area', 225, 'labor'), optional('Water damage treatment', 185)], ['Drywall Patch'], ['Patch square footage']),
  makeStarter('Full Room Drywall', 'drywall', 'Hang, tape, finish, and sand drywall for a full room.', [required('Wall drywall', 2.75, 'sf', 'Enter wall square footage.', 'labor'), required('Drywall materials', 0.95, 'sf', 'Enter drywall square footage.'), required('Tape and finish', 1.85, 'sf', 'Enter drywall square footage.', 'labor')], [optional('Ceiling drywall', 3.25, 'sf', 'labor'), optional('Level 5 finish', 1.25, 'sf', 'labor')], ['Drywall - Room Walls', 'Drywall - Room Ceiling'], ['Wall square footage', 'Ceiling square footage']),
  makeStarter('Basement Drywall', 'drywall', 'Basement drywall hang and finish with moisture-aware details.', [required('Basement wall drywall', 2.9, 'sf', 'Enter wall square footage.', 'labor'), required('Moisture-resistant board allowance', 1.15, 'sf', 'Enter wall square footage.'), required('Tape and finish', 1.95, 'sf', 'Enter wall square footage.', 'labor')], [optional('Soffit drywall', 4.25, 'lf', 'labor'), optional('Fire blocking repairs', 450, 'labor')], ['Drywall - Room Walls'], ['Wall square footage', 'Soffit linear feet']),
  makeStarter('Ceiling Repair', 'drywall', 'Repair ceiling drywall damage and blend finish.', [required('Ceiling repair area', 14, 'sf', 'Enter ceiling repair square footage.', 'labor'), fixed('Ceiling patch materials', 95), fixed('Texture match allowance', 225, 'labor')], [optional('Prime and paint ceiling', 1.1, 'sf', 'labor'), optional('Access protection', 150, 'labor')], ['Drywall Patch', 'Paint - Ceiling'], ['Ceiling repair square footage']),
  makeStarter('Texture Removal + Finish', 'drywall', 'Remove existing ceiling or wall texture and refinish surface.', [required('Texture removal', 2.85, 'sf', 'Enter surface square footage.', 'labor'), required('Skim coat finish', 2.1, 'sf', 'Enter surface square footage.', 'labor'), fixed('Dust control and cleanup', 425, 'labor')], [optional('Prime and paint', 1.15, 'sf', 'labor'), optional('Level 5 upgrade', 1.25, 'sf', 'labor')], ['Paint - Ceiling'], ['Surface square footage']),

  makeStarter('Basement Finish', 'remodel', 'Finish basement with framing, electrical, drywall, flooring, paint, and trim.', [required('Basement framing', 18, 'lf', 'Enter wall linear footage.', 'labor'), fixed('Electrical allowance', 3200, 'subcontractor'), required('Drywall walls', 4.25, 'sf', 'Enter drywall square footage.', 'labor'), required('Flooring', 6.5, 'sf', 'Enter floor square footage.'), calculated('Base trim', 4.25, 'lf', 'Calculate from finished room perimeter.')], [optional('Bathroom rough-in', 6500, 'subcontractor'), optional('Wet bar', 8500), optional('Egress window', 4800, 'subcontractor')], ['Partition Wall', 'Drywall - Room Walls', 'Paint - Walls'], ['Wall linear feet', 'Drywall square footage', 'Floor square footage']),
  makeStarter('Room Addition', 'remodel', 'Room addition starter scope from site prep through interior finishes.', [required('Framing allowance', 42, 'sf', 'Enter addition square footage.', 'labor'), required('Roof tie-in allowance', 28, 'sf', 'Enter addition square footage.', 'subcontractor'), required('Electrical allowance', 9, 'sf', 'Enter addition square footage.', 'subcontractor'), required('Drywall and paint', 6.5, 'sf', 'Enter wall/ceiling square footage.', 'labor'), required('Flooring allowance', 7, 'sf', 'Enter floor square footage.')], [optional('HVAC extension', 4500, 'subcontractor'), optional('Window package', 850, 'ea'), optional('Permit allowance', 1200, 'other')], ['Wall Frame - 8ft', 'Window Rough-In', 'Drywall - Room Walls'], ['Addition square footage', 'Wall/ceiling square footage', 'Window count']),
  makeStarter('Whole Home Refresh', 'remodel', 'Whole-home cosmetic refresh for paint, flooring, fixtures, and minor repairs.', [required('Interior paint', 0.95, 'sf', 'Enter paint wall square footage.', 'labor'), required('Flooring replacement', 6.5, 'sf', 'Enter flooring square footage.'), fixed('Fixture refresh allowance', 2500), fixed('Punch repair allowance', 1800, 'labor')], [optional('Cabinet painting', 6500, 'labor'), optional('Drywall repair allowance', 1200, 'labor'), optional('Exterior touch-up', 1850, 'labor')], ['Paint - Walls', 'Flooring Demo - Carpet', 'Trim Package'], ['Wall paint square footage', 'Flooring square footage']),
  makeStarter('Rental Turnover', 'remodel', 'Fast rental turnover with repair, paint, clean, flooring, and fixture allowances.', [fixed('Turnover inspection and punch', 350, 'labor'), required('Paint touch-up', 0.85, 'sf', 'Enter wall paint square footage.', 'labor'), fixed('Cleaning allowance', 450, 'other'), fixed('Fixture repair allowance', 750, 'labor')], [optional('Flooring replacement', 5.5, 'sf'), optional('Appliance swap', 650, 'labor'), optional('Lockset replacement', 85)], ['Paint - Walls', 'Drywall Patch'], ['Wall paint square footage', 'Flooring square footage']),
  makeStarter('House Flip Make Ready', 'remodel', 'Make-ready scope for investment flip with high-risk missed-scope reminders.', [fixed('Full property demo allowance', 4500, 'labor'), required('Interior paint', 0.95, 'sf', 'Enter wall paint square footage.', 'labor'), required('Flooring package', 5.85, 'sf', 'Enter flooring square footage.'), fixed('Kitchen/bath fixture allowance', 8500), fixed('Electrical/plumbing repair allowance', 6500, 'subcontractor')], [optional('Roof repair allowance', 4500, 'subcontractor'), optional('HVAC allowance', 6500, 'subcontractor'), optional('Exterior curb appeal', 2800, 'labor')], ['Room Demolition', 'Paint - Walls', 'Flooring Demo - Carpet'], ['Wall paint square footage', 'Flooring square footage', 'Fixture counts']),

  makeStarter('Deck Repair', 'exterior', 'Repair existing deck boards, rails, stairs, hardware, and finish.', [required('Deck board replacement', 18, 'sf', 'Enter deck surface repair square footage.', 'labor'), fixed('Hardware and fasteners', 185), calculated('Railing repair', 32, 'lf', 'Enter railing linear feet needing repair.', 'labor')], [optional('Stain deck', 3.25, 'sf', 'labor'), optional('Stair repair', 450, 'labor'), optional('Footing repair', 650, 'labor')], ['Trim Package'], ['Deck surface square footage', 'Railing linear feet']),
  makeStarter('New Deck Build', 'exterior', 'New deck build with framing, decking, railings, stairs, and hardware.', [required('Deck framing', 28, 'sf', 'Enter deck square footage.', 'labor'), required('Decking material', 16, 'sf', 'Enter deck square footage.'), calculated('Railing system', 58, 'lf', 'Enter railing linear feet.'), fixed('Stair allowance', 1800, 'labor')], [optional('Composite upgrade', 18, 'sf'), optional('Privacy screen', 95, 'lf'), optional('Deck lighting', 1200, 'subcontractor')], ['Wall Frame - 8ft'], ['Deck square footage', 'Railing linear feet', 'Stair count']),
  makeStarter('Fence Install', 'exterior', 'Fence install with posts, panels/pickets, gates, and hardware.', [required('Fence install labor', 24, 'lf', 'Enter fence linear footage.', 'labor'), required('Fence material', 32, 'lf', 'Enter fence linear footage.'), fixed('Gate allowance', 450)], [optional('Old fence removal', 7.5, 'lf', 'labor'), optional('Permit/utility locate allowance', 250, 'other'), optional('Stain fence', 3.25, 'sf', 'labor')], ['Post Setting'], ['Fence linear feet', 'Gate count']),
  makeStarter('Siding Repair', 'exterior', 'Repair damaged siding, trim, flashing, and paint touch-up.', [required('Siding repair area', 12, 'sf', 'Enter damaged siding square footage.', 'labor'), fixed('Siding material allowance', 450), fixed('Caulk/flashing allowance', 185)], [optional('Paint repaired area', 350, 'labor'), optional('House wrap patch', 225), optional('Trim replacement', 8.5, 'lf')], ['Paint - Walls'], ['Siding square footage', 'Trim linear feet']),
  makeStarter('Gutter Replacement', 'exterior', 'Replace gutters, downspouts, hangers, and disposal.', [calculated('Gutter replacement', 12, 'lf', 'Enter gutter linear feet.', 'subcontractor'), fixed('Downspout allowance', 85, 'material', 4), fixed('Removal and disposal', 350, 'labor')], [optional('Gutter guards', 8.5, 'lf'), optional('Fascia repair', 14, 'lf', 'labor'), optional('Underground drain tie-in', 650, 'subcontractor')], ['Gutter Install'], ['Gutter linear feet', 'Downspout count']),
];

function inferCategory(template: Template): TemplateCategory {
  const text = `${template.name} ${template.scope || ''}`.toLowerCase();
  if (template.category && categories.some(category => category.id === template.category)) return template.category as TemplateCategory;
  if (text.includes('kitchen')) return 'kitchen';
  if (text.includes('bath')) return 'bathroom';
  if (text.includes('floor')) return 'flooring';
  if (text.includes('paint')) return 'painting';
  if (text.includes('drywall') || text.includes('ceiling')) return 'drywall';
  if (text.includes('deck') || text.includes('fence') || text.includes('siding') || text.includes('gutter') || text.includes('roof')) return 'exterior';
  if (text.includes('remodel') || text.includes('rehab') || text.includes('basement') || text.includes('addition') || text.includes('turnover') || text.includes('flip')) return 'remodel';
  return 'custom';
}

function templateItems(template: Template, assemblyNames: string[] = []) {
  const allItems = [...(template.requiredItems || []), ...(template.items || []), ...(template.optionalItems || [])];
  const explicitItems = allItems.map(item => item.name).filter(Boolean) || [];
  const assumptions = [
    ...assemblyNames,
    ...(template.scopeSections || []).map(section => section.name),
    template.scope,
    template.laborAssumptions ? `Labor: ${template.laborAssumptions}` : '',
    template.materialAssumptions ? `Materials: ${template.materialAssumptions}` : '',
  ].filter(Boolean) as string[];
  return explicitItems.length > 0 ? explicitItems : assumptions;
}

function estimateTemplateValue(template: Template) {
  const allItems = [...(template.requiredItems || []), ...(template.items || []), ...(template.optionalItems || [])];
  const itemTotal = allItems.reduce((sum, item) => sum + (item.quantity || item.defaultQuantity || 0) * (item.unitPrice || 0), 0);
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
    let added = 0;
    starterTemplates.forEach(template => {
      if (!hasTemplateName(templates, template.name)) {
        addTemplate(template);
        added += 1;
      }
    });
    showToast(added ? `Added ${added} starter templates` : 'Starter templates are already installed', added ? 'success' : 'info');
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
              <button className="templates-secondary-btn" onClick={handleAddStarter}><PackageCheck size={18} /> Add Starter Templates</button>
            </div>
          </section>
        ) : (
          <main className="templates-workspace">
            <section className="templates-main">
              <div className="templates-insights">
                <div>
                  <span><Wand2 size={16} /> Smart Suggestions</span>
                  <strong>{mostUsedTemplate ? `Start with ${mostUsedTemplate.name}` : 'Create your first template'}</strong>
                  <p>{mostUsedTemplate ? 'This template has the strongest reuse profile for fast estimate starts.' : 'Save a reusable scope, labor assumptions, and materials to speed up future estimates.'}</p>
                </div>
                <button onClick={() => mostUsedTemplate ? handleUseTemplate(mostUsedTemplate) : setShowModal(true)}>
                  {mostUsedTemplate ? 'Use Suggested' : 'New Template'} <ChevronRight size={16} />
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
