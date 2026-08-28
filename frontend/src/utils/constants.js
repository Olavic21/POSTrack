/** Clés localStorage — Module A1 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'token',
  REFRESH_TOKEN: 'refresh_token',
  USER: 'user',
  PARTNER_CONTEXT_ID: 'partner_context_id',
  PARTNER_CONTEXT: 'partner_context',
  NAV_LEVEL: 'nav_level',
};

/** Rôles applicatifs cible (ADMIN / MANAGER / CHEF_OPERATIONNEL / OPERATIONNEL). */
export const ROLES = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  CHEF_OPERATIONNEL: 'CHEF_OPERATIONNEL',
  OPERATIONNEL: 'OPERATIONNEL',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administrateur',
  [ROLES.MANAGER]: 'Manager',
  [ROLES.CHEF_OPERATIONNEL]: 'Chef opérationnel',
  [ROLES.OPERATIONNEL]: 'Opérationnel',
};

/** Groupes de rôles réutilisables (matrice d'accès cible). */
export const ROLE_GROUPS = {
  ALL: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF_OPERATIONNEL, ROLES.OPERATIONNEL],
  PARTNER_PORTFOLIO: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF_OPERATIONNEL],
  OPERATIONS: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF_OPERATIONNEL, ROLES.OPERATIONNEL],
  ADMIN_ONLY: [ROLES.ADMIN],
};

/**
 * Types de niveau hiérarchique dans la sidebar.
 */
export const NAV_LEVELS = {
  PARTNER: 'partner',
  DSM: 'dsm',
  POS: 'pos',
};

/**
 * Navigation principale — filtrée par rôle selon le niveau hiérarchique.
 */
export const NAV_ITEMS = [
  {
    id: 'dashboard',
    to: '/dashboard',
    label: 'Dashboard',
    // Analytique partenaire : pas accessible aux opérationnels (détention POS).
    roles: ROLE_GROUPS.PARTNER_PORTFOLIO,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'dsm',
    to: '/dsm',
    label: 'DSM',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.PARTNER,
    // Entrée explicite dans la navigation DSM : le niveau reste actif
    // (sidebar DSM) jusqu'au clic sur le bouton de retour.
    enterLevel: NAV_LEVELS.DSM,
  },
  {
    id: 'pos',
    to: '/pos',
    label: 'Points de vente',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.PARTNER,
    // Entrée explicite dans la navigation POS (même logique que DSM).
    enterLevel: NAV_LEVELS.POS,
  },
  {
    id: 'bts',
    to: '/bts',
    label: 'BTS',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'ventes',
    to: '/ventes',
    label: 'Suivi des ventes',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'requetes',
    to: '/requetes',
    label: 'Requêtes',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'primes',
    to: '/primes',
    label: 'Primes',
    roles: ROLE_GROUPS.ADMIN_ONLY,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'sims',
    to: '/sims',
    label: 'Stock SIM',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'accueil-partenaire',
    to: '/',
    end: true,
    label: 'Accueil partenaire',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'partenaires',
    to: '/partenaires',
    label: 'Partenaires',
    roles: ROLE_GROUPS.ADMIN_ONLY,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'import-export',
    to: '/import-export',
    label: 'Import Excel',
    roles: ROLE_GROUPS.ADMIN_ONLY,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'sales-targets',
    to: '/analytics/sales-targets',
    label: 'Objectifs (admin)',
    roles: ROLE_GROUPS.ADMIN_ONLY,
    level: NAV_LEVELS.PARTNER,
  },
  {
    id: 'audit',
    to: '/audit',
    label: 'Audit',
    roles: ROLE_GROUPS.ADMIN_ONLY,
    level: NAV_LEVELS.PARTNER,
  },
  /* ── Navigation DSM ── */
  {
    id: 'dsm-dashboard',
    to: '/dsm',
    label: 'Tableau de bord DSM',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.DSM,
    end: true,
  },
  {
    id: 'dsm-pos',
    to: '/pos',
    label: 'Points de vente',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.DSM,
  },
  {
    id: 'dsm-bts',
    to: '/bts',
    label: 'BTS',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.DSM,
  },
  {
    id: 'dsm-ventes',
    to: '/ventes',
    label: 'Suivi des ventes',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.DSM,
  },
  {
    id: 'dsm-requetes',
    to: '/requetes',
    label: 'Requêtes',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.DSM,
  },
  {
    id: 'dsm-sims',
    to: '/sims',
    label: 'Stock SIM',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.DSM,
  },
  /* ── Navigation POS ── */
  {
    id: 'pos-list',
    to: '/pos',
    label: 'Liste POS',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.POS,
  },
  {
    id: 'pos-bts',
    to: '/bts',
    label: 'BTS',
    roles: ROLE_GROUPS.OPERATIONS,
    level: NAV_LEVELS.POS,
  },
  {
    id: 'pos-ventes',
    to: '/ventes',
    label: 'Suivi des ventes',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.POS,
  },
  {
    id: 'pos-requetes',
    to: '/requetes',
    label: 'Requêtes',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.POS,
  },
  {
    id: 'pos-sims',
    to: '/sims',
    label: 'Stock SIM',
    roles: ROLE_GROUPS.ALL,
    level: NAV_LEVELS.POS,
  },
];

/** Chemins exclus du préfixe /partners/{id}/ */
export const PARTNER_PREFIX_EXCLUDES = [
  /^\/?auth(\/|$)/i,
  /^\/?partenaires(\/|$)/i,
  /^\/?partners\/available(\/|$)/i,
  /^\/?hierarchy(\/|$)/i,
];

/** Types d'entités importables — Module A3 (Import Excel centralisé / ImportBatch) */
export const IMPORT_ENTITY_TYPES = [
  { value: 'POS', label: 'Points de Vente (POS)' },
  { value: 'DSM', label: 'DSM' },
  { value: 'BTS', label: 'BTS' },
  { value: 'SIM', label: 'Stock SIM' },
  { value: 'PERFORMANCE', label: 'Performance / Relevés' },
];

/** Types d'import reel (format partenaire specifique) */
export const IMPORT_REAL_TYPES = [
  { value: 'ZONE', label: 'Zone geographique (BTS + bornes)', description: 'Fichier ZONE avec GPS, couverture, bornes N/E/S/W' },
  { value: 'STOCK', label: 'Stock DSM/POS (solde SIM)', description: 'Fichier STOCK hierarchique DSM->POS avec solde et codes couleur' },
];

/** Chaîne d'acceptation des fichiers (input & drag & drop) — Module A3 */
export const IMPORT_FILE_ACCEPT = '.xlsx,.xls,.csv';

/** Statuts possibles d'un lot d'import (ImportBatch) — Module A3 */
export const IMPORT_BATCH_STATUS = {
  VALIDATED: 'VALIDATED',
  APPLIED: 'APPLIED',
  REJECTED: 'REJECTED',
};

/** Étapes du parcours d'import (Module A3) */
export const IMPORT_STEPS = {
  SETUP: 'SETUP',
  VALIDATING: 'VALIDATING',
  PREVIEW: 'PREVIEW',
  APPLYING: 'APPLYING',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
};

/**
 * Entités / agences en charge du traitement des requêtes (v3.4 §2.4).
 * Menu déroulant du tableau de suivi et du formulaire de création —
 * la liste est extensible côté ADMIN.
 */
export const ENTITES_EN_CHARGE = [
  'AC Bépanda',
  'AC Akwa',
  'AC Bonabéri',
  'AC Bonamoussadi',
  'AC Deïdo',
  'AC Ndogbong',
  'AC Bonanjo',
  'DSM Direct',
];
