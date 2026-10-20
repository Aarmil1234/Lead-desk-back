
import { useEffect, useState } from 'react';
import { Download, LoaderCircle, RefreshCw, Search, PhoneCall } from 'lucide-react';
import { api } from '../lib/api';
import { exportReportCsv, formatReportDate } from '../lib/reportData';

type CallLog = {
  id: string;
  lead_id: string;
  call_outcome: string | null;
  call_datetime: string | null;
  duration_seconds: number | null;
  notes: string | null;
  questions: string | null;
  sales_stage_after: string | null;
  next_action: string | null;
  lead: {
    id: string;
    lead_code: string;
    name: string;
    company: string | null;
    phone: string;
  } | null;
  telecaller: {
    id: string;
    full_name: string;
    role: string;
  } | null;
};

const today = () => new Date().toLocaleDateString('en-CA');

export default function CallLogs() {
  const [items, setItems] = useState<CallLog[]>([]);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today());
  const [outcome, setOutcome] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '25',
      });

      if (search.trim()) params.set('search', search.trim());
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (outcome) params.set('outcome', outcome);

      const result = await api<{
        items: CallLog[];
        pagination: { total: number; totalPages: number };
      }>(`/call-logs?${params.toString()}`);

      setItems(result.items);
      setTotal(result.pagination.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load call logs.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [page, from, to, outcome]);

  function exportCsv() {
    exportReportCsv(
      [
        ['Date and time', 'Lead code', 'Lead', 'Company', 'Phone', 'Logged by', 'Call outcome', 'Stage after call', 'Duration (seconds)', 'Next action', 'Notes'],
        ...items.map(item => [
          item.call_datetime ? new Date(item.call_datetime).toLocaleString('en-IN') : '',
          item.lead?.lead_code || '',
          item.lead?.name || '',
          item.lead?.company || '',
          item.lead?.phone || '',
          item.telecaller?.full_name || '',
          item.call_outcome || '',
          item.sales_stage_after || '',
          String(item.duration_seconds ?? ''),
          item.next_action || '',
          item.notes || '',
        ]),
      ],
      'leaddesk-call-logs.csv'
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">CALL ACTIVITY</div>
          <h1>Call Logs</h1>
          <p>Review recorded calls, conversation notes and follow-up decisions.</p>
        </div>

        <div className="d-flex gap-2">
          <button className="btn btn-outline-secondary" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={15} className="me-2" /> Refresh
          </button>
          <button className="btn btn-primary" onClick={exportCsv} disabled={!items.length}>
            <Download size={15} className="me-2" /> Export CSV
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <section className="surface-card">
        <div className="row g-3 align-items-end">
          <div className="col-xl-4">
            <label className="form-label">Search calls</label>
            <div className="input-group">
              <span className="input-group-text"><Search size={16} /></span>
              <input
                className="form-control"
                placeholder="Lead, phone, company or telecaller"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    void load();
                  }
                }}
              />
            </div>
          </div>

          <div className="col-md-4 col-xl-2">
            <label className="form-label">From</label>
            <input type="date" className="form-control" value={from} max={to} onChange={e => { setFrom(e.target.value); setPage(1); }} />
          </div>

          <div className="col-md-4 col-xl-2">
            <label className="form-label">To</label>
            <input type="date" className="form-control" value={to} min={from || undefined} max={today()} onChange={e => { setTo(e.target.value); setPage(1); }} />
          </div>

          <div className="col-md-4 col-xl-4">
            <label className="form-label">Call outcome</label>
            <select className="form-select" value={outcome} onChange={e => { setOutcome(e.target.value); setPage(1); }}>
              <option value="">All outcomes</option>
              <option>Connected</option>
              <option>Not Received</option>
              <option>Busy</option>
              <option>Switched Off</option>
            </select>
          </div>
        </div>
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <h2>Call history</h2>
            <p>{total} recorded calls</p>
          </div>
        </div>

        {loading ? (
          <div className="loading-panel"><LoaderCircle className="spin" size={22} /> Loading call history...</div>
        ) : items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><PhoneCall size={22} /></div>
            <strong>No call logs found</strong>
            <span>Try another date range or record a call update from a lead.</span>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="table crm-table align-middle report-table">
                <thead>
                  <tr>
                    <th>Date and time</th>
                    <th>Lead</th>
                    <th>Telecaller</th>
                    <th>Outcome</th>
                    <th>Stage</th>
                    <th>Duration</th>
                    <th>Next action</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id}>
                      <td>
                        <strong>{formatReportDate(item.call_datetime)}</strong>
                        <div className="table-sub">
                          {item.call_datetime
                            ? new Date(item.call_datetime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                            : '—'}
                        </div>
                      </td>
                      <td>
                        <strong>{item.lead?.name || 'Lead unavailable'}</strong>
                        <div className="table-sub">{item.lead?.lead_code || ''}</div>
                        <div className="table-sub">{item.lead?.phone || ''}</div>
                      </td>
                      <td>{item.telecaller?.full_name || 'Unknown'}</td>
                      <td>
                        <span className="soft-badge soft-neutral">{item.call_outcome || '—'}</span>
                      </td>
                      <td>{item.sales_stage_after || '—'}</td>
                      <td>
                        {item.duration_seconds == null
                          ? '—'
                          : `${Math.floor(item.duration_seconds / 60)}m ${item.duration_seconds % 60}s`}
                      </td>
                      <td>{item.next_action || '—'}</td>
                      <td className="call-log-notes">{item.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex align-items-center justify-content-between gap-3 mt-3">
              <span className="text-muted small">
                Page {page} of {totalPages}
              </span>
              <div className="d-flex gap-2">
                <button className="btn btn-outline-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(value => value - 1)}>
                  Previous
                </button>
                <button className="btn btn-outline-secondary btn-sm" disabled={page >= totalPages} onClick={() => setPage(value => value + 1)}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
