import type { AppData, Job, Worker, TimeEntry, Expense, Task, Invoice, Payment, Note, Photo, ChangeOrder, JobTemplate, Alert, Customer, Estimate, LaborRate, Material, Assembly, Template } from './types';
import { v4 as uuidv4 } from 'uuid';

const now = new Date().toISOString();
const today = new Date().toISOString().split('T')[0];
const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
const twoWeeks = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

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
    { id: uuidv4(), name: 'Wall Frame 8ft', description: 'Standard 2x4 wall with 16" OC spacing', category: 'Framing', laborHours: 2.5, laborRateId: '', items: [{ name: '2x4x8 Stud', quantity: 11, unitPrice: 4.50, category: 'material' }, { name: '2x4x8 Plate', quantity: 3, unitPrice: 4.50, category: 'material' }, { name: 'Nails', quantity: 0.5, unitPrice: 12, category: 'material' }], createdAt: now },
    { id: uuidv4(), name: 'Install Drywall 4x8', description: 'Hang and tape drywall', category: 'Drywall', laborHours: 1.5, items: [{ name: 'Drywall 4x8', quantity: 3, unitPrice: 12, category: 'material' }, { name: 'Joint Compound 5gal', quantity: 0.1, unitPrice: 18, category: 'material' }, { name: 'Paper Tape', quantity: 1, unitPrice: 2.50, category: 'material' }, { name: 'Screws', quantity: 0.5, unitPrice: 15, category: 'material' }], createdAt: now },
    { id: uuidv4(), name: 'Cabinet Install Base', description: 'Install base cabinet with doors', category: 'Carpentry', laborHours: 1.0, items: [{ name: 'Cabinet 24"', quantity: 1, unitPrice: 250, category: 'material' }, { name: 'Screws', quantity: 0.25, unitPrice: 15, category: 'material' }, { name: 'Shims', quantity: 4, unitPrice: 0.50, category: 'material' }], createdAt: now },
    { id: uuidv4(), name: 'Floor Prep', description: 'Subfloor prep for tile or hardwood', category: 'Flooring', laborHours: 2.0, items: [{ name: 'Plywood 3/4"', quantity: 4, unitPrice: 45, category: 'material' }, { name: 'Screws', quantity: 1, unitPrice: 15, category: 'material' }], createdAt: now },
  ],
  templates: [
    { id: uuidv4(), name: 'Kitchen Remodel Basic', type: 'estimate', scope: 'Complete kitchen remodel', laborAssumptions: 'Demo, drywall, electrical, plumbing, cabinets, countertops', materialAssumptions: 'Cabinets, countertops, flooring, fixtures', markupPercent: 20, items: [{ name: 'Demo', description: 'Remove existing cabinets, countertops', quantity: 1, unitPrice: 1500, category: 'Labor', isLabor: true }], createdAt: now },
    { id: uuidv4(), name: 'Bathroom Remodel', type: 'estimate', scope: 'Full bathroom renovation', laborAssumptions: 'Demo, plumbing, electrical, tile, fixtures', materialAssumptions: 'Tile, vanity, fixtures, plumbing', markupPercent: 20, items: [], createdAt: now },
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