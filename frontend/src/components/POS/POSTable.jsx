import { useNavigate } from 'react-router-dom';
import StatusPill from '../Common/StatusPill/StatusPill';

const TYPE_LABELS = {
  NOUVEAU: 'Créé',
  RECONDUIT: 'Reconduit',
  'LIÉ': 'Lié',
  LIE: 'Lié',
};

const COLS = 14;

function ZoningCell({ zoning }) {
  if (!zoning) return <span className="text-slate-400">—</span>;
  const map = {
    VERT: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    ORANGE: 'bg-amber-100 text-amber-700 border-amber-200',
    ROUGE: 'bg-red-100 text-red-700 border-red-200',
    INCONNU: 'bg-slate-100 text-slate-500 border-slate-200',
  };
  const dot = { VERT: '🟢', ORANGE: '🟠', ROUGE: '🔴', INCONNU: '⚪' };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${map[zoning.status] || map.INCONNU}`}>
      <span>{dot[zoning.status] || '⚪'}</span>{zoning.status}
    </span>
  );
}

/**
 * Tableau des POS — tri côté serveur (sort_by/order), synchronisé avec la
 * carte (sélection) et la fiche détail (clic sur la ligne).
 */
export default function POSTable({ rows = [], loading = false, sort, onSort, onSelect, selectedId = null }) {
  const navigate = useNavigate();
  const safeRows = Array.isArray(rows) ? rows : [];

  /** En-tête triable : clic → bascule serveur asc/desc. */
  const th = (label, field) => {
    const active = field && sort?.sort_by === field;
    return (
      <th
        key={label}
        scope="col"
        aria-sort={active ? (sort.order === 'asc' ? 'ascending' : 'descending') : undefined}
        className={field ? 'sortable' : undefined}
        onClick={field ? () => onSort?.(field) : undefined}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          {active ? <span aria-hidden="true">{sort.order === 'asc' ? '↑' : '↓'}</span> : null}
        </span>
      </th>
    );
  };

  return (
    <div className="data-table-container overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {th('Code POS', 'code_pos')}
            {th('Nom', 'nom')}
            {th('Type')}
            {th('Partenaire')}
            {th('DSM')}
            {th('Coordonnées')}
            {th('Zoning')}
            {th('Micro-zone / Partenaire')}
            {th('Statut', 'statut')}
            {th('Linkage')}
            {th('Loading')}
            {th('Sell-out')}
            {th('Expiration', 'date_expiration')}
            {th('Actions')}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 6 }, (_, r) => (
              <tr key={`skeleton-${r}`} aria-hidden="true">
                {Array.from({ length: COLS }, (_, c) => (
                  <td key={c}>
                    <div
                      className="skeleton h-3.5 rounded"
                      style={{ width: `${45 + ((r + c) * 13) % 40}%` }}
                    />
                  </td>
                ))}
              </tr>
            ))
          ) : safeRows.length === 0 ? (
            <tr>
              <td colSpan={COLS} className="text-center text-slate-400">
                Aucun POS trouvé.
              </td>
            </tr>
          ) : (
            safeRows.map((pos) => {
              const linked = pos.linkage_status === 'LINKED' || pos.holder_user_id;
              const coords =
                pos.latitude != null && pos.longitude != null
                  ? `${pos.latitude}, ${pos.longitude}`
                  : pos.coordonnees?.latitude != null && pos.coordonnees?.longitude != null
                    ? `${pos.coordonnees.latitude}, ${pos.coordonnees.longitude}`
                    : 'Aucune';
              return (
                <tr
                  key={pos.id}
                  className={`${pos.id === selectedId ? 'row-selected' : ''} cursor-pointer`}
                  onClick={() => {
                    onSelect?.(pos);
                    navigate(`/pos/${pos.id}`);
                  }}
                >
                  <td className="whitespace-nowrap font-mono font-semibold text-brand-600">
                    {pos.code_pos}
                  </td>
                  <td className="font-medium text-slate-900">{pos.nom}</td>
                  <td>{TYPE_LABELS[pos.type_pos ?? pos.type] ?? (pos.type_pos ?? pos.type) ?? '—'}</td>
                  <td>{pos.partenaire?.nom ?? '—'}</td>
                  <td>{pos.dsm?.nom_complet ?? '—'}</td>
                  <td className="whitespace-nowrap text-slate-500">{coords}</td>
                  <td><ZoningCell zoning={pos.zoning} /></td>
                  <td className="max-w-[160px] truncate text-xs text-slate-600" title={pos.zoning?.micro_zone || pos.zoning?.partner_name || ''}>
                    {pos.zoning?.status === 'ORANGE' && pos.zoning?.micro_zone ? pos.zoning.micro_zone : pos.zoning?.status === 'ROUGE' && pos.zoning?.partner_name ? pos.zoning.partner_name : pos.zoning?.micro_zone || '—'}
                  </td>
                  <td><StatusPill status={pos.statut} /></td>
                  <td><StatusPill status={linked ? 'Linké' : 'Délinké'} /></td>
                  <td className="font-semibold tabular-nums text-brand-600">{pos.loading ?? 0}</td>
                  <td className="font-semibold tabular-nums text-emerald-600">{pos.sell_out ?? 0}</td>
                  <td className="whitespace-nowrap">{pos.date_expiration ?? '—'}</td>
                  <td className="whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/pos/${pos.id}/edit`);
                      }}
                      className="font-medium text-brand-600 transition-colors hover:text-brand-800"
                    >
                      Modifier
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
