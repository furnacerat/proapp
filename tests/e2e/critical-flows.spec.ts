import { expect, test, type Locator, type Page } from '@playwright/test';

const STORAGE_KEY = 'buildops_pro_data';

const today = '2026-05-15';

const baseData = () => ({
  branding: { brandName: "Allen's Contractor's" },
  customers: [
    {
      id: 'customer-e2e',
      name: 'E2E Customer',
      company: 'E2E Homes',
      email: 'customer@example.com',
      phone: '555-0101',
      address: '100 Test Lane',
      createdAt: '2026-05-01T12:00:00.000Z',
      updatedAt: '2026-05-01T12:00:00.000Z',
    },
  ],
  workers: [],
  laborRates: [],
  materials: [],
  suppliers: [],
  assemblies: [],
  templates: [],
  projectTypeTemplates: [],
  estimateTemplates: [],
  estimates: [],
  jobTemplates: [],
  jobs: [],
  timeEntries: [],
  expenses: [],
  companyExpenses: [],
  tasks: [],
  invoices: [],
  payments: [],
  notes: [],
  photos: [],
  changeOrders: [],
  portalTokens: [],
  signatureRequests: [],
  dailyCommandProgress: { streak: 0, completedActionsByDate: {} },
  alerts: [],
  timeline: [],
  jobLogs: [],
  punchLists: [],
  jobIssues: [],
  fileAttachments: [],
  materialOrders: [],
  shoppingLists: [],
  receipts: [],
  allowances: [],
});

const jobFixture = {
  id: 'job-e2e',
  name: 'E2E Seed Job',
  customerId: 'customer-e2e',
  customer: 'E2E Customer',
  customerPhone: '555-0101',
  customerEmail: 'customer@example.com',
  address: '100 Test Lane',
  type: 'remodel',
  contractAmount: 12500,
  estimatedCost: 8000,
  actualCost: 0,
  startDate: today,
  dueDate: '2026-06-01',
  status: 'active',
  createdAt: '2026-05-01T12:00:00.000Z',
  updatedAt: '2026-05-01T12:00:00.000Z',
};

const approvedEstimateFixture = {
  id: 'estimate-e2e-approved',
  estimateNumber: 'EST-2026-900',
  customerId: 'customer-e2e',
  name: 'E2E Approved Estimate',
  address: '100 Test Lane',
  status: 'approved',
  type: 'remodel',
  sections: [],
  laborTotal: 0,
  materialTotal: 0,
  equipmentTotal: 0,
  subcontractorTotal: 0,
  subtotal: 10000,
  markupPercent: 20,
  markupAmount: 2000,
  total: 12000,
  projectedLaborHours: 0,
  projectedMaterialCost: 0,
  projectedLaborCost: 0,
  marginAmount: 0,
  marginPercent: 0,
  taxable: 'none',
  createdAt: '2026-05-01T12:00:00.000Z',
  updatedAt: '2026-05-01T12:00:00.000Z',
};

async function seedWorkspace(page: Page, data = baseData()) {
  await page.addInitScript(({ storageKey, workspace }) => {
    window.localStorage.clear();
    window.localStorage.setItem(storageKey, JSON.stringify(workspace));
  }, { storageKey: STORAGE_KEY, workspace: data });
}

function modal(page: Page) {
  return page.locator('.modal').last();
}

function inputFor(container: Locator, label: string) {
  return container.locator('.form-group', { hasText: label }).locator('input, textarea').first();
}

function selectFor(container: Locator, label: string) {
  return container.locator('.form-group', { hasText: label }).locator('select').first();
}

