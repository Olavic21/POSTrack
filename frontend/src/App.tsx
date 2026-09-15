import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import MainLayout from './components/Layout/MainLayout'
import RoleGuard from './components/Layout/RoleGuard'
import LoadingSpinner from './components/Common/LoadingSpinner/LoadingSpinner'
import PartnerRoute from './routes/PartnerRoute'
import { AuthProvider } from './context/AuthContext'
import { PartnerProvider } from './context/PartnerContext'
import { NavLevelProvider } from './context/NavLevelContext'
import { ROLE_GROUPS } from './utils/constants'
import { Navigate } from 'react-router-dom'

// Lazy load all pages for code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'))
const POSListPage = lazy(() => import('./pages/pos/POSListPage'))
const POSDetailPage = lazy(() => import('./pages/pos/POSDetailPage'))
const POSEditPage = lazy(() => import('./pages/pos/POSEditPage'))
const POSCreatePage = lazy(() => import('./pages/pos/POSCreatePage'))
const PartnersList = lazy(() => import('./pages/PartnersList'))
const BTSListPage = lazy(() => import('./pages/bts/BTSListPage'))
const BTSCreatePage = lazy(() => import('./pages/bts/BTSCreatePage'))
const BTSDetailPage = lazy(() => import('./pages/bts/BTSDetailPage'))
const BTSRelevesPage = lazy(() => import('./pages/bts/BTSRelevesPage'))
const DSMListPage = lazy(() => import('./pages/dsm/DSMListPage'))
const DSMCreatePage = lazy(() => import('./pages/dsm/DSMCreatePage'))
const DSMDetailPage = lazy(() => import('./pages/dsm/DSMDetailPage'))
const DSMHomePage = lazy(() => import('./pages/dsm/DSMHomePage'))
const DSMDashboardPage = lazy(() => import('./pages/dsm/DSMDashboardPage'))
const DSMPOSPage = lazy(() => import('./pages/dsm/DSMPOSPage'))
const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const RequeteCreatePage = lazy(() => import('./pages/requetes/RequeteCreatePage'))
const SelectPartnerPage = lazy(() => import('./pages/auth/SelectPartnerPage'))
const UnauthorizedPage = lazy(() => import('./pages/auth/UnauthorizedPage'))
const SimsStockPage = lazy(() => import('./pages/sims/SimsStockPage'))
const RequetesListPage = lazy(() => import('./pages/requetes/RequetesListPage'))
const ImportExportPage = lazy(() => import('./pages/import-export/ImportExportPage'))
const SuiviVentesPage = lazy(() => import('./pages/ventes/SuiviVentesPage'))
const SuiviQuotidienPage = lazy(() => import('./pages/tracking/SuiviQuotidienPage'))
const AuditLogsPage = lazy(() => import('./pages/audit/AuditLogsPage'))
const SalesTargetsPage = lazy(() => import('./pages/analytics/SalesTargetsPage'))
const PartenaireCreatePage = lazy(() => import('./pages/partenaires/PartenaireCreatePage'))
const PartnerPrimesDashboard = lazy(() => import('./pages/primes/PartnerPrimesDashboard'))
const ObjectivesDistributionPage = lazy(() => import('./pages/primes/ObjectivesDistributionPage'))
const PartnerPOSPage = lazy(() => import('./pages/partners/PartnerPOSPage'))
const UsersPage = lazy(() => import('./pages/admin/UsersPage'))
const GeolocalisationPage = lazy(() => import('./pages/GeolocalisationPage'))

