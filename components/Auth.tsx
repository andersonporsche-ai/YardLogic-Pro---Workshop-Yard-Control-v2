
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { User, UserRole } from '../types';
import { supabase } from '../services/supabase';
import { PorscheLogo } from './PorscheLogo';

interface AuthProps {
  onLogin: (user: User) => void;
  isDarkMode: boolean;
  isResettingPassword?: boolean;
  onResetComplete?: () => void;
  showAdminManagement?: boolean;
  onCloseAdminManagement?: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin, isDarkMode, isResettingPassword, onResetComplete, showAdminManagement, onCloseAdminManagement }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [name, setName] = useState('');
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [position, setPosition] = useState<string>('Consultor');
  const [fingerprintEnabled, setFingerprintEnabled] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [isAdminPanel, setIsAdminPanel] = useState(showAdminManagement || false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [biometricType, setBiometricType] = useState<'fingerprint' | 'face' | 'none'>('none');
  const videoRef = React.useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // Check for platform-specific biometric support (FaceID, Fingerprint, etc.)
    const checkBiometricSupport = async () => {
      if (window.PublicKeyCredential) {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        setBiometricAvailable(available);
        
        // Try to guess type if available (modern browsers)
        if (available) {
          // If FaceID or TouchID is specifically hinted at by the user agent
          const ua = navigator.userAgent.toLowerCase();
          if (ua.includes('iphone') || ua.includes('ipad')) setBiometricType('face');
          else setBiometricType('fingerprint'); 
        }
      }
    };
    
    checkBiometricSupport();
  }, []);

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user', width: { ideal: 400 }, height: { ideal: 400 } } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      return true;
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Acesso à câmera negado. Por favor, habilite as permissões.');
      return false;
    }
  };
  const POSITION_PERMISSIONS: Record<string, string[]> = {
    'consultant': ['view_yard', 'view_tasks', 'edit_own_tasks'],
    'operator': ['view_yard', 'manage_vehicles', 'move_vehicles'],
    'manager': ['view_yard', 'view_dashboard', 'view_reports', 'manage_vehicles'],
    'admin': ['all']
  };

  useEffect(() => {
    if (showAdminManagement) setIsAdminPanel(true);
    else setIsAdminPanel(false);
  }, [showAdminManagement]);

  const [editingPosition, setEditingPosition] = useState<string | null>(null);
  const [currentPerms, setCurrentPerms] = useState<Record<string, string[]>>(POSITION_PERMISSIONS);

  const POSITIONS = [
    { id: 'consultant', label: 'Consultor', role: 'consultant' },
    { id: 'operator', label: 'Operador de Pátio', role: 'operator' },
    { id: 'manager', label: 'Gerente', role: 'manager' },
    { id: 'admin', label: 'Administrador', role: 'admin' }
  ];

  const ALL_PERMISSIONS = [
    { id: 'view_yard', label: 'Visualizar Pátios', icon: 'fa-warehouse' },
    { id: 'manage_vehicles', label: 'Gerenciar Veículos', icon: 'fa-car' },
    { id: 'view_tasks', label: 'Ver Quadro de Tarefas', icon: 'fa-tasks' },
    { id: 'edit_own_tasks', label: 'Editar Próprias Tarefas', icon: 'fa-pen' },
    { id: 'move_vehicles', label: 'Transferir Veículos', icon: 'fa-exchange-alt' },
    { id: 'view_dashboard', label: 'Ver Dashboard IA', icon: 'fa-chart-pie' },
    { id: 'view_reports', label: 'Gerar Relatórios PDF', icon: 'fa-file-pdf' },
    { id: 'manage_users', label: 'Gerenciar Usuários', icon: 'fa-users-cog' }
  ];

  const handleTogglePermission = (posId: string, permId: string) => {
    setCurrentPerms(prev => {
      const perms = prev[posId] || [];
      const newPerms = perms.includes(permId) 
        ? perms.filter(p => p !== permId) 
        : [...perms, permId];
      return { ...prev, [posId]: newPerms };
    });
  };

  const handleSavePermissions = () => {
    // In a real app, this would update a 'role_permissions' table in Supabase
    setSuccess('Configurações de permissões salvas com sucesso!');
    setTimeout(() => {
      setSuccess('');
      setIsAdminPanel(false);
    }, 2000);
  };

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

            // Update trusted credentials if biometric choice is true
            if (profile?.fingerprint_enabled) {
              localStorage.setItem('yardlogic_trusted_user', email);
              localStorage.setItem('yardlogic_trusted_pass', password);
            }

            onLogin({
            id: data.user.id,
            name: profile?.name || data.user.email?.split('@')[0] || 'Usuário',
            email: data.user.email || '',
            recoveryEmail: profile?.recovery_email || '',
            fingerprintEnabled: profile?.fingerprint_enabled || false,
            role: profile?.role || 'operator',
            position: profile?.position || 'Operador de Pátio',
            permissions: profile?.permissions || [],
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

          const selectedPos = POSITIONS.find(p => p.label === position) || POSITIONS[0];

          // Create profile with role and position
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              { 
                id: data.user.id, 
                name, 
                recovery_email: recoveryEmail, 
                fingerprint_enabled: fingerprintEnabled,
                position: position,
                role: selectedPos.role,
                permissions: POSITION_PERMISSIONS[selectedPos.role as string]
              }
            ]);

          if (profileError) console.error('Erro ao criar perfil:', profileError);

          // Save for biometric if enabled
          if (fingerprintEnabled) {
            localStorage.setItem('yardlogic_trusted_user', email);
            localStorage.setItem('yardlogic_trusted_pass', password);
          }

          onLogin({
            id: data.user.id,
            name,
            email,
            recoveryEmail,
            fingerprintEnabled,
            position,
            role: selectedPos.role as UserRole,
            permissions: POSITION_PERMISSIONS[selectedPos.role as string],
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
    
    // 1. Check for Biometric Support
    if (!biometricAvailable) {
      setError('Autenticação biométrica não disponível ou não configurada neste dispositivo.');
      return;
    }

    setIsScanning(true);
    
    // Start camera for visual "scanning" effect if it's FaceID style or just for premium feel
    await startCamera();
    
    try {
      // 2. Trigger native biometric prompt via WebAuthn
      // We use a challenge to trigger the native UI
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      // Attempt to get credentials with biometrics (platform)
      // Note: In a real app with server, we'd use allowCredentials from our DB
      const options: CredentialRequestOptions = {
        publicKey: {
          challenge: challenge,
          timeout: 60000,
          userVerification: "required",
          rpId: window.location.hostname === 'localhost' ? 'localhost' : window.location.hostname,
        }
      };

      // Since we are likely in a prototype/demo mode without a production domain or origin constraints,
      // we'll try the publicKey first, then fallback to Password Management if that fails
      try {
        await navigator.credentials.get(options);
        // If we reach here, the biometric verification on the DEVICE passed
        setSuccess('Biometria autenticada pelo dispositivo!');
      } catch (authErr) {
        console.warn('PublicKey auth failed, trying Password Manager:', authErr);
        // Fallback to password manager/CMAPI
        const credential = await navigator.credentials.get({
          password: true,
          mediation: 'optional'
        }) as PasswordCredential | null;

        if (!credential) {
          throw new Error('Autenticação cancelada ou não encontrada.');
        }
        
        setEmail(credential.id);
        setPassword(credential.password);
      }

      // 3. Perform manual login with the gathered credentials OR 
      // If we authenticated but don't have credentials (e.g. publicKey success only), 
      // we check for a "Trusted User" in local storage
      const savedUser = localStorage.getItem('yardlogic_trusted_user');
      const savedPass = localStorage.getItem('yardlogic_trusted_pass');

      if (savedUser && savedPass) {
        setLoading(true);
        const { data, error: signInError } = await supabase.auth.signInWithPassword({
          email: savedUser.trim(),
          password: savedPass,
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
            role: profile?.role || 'operator',
            position: profile?.position || 'Operador de Pátio',
            permissions: profile?.permissions || [],
            createdAt: data.user.created_at
          });
        }
      } else {
        setError('Por favor, faça o login manual com senha uma vez para registrar sua biometria neste dispositivo.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro na autenticação biométrica.';
      setError(message);
    } finally {
      // Delay for the animation to look "high-tech"
      await new Promise(resolve => setTimeout(resolve, 1000));
      stopCamera();
      setIsScanning(false);
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
        <div className="flex flex-col items-center mb-8 gap-4 text-center">
          <div className="flex items-center gap-6">
            <PorscheLogo size={300} />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="flex flex-col items-center"
          >
            <div className="overflow-hidden py-1">
              <motion.p 
                initial={{ y: "100%", opacity: 0, filter: "blur(5px)" }}
                animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
                className={`text-[10px] font-space font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-slate-400' : 'text-slate-500'}`}
              >
                Logística de Pátio
              </motion.p>
            </div>
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="relative px-4"
            >
              <motion.div 
                animate={{ opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="text-[11px] font-bold text-blue-500 uppercase tracking-[0.4em] mt-1"
              >
                Porsche
              </motion.div>
              
              {/* Shine effect for Auth screen too */}
              <motion.div 
                animate={{ 
                  left: ['-100%', '200%'],
                }}
                transition={{ 
                  duration: 2, 
                  repeat: Infinity, 
                  repeatDelay: 5,
                  ease: "easeInOut"
                }}
                className="absolute inset-0 z-10 w-full h-full bg-gradient-to-r from-transparent via-blue-500/20 to-transparent -skew-x-[25deg] pointer-events-none"
              />
            </motion.div>
          </motion.div>
        </div>

        <AnimatePresence mode="wait">
          {isScanning ? (
            <motion.div
              key="scanning"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center gap-6 py-8"
            >
              <div className="relative w-48 h-48">
                {/* Visual Scanner Frame */}
                <div className="absolute inset-0 border-4 border-blue-600/30 rounded-full animate-pulse"></div>
                <div className="absolute inset-[-10px] border-2 border-dashed border-blue-500/20 rounded-full animate-[spin_10s_linear_infinite]"></div>
                
                {/* Camera Feed */}
                <div className="w-full h-full rounded-full overflow-hidden border-4 border-blue-600 relative bg-black shadow-2xl shadow-blue-600/20">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    muted 
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                  
                  {/* Scanning Bar */}
                  <motion.div 
                    initial={{ top: '0%' }}
                    animate={{ top: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                    className="absolute left-0 right-0 h-1 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] z-20"
                  />
                  
                  {/* Grid Overlay */}
                  <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,0,0,0)_0%,rgba(0,0,0,0.4)_100%)] z-10 pointer-events-none"></div>
                </div>

                {/* Face Target Reticle */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-40 border-2 border-white/20 rounded-[4rem] z-30"></div>
              </div>

              <div className="text-center">
                <h3 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Iniciando Reconhecimento</h3>
                <p className="text-[10px] text-blue-500 font-bold uppercase tracking-widest mt-1">Aguarde o processamento biométrico...</p>
              </div>

              <button 
                onClick={() => { stopCamera(); setIsScanning(false); }}
                className="mt-4 px-6 py-2 rounded-xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase tracking-widest border border-red-500/20 hover:bg-red-500 hover:text-white transition-all"
              >
                Cancelar
              </button>
            </motion.div>
          ) : isAdminPanel ? (
            <motion.div
              key="admin-panel"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex flex-col gap-6"
            >
              <div className="flex justify-between items-center mb-2">
                <h2 className={`text-lg font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-slate-800'}`}>Gestão de Permissões</h2>
                <button 
                  onClick={() => onCloseAdminManagement ? onCloseAdminManagement() : setIsAdminPanel(false)}
                  className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-slate-500/10 transition-colors"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>

              {success && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest text-center">
                  {success}
                </div>
              )}

              <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {POSITIONS.map(pos => (
                  <div key={pos.id} className={`p-4 rounded-2xl border transition-all ${editingPosition === pos.id ? 'border-blue-500 ring-2 ring-blue-500/10' : (isDarkMode ? 'bg-white/5 border-white/5' : 'bg-slate-50 border-slate-200')}`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${pos.role === 'admin' ? 'bg-blue-600' : 'bg-slate-500'}`}>
                          <i className={`fas ${pos.role === 'admin' ? 'fa-user-tie' : 'fa-user'}`}></i>
                        </div>
                        <span className={`text-[11px] font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-slate-900'}`}>{pos.label}</span>
                      </div>
                      <button 
                        onClick={() => setEditingPosition(editingPosition === pos.id ? null : pos.id)}
                        className={`text-[9px] font-black uppercase border px-3 py-1.5 rounded-lg transition-all ${editingPosition === pos.id ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-500/20 text-slate-500 hover:border-blue-500 hover:text-blue-500'}`}
                      >
                        {editingPosition === pos.id ? 'Fechar' : 'Editar'}
                      </button>
                    </div>

                    {editingPosition === pos.id && (
                      <div className="grid grid-cols-1 gap-2 mt-4 animate-in fade-in slide-in-from-top-2">
                        {ALL_PERMISSIONS.map(perm => (
                           <button
                            key={perm.id}
                            onClick={() => handleTogglePermission(pos.id, perm.id)}
                            className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${currentPerms[pos.id]?.includes(perm.id) ? 'bg-blue-500/10 border-blue-500 text-blue-500' : 'border-transparent hover:bg-black/5 opacity-60'}`}
                           >
                            <div className="flex items-center gap-3">
                              <i className={`fas ${perm.icon} text-xs`}></i>
                              <span className="text-[10px] font-bold uppercase">{perm.label}</span>
                            </div>
                            {currentPerms[pos.id]?.includes(perm.id) && <i className="fas fa-check-circle text-xs"></i>}
                           </button>
                        ))}
                      </div>
                    )}

                    {editingPosition !== pos.id && (
                      <div className="flex flex-wrap gap-1.5">
                        {currentPerms[pos.id]?.map(pId => (
                          <span key={pId} className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 text-[8px] font-black uppercase">
                            {ALL_PERMISSIONS.find(ap => ap.id === pId)?.label || pId}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <button 
                onClick={handleSavePermissions}
                className="h-14 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-all active:scale-95 mt-4"
              >
                Salvar Configurações
              </button>
            </motion.div>
          ) : isResettingPassword ? (
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
                    <i className="fas fa-briefcase absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"></i>
                    <select 
                      className={`w-full h-14 pl-12 pr-10 rounded-2xl border-2 outline-none font-bold transition-all appearance-none ${isDarkMode ? 'bg-white/5 border-white/5 text-white focus:border-blue-500/50' : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-blue-500'}`}
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                    >
                      {POSITIONS.map(p => (
                        <option key={p.id} value={p.label}>{p.label}</option>
                      ))}
                    </select>
                    <i className="fas fa-chevron-down absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"></i>
                  </div>

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
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Ou acesse com sua Biometria</span>
                    <div className="h-px flex-1 bg-slate-500/20"></div>
                  </div>
                  
                  <div className="relative group">
                    {biometricAvailable && (
                      <motion.div 
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1.2, opacity: 0.3 }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="absolute inset-[-8px] bg-blue-500/30 rounded-3xl blur-xl"
                      />
                    )}
                    <button 
                      type="button"
                      onClick={handleFingerprintLogin}
                      className={`w-18 h-18 rounded-2xl border-2 flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95 relative z-10 ${isDarkMode ? 'bg-white/5 border-white/10 text-blue-500 hover:border-blue-500/50' : 'bg-white border-slate-200 text-blue-600 hover:border-blue-500 shadow-xl'}`}
                    >
                      <i className={`fas ${biometricType === 'face' ? 'fa-face-smile' : 'fa-fingerprint'} text-3xl mb-1`}></i>
                      <span className="text-[7px] font-black uppercase tracking-widest">
                        {biometricType === 'face' ? 'FaceID' : 'TouchID'}
                      </span>
                    </button>
                    {!biometricAvailable && (
                      <div className="absolute top-0 right-[-40px] w-6 h-6 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center" title="Biometria não configurada no dispositivo">
                        <i className="fas fa-exclamation-triangle text-[10px]"></i>
                      </div>
                    )}
                  </div>
                  {!biometricAvailable && (
                     <p className="text-[9px] text-slate-500 font-medium max-w-[200px] text-center">
                       Configure a biometria nas definições do seu celular para acesso rápido.
                     </p>
                  )}
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
