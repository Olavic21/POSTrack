import React from 'react';
import { render, screen } from '@testing-library/react';
import DSMSummaryCard from './DSMSummaryCard';

describe('DSMSummaryCard', () => {
  const mockData = {
    partner_id: 1,
    partner_name: 'Test Partner',
    by_dsm: [
      {
        dsm_id: 1,
        dsm_code: 'DSM001',
        dsm_name: 'Test DSM',
        objectif_creation: 100,
        realisation_creation: 75,
        objectif_redeploiement: 50,
        realisation_redeploiement: 30,
        loading: 200,
        sell_out: 150,
        recettes: null, // Donnée manquante identifiée
        progression_globale: 72.5,
      },
    ],
  };

  it('affiche le titre et la description', () => {
    render(<DSMSummaryCard data={mockData} />);
    expect(screen.getByText('Performances par DSM')).toBeInTheDocument();
    expect(screen.getByText(/Analyse détaillée des performances par DSM/)).toBeInTheDocument();
  });

  it('affiche les en-têtes du tableau', () => {
    render(<DSMSummaryCard data={mockData} />);
    expect(screen.getByText('DSM')).toBeInTheDocument();
    expect(screen.getByText('Objectif création')).toBeInTheDocument();
    expect(screen.getByText('Réalisation création')).toBeInTheDocument();
    expect(screen.getByText('Objectif redéploiement')).toBeInTheDocument();
    expect(screen.getByText('Réalisation redéploiement')).toBeInTheDocument();
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(screen.getByText('Sell-out')).toBeInTheDocument();
    expect(screen.getByText('Recettes')).toBeInTheDocument();
    expect(screen.getByText('Progression globale')).toBeInTheDocument();
  });

  it('affiche les données DSM correctement', () => {
    render(<DSMSummaryCard data={mockData} />);
    expect(screen.getByText('Test DSM')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument(); // objectif création
    expect(screen.getByText('75')).toBeInTheDocument(); // réalisation création
    expect(screen.getByText('50')).toBeInTheDocument(); // objectif redéploiement
    expect(screen.getByText('30')).toBeInTheDocument(); // réalisation redéploiement
    expect(screen.getByText('200')).toBeInTheDocument(); // loading
    expect(screen.getByText('150')).toBeInTheDocument(); // sell-out
  });

  it('affiche "Donnée non disponible" pour les recettes manquantes', () => {
    render(<DSMSummaryCard data={mockData} />);
    expect(screen.getByText('Donnée non disponible')).toBeInTheDocument();
  });

  it('affiche les recettes quand elles sont disponibles', () => {
    const dataWithRecettes = {
      ...mockData,
      by_dsm: [
        {
          ...mockData.by_dsm[0],
          recettes: 5000000, // 5 millions FCFA
        },
      ],
    };

    render(<DSMSummaryCard data={dataWithRecettes} />);
    expect(screen.getByText('5 000 000 FCFA')).toBeInTheDocument();
    expect(screen.queryByText('Donnée non disponible')).not.toBeInTheDocument();
  });

  it('affiche un message quand aucune donnée DSM n\'est disponible', () => {
    render(<DSMSummaryCard data={{ partner_id: 1, partner_name: 'Test', by_dsm: [] }} />);
    expect(screen.getByText('Aucune donnée DSM disponible')).toBeInTheDocument();
  });

  it('affiche la note sur les montants en FCFA', () => {
    render(<DSMSummaryCard data={mockData} />);
    expect(screen.getByText(/Montants en FCFA/)).toBeInTheDocument();
    expect(screen.getByText(/le loading correspond au montant vendu par les POS/)).toBeInTheDocument();
  });

  it('gère le cas où data est null', () => {
    render(<DSMSummaryCard data={null} />);
    expect(screen.getByText('Aucune donnée DSM disponible')).toBeInTheDocument();
  });

  it('affiche correctement la progression globale', () => {
    render(<DSMSummaryCard data={mockData} />);
    expect(screen.getByText('72,5 %')).toBeInTheDocument();
  });
});