function App() {
  return (
    <AuthProvider>
      <NavLevelProvider>
        <PartnerProvider>
        <Routes>
          <Route path="/login" element={
            <Suspense fallback={<LoadingSpinner />}>
              <LoginPage />
            </Suspense>
          } />
          <Route path="/select-partner" element={
            <Suspense fallback={<LoadingSpinner />}>
              <SelectPartnerPage />
            </Suspense>
          } />
          <Route
            element={
              <PartnerRoute>
                <MainLayout />
              </PartnerRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={
              <Suspense fallback={<LoadingSpinner />}>
                <Dashboard />
              </Suspense>
            } />
            <Route path="geolocalisation" element={
              <Suspense fallback={<LoadingSpinner />}>
                <GeolocalisationPage />
              </Suspense>
            } />
            <Route path="unauthorized" element={
              <Suspense fallback={<LoadingSpinner />}>
                <UnauthorizedPage />
              </Suspense>
            } />

            <Route path="partenaires/pos" element={
              <Suspense fallback={<LoadingSpinner />}>
                <PartnerPOSPage />
              </Suspense>
            } />
            <Route path="pos" element={
              <Suspense fallback={<LoadingSpinner />}>
                <POSListPage />
              </Suspense>
            } />
            <Route path="pos/new" element={
              <Suspense fallback={<LoadingSpinner />}>
                <POSCreatePage />
              </Suspense>
            } />
            <Route path="pos/nouveau" element={
              <Suspense fallback={<LoadingSpinner />}>
                <POSCreatePage />
              </Suspense>
            } />
            <Route path="pos/:id/edit" element={
              <Suspense fallback={<LoadingSpinner />}>
                <POSEditPage />
              </Suspense>
            } />
            <Route path="pos/:id" element={
              <Suspense fallback={<LoadingSpinner />}>
                <POSDetailPage />
              </Suspense>
            } />

            <Route
              path="partenaires"
              element={
                <RoleGuard roles={ROLE_GROUPS.ADMIN_ONLY}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <PartnersList />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="partenaires/new"
              element={
                <RoleGuard roles={ROLE_GROUPS.ADMIN_ONLY}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <PartenaireCreatePage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="users"
              element={
                <RoleGuard roles={ROLE_GROUPS.ADMIN_ONLY}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <UsersPage />
                  </Suspense>
                </RoleGuard>
              }
            />

            <Route
              path="primes"
              element={
                <RoleGuard roles={ROLE_GROUPS.PARTNER_PORTFOLIO}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <PartnerPrimesDashboard />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="primes/dsm"
              element={
                <RoleGuard roles={ROLE_GROUPS.PARTNER_PORTFOLIO}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <PartnerPrimesDashboard />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="primes/objectives"
              element={
                <RoleGuard roles={ROLE_GROUPS.ADMIN_ONLY}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ObjectivesDistributionPage />
                  </Suspense>
                </RoleGuard>
              }
            />

            <Route
              path="dsm"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DSMDashboardPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="dsm/home"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DSMHomePage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="dsm/list"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DSMListPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="dsm/new"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DSMCreatePage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="dsm/:id"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DSMDetailPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="dsm/:id/pos"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <DSMPOSPage />
                  </Suspense>
                </RoleGuard>
              }
            />

            <Route
              path="bts"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <BTSListPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="bts/new"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <BTSCreatePage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="bts/releves"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <BTSRelevesPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="bts/:id/modifier"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <BTSCreatePage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="bts/:id"
              element={
                <RoleGuard roles={ROLE_GROUPS.OPERATIONS}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <BTSDetailPage />
                  </Suspense>
                </RoleGuard>
              }
            />

            <Route path="sims" element={
              <Suspense fallback={<LoadingSpinner />}>
                <SimsStockPage />
              </Suspense>
            } />
            <Route path="ventes" element={
              <Suspense fallback={<LoadingSpinner />}>
                <SuiviVentesPage />
              </Suspense>
            } />
            <Route path="suivi-quotidien" element={
              <Suspense fallback={<LoadingSpinner />}>
                <SuiviQuotidienPage />
              </Suspense>
            } />
            <Route path="requetes" element={
              <Suspense fallback={<LoadingSpinner />}>
                <RequetesListPage />
              </Suspense>
            } />
            <Route path="requetes/new" element={
              <Suspense fallback={<LoadingSpinner />}>
                <RequeteCreatePage />
              </Suspense>
            } />

            <Route
              path="import-export"
              element={
                <RoleGuard roles={ROLE_GROUPS.PARTNER_PORTFOLIO}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <ImportExportPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="analytics/sales-targets"
              element={
                <RoleGuard roles={ROLE_GROUPS.ADMIN_ONLY}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <SalesTargetsPage />
                  </Suspense>
                </RoleGuard>
              }
            />
            <Route
              path="audit"
              element={
                <RoleGuard roles={ROLE_GROUPS.ADMIN_ONLY}>
                  <Suspense fallback={<LoadingSpinner />}>
                    <AuditLogsPage />
                  </Suspense>
                </RoleGuard>
              }
            />
          </Route>
        </Routes>
        </PartnerProvider>
      </NavLevelProvider>
    </AuthProvider>
  )
}

export default App
