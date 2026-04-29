import type { Expense, TimeEntry, Worker } from '../data/types';

export function getTimeEntryTotalHours(entry: Partial<TimeEntry>) {
  return Number(entry.totalHours ?? entry.hours ?? 0);
}

export function getTimeEntryOvertimeHours(entry: Partial<TimeEntry>, totalHours = getTimeEntryTotalHours(entry)) {
  if (entry.overtimeHours !== undefined) return Number(entry.overtimeHours) || 0;
  return entry.overtime ? Math.max(totalHours - 8, 0) : 0;
}

export function calculateTimeEntryLaborCost(entry: Partial<TimeEntry>, worker?: Worker) {
  const totalHours = getTimeEntryTotalHours(entry);
  const overtimeHours = getTimeEntryOvertimeHours(entry, totalHours);
  const hourlyRate = Number(entry.hourlyRate ?? worker?.hourlyRate ?? 0);
  const overtimeRate = Number(entry.overtimeRate ?? hourlyRate * 1.5);
  const regularHours = Math.max(totalHours - overtimeHours, 0);
  return regularHours * hourlyRate + overtimeHours * overtimeRate;
}

export function timeEntryCostFields(entry: Partial<TimeEntry>, worker?: Worker) {
  const totalHours = getTimeEntryTotalHours(entry);
  const overtimeHours = getTimeEntryOvertimeHours(entry, totalHours);
  const hourlyRate = Number(entry.hourlyRate ?? worker?.hourlyRate ?? 0);
  const overtimeRate = Number(entry.overtimeRate ?? hourlyRate * 1.5);
  return {
    totalHours,
    hours: Number(entry.hours ?? totalHours),
    overtimeHours,
    hourlyRate,
    overtimeRate,
    laborCost: calculateTimeEntryLaborCost({ ...entry, totalHours, overtimeHours, hourlyRate, overtimeRate }, worker),
  };
}

export function expenseAffectsJobCost(expense: Expense) {
  if (expense.sourceType === 'time_entry' || expense.source === 'time_entry') return false;
  if (expense.expenseType !== 'allowance' && expense.costTreatment !== 'allowance') return true;
  return expense.reimbursable === true || (expense as any).affectsContractorCost === true;
}
