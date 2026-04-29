
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { supabase } from '../services/supabase';

interface AuthProps {
  onLogin: (user: User) => void;
  isDarkMode: boolean;
  isResettingPassword?: boolean;
  onResetComplete?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, isDarkMode, isResettingPassword, onResetComplete }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isResettingPassword) {
        if (newPassword.length < 6) {
          throw new Error('A nova senha deve ter pelo menos 6 caracteres.');
        }
        const { error: resetError } = await supabase.auth.updateUser({ password: newPassword });
        if (resetError) throw resetError;
        setSuccess('Senha redefinida com sucesso! Redirecionando...');
        setTimeout(() => {
          if (onResetComplete) onResetComplete();
        }, 3000);
        return;
      }

      if (isLogin) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) {
          if (signInError.message.includes('Email not confirmed')) {
            throw new Error('E-mail não confirmado. Verifique sua caixa de entrada.');
          }
          if (signInError.message.includes('Invalid login credentials')) {
            throw new Error('E-mail ou senha incorretos.');
          }
          throw signInError;
        }
        
        if (data.user) {
          // Fetch profile
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          if (profileError && profileError.code !== 'PGRST116') {
            console.error('Erro ao buscar perfil:', profileError);
          }

          onLogin({
            id: data.user.id,
            name: profile?.name || data.user.email?.split('@')[0] || 'Usuário',
            email: data.user.email || '',
            recoveryEmail: profile?.recovery_email || '',
            fingerprintEnabled: profile?.fingerprint_enabled || false,
            createdAt: data.user.created_at
          });
        }
      } else {
        if (!name || !email || !password || !recoveryEmail) {
          setError('Por favor, preencha todos os campos.');
          setLoading(false);
          return;
        }

        if (password.length < 6) {
          setError('A senha deve ter pelo menos 6 caracteres.');
          setLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: name,
            }
          }
        });

        if (signUpError) throw signUpError;

        if (data.user) {
          // Check if auto-confirm is off (common in Supabase)
          if (data.session === null) {
            setError('Cadastro realizado. Por favor, verifique seu e-mail para confirmar a conta antes de entrar.');
            setLoading(false);
            return;
          }

          // Create profile
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              { 
                id: data.user.id, 
                name, 
                recovery_email: recoveryEmail, 
                fingerprint_enabled: fingerprintEnabled 
              }
            ]);

          if (profileError) console.error('Erro ao criar perfil:', profileError);

          onLogin({
            id: data.user.id,
            name,
            email,
            recoveryEmail,
            fingerprintEnabled,
            createdAt: data.user.created_at
          });
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocorreu um erro na autenticação.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleFingerprintLogin = async () => {
    setError('');
    setLoading(true);

    try {
      // 1. Check if browser supports Credential Management API
      if (!navigator.credentials || !navigator.credentials.get) {
        throw new Error('Seu navegador não suporta autenticação biométrica nativa.');
      }

      // 2. Try to get saved credentials. This will trigger the native OS biometric prompt (FaceID/Fingerprint)
      // if credentials were saved previously for this domain.
      const credential = await navigator.credentials.get({
        password: true,
        // We could also suggest "conditional" UI for newer browsers
        mediation: 'optional'
      }) as PasswordCredential | null;

      if (credential && credential.id && credential.password) {
        setEmail(credential.id);
        setPassword(credential.password);
        
        // 3. Perform login with retrieved credentials
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: credential.id.trim(),
          password: credential.password,
        });

        if (signInError) throw signInError;
        
        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', data.user.id)
            .single();

          onLogin({
            id: data.user.id,
            name: profile?.name || data.user.email?.split('@')[0] || 'Usuário',
            email: data.user.email || '',
            recoveryEmail: profile?.recovery_email || '',
            fingerprintEnabled: profile?.fingerprint_enabled || false,
            createdAt: data.user.created_at
          });
        }
      } else {
        setError('Nenhuma credencial digital encontrada. Por favor, entre com e-mail e senha primeiro e salve-os no seu dispositivo.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro na autenticação biométrica.';
      console.error('Biometric error:', err);
      // Fallback message for mobile users
      if (message.includes('not supported') || message.includes('navigator.credentials')) {
        setError('O acesso por digital requer que você já tenha salvo sua senha no navegador ou sistema do celular.');
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, informe seu e-mail.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        },
      });
      if (error) throw error;
      setSuccess(`Um link de acesso foi enviado para ${email}. Verifique seu e-mail.`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar link mágico.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail || email, {
        redirectTo: `${window.location.origin}/`,
      });
      if (error) throw error;
      setSuccess(`Um e-mail de recuperação foi enviado para ${recoveryEmail || email}. Verifique sua caixa de entrada e spam.`);
      setTimeout(() => {
        setIsRecovering(false);
        setSuccess('');
      }, 5000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocorreu um erro na recuperação.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`fixed inset-0 z-[1000] flex items-center justify-center p-4 ${isDarkMode ? 'bg-[#07080C]' : 'bg-slate-100'}`}>
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 ${isDarkMode ? 'bg-blue-600' : 'bg-blue-400'}`}></div>
        <div className={`absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full blur-[120px] opacity-20 ${isDarkMode ? 'bg-blue-900' : 'bg-blue-200'}`}></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className={`w-full max-w-md p-8 rounded-[2.5rem] border shadow-2xl backdrop-blur-xl relative z-10 ${isDarkMode ? 'bg-[#0A0B10]/90 border-white/5' : 'bg-white/90 border-slate-200'}`}
      >
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-xl shadow-blue-600/20 mb-4">
            <i className="fas fa-shield-halved"></i>
          </div>
          <h1 className={`text-3xl font-outfit font-black uppercase tracking-tighter leading-none ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>
            YardLogic <span className="text-blue-600">Pro</span>
          </h1>
          <p className="text-[10px] font-space font-black uppercase tracking-[0.3em] text-slate-500 mt-2">
            Acesso Restrito Porsche
          </p>
        </div>

        <AnimatePresence mode="wait">
          {isResettingPassword ? (
            <motion.form 
              key="reset"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleAuth}
              className="flex flex-col gap-4"
            >
              <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Nova Senha</h2>
              <p className="text-xs text-slate-500 font-medium">Defina uma nova senha segura.</p>
              
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest text-center">
                  {success}
                </div>
              )}

              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="password" 
                  placeholder="Nova Senha (min. 6 caracteres)"
                  required
                  className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 outline-none font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <button type="submit" disabled={loading || !!success} className="h-14 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-95 mt-2 disabled:opacity-50">
                {loading ? 'Redefinindo...' : 'Salvar Nova Senha'}
              </button>
            </motion.form>
          ) : useMagicLink ? (
            <motion.form 
              key="magic-link"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleMagicLink}
              className="flex flex-col gap-4"
            >
              <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Acesso Sem Senha</h2>
              <p className="text-xs text-slate-500 font-medium">Enviaremos um link de acesso direto para seu e-mail.</p>
              
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest text-center">
                  {success}
                </div>
              )}

              <div className="relative">
                <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="email" 
                  placeholder="Seu e-mail"
                  required
                  className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 outline-none font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button type="submit" disabled={loading || !!success} className="h-14 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-95 mt-2">
                {loading ? 'Enviando...' : 'Enviar Link de Acesso'}
              </button>

              <button 
                type="button" 
                onClick={() => { setUseMagicLink(false); setError(''); }}
                className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors mt-2"
              >
                Voltar para Senha
              </button>
            </motion.form>
          ) : isRecovering ? (
            <motion.form 
              key="recovery"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleRecovery}
              className="flex flex-col gap-4"
            >
              <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Recuperar Senha</h2>
              <p className="text-xs text-slate-500 font-medium">Informe seu e-mail de recuperação cadastrado.</p>
              
              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
                  {error}
                </div>
              )}

              {success && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest text-center">
                  {success}
                </div>
              )}

              <div className="relative">
                <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="email" 
                  placeholder="E-mail de Recuperação"
                  required
                  className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 outline-none font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                />
              </div>

              <button type="submit" disabled={loading} className="h-14 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-95 mt-2 disabled:opacity-50">
                {loading ? 'Processando...' : 'Enviar Instruções'}
              </button>
              
              <button 
                type="button" 
                onClick={() => setIsRecovering(false)}
                className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 transition-colors"
              >
                Voltar ao Login
              </button>
            </motion.form>
          ) : (
            <motion.form 
              key={isLogin ? 'login' : 'signup'}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleAuth}
              className="flex flex-col gap-4"
            >
              <div className="flex p-1 bg-black/5 rounded-2xl mb-2">
                <button 
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Entrar
                </button>
                <button 
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Criar Conta
                </button>
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-black uppercase tracking-widest text-center">
                  {error}
                </div>
              )}

              {!isLogin && (
                <div className="relative">
                  <i className="fas fa-user absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                  <input 
                    type="text" 
                    placeholder="Nome Completo"
                    required
                    className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 outline-none font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              )}

              <div className="relative">
                <i className="fas fa-envelope absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="email" 
                  name="email"
                  autoComplete={isLogin ? "username" : "email"}
                  placeholder="E-mail Corporativo"
                  required
                  className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 outline-none font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="relative">
                <i className="fas fa-lock absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                <input 
                  type="password" 
                  name="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder="Senha"
                  required
                  className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 outline-none font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {!isLogin && (
                <>
                  <div className="relative">
                    <i className="fas fa-at absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <input 
                      type="email" 
                      placeholder="E-mail de Recuperação"
                      required
                      className={`w-full h-14 pl-12 pr-4 rounded-2xl border-2 outline-none font-bold transition-all ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                    />
                  </div>

                  <div className={`p-4 rounded-2xl border flex items-center justify-between ${isDarkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200'}`}>
                    <div className="flex items-center gap-3">
                      <i className="fas fa-fingerprint text-blue-500"></i>
                      <span className={`text-[10px] font-black uppercase tracking-widest ${isDarkMode ? 'text-slate-400' : 'text-slate-600'}`}>Habilitar Digital</span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => setFingerprintEnabled(!fingerprintEnabled)}
                      className={`w-12 h-6 rounded-full transition-all relative ${fingerprintEnabled ? 'bg-blue-600' : 'bg-slate-400'}`}
                    >
                      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${fingerprintEnabled ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                </>
              )}

              {isLogin && (
                <div className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => setIsRecovering(true)}
                      className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="button" 
                      onClick={() => setUseMagicLink(true)}
                      className="text-[10px] font-black uppercase tracking-widest text-blue-600/70 hover:text-blue-600 transition-colors"
                    >
                      Acessar via Link Mágico
                    </button>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className="h-14 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-95 mt-2 disabled:opacity-50">
                {loading ? 'Aguarde...' : (isLogin ? 'Acessar Sistema' : 'Finalizar Cadastro')}
              </button>

              {isLogin && (
                <div className="flex flex-col items-center gap-4 mt-4">
                  <div className="flex items-center gap-4 w-full">
                    <div className="h-px flex-1 bg-slate-500/20"></div>
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ou acesse com</span>
                    <div className="h-px flex-1 bg-slate-500/20"></div>
                  </div>
                  
                  <button 
                    type="button"
                    onClick={handleFingerprintLogin}
                    className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${isDarkMode ? 'bg-white/5 border-white/10 text-blue-500 hover:border-blue-500/50' : 'bg-white border-slate-200 text-blue-600 hover:border-blue-500 shadow-md'}`}
                  >
                    <i className="fas fa-fingerprint text-3xl"></i>
                  </button>
                </div>
              )}
            </motion.form>
          )}
        </AnimatePresence>

        <div className="mt-8 text-center">
          <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">
            © 2026 Porsche Workshop Management System
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
