
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, LoaderCircle, Search } from 'lucide-react';
import { api } from '../lib/api';

type Lead = {
  id: string;
  lead_code: string | null;
  name: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  sales_stage: string;
  call_outcome: string | null;
  priority: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  created_at: string;
};

type Detail = {
  telecaller: {
    id: string;
    full_name: string;
    is_active: boolean;
  };
  stats: {
    assigned: number;
    contacted: number;
    contactRate: number;
    overdue: number;
    won: number;
    interested: number;
    followUps: number;
    stages: Record<string, number>;
  };
  leads: Lead[];
};

function formatDate(value: string | null) {
  if (!value) return '—';

  return new Date(value).toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export default function TelecallerDetail() {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [search, setSearch] = useState('');
  const [stage, setStage] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;

    async function load() {
      if (!id) {
        setError('Missing telecaller ID.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await api<Detail>(`/telecallers/${id}`);
        if (live) setDetail(result);
      } catch (e) {
        if (live) {
          setError(e instanceof Error ? e.message : 'Unable to load telecaller.');
        }
      } finally {
        if (live) setLoading(false);
      }
    }

    void load();

    return () => {
      live = false;
    };
  }, [id]);

  const leads = (detail?.leads ?? []).filter(lead => {
    const text = `${lead.name} ${lead.company ?? ''} ${lead.phone ?? ''} ${lead.lead_code ?? ''}`;
    return text.toLowerCase().includes(search.toLowerCase()) &&
      (stage === 'all' || lead.sales_stage === stage);
  });

  if (loading) {
    return (
      <div className="loading-panel">
        <LoaderCircle className="spin" size={22} />
        Loading telecaller details...
      </div>
    );
  }

  if (error || !detail) {
    return <div className="alert alert-danger">{error || 'Telecaller not found.'}</div>;
  }

  const { telecaller, stats } = detail;

  return (
    <div className="page-stack">
      <div>
        <Link to="/telecallers" className="btn btn-outline-secondary btn-sm mb-3">
          <ArrowLeft size={15} className="me-2" />
          All telecallers
        </Link>

        <div className="page-heading">
          <div>
            <div className="eyebrow">TELECALLER PERFORMANCE</div>
            <h1>{telecaller.full_name}</h1>
            <p>Assigned leads, contact progress and sales pipeline.</p>
          </div>
          <span className={`soft-badge ${telecaller.is_active ? 'soft-green' : 'soft-red'}`}>
            {telecaller.is_active ? 'Active' : 'Inactive'}
          </span>
        </div>
      </div>

      <div className="row g-3">
        {[
          ['Assigned leads', stats.assigned],
          ['Contacted', stats.contacted],
          ['Contact rate', `${stats.contactRate}%`],
          ['Overdue', stats.overdue],
          ['Interested', stats.interested],
          ['Won', stats.won],
        ].map(([label, value]) => (
          <div className="col-6 col-md-4 col-xl-2" key={String(label)}>
            <div className="surface-card h-100">
              <div className="text-muted small">{label}</div>
              <h2 className="mt-2 mb-0">{value}</h2>
            </div>
          </div>
        ))}
      </div>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <h2>Sales pipeline</h2>
            <p>Current stage of assigned leads.</p>
          </div>
        </div>

        <div className="row g-3">
          {Object.entries(stats.stages).map(([name, count]) => (
            <div className="col-6 col-md-4 col-xl-3" key={name}>
              <div className="pipeline-tile">
                <span>{name}</span>
                <strong>{count}</strong>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="surface-card">
        <div className="section-heading">
          <div>
            <h2>Assigned leads</h2>
            <p>{leads.length} leads match your filters.</p>
          </div>
        </div>

        <div className="row g-3 mb-3">
          <div className="col-lg-7">
            <div className="input-group">
              <span className="input-group-text"><Search size={16} /></span>
              <input
                className="form-control"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, company or phone..."
              />
            </div>
          </div>

          <div className="col-lg-5">
            <select
              className="form-select"
              value={stage}
              onChange={e => setStage(e.target.value)}
            >
              <option value="all">All stages</option>
              {Object.keys(stats.stages).map(name => (
                <option value={name} key={name}>{name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table crm-table align-middle">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Stage</th>
                <th>Last contact</th>
                <th>Outcome</th>
                <th>Next follow-up</th>
                <th>Priority</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id}>
                  <td>
                    <Link className="lead-link" to={`/leads/${lead.id}`}>
                      {lead.company || lead.name}
                    </Link>
                    <div className="table-sub">{lead.name}</div>
                    <div className="table-sub">{lead.phone || 'No phone'}</div>
                  </td>
                  <td><span className="soft-badge soft-neutral">{lead.sales_stage}</span></td>
                  <td>{formatDate(lead.last_contacted_at)}</td>
                  <td>{lead.call_outcome || '—'}</td>
                  <td>{formatDate(lead.next_follow_up_at)}</td>
                  <td>{lead.priority || '—'}</td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted py-4">
                    No leads match these filters.
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
