
import { api } from './api';

export type ReportLead = {
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

export type ReportTelecaller = {
  id: string;
  full_name: string;
  is_active: boolean;
};

export type TelecallerReport = {
  telecaller: ReportTelecaller;
  leads: ReportLead[];
};

export const completedStages = ['Won', 'Lost', 'Not Interested'];

export function isCompleted(lead: ReportLead) {
  return completedStages.includes(lead.sales_stage ?? '');
}

export async function getReportData(): Promise<TelecallerReport[]> {
  const result = await api<{ items: ReportTelecaller[] }>('/telecallers');

  return Promise.all(
    result.items.map(async telecaller => {
      const detail = await api<{ leads: ReportLead[] }>(
        `/telecallers/${telecaller.id}`
      );

      return {
        telecaller,
        leads: detail.leads ?? [],
      };
    })
  );
}

export function formatReportDate(value: string | null) {
  if (!value) return '—';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function exportReportCsv(rows: string[][], filename: string) {
  const csv = rows.map(row =>
    row.map(value =>
      `"${String(value ?? '').replace(/"/g, '""')}"`
    ).join(',')
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
