import React from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid } from 'recharts'

export default function POSObjectiveBarChart({ loading, data }) {
  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    )
  }
  const chartData = data ?? []
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} barGap={12} barCategoryGap="28%">
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} allowDecimals={false} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: '#f8fafc' }}
          contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 16px rgba(15,23,42,0.08)' }}
        />
        <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '12px' }} iconType="circle" />
        <Bar dataKey="Objectif" fill="#c7d2fe" radius={[10, 10, 0, 0]} barSize={36} />
        <Bar dataKey="Réalisation" fill="#6366f1" radius={[10, 10, 0, 0]} barSize={36} />
      </BarChart>
    </ResponsiveContainer>
  )
}
