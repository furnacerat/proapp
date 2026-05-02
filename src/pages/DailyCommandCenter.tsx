import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useToast } from '../components/common/Toast';
import { OnboardingGuide } from '../components/onboarding/OnboardingGuide';
import { formatCurrency, formatDate } from '../utils/formatters';
import { generateSmartNextActions } from '../utils/insights';
import { expenseAffectsJobCost } from '../utils/timeEntries';
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  CalendarCheck,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Flame,
  PackageCheck,
  Play,
  Receipt,
  ShoppingCart,
  Sparkles,
  TimerReset,
} from 'lucide-react';

type WorkflowStep = 'tasks' | 'jobs' | 'materials' | 'time' | 'invoices';

interface DailyProgressState {
  lastCompletedDate?: string;
  streak: number;
  completedActionsByDate: Record<string, string[]>;
}

const STORAGE_KEY = 'buildops_daily_command_center';

const todayKey = () => new Date().toISOString().split('T')[0];

const defaultProgress: DailyProgressState = {
  streak: 0,
  completedActionsByDate: {},
};

function loadProgress(): DailyProgressState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? { ...defaultProgress, ...JSON.parse(stored) } : defaultProgress;
  } catch {
    return defaultProgress;
  }
}

function getYesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

export function DailyCommandCenter() {
  const {
    jobs,
    tasks,
    invoices,
    payments,
    materialOrders,
    shoppingLists,
    timeEntries,
    expenses,
    estimates,
    allowances,
    updateTask,
    updateInvoice,
  } = useApp();
  const { showToast } = useToast();
  const today = todayKey();
  const [started, setStarted] = useState(false);
  const [activeStep, setActiveStep] = useState<WorkflowStep>('tasks');
  const [progress, setProgress] = useState<DailyProgressState>(() => loadProgress());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  }, [progress]);

  const paidByInvoice = useMemo(() => payments.reduce((acc, payment) => {
    acc[payment.invoiceId] = (acc[payment.invoiceId] || 0) + payment.amount;
    return acc;
  }, {} as Record<string, number>), [payments]);

  const todayTasks = tasks.filter(task => task.dueDate === today && task.status !== 'done');
  const urgentTasks = tasks.filter(task => task.status !== 'done' && (task.priority === 'urgent' || task.priority === 'high'));
  const overdueTasks = tasks.filter(task => task.dueDate && task.dueDate < today && task.status !== 'done');
  const overdueInvoices = invoices.filter(invoice => invoice.status !== 'paid' && invoice.dueDate < today && invoice.amount - (paidByInvoice[invoice.id] || 0) > 0);
  const pendingOrders = materialOrders.filter(order => !['received', 'cancelled'].includes(order.status));
  const openShoppingLists = shoppingLists.filter(list => !['completed', 'cancelled'].includes(list.status));
  const activeJobs = jobs.filter(job => ['active', 'scheduled', 'awaiting_materials'].includes(job.status));
  const missingTimeJobs = activeJobs.filter(job => !timeEntries.some(entry => entry.jobId === job.id && entry.date === today));
  const activeJobsNeedingAttention = activeJobs.filter(job => {
    const jobOpenTasks = tasks.some(task => task.jobId === job.id && task.status !== 'done');
    const hasMaterials = materialOrders.some(order => order.jobId === job.id) || shoppingLists.some(list => list.jobId === job.id);
    const dueSoon = job.dueDate <= today;
    return !jobOpenTasks || !hasMaterials || dueSoon;
  });

  const smartActions = useMemo(() => generateSmartNextActions(
    estimates,
    jobs,
    expenses,
    timeEntries,
    invoices,
    payments,
    tasks,
    materialOrders,
    shoppingLists,
    allowances
  ).slice(0, 6), [allowances, estimates, expenses, invoices, jobs, materialOrders, payments, shoppingLists, tasks, timeEntries]);

  const completedActionIds = progress.completedActionsByDate[today] || [];
  const workflow = [
    { id: 'tasks' as const, label: 'Complete tasks', count: todayTasks.length + overdueTasks.length, to: '/tasks' },
    { id: 'jobs' as const, label: 'Review jobs', count: activeJobsNeedingAttention.length, to: '/jobs' },
    { id: 'materials' as const, label: 'Check materials', count: pendingOrders.length + openShoppingLists.length, to: '/estimates/orders' },
    { id: 'time' as const, label: 'Log time', count: missingTimeJobs.length, to: '/time-entries' },
    { id: 'invoices' as const, label: 'Send invoices', count: overdueInvoices.length, to: '/invoices' },
  ];
  const actionTotal = workflow.reduce((sum, step) => sum + Math.max(step.count, 1), 0);
  const completedTasksToday = tasks.filter(task => task.dueDate === today && task.status === 'done').length;
  const dailyCompletion = Math.min(100, Math.round(((completedActionIds.length + completedTasksToday) / Math.max(actionTotal, 1)) * 100));
  const profitInMotion = activeJobs.reduce((sum, job) => {
    const jobExpenses = expenses.filter(expense => expense.jobId === job.id && expenseAffectsJobCost(expense)).reduce((total, expense) => total + expense.amount, 0);
    const labor = timeEntries.filter(entry => entry.jobId === job.id).reduce((total, entry) => total + entry.laborCost, 0);
    return sum + (job.contractAmount - jobExpenses - labor);
  }, 0);

  const markActionDone = (id: string, message: string) => {
    setProgress(prev => {
      const existing = prev.completedActionsByDate[today] || [];
      if (existing.includes(id)) return prev;
      return {
        ...prev,
        completedActionsByDate: {
          ...prev.completedActionsByDate,
          [today]: [...existing, id],
        },
      };
    });
    showToast(message, 'success');
  };

  const completeTask = (taskId: string) => {
    updateTask(taskId, { status: 'done' });
    markActionDone(`task-${taskId}`, 'Task completed');
  };

  const sendInvoice = (invoiceId: string) => {
    updateInvoice(invoiceId, { status: 'sent' });
    markActionDone(`invoice-${invoiceId}`, 'Invoice marked sent');
  };

  const startMyDay = () => {
    setStarted(true);
    setActiveStep('tasks');
    showToast('Daily workflow started');
  };

  const finishDay = () => {
    setProgress(prev => {
      if (prev.lastCompletedDate === today) return prev;
      const nextStreak = prev.lastCompletedDate === getYesterdayKey() ? prev.streak + 1 : 1;
      return { ...prev, lastCompletedDate: today, streak: nextStreak };
    });
    showToast('Daily workflow complete. Nice progress.', 'success');
  };

  const workflowComplete = workflow.every(step => step.count === 0 || completedActionIds.includes(`step-${step.id}`)) || dailyCompletion >= 80;

  return (
    <div className="daily-command-page">
      <section className="daily-hero">
        <div>
          <div className="page-eyebrow">Daily Command Center</div>
          <h1>Run today's work</h1>
          <p>Start the day, clear the important actions, and keep jobs moving toward cash collected.</p>
        </div>
        <div className="daily-hero-actions">
          <button className="btn btn-primary" onClick={startMyDay}><Play size={18} /> Start My Day</button>
          <Link className="btn btn-secondary" to="/dashboard">Operations Dashboard</Link>
        </div>
      </section>

      <OnboardingGuide />

      <section className="daily-progress-card">
        <div className="daily-progress-ring" style={{ '--progress': `${dailyCompletion}%` } as React.CSSProperties}>
          <strong>{dailyCompletion}%</strong>
          <span>complete</span>
        </div>
        <div className="daily-progress-copy">
          <h2>Today's momentum</h2>
          <p>{completedTasksToday} tasks completed today. {completedActionIds.length} command-center actions cleared.</p>
          <div className="daily-progress-bar"><span style={{ width: `${dailyCompletion}%` }} /></div>
        </div>
        <div className="daily-streak">
          <Flame size={22} />
          <strong>{progress.streak}</strong>
          <span>day streak</span>
        </div>
      </section>

      <section className="daily-kpi-grid">
        <div className="daily-kpi"><CheckCircle2 size={20} /><span>Tasks due today</span><strong>{todayTasks.length}</strong></div>
        <div className="daily-kpi warning"><AlertTriangle size={20} /><span>Urgent tasks</span><strong>{urgentTasks.length}</strong></div>
        <div className="daily-kpi danger"><FileText size={20} /><span>Overdue invoices</span><strong>{overdueInvoices.length}</strong></div>
        <div className="daily-kpi"><Briefcase size={20} /><span>Jobs need attention</span><strong>{activeJobsNeedingAttention.length}</strong></div>
        <div className="daily-kpi"><PackageCheck size={20} /><span>Pending orders</span><strong>{pendingOrders.length}</strong></div>
        <div className="daily-kpi warning"><Clock size={20} /><span>Missing time</span><strong>{missingTimeJobs.length}</strong></div>
      </section>

      <section className="daily-workspace">
        <div className="daily-flow-panel">
          <div className="daily-section-heading">
            <h2>Start My Day Flow</h2>
            {workflowComplete && <button className="btn btn-sm btn-primary" onClick={finishDay}>Finish Day</button>}
          </div>
          <div className="daily-flow-list">
            {workflow.map((step, index) => (
              <button key={step.id} className={`daily-flow-step ${activeStep === step.id ? 'active' : ''}`} onClick={() => setActiveStep(step.id)}>
                <b>{index + 1}</b>
                <span>{step.label}</span>
                <strong>{step.count}</strong>
              </button>
            ))}
          </div>
          <div className="daily-active-step">
            {activeStep === 'tasks' && (
              <>
                <h3>Complete Tasks</h3>
                {[...overdueTasks, ...todayTasks, ...urgentTasks].slice(0, 8).map(task => {
                  const job = jobs.find(item => item.id === task.jobId);
                  return (
                    <div className="daily-action-row" key={task.id}>
                      <CheckCircle2 size={18} />
                      <div><strong>{task.title}</strong><span>{job?.name || 'No job'} {task.dueDate ? `- ${formatDate(task.dueDate)}` : ''}</span></div>
                      <button className="btn btn-sm btn-secondary" onClick={() => completeTask(task.id)}>Done</button>
                    </div>
                  );
                })}
                {[...overdueTasks, ...todayTasks, ...urgentTasks].length === 0 && <div className="daily-empty">No urgent task work due right now.</div>}
              </>
            )}
            {activeStep === 'jobs' && (
              <>
                <h3>Review Jobs</h3>
                {activeJobsNeedingAttention.slice(0, 6).map(job => (
                  <div className="daily-action-row" key={job.id}>
                    <Briefcase size={18} />
                    <div><strong>{job.name}</strong><span>{job.status.replace('_', ' ')} - due {formatDate(job.dueDate)}</span></div>
                    <Link className="btn btn-sm btn-secondary" to={`/jobs/${job.id}`}>Open</Link>
                  </div>
                ))}
                {activeJobsNeedingAttention.length === 0 && <div className="daily-empty">Active jobs look covered.</div>}
              </>
            )}
            {activeStep === 'materials' && (
              <>
                <h3>Check Materials and Orders</h3>
                {pendingOrders.slice(0, 5).map(order => (
                  <div className="daily-action-row" key={order.id}>
                    <ShoppingCart size={18} />
                    <div><strong>{order.poNumber}</strong><span>{order.supplierName || 'Supplier needed'} - {formatCurrency(order.total)}</span></div>
                    <Link className="btn btn-sm btn-secondary" to="/estimates/orders">Review</Link>
                  </div>
                ))}
                {openShoppingLists.slice(0, 3).map(list => (
                  <div className="daily-action-row" key={list.id}>
                    <Receipt size={18} />
                    <div><strong>{list.title}</strong><span>{list.items.length} items for {list.jobName}</span></div>
                    <Link className="btn btn-sm btn-secondary" to="/shopping-lists">Open</Link>
                  </div>
                ))}
                {pendingOrders.length + openShoppingLists.length === 0 && <div className="daily-empty">No open material actions.</div>}
              </>
            )}
            {activeStep === 'time' && (
              <>
                <h3>Log Time</h3>
                {missingTimeJobs.slice(0, 7).map(job => (
                  <div className="daily-action-row" key={job.id}>
                    <TimerReset size={18} />
                    <div><strong>{job.name}</strong><span>No labor logged today</span></div>
                    <Link className="btn btn-sm btn-secondary" to="/time-entries">Log Time</Link>
                  </div>
                ))}
                {missingTimeJobs.length === 0 && <div className="daily-empty">Time is logged for active jobs today.</div>}
              </>
            )}
            {activeStep === 'invoices' && (
              <>
                <h3>Send Invoices</h3>
                {overdueInvoices.slice(0, 7).map(invoice => (
                  <div className="daily-action-row" key={invoice.id}>
                    <DollarSign size={18} />
                    <div><strong>{invoice.invoiceNumber}</strong><span>{formatCurrency(invoice.amount - (paidByInvoice[invoice.id] || 0))} overdue</span></div>
                    <button className="btn btn-sm btn-secondary" onClick={() => sendInvoice(invoice.id)}>Mark Sent</button>
                  </div>
                ))}
                {overdueInvoices.length === 0 && <div className="daily-empty">No overdue invoices in today's queue.</div>}
              </>
            )}
            {started && <button className="daily-step-clear" onClick={() => markActionDone(`step-${activeStep}`, `${workflow.find(step => step.id === activeStep)?.label} reviewed`)}>Mark this step reviewed</button>}
          </div>
        </div>

        <aside className="daily-side-panel">
          <div className="daily-section-heading"><h2>Next Best Actions</h2><Sparkles size={18} /></div>
          <div className="daily-smart-list">
            {smartActions.map(action => (
              <Link key={action.id} to={action.to} className={`daily-smart-action ${action.priority}`}>
                <span>{action.priority}</span>
                <div><strong>{action.title}</strong><small>{action.description}</small></div>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
          <div className="daily-momentum-card">
            <h3>Visual Momentum</h3>
            <div><span>Active jobs</span><strong>{activeJobs.length}</strong></div>
            <div><span>Profit in motion</span><strong>{formatCurrency(profitInMotion)}</strong></div>
            <div><span>Labor logged today</span><strong>{timeEntries.filter(entry => entry.date === today).reduce((sum, entry) => sum + entry.totalHours, 0).toFixed(1)}h</strong></div>
          </div>
        </aside>
      </section>
    </div>
  );
}
