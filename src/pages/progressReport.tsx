
import { useEffect, useMemo, useState } from 'react';
import { Download, LoaderCircle, RefreshCw } from 'lucide-react';
import {
  exportReportCsv,
  formatReportDate,
  getReportData,
  isCompleted,
  type TelecallerReport,
} from '../lib/reportData';

export default function ProgressReport() {
  const today = new Date().toLocaleDateString('en-CA');

  const [data, setData] = useState<TelecallerReport[]>([]);
  const [from, setFrom] = useState(today.slice(0, 8) + '01');
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      setData(await getReportData());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load progress report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    if (!from || !to || from > to) return [];

    const start = new Date(`${from}T00:00:00`).getTime();
    const end = new Date(`${to}T23:59:59.999`).getTime();

    return data.map(item => {
      const worked = item.leads.filter(lead => {
        if (!lead.last_contacted_at) return false;

        const date = new Date(lead.last_contacted_at).getTime();

        return date >= start && date <= end;
      });

      const completed = worked.filter(isCompleted).length;
      const pending = worked.length - completed;

      return {
        ...item,
        worked,
        contacted: worked.length,
        completed,
        pending,
        won: worked.filter(lead => lead.sales_stage === 'Won').length,
        lost: worked.filter(lead => lead.sales_stage === 'Lost').length,
        rate: worked.length
          ? Math.round((completed / worked.length) * 100)
          : 0,
      };
    });
  }, [data, from, to]);

  const totals = rows.reduce(
    (sum, row) => ({
      contacted: sum.contacted + row.contacted,
      completed: sum.completed + row.completed,
      pending: sum.pending + row.pending,
      won: sum.won + row.won,
    }),
    { contacted: 0, completed: 0, pending: 0, won: 0 }
  );

  function exportCsv() {
    exportReportCsv(
      [
        ['Telecaller', 'Account Status', 'Leads Contacted', 'Completed Outcomes', 'Pending Outcomes', 'Won', 'Lost', 'Completion Rate'],
        ...rows.map(row => [
          row.telecaller.full_name,
          row.telecaller.is_active ? 'Active' : 'Inactive',
          String(row.contacted),
          String(row.completed),
          String(row.pending),
          String(row.won),
          String(row.lost),
          `${row.rate}%`,
        ]),
      ],
      'progress-report.csv'
    );
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">TEAM PERFORMANCE</div>
          <h1>Progress Report</h1>
          <p>Review telecaller progress over a selected period.</p>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className="me-2" /> Refresh
          </button>
          <button className="btn btn-primary" onClick={exportCsv} disabled={loading}>
            <Download size={15} className="me-2" /> Export CSV
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <section className="surface-card">
        <div className="row g-3 align-items-end">
          <div className="col-md-4">
            <label className="form-label">From date</label>
            <input className="form-control" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="col-md-4">
            <label className="form-label">To date</label>
            <input className="form-control" type="date" value={to} min={from} max={today} onChange={e => setTo(e.target.value)} />
          </div>
          <div className="col-md-4">
            <div className="report-period-note">
              Reporting period: {formatReportDate(from)} – {formatReportDate(to)}
            </div>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="surface-card loading-panel">
          <LoaderCircle className="spin" size={22} /> Loading progress...
        </div>
      ) : (
        <>
          <div className="row g-3">
            {[
              ['Leads contacted', totals.contacted],
              ['Completed outcomes', totals.completed],
              ['Pending outcomes', totals.pending],
              ['Won', totals.won],
            ].map(([label, value]) => (
              <div className="col-6 col-xl-3" key={String(label)}>
                <section className="surface-card report-metric">
                  <div className="report-metric-label">{label}</div>
                  <div className="report-metric-value">{value}</div>
                </section>
              </div>
            ))}
          </div>

          <section className="surface-card">
            <div className="section-heading">
              <div>
                <h2>Telecaller-wise progress</h2>
                <p>Leads with a recorded last-contact date inside the selected period.</p>
              </div>
            </div>

            <div className="table-responsive">
              <table className="table crm-table align-middle report-table">
                <thead>
                  <tr>
                    <th>Telecaller</th>
                    <th>Account</th>
                    <th>Contacted</th>
                    <th>Completed</th>
                    <th>Pending</th>
                    <th>Won</th>
                    <th>Lost</th>
                    <th>Completion rate</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.telecaller.id}>
                      <td><strong>{row.telecaller.full_name}</strong></td>
                      <td>{row.telecaller.is_active ? 'Active' : 'Inactive'}</td>
                      <td>{row.contacted}</td>
                      <td>{row.completed}</td>
                      <td>{row.pending}</td>
                      <td>{row.won}</td>
                      <td>{row.lost}</td>
                      <td>
                        <div className="report-rate">
                          <div className="progress">
                            <div className="progress-bar" style={{ width: `${row.rate}%` }} />
                          </div>
                          <strong>{row.rate}%</strong>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
