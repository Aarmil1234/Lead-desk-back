
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UsersRound,
  Search,
  RefreshCw,
  LoaderCircle,
  ArrowUpRight,
  PhoneCall,
  CalendarClock,
  Trophy,
  UserRound,
} from 'lucide-react';
import { api } from '../lib/api';

type Telecaller = {
  id: string;
  full_name: string;
  is_active: boolean;
  stats: {
    assigned: number;
    contacted: number;
    contactRate: number;
    overdue: number;
    dueToday: number;
    won: number;
    interested: number;
    followUps: number;
  };
};

export default function Telecallers() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Telecaller[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      const result = await api<{ items: Telecaller[] }>('/telecallers');
      setItems(result.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load telecallers.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = items.filter(user => {
    const matchesSearch = user.full_name
      .toLowerCase()
      .includes(search.trim().toLowerCase());

    const matchesStatus = status === 'all' ||
      (status === 'active' ? user.is_active : !user.is_active);

    return matchesSearch && matchesStatus;
  });

  const totals = items.reduce(
    (sum, user) => ({
      assigned: sum.assigned + user.stats.assigned,
      contacted: sum.contacted + user.stats.contacted,
      won: sum.won + user.stats.won,
      overdue: sum.overdue + user.stats.overdue,
    }),
    { assigned: 0, contacted: 0, won: 0, overdue: 0 }
  );

  return (
    <div className="page-stack">
      <div className="page-heading">
        <div>
          <div className="eyebrow">TEAM PERFORMANCE</div>
          <h1>Telecallers</h1>
          <p>Monitor lead ownership, follow-ups and sales progress.</p>
        </div>

        <button className="btn btn-outline-secondary" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className="me-2" />
          Refresh
        </button>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="row g-3">
        <div className="col-6 col-xl-3">
          <div className="surface-card">
            <div className="text-muted small">Assigned leads</div>
            <h2 className="mt-2 mb-0">{totals.assigned}</h2>
          </div>
        </div>

        <div className="col-6 col-xl-3">
          <div className="surface-card">
            <div className="text-muted small">Contacted leads</div>
            <h2 className="mt-2 mb-0">{totals.contacted}</h2>
          </div>
        </div>

        <div className="col-6 col-xl-3">
          <div className="surface-card">
            <div className="text-muted small">Won</div>
            <h2 className="mt-2 mb-0">{totals.won}</h2>
          </div>
        </div>

        <div className="col-6 col-xl-3">
          <div className="surface-card">
            <div className="text-muted small">Overdue follow-ups</div>
            <h2 className="mt-2 mb-0">{totals.overdue}</h2>
          </div>
        </div>
      </div>

      <section className="surface-card">
        <div className="row g-3 align-items-center mb-4">
          <div className="col-lg-7">
            <div className="input-group">
              <span className="input-group-text">
                <Search size={16} />
              </span>
              <input
                className="form-control"
                placeholder="Search telecallers..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="col-lg-5">
            <select
              className="form-select"
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">All telecallers</option>
              <option value="active">Active only</option>
              <option value="inactive">Inactive only</option>
            </select>
          </div>
        </div>

        {loading ? (
          <div className="loading-panel">
            <LoaderCircle className="spin" size={22} />
            Loading performance...
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <UsersRound size={28} />
            <strong>No telecallers found</strong>
            <span>Try another search or add a telecaller in User Management.</span>
          </div>
        ) : (
          <div className="row g-3">
            {filtered.map(user => (
              <div className="col-12 col-xl-6" key={user.id}>
                <button
                  type="button"
                  className="telecaller-card w-100 text-start"
                  onClick={() => navigate(`/telecallers/${user.id}`)}
                >
                  <div className="d-flex align-items-center gap-3">
                    <div className="mini-avatar">
                      {user.full_name.slice(0, 1).toUpperCase()}
                    </div>

                    <div className="flex-grow-1">
                      <div className="d-flex align-items-center gap-2 flex-wrap">
                        <strong>{user.full_name}</strong>
                        <span className={`soft-badge ${user.is_active ? 'soft-green' : 'soft-red'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div className="table-sub">Telecaller</div>
                    </div>

                    <ArrowUpRight size={19} />
                  </div>

                  <div className="row g-3 mt-2">
                    <div className="col-6">
                      <div className="metric-label"><UserRound size={14} /> Assigned</div>
                      <strong className="metric-value">{user.stats.assigned}</strong>
                    </div>
                    <div className="col-6">
                      <div className="metric-label"><PhoneCall size={14} /> Contacted</div>
                      <strong className="metric-value">{user.stats.contacted}</strong>
                    </div>
                    <div className="col-6">
                      <div className="metric-label"><CalendarClock size={14} /> Overdue</div>
                      <strong className="metric-value">{user.stats.overdue}</strong>
                    </div>
                    <div className="col-6">
                      <div className="metric-label"><Trophy size={14} /> Won</div>
                      <strong className="metric-value">{user.stats.won}</strong>
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="d-flex justify-content-between small mb-2">
                      <span>Contact progress</span>
                      <strong>{user.stats.contactRate}%</strong>
                    </div>
                    <div className="progress" style={{ height: 7 }}>
                      <div
                        className="progress-bar"
                        style={{ width: `${user.stats.contactRate}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 small text-primary">
                    View assigned leads and progress →
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
