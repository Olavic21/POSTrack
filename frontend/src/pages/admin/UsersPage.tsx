import { useCallback, useEffect, useState } from 'react'
import api from '../../services/api'
import useAuth from '../../hooks/useAuth'
import PageHeader from '../../components/Common/PageHeader/PageHeader'
import Button from '../../components/Common/Button/Button'
import DataTable from '../../components/Common/DataTable/DataTable'
import { ROLE_LABELS } from '../../utils/constants'

type User = {
  id: number
  username: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
  created_at: string
  dsm_id: number | null
  partner_id: number | null
  partner_name?: string
}

type AuthUser = {
  id?: number
  username?: string
  email?: string
  role?: string
  partner_id?: number | null
}

type UserForm = {
  username: string
  email: string
  password: string
  full_name: string
  role: string
  partner_id: number | null
}

const EMPTY_FORM: UserForm = {
  username: '',
  email: '',
  password: '',
  full_name: '',
  role: 'OPERATIONNEL',
  partner_id: null,
}

const roleOptions = [
  { value: 'ADMIN', label: 'Administrateur' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'CHEF_OPERATIONNEL', label: 'Chef opérationnel' },
  { value: 'OPERATIONNEL', label: 'Opérationnel' },
]

// Rôles rattachés à un partenaire : le choix du partenaire n'a de sens que
// pour les opérationnels et chefs opérationnels (un manager ou un admin
// supervise l'ensemble des partenaires sans y être rattaché).
const ROLES_WITH_PARTNER: readonly string[] = ['OPERATIONNEL', 'CHEF_OPERATIONNEL']

const roleBadgeClass = (role: string): string => {
  switch (role) {
    case 'ADMIN':
      return 'bg-red-100 text-red-800'
    case 'MANAGER':
      return 'bg-amber-100 text-amber-800'
    case 'CHEF_OPERATIONNEL':
      return 'bg-purple-100 text-purple-800'
    default:
      return 'bg-emerald-100 text-emerald-800'
  }
}

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500'
export default function UsersPage() {
  const { user } = useAuth() as { user: AuthUser | null }
  const isAdmin = user?.role === 'ADMIN'

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState<UserForm>(EMPTY_FORM)
  const [partnerOptions, setPartnerOptions] = useState<Array<{ value: number; label: string }>>([])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/users')
      const data = res.data?.items ?? res.data ?? []
      setUsers(Array.isArray(data) ? data : [])
    } catch {
      setUsers([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadPartners = async () => {
      try {
        const res = await api.get('/partenaires')
        const data = res.data?.items ?? res.data ?? []
        const partners = Array.isArray(data) ? data : []
        setPartnerOptions(
          partners.map((p: { id: number; nom?: string; name?: string }) => ({
            value: p.id,
            label: p.nom || p.name || `Partenaire #${p.id}`,
          }))
        )
      } catch {
        setPartnerOptions([])
      }
    }
    void loadPartners()
  }, [])

  useEffect(() => {
    void loadUsers()
  }, [loadUsers])

  const resetForm = () => {
    setFormData(EMPTY_FORM)
    setEditingId(null)
    setDeletingId(null)
  }

  const closeModal = () => {
    resetForm()
    setShowModal(false)
  }

  const openCreateModal = () => {
    resetForm()
    setShowModal(true)
  }

  const openEditModal = (u: User) => {
    setFormData({
      username: u.username,
      email: u.email,
      password: '',
      full_name: u.full_name || '',
      role: u.role || 'OPERATIONNEL',
      partner_id: u.partner_id ?? null,
    })
    setDeletingId(null)
    setEditingId(u.id)
    setShowModal(true)
  }

  const openDeleteModal = (userId: number) => {
    resetForm()
    setDeletingId(userId)
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      // Le rattachement partenaire ne s'applique qu'aux rôles opérationnels
      const partnerId = ROLES_WITH_PARTNER.includes(formData.role) ? formData.partner_id : null
      if (editingId) {
        await api.patch(`/users/${editingId}`, {
          username: formData.username,
          email: formData.email,
          full_name: formData.full_name,
          role: formData.role,
          partner_id: partnerId,
        })
      } else {
        await api.post('/users', {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          full_name: formData.full_name,
          role: formData.role,
          partner_id: partnerId,
        })
      }
      closeModal()
      await loadUsers()
    } catch {
      alert("Erreur lors de l'enregistrement de l'utilisateur")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingId) return
    setDeleting(true)
    try {
      await api.delete(`/users/${deletingId}`)
      closeModal()
      await loadUsers()
    } catch {
      alert("Erreur lors de la suppression de l'utilisateur")
    } finally {
      setDeleting(false)
    }
  }
