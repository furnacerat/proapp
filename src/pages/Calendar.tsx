import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/formatters';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List as ListIcon } from 'lucide-react';

export function Calendar() {
  const { jobs, tasks, timeEntries, workers } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'month' | 'list'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const startingDay = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();
  
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getJobEvents = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return jobs.filter(j => j.startDate === dateStr || j.dueDate === dateStr);
  };

  const getTaskEvents = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return tasks.filter(t => t.dueDate === dateStr);
  };

  const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = new Date().toISOString().split('T')[0];

  const upcomingJobs = useMemo(() => {
    return jobs
      .filter(j => j.status === 'active' || j.status === 'scheduled' || j.status === 'approved')
      .sort((a, b) => new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime())
      .slice(0, 10);
  }, [jobs]);

  const jobsWithTime = useMemo(() => {
    return timeEntries
      .filter(t => {
        const entryDate = new Date(t.date);
        return entryDate.getMonth() === month && entryDate.getFullYear() === year;
      })
      .reduce((acc, t) => {
        if (!acc[t.date]) acc[t.date] = [];
        acc[t.date].push(t);
        return acc;
      }, {} as Record<string, typeof timeEntries>);
  }, [timeEntries, month, year]);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Schedule</h1>
        <div className="flex gap-2">
          <div className="btn-group flex">
            <button 
              className={`btn ${view === 'month' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('month')}
              title="Month View"
            >
              <CalendarIcon size={18} />
            </button>
            <button 
              className={`btn ${view === 'list' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setView('list')}
              title="List View"
            >
              <ListIcon size={18} />
            </button>
          </div>
          <button className="btn btn-secondary" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <span className="font-medium" style={{minWidth: '150px', textAlign: 'center'}}>{monthName}</span>
          <button className="btn btn-secondary" onClick={nextMonth}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="page-content">
        {view === 'month' ? (
          <>
            <div className="card">
              <div className="grid-7" style={{background: 'var(--border)'}}>
                {days.map(d => (
                  <div key={d} className="text-center font-medium text-sm" style={{padding: '12px', background: 'var(--bg-primary)'}}>{d}</div>
                ))}
              </div>
              <div className="grid-7" style={{minHeight: '400px'}}>
                {Array(startingDay).fill(null).map((_, i) => (
                  <div key={`empty-${i}`} style={{padding: '8px', borderBottom: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', background: 'var(--bg-primary)'}} />
                ))}
                {Array(daysInMonth).fill(null).map((_, i) => {
                  const day = i + 1;
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === today;
                  const dayJobs = getJobEvents(day);
                  const dayTasks = getTaskEvents(day);
                  const dayTime = jobsWithTime[dateStr] || [];
                  
                  return (
                    <div key={day} style={{padding: '8px', borderBottom: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', minHeight: '100px', background: isToday ? '#eff6ff' : 'white'}}>
                      <div className={`font-medium text-sm ${isToday ? 'text-primary font-bold' : ''}`}>{day}</div>
                      {dayJobs.slice(0, 1).map(j => (
                        <Link key={j.id} to={`/jobs/${j.id}`} className="badge badge-blue" style={{display: 'block', marginTop: '2px', fontSize: '0.65rem', padding: '2px 4px'}}>
                          {j.dueDate === dateStr ? '📅' : '▶'} {j.name.slice(0, 12)}
                        </Link>
                      ))}
                      {dayTasks.slice(0, 1).map(t => (
                        <div key={t.id} className={`badge ${t.status === 'done' ? 'badge-green' : 'badge-yellow'}`} style={{display: 'block', marginTop: '2px', fontSize: '0.65rem', padding: '2px 4px'}}>
                          ✓ {t.title.slice(0, 12)}
                        </div>
                      ))}
                      {dayTime.length > 0 && (
                        <div className="badge badge-purple" style={{display: 'block', marginTop: '2px', fontSize: '0.65rem', padding: '2px 4px'}}>
                          ⏱ {dayTime.length}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card mt-4">
              <div className="card-header">
                <h3 className="card-title">This Month's Schedule</h3>
              </div>
              <div className="card-body">
                <div className="grid-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-primary">{upcomingJobs.length}</div>
                    <div className="text-sm text-muted">Active Jobs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{tasks.filter(t => t.status === 'done' && t.dueDate?.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)).length}</div>
                    <div className="text-sm text-muted">Tasks Done</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-accent">{Object.keys(jobsWithTime).length}</div>
                    <div className="text-sm text-muted">Days with Time</div>
                  </div>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Jobs & Tasks - {monthName}</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {upcomingJobs.map(job => (
                  <div key={job.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${job.status === 'active' ? 'bg-green-500' : job.status === 'scheduled' ? 'bg-blue-500' : 'bg-purple-500'}`} />
                      <div>
                        <Link to={`/jobs/${job.id}`} className="font-medium hover:text-primary">{job.name}</Link>
                        <div className="text-sm text-muted">{job.address}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-sm ${job.dueDate && new Date(job.dueDate) < new Date() ? 'text-red-600 font-medium' : ''}`}>
                        {job.dueDate ? formatDate(job.dueDate) : 'No due date'}
                      </div>
                      <span className={`badge badge-sm ${job.status === 'active' ? 'badge-green' : job.status === 'scheduled' ? 'badge-blue' : 'badge-purple'}`}>
                        {job.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <h4 className="font-medium mt-6 mb-3">Upcoming Tasks</h4>
              <div className="space-y-2">
                {tasks
                  .filter(t => t.status !== 'done' && t.dueDate)
                  .sort((a, b) => new Date(a.dueDate || '9999').getTime() - new Date(b.dueDate || '9999').getTime())
                  .slice(0, 10)
                  .map(task => {
                    const job = jobs.find(j => j.id === task.jobId);
                    const worker = workers.find(w => w.id === task.assignedTo);
                    return (
                      <div key={task.id} className="flex items-center justify-between p-2 bg-white border rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className={`priority-indicator priority-${task.priority}`} />
                          <span className={task.status === 'done' ? 'line-through text-muted' : ''}>{task.title}</span>
                        </div>
                        <div className="text-sm text-muted">
                          {job && <Link to={`/jobs/${job.id}`} className="mr-2">{job.name}</Link>}
                          {worker && <span className="mr-2">{worker.name}</span>}
                          <span>{task.dueDate ? formatDate(task.dueDate) : ''}</span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        <div className="card mt-4">
          <div className="card-header">
            <h3 className="card-title">Legend</h3>
          </div>
          <div className="card-body">
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="badge badge-blue">Job</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-yellow">Task</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-purple">Time Entry</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-green">Completed</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}