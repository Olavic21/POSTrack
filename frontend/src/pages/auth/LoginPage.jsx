import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAuth from '../../hooks/useAuth';
import usePartner from '../../hooks/usePartner';
import Alert from '../../components/Common/Alert/Alert';
import { clearAuthSession } from '../../services/api';
import Logo from '../../assets/logos/LOGO.jpeg';

const mockAccounts = [
  { label: 'Admin', username: 'admin', password: 'admin123' },
  { label: 'Manager', username: 'manager', password: 'manager123' },
  { label: 'Chef operationnel', username: 'chef', password: 'chef123' },
  { label: 'Operationnel', username: 'oper', password: 'oper123' },
];

const LoginPage = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  let hasPartner = false;
  try {
    ({ hasPartner } = usePartner());
  } catch {
    hasPartner = false;
  }
  const navigate = useNavigate();

  const goAfterLogin = () => {
    navigate('/select-partner', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      clearAuthSession();
      await login({ username, password });
      goAfterLogin();
    } catch (err) {
      if (err.isAuthExpired) {
        setError(
          'Votre session est obsolete. Reconnectez-vous.'
        );
      } else {
        setError(
          err.response?.data?.detail || 'Echec de la connexion.'
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMockSelect = (account) => {
    setUsername(account.username);
    setPassword(account.password);
    setError('');
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f3f3f3] px-4 py-12 sm:px-6 lg:px-8">
      <div className="relative z-10 w-full max-w-md animate-fade-in-scale">
        {/* Main card */}
        <div className="overflow-hidden rounded border border-[#dddbda] bg-white shadow-md">
          {/* Blue header (Salesforce brand blue) */}
          <div className="bg-gradient-brand relative overflow-hidden px-8 pb-8 pt-10 text-center">
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
            <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/5" />

            <div className="relative">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-white/20 p-1 shadow-sm">
                <img
                  src={Logo}
                  alt="POSTrack logo"
                  className="h-full w-auto rounded object-cover"
                />
              </div>
              <h2 className="text-xl font-bold text-white drop-shadow-sm">
                POSTrack
              </h2>
              <p className="mt-1 text-[13px] text-blue-100">
                Gestion de la chaine Partenaire
              </p>
            </div>
          </div>

          {/* Form body */}
          <div className="px-8 py-7">
            <p className="mb-5 text-center text-[13px] font-medium text-[#444746]">
              Connectez-vous a votre compte
            </p>

            {error && (
              <div className="mb-5">
                <Alert type="error" message={error} />
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-[#444746]">
                  Nom d'utilisateur
                </label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="input"
                  placeholder="Identifiant"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[12px] font-semibold text-[#444746]">
                  Mot de passe
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input"
                  placeholder="Mot de passe"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-2.5 text-[13px] shadow-sm"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Connexion en cours...
                  </span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-6">
              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e5e5e5]" />
                </div>
                <div className="relative flex justify-center text-[11px]">
                  <span className="bg-white px-3 font-semibold uppercase tracking-wider text-[#939393]">
                    Comptes de demo
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {mockAccounts.map((account) => (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => handleMockSelect(account)}
                    className={`flex items-center rounded border px-3 py-2 text-[13px] font-medium transition-colors ${
                      username === account.username
                        ? 'border-[#0176d3] bg-[#e8f4fd] text-[#032d60]'
                        : 'border-[#e5e5e5] bg-[#fafaf9] text-[#444746] hover:border-[#a8c7fa] hover:bg-[#e8f4fd]/50'
                    }`}
                  >
                    {account.label}
                  </button>
                ))}
              </div>

              <p className="mt-3 text-center text-[11px] text-[#939393]">
                Selectionnez un compte, puis cliquez sur "Se connecter"
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-5 text-center text-[11px] text-[#939393]">
          POSTrack
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
