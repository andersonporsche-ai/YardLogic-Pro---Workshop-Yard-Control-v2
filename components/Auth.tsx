
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { supabase } from '../services/supabase';

interface AuthProps {
  onLogin: (user: User) => void;
  isDarkMode: boolean;
}

const Auth: React.FC<AuthProps> = ({ onLogin, isDarkMode }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        
        if (data.user) {
          // Fetch profile
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
        if (!name || !email || !password || !recoveryEmail) {
          setError('Por favor, preencha todos os campos.');
          setLoading(false);
          return;
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: name,
            }
          }
        });

        if (signUpError) throw signUpError;

        if (data.user) {
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
    // In a real app with Supabase, we would use WebAuthn
    setError('A autenticação por digital via Supabase requer configuração de WebAuthn.');
  };

  const handleRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(recoveryEmail || email);
      if (error) throw error;
      alert(`Um e-mail de recuperação foi enviado para ${recoveryEmail || email}`);
      setIsRecovering(false);
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
          {isRecovering ? (
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
                <div className="flex justify-end">
                  <button 
                    type="button" 
                    onClick={() => setIsRecovering(true)}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-500 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
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