const toggleActive = async (u: User) => {
    try {
      await api.patch(`/users/${u.id}`, { is_active: !u.is_active })
      await loadUsers()
    } catch {
      alert("Erreur lors du changement de statut de l'utilisateur")
    }
  }

  /** Colonnes du tableau utilisateurs. */
  const columns = [
    {
      key: 'id',
      header: '#',
      align: 'center' as const,
      sortValue: (u: User) => u.id,
      render: (u: User) => <span className="font-medium text-slate-500">{u.id}</span>,
    },
    {
      key: 'username',
      header: "Nom d'utilisateur",
      sortValue: (u: User) => u.username,
      render: (u: User) => <div className="font-medium text-slate-900">{u.username}</div>,
    },
    {
      key: 'email',
      header: 'Email',
      responsive: 'hidden md:table-cell',
      render: (u: User) => u.email,
    },
    {
      key: 'role',
      header: 'Rôle',
      sortValue: (u: User) => u.role,
      render: (u: User) => (
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${roleBadgeClass(u.role)}`}
        >
          {ROLE_LABELS[u.role] || u.role}
        </span>
      ),
    },
    {
      key: 'partner',
      header: 'Partenaire',
      render: (u: User) =>
        u.partner_name || (u.partner_id ? `Partenaire #${u.partner_id}` : 'Non assigné'),
    },
    {
      key: 'is_active',
      header: 'Actif',
      sortValue: (u: User) => (u.is_active ? 1 : 0),
      render: (u: User) => (
        <span className={u.is_active ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
          {u.is_active ? 'Oui' : 'Non'}
        </span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right' as const,
      render: (u: User) => (
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={u.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'}
            onClick={() => void toggleActive(u)}
          >
            {u.is_active ? 'Désactiver' : 'Activer'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-800"
            onClick={() => openEditModal(u)}
          >
            Modifier
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => openDeleteModal(u.id)}
          >
            Supprimer
          </Button>
        </div>
      ),
    },
  ]

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Gestion des utilisateurs"
          subtitle="Créer, modifier et supprimer les comptes utilisateurs."
        />
        <div className="card p-8 text-center text-sm text-slate-500">
          Seuls les administrateurs peuvent accéder à cette page.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des utilisateurs"
        subtitle="Créer, modifier et supprimer les comptes utilisateurs."
        actions={
          <Button variant="primary" onClick={openCreateModal}>
            + Ajouter un utilisateur
          </Button>
        }
      />

      <div className="card overflow-hidden">
        <div className="card-header flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-slate-700">
            {loading ? 'Chargement…' : `${users.length} utilisateur(s)`}
          </span>
        </div>
        <DataTable
          columns={columns}
          rows={users}
          loading={loading}
          rowKey="id"
          emptyTitle="Aucun utilisateur"
          emptyMessage="Aucun utilisateur trouvé."
        />
      </div>
{showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md shadow-xl">
            {deletingId ? (
              <>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">Supprimer l'utilisateur</h2>
                <p className="text-sm text-slate-600">
                  Voulez-vous vraiment supprimer cet utilisateur ? Cette action est irréversible.
                </p>
                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                  <Button variant="secondary" onClick={closeModal} disabled={deleting}>
                    Annuler
                  </Button>
                  <Button variant="danger" onClick={() => void handleDelete()} disabled={deleting}>
                    {deleting ? 'Suppression…' : 'Supprimer'}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-slate-900 mb-4">
                  {editingId ? "Modifier l'utilisateur" : "Créer un utilisateur"}
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Nom d'utilisateur</label>
                    <input
                      type="text"
                      placeholder="Username"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Email</label>
                    <input
                      type="email"
                      placeholder="Email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  {!editingId && (
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Mot de passe</label>
                      <input
                        type="password"
                        placeholder="Mot de passe"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className={inputClass}
                      />
                    </div>
                  )}
<div>
                    <label className="block text-sm text-slate-600 mb-1">Nom complet</label>
                    <input
                      type="text"
                      placeholder="Nom complet"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Rôle</label>
                    <select
                      value={formData.role}
                      onChange={(e) => {
                        const role = e.target.value
                        setFormData({
                          ...formData,
                          role,
                          // Un manager / admin n'appartient à aucun partenaire
                          partner_id: ROLES_WITH_PARTNER.includes(role) ? formData.partner_id : null,
                        })
                      }}
                      className={inputClass}
                    >
                      {roleOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {!editingId && ROLES_WITH_PARTNER.includes(formData.role) && (
                    <div>
                      <label className="block text-sm text-slate-600 mb-1">Partenaire de rattachement</label>
                      <select
                        value={formData.partner_id ? String(formData.partner_id) : ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            partner_id: e.target.value !== '' ? Number(e.target.value) : null,
                          })
                        }
                        className={inputClass}
                      >
                        <option value="">Aucun</option>
                        {partnerOptions.map((p) => (
                          <option key={p.value} value={p.value}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                    <Button variant="secondary" onClick={closeModal} disabled={saving}>
                      Annuler
                    </Button>
                    <Button variant="primary" onClick={() => void handleSave()} disabled={saving}>
                      {saving ? 'Enregistrement…' : 'Enregistrer'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}