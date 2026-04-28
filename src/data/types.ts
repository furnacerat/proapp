export type JobStatus = 'lead' | 'estimate_sent' | 'approved' | 'scheduled' | 'active' | 'awaiting_materials' | 'awaiting_payment' | 'completed' | 'closed';
export type JobType = 'flip' | 'remodel' | 'new_build' | 'addition' | 'repair' | 'other';
export type WorkerType = 'employee' | 'subcontractor';
export type WorkerStatus = 'active' | 'inactive';
export type PayType = 'hourly' | 'flat';
export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';
export type TaskType = 'task' | 'order' | 'inspection' | 'client_action' | 'follow_up' | 'admin';
export type TaskAssignmentRole = 'worker' | 'owner' | 'office';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ExpenseCategory = 'materials' | 'permits' | 'dump_fees' | 'fuel' | 'rental' | 'subcontractor' | 'equipment' | 'misc';
export type ExpenseSource = 'manual' | 'shopping_list' | 'order' | 'time_entry' | 'allowance' | 'receipt';
export type ExpenseType = 'material' | 'labor' | 'equipment' | 'permit' | 'fuel' | 'rental' | 'subcontractor' | 'allowance';
export type ExpenseCostTreatment = 'contractor_cost' | 'allowance' | 'reimbursable';
export type ExpenseSourceType = 'manual' | 'shopping_list' | 'material_order' | 'time_entry' | 'allowance' | 'receipt';
export type PaymentSource = 'company_card' | 'cash' | 'check' | 'finance' | 'credit' | 'other';
export type InvoiceType = 'deposit' | 'progress' | 'final' | 'change_order';
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'partial' | 'overdue';
export type PaymentMethod = 'cash' | 'check' | 'ach' | 'card' | 'other';
export type ChangeOrderStatus = 'pending' | 'approved' | 'rejected';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertType = 'task_overdue' | 'job_overdue' | 'invoice_overdue' | 'budget_warning' | 'payment_due';
export type EstimateStatus = 'draft' | 'in_review' | 'sent' | 'viewed' | 'approved' | 'rejected' | 'expired' | 'archived' | 'converted';

// ============ SHARED ENTITIES ============

export interface Customer {
  id: string;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Worker {
  id: string;
  name: string;
  type: WorkerType;
  trade?: string;
  phone?: string;
  email?: string;
  address?: string;
  payType: PayType;
  hourlyRate?: number;
  flatRate?: number;
  status: WorkerStatus;
  notes?: string;
  createdAt: string;
}

export interface LaborRate {
  id: string;
  name: string;
  trade: string;
  hourlyRate: number;
  overtimeRate?: number;
  isActive: boolean;
}

export interface Material {
  id: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  unitPrice: number;
  currentPrice?: number;
  basePrice?: number;
  supplier?: string;
  preferredSupplier?: string;
  sku?: string;
  modelNumber?: string;
  productUrl?: string;
  matchedProductTitle?: string;
  lastUpdated?: string;
  priceSource?: 'manual' | 'serpapi' | 'rainforest' | 'apify' | 'cache' | 'estimated';
  pricingSource?: 'manual' | 'serpapi' | 'rainforest' | 'apify' | 'cache' | 'estimated';
  pricingVerified?: boolean;
  priceEstimateOnly?: boolean;
  matchConfidence?: number;
  matchStatus?: 'unmatched' | 'suggested' | 'confirmed' | 'rejected';
  preferredStoreLocation?: string;
  isActive: boolean;
}

export interface Assembly {
  id: string;
  name: string;
  description?: string;
  category: string;
  laborHours: number;
  laborRateId?: string;
  items: AssemblyItem[];
  createdAt: string;
}

export interface AssemblyItem {
  name: string;
  description?: string;
  quantity: number | null;
  unit: string;
  unitPrice: number;
  category: 'material' | 'labor' | 'equipment' | 'other' | 'allowance';
  linkedMaterialId?: string;
  linkedLaborRateId?: string;
  quantityMode?: LineItemQuantityMode;
  defaultQuantity?: number;
  measurementPrompt?: string;
  isOptional?: boolean;
  clientVisible?: boolean;
  notes?: string;
}

export interface Assembly {
  id: string;
  name: string;
  description?: string;
  category: string;
  unit: string;
  laborHours: number;
  laborRateId?: string;
  items: AssemblyItem[];
  isOptional?: boolean;
  isDefault?: boolean;
  notes?: string;
  markupPercent?: number;
  createdAt: string;
  updatedAt?: string;
}

// ============ ESTIMATE TEMPLATES ============

export interface EstimateTemplateScope {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  sections: EstimateTemplateSection[];
}

export interface EstimateTemplateSection {
  id: string;
  name: string;
  description?: string;
  sortOrder: number;
  items: EstimateTemplateItem[];
}

export interface EstimateTemplateItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category: string;
  isLabor?: boolean;
  hours?: number;
  isOptional?: boolean;
  isAllowance?: boolean;
  isDefaultChecked?: boolean;
  assemblyId?: string;
  linkedMaterialId?: string;
  linkedLaborRateId?: string;
}

