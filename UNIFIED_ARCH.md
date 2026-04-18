# Contractor Pro - Unified Platform Architecture

## Overview
Single contractor management platform with two integrated modules: Estimates and Business Pro (Operations).

## Core Principle
One codebase, one storage, one schema. Estimates and Operations share customers, workers, templates, and business logic.

---

## Shared Schema (Single Source of Truth)

### Core Entities

```typescript
// Customer - shared between Estimates and Jobs
interface Customer {
  id: string;
  name: string;
  company?: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Worker - shared for labor rates and time tracking
interface Worker {
  id: string;
  name: string;
  type: 'employee' | 'subcontractor';
  trade?: string;
  phone?: string;
  email?: string;
  payType: 'hourly' | 'flat';
  hourlyRate?: number;
  flatRate?: number;
  status: 'active' | 'inactive';
  createdAt: string;
}

// Labor Rate - pricing templates
interface LaborRate {
  id: string;
  name: string;
  trade: string;
  hourlyRate: number;
  overtimeRate?: number;
  isActive: boolean;
}

// Assembly - reusable scope items
interface Assembly {
  id: string;
  name: string;
  description?: string;
  category: string;
  laborHours: number;
  laborRateId?: string;
  items: AssemblyItem[];
  createdAt: string;
}

interface AssemblyItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  category: 'material' | 'labor' | 'equipment' | 'other';
}

// Material - pricing catalog
interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  supplier?: string;
  sku?: string;
  isActive: boolean;
}

// Template - estimate/job templates
interface Template {
  id: string;
  name: string;
  type: 'estimate' | 'job';
  scope: string;
  items: TemplateItem[];
  laborAssumptions: string;
  materialAssumptions: string;
  markupPercent: number;
  createdAt: string;
}

interface TemplateItem {
  name: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  category: string;
  isLabor: boolean;
}

// Estimate
interface Estimate {
  id: string;
  estimateNumber: string;
  customerId: string;
  customer?: Customer; // populated
  name: string;
  address: string;
  type: JobType;
  status: EstimateStatus;
  lineItems: EstimateLineItem[];
  laborTotal: number;
  materialTotal: number;
  equipmentTotal: number;
  subtotal: number;
  markupPercent: number;
  markupAmount: number;
  total: number;
  projectedLaborHours: number;
  projectedProfit: number;
  notes?: string;
  validUntil?: string;
  createdAt: string;
  updatedAt: string;
  convertedToJobId?: string;
}

interface EstimateLineItem {
  id: string;
  name: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  category: string;
  isLabor: boolean;
  hours?: number;
  laborRateId?: string;
  total: number;
}

type EstimateStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired';

// Job - from Operations
interface Job {
  id: string;
  name: string;
  customerId: string;
  customer?: Customer;
  address: string;
  type: JobType;
  contractAmount: number;
  estimatedCost: number;
  actualCost: number;
  startDate: string;
  dueDate: string;
  status: JobStatus;
  notes?: string;
  estimateId?: string; // link to original estimate
  createdAt: string;
  updatedAt: string;
}

// Supporting entities (shared)
interface TimeEntry { /* existing */ }
interface Expense { /* existing */ }
interface Task { /* existing */ }
interface Invoice { /* existing */ }
interface Payment { /* existing */ }
interface ChangeOrder { /* existing */ }
interface Note { /* existing */ }
interface Photo { /* existing */ }
interface Alert { /* existing */ }
```

---

## Module Architecture

```
src/
├── core/                    # Shared business logic
│   ├── schema/              # Type definitions
│   ├── services/           # Business logic layer
│   │   ├── customerService.ts
│   │   ├── estimateService.ts
│   │   ├── jobService.ts
│   │   └── conversionService.ts  # Estimate→Job conversion
│   └── hooks/               # Shared React hooks
├── shared/                  # Shared UI components
│   ├── forms/
│   ├── cards/
│   └── layout/
├── features/
│   ├── estimates/          # Estimates module
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   ├── operations/         # Business Pro module
│   │   ├── components/
│   │   ├── pages/
│   │   └── hooks/
│   └── home/               # Launcher/Command Center
│       └── pages/
└── app/                    # Shell & routing
```

