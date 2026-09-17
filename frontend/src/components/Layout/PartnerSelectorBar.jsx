import React from 'react';
import usePartner from '../../hooks/usePartner';

const PartnerSelectorBar = () => {
  const { hasPartner } = usePartner();
  // Header already shows partner context; this bar is now reserved for demo banner only.
  if (hasPartner) return null;
  return (
    <div className="mx-4 md:ml-[260px] mt-3">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 font-bold">!</span>
        <p className="font-medium">Sélectionnez un partenaire pour afficher les données du tableau de bord.</p>
      </div>
    </div>
  );
};

export default PartnerSelectorBar;