export interface EstimateTemplate {
  id: string;
  name: string;
  description?: string;
  category: string;
  projectType: JobType;
  scopes: EstimateTemplateScope[];
  defaultMarkups?: {
    labor: number;
    material: number;
    equipment: number;
  };
  isActive: boolean;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface Template {
  id: string;
  name: string;
  category?: string;
  description?: string;
  type: 'estimate' | 'job';
  scope?: string;
  scopeSections?: TemplateScopeSection[];
  laborAssumptions?: string;
  materialAssumptions?: string;
  markupPercent: number;
  assemblyIds?: string[];
  recommendedAssemblies?: string[];
  measurementPrompts?: string[];
  items?: TemplateItem[];
  requiredItems?: TemplateItem[];
  optionalItems?: TemplateItem[];
  clientFacingNotes?: string;
  internalEstimatorNotes?: string;
  createdAt: string;
}

export interface TemplateScopeSection {
  name: string;
  description?: string;
  phase?: string;
}

export interface TemplateItem {
  name: string;
  description?: string;
  quantity: number | null;
  unit?: string;
  unitPrice: number;
  category: string;
  isLabor: boolean;
  quantityMode?: LineItemQuantityMode;
  defaultQuantity?: number;
  measurementPrompt?: string;
  materialType?: string;
  markupPercent?: number;
  clientVisible?: boolean;
  isOptional?: boolean;
  notes?: string;
}

// ============ ESTIMATE ENTITIES ============

export type EstimateLineCategory = 'labor' | 'material' | 'equipment' | 'subcontractor' | 'other' | 'allowance';
export type LineItemQuantityMode = 'fixed' | 'user_required' | 'calculated' | 'optional';

export interface EstimateLineItem {
  id: string;
  sourceType?: 'manual' | 'priceBook' | 'assembly' | 'template' | 'smartScope';
  sourceId?: string;
  originTemplateId?: string;
  originAssemblyId?: string;
  name: string;
  description?: string;
  quantity: number | null;
  unit: string;
  quantityMode?: LineItemQuantityMode;
  defaultQuantity?: number;
  measurementPrompt?: string;
  unitCost?: number;
  unitPrice: number;
  markupPercent?: number;
  costTotal?: number;
  priceTotal?: number;
  category: EstimateLineCategory;
  type?: 'labor' | 'material' | 'equipment' | 'subcontractor' | 'other';
  isLabor: boolean;
  hours?: number;
  laborRateId?: string;
  materialCost?: number;
  materialType?: string;
  equipmentCost?: number;
  subcontractorCost?: number;
  total: number;
  taxable?: boolean;
  clientVisible?: boolean;
  internalNotes?: string;
  priceBookSnapshot?: {
    unitCost?: number;
    unitPrice?: number;
    name?: string;
    updatedAt?: string;
    pricingSource?: string;
    pricingVerified?: boolean;
    priceEstimateOnly?: boolean;
    productUrl?: string;
  };
  isOptional?: boolean;
  isExcluded?: boolean;
  isAllowance?: boolean;
  notes?: string;
  sortOrder?: number;
  linkedMaterialId?: string;
  linkedLaborRateId?: string;
}

export interface EstimateSection {
  id: string;
  name: string;
  description?: string;
  lineItems: EstimateLineItem[];
  notes?: string;
  sortOrder?: number;
}

export interface EstimateAllowance {
  id: string;
  name: string;
  amount: number;
  description?: string;
  sortOrder?: number;
}

export type TemplateItemCategory = 'labor' | 'material' | 'equipment' | 'subcontractor' | 'allowance' | 'optional' | 'other';

export interface ProjectTypeTemplateItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category: TemplateItemCategory;
  isLabor?: boolean;
  hours?: number;
  isOptional?: boolean;
  isAllowance?: boolean;
  isDefaultChecked?: boolean;
  linkedLaborRateId?: string;
  linkedMaterialId?: string;
}

export interface ProjectTypeTemplateSection {
  id: string;
  name: string;
  description?: string;
  items: ProjectTypeTemplateItem[];
  sortOrder: number;
}

