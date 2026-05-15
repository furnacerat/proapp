type SkeletonScreenProps = {
  variant?: 'workspace' | 'auth';
};

const kpiCards = ['kpi-1', 'kpi-2', 'kpi-3', 'kpi-4'];
const tableRows = ['row-1', 'row-2', 'row-3', 'row-4', 'row-5'];
const sideRows = ['side-1', 'side-2', 'side-3'];

export function SkeletonScreen({ variant = 'workspace' }: SkeletonScreenProps) {
  if (variant === 'auth') {
    return (
      <main className="auth-page" aria-busy="true" aria-label="Loading workspace">
        <section className="auth-panel auth-panel-compact skeleton-auth-panel">
          <div className="skeleton-line skeleton-line-eyebrow" />
          <div className="skeleton-line skeleton-line-title" />
          <div className="skeleton-line skeleton-line-copy" />
          <div className="skeleton-button-row">
            <div className="skeleton-button" />
            <div className="skeleton-button skeleton-button-secondary" />
          </div>
        </section>
      </main>
    );
  }

  return (
    <div className="route-skeleton page-content" aria-busy="true" aria-label="Loading page">
      <div className="skeleton-header" aria-hidden="true">
        <div>
          <div className="skeleton-line skeleton-line-eyebrow" />
          <div className="skeleton-line skeleton-line-title" />
          <div className="skeleton-line skeleton-line-copy" />
        </div>
        <div className="skeleton-button" />
      </div>

      <div className="skeleton-kpi-grid" aria-hidden="true">
        {kpiCards.map(card => (
          <div className="skeleton-kpi-card" key={card}>
            <div className="skeleton-line skeleton-line-small" />
            <div className="skeleton-line skeleton-line-metric" />
            <div className="skeleton-line skeleton-line-copy" />
          </div>
        ))}
      </div>

      <div className="skeleton-content-grid" aria-hidden="true">
        <section className="skeleton-panel skeleton-panel-main">
          <div className="skeleton-panel-header">
            <div className="skeleton-line skeleton-line-section" />
            <div className="skeleton-pill" />
          </div>
          <div className="skeleton-table">
            {tableRows.map(row => (
              <div className="skeleton-table-row" key={row}>
                <div className="skeleton-avatar" />
                <div className="skeleton-row-copy">
                  <div className="skeleton-line skeleton-line-row-title" />
                  <div className="skeleton-line skeleton-line-row-copy" />
                </div>
                <div className="skeleton-line skeleton-line-status" />
              </div>
            ))}
          </div>
        </section>

        <aside className="skeleton-panel skeleton-panel-side">
          <div className="skeleton-line skeleton-line-section" />
          {sideRows.map(row => (
            <div className="skeleton-side-row" key={row}>
              <div className="skeleton-line skeleton-line-row-title" />
              <div className="skeleton-line skeleton-line-row-copy" />
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}