---

## Navigation Structure

```
/                           → Home/Launcher (Command Center)
├── estimates/              → Estimates module
│   ├── /                   → Estimate list
│   ├── /new                → New estimate
│   ├── /:id                → Estimate detail
│   └── /:id/edit           → Edit estimate
├── operations/             → Operations module
│   ├── /                   → Dashboard
│   ├── /jobs               → Jobs list
│   ├── /jobs/:id           → Job detail
│   ├── /workers            → Workers
│   ├── /time-entries       → Time tracking
│   ├── /expenses           → Expenses
│   ├── /tasks              → Tasks
│   ├── /invoices           → Invoices
│   ├── /schedule           → Calendar
│   └── /reports            → Reports
└── settings/               → Settings (future)
```

---

## Estimate-to-Job Conversion Logic

```typescript
function convertEstimateToJob(estimate: Estimate, data: AppData): Job {
  // Customer already exists - link by customerId
  const customer = data.customers.find(c => c.id === estimate.customerId);
  
  // Map estimate fields to job
  const job: Job = {
    id: generateId(),
    name: estimate.name,
    customerId: estimate.customerId,
    customer: customer, // populated
    address: estimate.address,
    type: estimate.type,
    contractAmount: estimate.total,
    estimatedCost: calculateEstimatedCost(estimate),
    actualCost: 0, // will accumulate from time/expenses
    startDate: new Date().toISOString().split('T')[0],
    dueDate: calculateDueDate(estimate), // based on scope
    status: 'scheduled',
    notes: buildJobNotes(estimate),
    estimateId: estimate.id, // link back
    createdAt: now,
    updatedAt: now,
  };

  // Create tasks from estimate line items
  estimate.lineItems
    .filter(item => item.isLabor)
    .forEach(item => {
      data.tasks.push({
        id: generateId(),
        title: item.name,
        description: item.description,
        jobId: job.id,
        priority: 'medium',
        status: 'open',
        createdAt: now,
        updatedAt: now,
      });
    });

  // Update estimate status
  estimate.status = 'approved';
  estimate.convertedToJobId = job.id;

  return job;
}
```

---

## Home/Launcher Screen

**Purpose**: Central command center with clear entry points

**Layout**:
1. **Header**: App title "Contractor Pro" + settings gear
2. **Welcome Section**: Company name, current date
3. **Entry Points** (large cards):
   - 📝 **Estimates** - Create quotes, proposals, convert to jobs
   - 🏗️ **Operations** - Manage active jobs, workers, finances
4. **Quick Summary** (bottom):
   - Recent Estimates (last 5)
   - Active Jobs (last 5)
   - Overdue Tasks count
   - Unpaid Invoices total
5. **Quick Actions**:
   - New Estimate
   - New Job
   - Log Time
   - Add Expense

---

## Insights: Estimate vs Actual Analysis

**Metrics to Track**:
1. **Labor Variance**: (actualHours - estimatedHours) / estimatedHours * 100
2. **Material Variance**: (actualCost - estimatedCost) / estimatedCost * 100
3. **Profit Variance**: (actualProfit - projectedProfit) / projectedProfit * 100
4. **Win Rate**: approved estimates / total sent

**Data Sources**:
- Compare estimate.projectedLaborHours vs sum(timeEntries.hours) per job
- Compare estimate.materialTotal vs sum(expenses) per job
- Compare estimate.projectedProfit vs (contractAmount - actualCost)

---

## Implementation Priority

1. **Phase 1**: Enhance types, add shared services
2. **Phase 2**: Build home/launcher screen
3. **Phase 3**: Rebuild estimates module
4. **Phase 4**: Integrate operations module (mostly existing)
5. **Phase 5**: Add conversion logic
6. **Phase 6**: Add insights comparisons

---

## Technical Notes

- All data in single localStorage key
- Customer is the join - estimate.customerId === job.customerId
- Templates can be used by both modules
- Worker rates used in both estimating and time tracking
- No authentication - single user app
- Future-ready: interfaces support REST API migration