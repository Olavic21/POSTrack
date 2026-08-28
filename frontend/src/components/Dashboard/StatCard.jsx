import React from 'react';
import { ArrowDownRightIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline';

const ACCENT_CONFIG = {
  default: {
    valueColor: 'text-[#181818]',
    labelColor: 'text-[#444746]',
    leftBorder: 'border-l-[#dddbda]',
  },
  indigo: {
    valueColor: 'text-[#032d60]',
    labelColor: 'text-[#0176d3]',
    leftBorder: 'border-l-[#0176d3]',
  },
  green: {
    valueColor: 'text-[#1e4d2b]',
    labelColor: 'text-[#2e844a]',
    leftBorder: 'border-l-[#2e844a]',
  },
  amber: {
    valueColor: 'text-[#6b3c00]',
    labelColor: 'text-[#dd7a01]',
    leftBorder: 'border-l-[#dd7a01]',
  },
  red: {
    valueColor: 'text-[#8c0013]',
    labelColor: 'text-[#ea001e]',
    leftBorder: 'border-l-[#ea001e]',
  },
  sky: {
    valueColor: 'text-[#032d60]',
    labelColor: 'text-[#0d9dd1]',
    leftBorder: 'border-l-[#0d9dd1]',
  },
};

/**
 * Carte KPI - style Salesforce : nombre bold, label discret, bordure gauche coloree.
 */
const StatCard = ({
  label,
  value,
  loading = false,
  accent = 'default',
  icon = undefined,
  subtitle = '',
  small = false,
  trend = undefined,
  className = '',
}) => {
  const config = ACCENT_CONFIG[accent] || ACCENT_CONFIG.default;
  const trendPositive = trend ? trend.positive ?? trend.direction !== 'down' : true;

  if (loading) {
    return (
      <div className={`card overflow-hidden border-l-[3px] ${config.leftBorder} ${className}`}>
        <div className={small ? 'p-3' : 'p-4'}>
          <div className="flex items-start justify-between">
            <div className="flex-1 space-y-2">
              <div className="skeleton h-2.5 w-20 rounded" />
              <div className={`skeleton rounded ${small ? 'h-6 w-14' : 'h-8 w-16'}`} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`card card-hover group overflow-hidden border-l-[3px] ${config.leftBorder} ${className}`}
    >
      <div className={small ? 'p-3' : 'p-4'}>
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <p className={`text-[11px] font-semibold uppercase tracking-wide ${config.labelColor}`}>
              {label}
            </p>
            <p
              className={`mt-1 font-bold tracking-tight ${config.valueColor} ${
                small ? 'text-[22px]' : 'text-[28px]'
              }`}
            >
              {value ?? '—'}
            </p>
            {trend && !loading ? (
              <p
                className={`mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-semibold ${
                  trendPositive ? 'text-[#2e844a]' : 'text-[#ea001e]'
                }`}
              >
                {trend.direction === 'down' ? (
                  <ArrowDownRightIcon className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <ArrowUpRightIcon className="h-3 w-3" aria-hidden="true" />
                )}
                {trend.value}
                {trend.label ? <span className="ml-0.5 font-medium text-[#706e6b]">{trend.label}</span> : null}
              </p>
            ) : null}
            {subtitle && (
              <p className="mt-0.5 text-[11px] text-[#706e6b]">{subtitle}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StatCard;