export interface ProjectTypeTemplate {
  id: string;
  name: string;
  projectType: JobType;
  description?: string;
  sections: ProjectTypeTemplateSection[];
  createdAt: string;
}

export interface EstimateExclusion {
  id: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export type EstimateTaxable = 'none' | 'materials' | 'labor' | 'all';

export interface EstimateScope {
  id: string;
  name: string;
  projectType: JobType;
  sections: EstimateSection[];
  subtotal: number;
  isOptional: boolean;
  sortOrder: number;
}

export interface Estimate {
  id: string;
  estimateNumber: string;
  customerId: string;
  name: string;
  address: string;
  status: EstimateStatus;
  type?: JobType;
  scopes?: EstimateScope[];
  sections?: EstimateSection[];
  laborTotal: number;
  materialTotal: number;
  equipmentTotal: number;
  subcontractorTotal: number;
  subtotal: number;
  markupPercent: number;
  markupAmount: number;
  total: number;
  projectedLaborHours: number;
  projectedMaterialCost: number;
  projectedLaborCost: number;
  marginPercent?: number;
  marginAmount?: number;
  notes?: string;
  validUntil?: string;
  exclusions?: EstimateExclusion[];
  allowances?: EstimateAllowance[];
  clientAllowances?: Allowance[];
  taxable: EstimateTaxable;
  createdAt: string;
  updatedAt: string;
  convertedToJobId?: string;
  archivedAt?: string;
}

export interface JobTemplate {
  id: string;
  name: string;
  type: JobType;
  estimatedCost: number;
  tasks: { title: string; description?: string; priority: Priority }[];
  materials: { name: string; category: ExpenseCategory; estimatedCost: number }[];
  createdAt: string;
}

// ============ JOB ENTITIES ============

export interface Job {
  id: string;
  name: string;
  customerId?: string;
  address: string;
  type: JobType;
  contractAmount: number;
  estimatedCost: number;
  actualCost: number;
  startDate: string;
  dueDate: string;
  status: JobStatus;
  notes?: string;
  estimateId?: string;
  customer?: string;
  customerPhone?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimeEntry {
  id: string;
  jobId: string;
  workerId: string;
  taskId?: string;
  date: string;
  startTime: string;
  endTime?: string;
  totalHours: number;
  overtime: boolean;
  laborCost: number;
  notes?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  jobId: string;
  date: string;
  vendor: string;
  amount: number;
  category: ExpenseCategory;
  source?: ExpenseSource;
  sourceType?: ExpenseSourceType;
  sourceId?: string;
  expenseType?: ExpenseType;
  costTreatment?: ExpenseCostTreatment;
  reimbursable?: boolean;
  allowanceId?: string;
  paymentSource?: PaymentSource;
  notes?: string;
  receipt?: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  dueDate?: string;
  assignedTo?: string;
  assignmentRole?: TaskAssignmentRole;
  taskType?: TaskType;
  sourceType?: 'manual' | 'approved_estimate' | 'order' | 'job_creation';
  sourceId?: string;
  customerId?: string;
  estimateId?: string;
  jobId?: string;
  orderId?: string;
  shoppingListId?: string;
  invoiceId?: string;
  priority: Priority;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId?: string;
  estimateId?: string;
  jobId: string;
  amount: number;
  type: InvoiceType;
  dueDate: string;
  status: InvoiceStatus;
  notes?: string;
  createdAt: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  customerId?: string;
  jobId?: string;
  amount: number;
  date: string;
  method?: PaymentMethod;
  checkNumber?: string;
  notes?: string;
  createdAt: string;
}

export interface Note {
  id: string;
  jobId: string;
  content: string;
  createdAt: string;
}

export interface Photo {
  id: string;
  jobId: string;
  url: string;
  description?: string;
  category: 'progress' | 'before' | 'after' | 'issue' | 'other';
  createdAt: string;
}

export interface ChangeOrder {
  id: string;
  jobId: string;
  description: string;
  amount: number;
  status: ChangeOrderStatus;
  createdAt: string;
  updatedAt: string;
}

// ============ FIELD OPERATION ENTITIES ============

export type TimelineEntryType = 'note' | 'photo' | 'expense' | 'time_entry' | 'issue' | 'update' | 'change_order' | 'invoice' | 'payment';
export type TimelinePhotoCategory = 'progress' | 'before' | 'after' | 'issue' | 'punch_list' | 'other';

export interface JobTimelineEntry {
  id: string;
  jobId: string;
  type: TimelineEntryType;
  title: string;
  description?: string;
  timestamp: string;
  createdBy?: string;
  linkedId?: string;
  photoUrl?: string;
  metadata?: Record<string, any>;
}

export interface JobLog {
  id: string;
  jobId: string;
  date: string;
  workCompleted: string;
  workers: string[];
  issues: string;
  notes: string;
  hoursWorked: number;
  createdAt: string;
}

export type PunchListStatus = 'open' | 'in_progress' | 'done';

export interface PunchListItem {
  id: string;
  jobId: string;
  description: string;
  status: PunchListStatus;
  photoUrl?: string;
  createdAt: string;
  completedAt?: string;
}

export type IssueSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved';

export interface JobIssue {
  id: string;
  jobId: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  status: IssueStatus;
  estimatedCost?: number;
  estimatedHours?: string;
  photoUrl?: string;
  resolution?: string;
  createdAt: string;
  resolvedAt?: string;
}

export interface FileAttachment {
  id: string;
  jobId: string;
  name: string;
  url: string;
  type: string;
  size: number;
  category: string;
  createdAt: string;
}

export type MaterialOrderStatus = 'draft' | 'sent' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';

export interface Supplier {
  id: string;
  name: string;
  category?: string;
  categories?: string[];
  location?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  website?: string;
  leadTimeDays?: number;
  notes?: string;
  isPreferred?: boolean;
  isDefault?: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface MaterialOrderItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category: EstimateLineCategory;
  supplier?: string;
  supplierId?: string;
  orderedQuantity?: number;
  receivedQuantity?: number;
  lineTotal: number;
  allowanceId?: string;
  costTreatment?: 'contractor_cost' | 'allowance_item' | 'client_direct_purchase' | 'reimbursable_allowance';
}

export interface MaterialOrder {
  id: string;
  customerId?: string;
  estimateId?: string;
  jobId?: string;
  supplierId?: string;
  supplierName?: string;
  poNumber: string;
  status: MaterialOrderStatus;
  items: MaterialOrderItem[];
  subtotal: number;
  tax?: number;
  total: number;
  notes?: string;
  sentDate?: string;
  expectedDate?: string;
  receivedDate?: string;
  createdAt: string;
  updatedAt?: string;
}

export type ShoppingListStatus = 'open' | 'shopping' | 'completed' | 'cancelled';
export type ShoppingListItemCategory = 'material' | 'tool' | 'supply' | 'hardware' | 'rental' | 'other';
export type ShoppingListAddOnStatus = 'included_expense' | 'client_add_on' | 'change_order_needed';
export type AllowanceCategory = 'materials' | 'fixtures' | 'cabinets' | 'flooring' | 'lighting' | 'plumbing' | 'appliances' | 'other';
export type AllowanceStatus = 'under' | 'near_limit' | 'over_limit';
export type AllowanceSelectionStatus = 'planned' | 'selected' | 'purchased' | 'installed';

export interface AllowanceSelection {
  id: string;
  allowanceId: string;
  itemName: string;
  vendor?: string;
  quantity?: number;
  unitCost?: number;
  total: number;
  date: string;
  receiptAttachment?: string;
  notes?: string;
  status: AllowanceSelectionStatus;
}

export interface Allowance {
  id: string;
  jobId: string;
  estimateId?: string;
  name: string;
  category: AllowanceCategory;
  allowanceAmount: number;
  usedAmount: number;
  remainingAmount: number;
  status: AllowanceStatus;
  clientResponsible: boolean;
  affectsContractorCost: boolean;
  includeInClientProposal?: boolean;
  notes?: string;
  selections: AllowanceSelection[];
}

export interface ShoppingListItem {
  id: string;
  name: string;
  category: ShoppingListItemCategory;
  quantity: number;
  unit: string;
  estimatedCost?: number;
  actualCost?: number;
  purchased: boolean;
  urgent: boolean;
  notes?: string;
  supplierId?: string;
  supplierName?: string;
  linkedPriceBookItemId?: string;
  linkedEstimateLineItemId?: string;
  addOnStatus?: ShoppingListAddOnStatus;
  allowanceId?: string;
  allowanceHandling?: 'track_only' | 'contractor_paid_reimbursable' | 'client_paid_direct';
}

export interface ShoppingList {
  id: string;
  customerId?: string;
  estimateId?: string;
  jobId: string;
  jobName: string;
  title: string;
  status: ShoppingListStatus;
  createdAt: string;
  completedAt?: string;
  supplierId?: string;
  supplierName?: string;
  store?: string;
  notes?: string;
  items: ShoppingListItem[];
}

export interface Receipt {
  id: string;
  shoppingListId: string;
  expenseId?: string;
  customerId?: string;
  jobId: string;
  vendor: string;
  date: string;
  total: number;
  tax?: number;
  imageUrl?: string;
  notes?: string;
}

// SMTP settings for outbound emails
export interface SmtpSettings {
  host: string;
  port: number;
  user: string;
  password?: string;
  secure: boolean; // true for TLS/SSL
  fromName?: string;
  fromEmail?: string;
  enabled?: boolean;
}

// Branding configuration for emails, invoices, estimates, etc.
export interface BrandingSettings {
  brandName: string;
  emailFromName?: string;
  emailFromAddress?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  logoUrl?: string;
  logoDataUrl?: string;
  termsUrl?: string;
  termsText?: string;
  signature?: string;
  // Default markups (applied to estimates/invoices)
  defaultLaborMarkup?: number;
  defaultMaterialMarkup?: number;
  defaultEquipmentMarkup?: number;
  defaultSubcontractorMarkup?: number;
  // Payment terms
  paymentTerms?: string;
  // Tax rate
  defaultTaxRate?: number;
  // Smart Features (default ON for new users)
  smartFeaturesEnabled?: boolean;
}

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  jobId?: string;
  taskId?: string;
  invoiceId?: string;
  isRead: boolean;
  createdAt: string;
}

// ============ APP DATA ============

export interface AppData {
  customers: Customer[];
  workers: Worker[];
  laborRates: LaborRate[];
  materials: Material[];
  assemblies: Assembly[];
  templates: Template[];
  projectTypeTemplates: ProjectTypeTemplate[];
  estimateTemplates?: EstimateTemplate[];
  estimates: Estimate[];
  jobTemplates: JobTemplate[];
  jobs: Job[];
  timeEntries: TimeEntry[];
  expenses: Expense[];
  tasks: Task[];
  invoices: Invoice[];
  payments: Payment[];
  notes: Note[];
  photos: Photo[];
  changeOrders: ChangeOrder[];
  alerts: Alert[];
  timeline?: JobTimelineEntry[];
  jobLogs?: JobLog[];
  punchLists?: PunchListItem[];
  jobIssues?: JobIssue[];
  fileAttachments?: FileAttachment[];
  suppliers?: Supplier[];
  materialOrders?: MaterialOrder[];
  shoppingLists?: ShoppingList[];
  receipts?: Receipt[];
  allowances?: Allowance[];
}

// ============ CONSTANTS ============

export const JOB_STATUSES: { value: JobStatus; label: string }[] = [
  { value: 'lead', label: 'Lead' },
  { value: 'estimate_sent', label: 'Estimate Sent' },
  { value: 'approved', label: 'Approved' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'active', label: 'Active' },
  { value: 'awaiting_materials', label: 'Awaiting Materials' },
  { value: 'awaiting_payment', label: 'Awaiting Payment' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
];

export const JOB_TYPES: { value: JobType; label: string }[] = [
  { value: 'flip', label: 'House Flip' },
  { value: 'remodel', label: 'Remodel' },
  { value: 'new_build', label: 'New Build' },
  { value: 'addition', label: 'Addition' },
  { value: 'repair', label: 'Repair' },
  { value: 'other', label: 'Other' },
];

export const ESTIMATE_STATUSES: { value: EstimateStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_review', label: 'In Review' },
  { value: 'sent', label: 'Sent' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'expired', label: 'Expired' },
  { value: 'archived', label: 'Archived' },
  { value: 'converted', label: 'Converted' },
];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'materials', label: 'Materials' },
  { value: 'permits', label: 'Permits' },
  { value: 'dump_fees', label: 'Dump Fees' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'rental', label: 'Equipment Rental' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'misc', label: 'Miscellaneous' },
];

export const TASK_STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'done', label: 'Done' },
];

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string }[] = [
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'overdue', label: 'Overdue' },
];

export const INVOICE_TYPES: { value: InvoiceType; label: string }[] = [
  { value: 'deposit', label: 'Deposit' },
  { value: 'progress', label: 'Progress Payment' },
  { value: 'final', label: 'Final Payment' },
  { value: 'change_order', label: 'Change Order' },
];

export const CHANGE_ORDER_STATUSES: { value: ChangeOrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export const TRADES = [
  'Carpentry',
  'Electrical',
  'Plumbing',
  'HVAC',
  'Roofing',
  'Drywall',
  'Painting',
  'Flooring',
  'General',
  'Demolition',
  'Landscaping',
  'Other',
];

export const PHOTO_CATEGORIES = [
  { value: 'progress', label: 'Progress' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'issue', label: 'Issue/Damage' },
  { value: 'other', label: 'Other' },
];
