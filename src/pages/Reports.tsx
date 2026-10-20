
import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  Download,
  LoaderCircle,
  RefreshCw,
  Search,
  Target,
  UsersRound,
  PhoneCall,
  Trophy,
  Clock3,
} from 'lucide-react';
import { api } from '../lib/api';

type Lead = {
  id: string;
  lead_code: string | null;
  name: string;
  company: string | null;
  phone: string | null;
  sales_stage: string | null;
  call_outcome: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type Telecaller = {
  id: string;
  full_name: string;
  is_active: boolean;
};

type TelecallerSummary = {
  telecaller: Telecaller;
  leads: Lead[];
};

type Period = 'all' | '7' | '30' | 'month';

function isTerminal(stage: string | null) {
  return ['Won', 'Lost', 'Not Interested'].includes(stage ?? '');
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map(row =>
    row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')
  ).join('\r\n');

  const blob = new Blob(['\uFEFF' + csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.click();

  URL.revokeObjectURL(url);
}

export default function Reports() {
  const [data, setData] = useState<TelecallerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [period, setPeriod] = useState<Period>('all');

  async function loadReports() {
    setLoading(true);
    setError('');

    try {
      const result = await api<{ items: Telecaller[] }>('/telecallers');

      const summaries = await Promise.all(
        result.items.map(async telecaller => {
          const detail = await api<{ leads: Lead[] }>(
            `/telecallers/${telecaller.id}`
          );

          return {
            telecaller,
            leads: detail.leads ?? [],
          };
        })
      );

      setData(summaries);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Unable to load reports.'
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  const filteredData = useMemo(() => {
    const now = new Date();

    return data.map(item => {
      const leads = item.leads.filter(lead => {
        if (period === 'all') return true;

        const created = new Date(lead.created_at);

        if (Number.isNaN(created.getTime())) return false;

        if (period === 'month') {
          return created.getFullYear() === now.getFullYear() &&
            created.getMonth() === now.getMonth();
        }

        const days = Number(period);
        const start = new Date(now);
        start.setDate(start.getDate() - days + 1);
        start.setHours(0, 0, 0, 0);

        return created >= start && created <= now;
      });

      const contacted = leads.filter(
        lead => Boolean(lead.last_contacted_at)
      ).length;

      const won = leads.filter(
        lead => lead.sales_stage === 'Won'
      ).length;

      const lost = leads.filter(
        lead => lead.sales_stage === 'Lost'
      ).length;

      const interested = leads.filter(
        lead => lead.sales_stage === 'Interested'
      ).length;

      const overdue = leads.filter(lead => {
        if (!lead.next_follow_up_at || isTerminal(lead.sales_stage)) {
          return false;
        }

        return new Date(lead.next_follow_up_at).getTime() < now.getTime();
      }).length;

      const dueToday = leads.filter(lead => {
        if (!lead.next_follow_up_at || isTerminal(lead.sales_stage)) {
          return false;
        }

        const due = new Date(lead.next_follow_up_at);

        return !Number.isNaN(due.getTime()) && isSameDay(due, now);
      }).length;

      return {
        ...item,
        leads,
        assigned: leads.length,
        contacted,
        won,
        lost,
        interested,
        overdue,
        dueToday,
        contactRate: leads.length
          ? Math.round((contacted / leads.length) * 100)
          : 0,
      };
    });
  }, [data, period]);

  const visibleData = filteredData.filter(item =>
    item.telecaller.full_name.toLowerCase().includes(search.toLowerCase())
  );

  
const totals = visibleData.reduce(
  (acc, item) => ({
    assigned: acc.assigned + item.assigned,
    contacted: acc.contacted + item.contacted,
    interested: acc.interested + item.interested,
    won: acc.won + item.won,
    lost: acc.lost + item.lost,
    overdue: acc.overdue + item.overdue,
    dueToday: acc.dueToday + item.dueToday,
  }),
  {
    assigned: 0,
    contacted: 0,
    interested: 0,
    won: 0,
    lost: 0,
    overdue: 0,
    dueToday: 0,
  }
);


  const contactRate = totals.assigned
    ? Math.round((totals.contacted / totals.assigned) * 100)
    : 0;

  function exportReport() {
    const rows = [
      [
        'Telecaller',
        'Account Status',
        'Assigned Leads',
        'Contacted Leads',
        'Contact Rate',
        'Interested',
        'Won',
        'Lost',
        'Overdue Follow-ups',
        'Follow-ups Due Today',
      ],
      ...visibleData.map(item => [
        item.telecaller.full_name,
        item.telecaller.is_active ? 'Active' : 'Inactive',
        String(item.assigned),
        String(item.contacted),
        `${item.contactRate}%`,
        String(item.interested),
        String(item.won),
        String(item.lost),
        String(item.overdue),
        String(item.dueToday),
      ]),
    ];

    downloadCsv(rows, `leaddesk-report-${new Date().toISOString().slice(0, 10)}.csv`);
  }

  return (
    <div className="page-stack reports-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">BUSINESS OVERVIEW</div>
          <h1>Reports</h1>
          <p>Measure lead ownership, follow-up performance and sales progress.</p>
        </div>

        <div className="d-flex gap-2 flex-wrap">
          <button
            className="btn btn-outline-secondary"
            onClick={() => void loadReports()}
            disabled={loading}
          >
            <RefreshCw size={15} className="me-2" />
            Refresh
          </button>

          <button
            className="btn btn-primary"
            onClick={exportReport}
            disabled={loading || visibleData.length === 0}
          >
            <Download size={15} className="me-2" />
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <section className="surface-card report-filters">
        <div className="row g-3 align-items-end">
          <div className="col-12 col-lg-7">
            <label className="form-label">Search telecaller</label>
            <div className="input-group">
              <span className="input-group-text">
                <Search size={16} />
              </span>
              <input
                className="form-control"
                placeholder="Search by telecaller name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-12 col-lg-5">
            <label className="form-label">Lead creation period</label>
            <select
              className="form-select"
              value={period}
              onChange={e => setPeriod(e.target.value as Period)}
            >
              <option value="all">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="month">This month</option>
            </select>
          </div>
        </div>

        <div className="report-period-note">
          <CalendarDays size={14} />
          Period filters use lead creation date, not call date.
        </div>
      </section>

      {loading ? (
        <div className="surface-card loading-panel">
          <LoaderCircle className="spin" size={24} />
          Loading report data...
        </div>
      ) : (
        <>
          <div className="row g-3">
            <div className="col-6 col-xl-3">
              <div className="surface-card report-metric">
                <div className="report-metric-icon blue">
                  <UsersRound size={19} />
                </div>
                <div className="report-metric-label">Assigned leads</div>
                <div className="report-metric-value">{totals.assigned}</div>
                <div className="report-metric-foot">In selected period</div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="surface-card report-metric">
                <div className="report-metric-icon purple">
                  <PhoneCall size={19} />
                </div>
                <div className="report-metric-label">Contacted leads</div>
                <div className="report-metric-value">{totals.contacted}</div>
                <div className="report-metric-foot">{contactRate}% contact rate</div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="surface-card report-metric">
                <div className="report-metric-icon green">
                  <Trophy size={19} />
                </div>
                <div className="report-metric-label">Won leads</div>
                <div className="report-metric-value">{totals.won}</div>
                <div className="report-metric-foot">Current Won stage</div>
              </div>
            </div>

            <div className="col-6 col-xl-3">
              <div className="surface-card report-metric">
                <div className="report-metric-icon amber">
                  <Clock3 size={19} />
                </div>
                <div className="report-metric-label">Overdue follow-ups</div>
                <div className="report-metric-value">{totals.overdue}</div>
                <div className="report-metric-foot">
                  {totals.dueToday} due today
                </div>
              </div>
            </div>
          </div>

          <section className="surface-card">
            <div className="section-heading">
              <div>
                <h2>
                  <BarChart3 size={19} className="me-2" />
                  Telecaller performance
                </h2>
                <p>
                  {visibleData.length} telecallers · grouped by current assignment
                </p>
              </div>
            </div>

            {visibleData.length === 0 ? (
              <div className="empty-state">
                <Target size={27} />
                <strong>No matching telecallers</strong>
                <span>Try a different search term or date period.</span>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table crm-table align-middle report-table">
                  <thead>
                    <tr>
                      <th>Telecaller</th>
                      <th>Status</th>
                      <th>Assigned</th>
                      <th>Contacted</th>
                      <th>Contact rate</th>
                      <th>Interested</th>
                      <th>Won</th>
                      <th>Lost</th>
                      <th>Overdue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleData.map(item => (
                      <tr key={item.telecaller.id}>
                        <td>
                          <div className="report-person">
                            <div className="mini-avatar">
                              {item.telecaller.full_name.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <strong>{item.telecaller.full_name}</strong>
                              <div className="table-sub">Telecaller</div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <span className={`soft-badge ${
                            item.telecaller.is_active ? 'soft-green' : 'soft-red'
                          }`}>
                            {item.telecaller.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        <td>{item.assigned}</td>
                        <td>{item.contacted}</td>
                        <td>
                          <div className="report-rate">
                            <div className="progress">
                              <div
                                className="progress-bar"
                                style={{ width: `${item.contactRate}%` }}
                              />
                            </div>
                            <strong>{item.contactRate}%</strong>
                          </div>
                        </td>
                        <td>{item.interested}</td>
                        <td><span className="report-won">{item.won}</span></td>
                        <td>{item.lost}</td>
                        <td>
                          <span className={item.overdue ? 'report-overdue' : ''}>
                            {item.overdue}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="surface-card">
            <div className="section-heading">
              <div>
                <h2>Pipeline summary</h2>
                <p>Current lead stages for the selected lead creation period.</p>
              </div>
            </div>

            <div className="row g-3">
              {[
                {
                  label: 'New',
                  count: visibleData.reduce((sum, item) =>
                    sum + item.leads.filter(lead => lead.sales_stage === 'New').length, 0),
                },
                {
                  label: 'Follow-up',
                  count: visibleData.reduce((sum, item) =>
                    sum + item.leads.filter(lead => lead.sales_stage === 'Follow-up').length, 0),
                },
                {
                  label: 'Interested',
                  count: totals.interested,
                },
                {
                  label: 'Won',
                  count: totals.won,
                },
                {
                  label: 'Lost',
                  count: totals.lost,
                },
              ].map(stage => (
                <div className="col-6 col-md" key={stage.label}>
                  <div className="pipeline-tile">
                    <span>{stage.label}</span>
                    <strong>{stage.count}</strong>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
