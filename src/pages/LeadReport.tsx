
import { useEffect, useMemo, useState } from 'react';
import { Download, LoaderCircle, RefreshCw, Search } from 'lucide-react';
import {
  exportReportCsv,
  getReportData,
  isCompleted,
  type TelecallerReport,
} from '../lib/reportData';

export default function LeadReport() {
  const [data, setData] = useState<TelecallerReport[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      setData(await getReportData());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load lead report.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();

    return data.map(item => {
      const leads = item.leads.filter(lead =>
        !term ||
        lead.name?.toLowerCase().includes(term) ||
        lead.company?.toLowerCase().includes(term) ||
        lead.phone?.toLowerCase().includes(term) ||
        item.telecaller.full_name.toLowerCase().includes(term)
      );

      const completed = leads.filter(isCompleted).length;
      const pending = leads.length - completed;

      return {
        ...item,
        leads,
        assigned: leads.length,
        completed,
        pending,
        newLeads: leads.filter(lead => lead.sales_stage === 'New').length,
        followUps: leads.filter(lead => lead.sales_stage === 'Follow-up').length,
        interested: leads.filter(lead => lead.sales_stage === 'Interested').length,
        won: leads.filter(lead => lead.sales_stage === 'Won').length,
        lost: leads.filter(lead => lead.sales_stage === 'Lost').length,
        notInterested: leads.filter(lead => lead.sales_stage === 'Not Interested').length,
      };
    });
  }, [data, search]);

  const totals = rows.reduce(
    (sum, row) => ({
      assigned: sum.assigned + row.assigned,
      completed: sum.completed + row.completed,
      pending: sum.pending + row.pending,
      won: sum.won + row.won,
      lost: sum.lost + row.lost,
    }),
    { assigned: 0, completed: 0, pending: 0, won: 0, lost: 0 }
  );

  function exportCsv() {
    exportReportCsv(
      [
        ['Telecaller', 'Account Status', 'Assigned Leads', 'Completed', 'Pending', 'New', 'Follow-up', 'Interested', 'Won', 'Lost', 'Not Interested'],
        ...rows.map(row => [
          row.telecaller.full_name,
          row.telecaller.is_active ? 'Active' : 'Inactive',
          String(row.assigned),
          String(row.completed),
          String(row.pending),
          String(row.newLeads),
          String(row.followUps),
          String(row.interested),
          String(row.won),
          String(row.lost),
          String(row.notInterested),
        ]),
      ],
      'lead-report.csv'
    );
  }

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">LEAD DISTRIBUTION</div>
          <h1>Lead Report</h1>
          <p>Track lead ownership and current completion status across your team.</p>
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
        <div className="row g-3">
          {[
            ['Total assigned', totals.assigned],
            ['Completed', totals.completed],
            ['Pending', totals.pending],
            ['Won', totals.won],
          ].map(([label, value]) => (
            <div className="col-6 col-xl-3" key={String(label)}>
              <div className="report-metric">
                <div className="report-metric-label">{label}</div>
                <div className="report-metric-value">{value}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <h2>Lead ownership by telecaller</h2>
            <p>Current status of leads assigned to each telecaller.</p>
          </div>
        </div>

        <div className="input-group mb-4">
          <span className="input-group-text"><Search size={16} /></span>
          <input
            className="form-control"
            placeholder="Search telecaller, lead, company or phone..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading-panel">
            <LoaderCircle className="spin" size={22} /> Loading lead report...
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table crm-table align-middle report-table">
              <thead>
                <tr>
                  <th>Telecaller</th>
                  <th>Account</th>
                  <th>Assigned</th>
                  <th>Completed</th>
                  <th>Pending</th>
                  <th>New</th>
                  <th>Follow-up</th>
                  <th>Interested</th>
                  <th>Won</th>
                  <th>Lost</th>
                  <th>Not interested</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.telecaller.id}>
                    <td><strong>{row.telecaller.full_name}</strong></td>
                    <td>{row.telecaller.is_active ? 'Active' : 'Inactive'}</td>
                    <td>{row.assigned}</td>
                    <td><span className="report-won">{row.completed}</span></td>
                    <td>{row.pending}</td>
                    <td>{row.newLeads}</td>
                    <td>{row.followUps}</td>
                    <td>{row.interested}</td>
                    <td>{row.won}</td>
                    <td>{row.lost}</td>
                    <td>{row.notInterested}</td>
                  </tr>
                ))}

                {!loading && rows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="text-center py-4">
                      No telecallers found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <h2>Lead details</h2>
            <p>See exactly which telecaller owns each matching lead.</p>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table crm-table align-middle">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Company</th>
                <th>Phone</th>
                <th>Assigned to</th>
                <th>Stage</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.flatMap(row =>
                row.leads.map(lead => (
                  <tr key={`${row.telecaller.id}-${lead.id}`}>
                    <td>
                      <strong>{lead.name}</strong>
                      {lead.lead_code && <div className="table-sub">{lead.lead_code}</div>}
                    </td>
                    <td>{lead.company || '—'}</td>
                    <td>{lead.phone || '—'}</td>
                    <td>{row.telecaller.full_name}</td>
                    <td>{lead.sales_stage || 'New'}</td>
                    <td>
                      <span className={`soft-badge ${
                        isCompleted(lead) ? 'soft-green' : 'soft-amber'
                      }`}>
                        {isCompleted(lead) ? 'Completed' : 'Pending'}
                      </span>
                    </td>
                  </tr>
                ))
              )}

              {!loading && rows.every(row => row.leads.length === 0) && (
                <tr>
                  <td colSpan={6} className="text-center py-4">
                    No leads match your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