test.describe('critical business flows', () => {
  test('creates a job from the jobs command center', async ({ page }) => {
    await seedWorkspace(page);
    await page.goto('/jobs');

    await page.getByRole('button', { name: /add new job/i }).first().click();
    const dialog = modal(page);
    await inputFor(dialog, 'Job Name').fill('E2E Kitchen Remodel');
    await inputFor(dialog, 'Customer').fill('E2E Customer');
    await inputFor(dialog, 'Address').fill('42 Cypress Street');
    await inputFor(dialog, 'Contract Amount').fill('15000');
    await inputFor(dialog, 'Estimated Cost').fill('9000');
    await inputFor(dialog, 'Start Date').fill(today);
    await selectFor(dialog, 'Status').selectOption('active');
    await dialog.getByRole('button', { name: /^Create Job$/ }).click();

    await expect(page.getByText('Job created')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'E2E Kitchen Remodel' }).first()).toBeVisible();
    await expect(page.getByText('42 Cypress Street')).toBeVisible();
  });

  test('creates an estimate through the estimates list', async ({ page }) => {
    await seedWorkspace(page);
    await page.goto('/estimates/list');

    await page.getByRole('button', { name: /new estimate|create estimate/i }).first().click();
    const dialog = modal(page);
    await inputFor(dialog, 'Estimate Name').fill('E2E Bath Estimate');
    await selectFor(dialog, 'Customer').selectOption({ label: 'E2E Customer' });
    await selectFor(dialog, 'Project Type').selectOption('remodel');
    await dialog.getByRole('button', { name: /^Create Estimate$/ }).click();

    await expect(page.getByText('Estimate created')).toBeVisible();
    await expect(page).toHaveURL(/\/estimates\/.+/);
    await expect(page.locator('input.eb-nameInput')).toHaveValue('E2E Bath Estimate');
  });

  test('converts an approved estimate into a job', async ({ page }) => {
    const data = baseData();
    data.estimates = [approvedEstimateFixture];
    await seedWorkspace(page, data);
    await page.goto('/estimates/list');

    await expect(page.getByRole('article').getByRole('link', { name: 'E2E Approved Estimate' })).toBeVisible();
    await page.getByRole('button', { name: /convert to job/i }).click();

    await expect(page.getByText('Converted to job')).toBeVisible();
    await expect(page).toHaveURL(/\/jobs\/.+/);
    await expect(page.getByRole('heading', { name: 'E2E Approved Estimate' }).first()).toBeVisible();
  });

  test('creates an invoice and records a payment', async ({ page }) => {
    const data = baseData();
    data.jobs = [jobFixture];
    await seedWorkspace(page, data);
    await page.goto('/invoices');

    await page.getByRole('button', { name: /create invoice/i }).click();
    let dialog = modal(page);
    await selectFor(dialog, 'Job').selectOption({ label: 'E2E Seed Job' });
    await inputFor(dialog, 'Invoice #').fill('INV-E2E-001');
    await inputFor(dialog, 'Amount').fill('5000');
    await inputFor(dialog, 'Due Date').fill('2026-06-15');
    await dialog.getByRole('button', { name: /^Create Invoice$/ }).click();

    await expect(page.getByText('Invoice created')).toBeVisible();
    const invoiceRow = page.locator('tr', { hasText: 'INV-E2E-001' });
    await expect(invoiceRow.getByRole('cell', { name: 'INV-E2E-001' })).toBeVisible();
    await expect(invoiceRow.locator('td[data-label="Amount"]')).toContainText('$5,000');
    await invoiceRow.getByRole('button', { name: /record payment/i }).click();
    dialog = modal(page);
    await inputFor(dialog, 'Amount').fill('2500');
    await selectFor(dialog, 'Method').selectOption('check');
    await inputFor(dialog, 'Check / Reference #').fill('CHK-1001');
    await dialog.getByRole('button', { name: /^Record Payment$/ }).click();

    await expect(page.getByText('Payment recorded')).toBeVisible();
    await expect(invoiceRow.locator('td[data-label="Paid"]')).toContainText('$2,500');
    await expect(invoiceRow.locator('td[data-label="Balance"]')).toContainText('$2,500');
    await expect(invoiceRow.getByText('partial')).toBeVisible();
  });
});
