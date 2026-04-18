import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { formatDate } from '../utils/formatters';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Calendar() {
  const { jobs, tasks, timeEntries } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());

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

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Schedule</h1>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={prevMonth}><ChevronLeft size={18} /></button>
          <span className="font-medium" style={{minWidth: '150px', textAlign: 'center'}}>{monthName}</span>
          <button className="btn btn-secondary" onClick={nextMonth}><ChevronRight size={18} /></button>
        </div>
      </div>

      <div className="page-content">
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
              
              return (
                <div key={day} style={{padding: '8px', borderBottom: '1px solid var(--border-light)', borderRight: '1px solid var(--border-light)', minHeight: '100px', background: isToday ? 'var(--bg-primary)' : 'white'}}>
                  <div className={`font-medium text-sm ${isToday ? 'text-primary' : ''}`}>{day}</div>
                  {dayJobs.slice(0, 2).map(j => (
                    <Link key={j.id} to={`/jobs/${j.id}`} className="badge badge-blue" style={{display: 'block', marginTop: '4px', fontSize: '0.7rem'}}>
                      {j.dueDate === dateStr ? '📅 ' : '▶ '} {j.name.slice(0, 15)}
                    </Link>
                  ))}
                  {dayTasks.slice(0, 2).map(t => (
                    <div key={t.id} className={`badge ${t.status === 'done' ? 'badge-green' : 'badge-yellow'}`} style={{display: 'block', marginTop: '4px', fontSize: '0.7rem'}}>
                      ✓ {t.title.slice(0, 15)}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        <div className="card mt-4">
          <div className="card-header">
            <h3 className="card-title">Upcoming</h3>
          </div>
          <div className="card-body">
            {jobs.filter(j => j.status === 'active' || j.status === 'scheduled').slice(0, 5).map(j => (
              <div key={j.id} className="list-item">
                <div className="list-item-content">
                  <div className="list-item-title"><Link to={`/jobs/${j.id}`}>{j.name}</Link></div>
                  <div className="list-item-subtitle">{formatDate(j.dueDate)}</div>
                </div>
                <span className="badge badge-blue">{j.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}