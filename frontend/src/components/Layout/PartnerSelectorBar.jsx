import React from 'react';
import { useNavigate } from 'react-router-dom';
import usePartner from '../../hooks/usePartner';
import Button from '../Common/Button/Button';
import DemoDataBanner from '../Common/DemoDataBanner/DemoDataBanner';
import { envFlag } from '../../utils/envFlags';

/**
 * Barre de contexte partenaire - style Salesforce : fond bleu clair, texte bleu fonce.
 */
const PartnerSelectorBar = () => {
  const { partner, partnerContextId, hasPartner } = usePartner();
  const navigate = useNavigate();

  if (!hasPartner) return null;

  const name = partner?.nom || partner?.code_partenaire || `Partenaire #${partnerContextId}`;
  const meta = [partner?.code_partenaire, partner?.ville, partner?.region]
    .filter(Boolean)
    .join(' / ');

  return (
    <div className="border-b border-[#c9e3fb] bg-[#e8f4fd]">
      <div className="flex flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between md:pl-60">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-[#0176d3]">
            Contexte partenaire
          </p>
          <p className="truncate text-[13px] font-bold text-[#032d60]">{name}</p>
          {meta ? <p className="truncate text-[11px] text-[#0176d3]/70">{meta}</p> : null}
        </div>
        <Button
          type="button"
          variant="primary"
          className="shrink-0 text-[13px]"
          onClick={() => navigate('/select-partner')}
        >
          Changer de partenaire
        </Button>
      </div>
      {partner?.__mock && !envFlag(import.meta.env.VITE_DISABLE_DEMO_BANNER) ? (
        <DemoDataBanner
          compact
          message="Le backend est indisponible : le contexte partenaire actif utilise des donnees de demonstration."
        />
      ) : null}
    </div>
  );
};

export default PartnerSelectorBar;
