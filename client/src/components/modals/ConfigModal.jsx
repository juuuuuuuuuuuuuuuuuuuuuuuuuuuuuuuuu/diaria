import React, { useState, useEffect } from 'react';
import API_URL from '@/config/api';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, Users, Plus, Trash2, Key, Save } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '@/context/AuthContext';

const ConfigModal = ({ isOpen, onClose }) => {
  const { user: currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [loading, setLoading] = useState(false);
  
  // Config State
  const [configData, setConfigData] = useState({
    limit_per_number: 350,
    limit_total_shift: 5000,
    whatsapp_number: ''
  });

  // Users State
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', password: '' });
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadConfig();
      if (activeTab === 'users') loadUsers();
    }
  }, [isOpen, activeTab]);

  const loadConfig = async () => {
    try {
      const res = await axios.get(`${API_URL}/config`);
      setConfigData({
         limit_per_number: res.data.limit_per_number,
         limit_total_shift: res.data.limit_total_shift || 5000,
         whatsapp_number: res.data.whatsapp_number || ''
      });
    } catch (err) {
      console.error(err);
    }
  };

  const loadUsers = async () => {
      setLoadingUsers(true);
      try {
          const res = await axios.get(`${API_URL}/users`);
          setUsers(res.data);
      } catch (err) {
          console.error(err);
      } finally {
          setLoadingUsers(false);
      }
  };

  const handleConfigChange = (e) => {
    setConfigData({ ...configData, [e.target.name]: e.target.value });
  };

  const handleSaveConfig = async () => {
     setLoading(true);
     try {
       const current = await axios.get(`${API_URL}/config`);
       await axios.put(`${API_URL}/config`, {
            ...current.data,
            limit_per_number: parseInt(configData.limit_per_number),
            limit_total_shift: parseInt(configData.limit_total_shift),
            whatsapp_number: configData.whatsapp_number
       });
       onClose();
       alert("Configuración guardada");
     } catch (err) {
        console.error(err);
        alert("Error al guardar configuración");
     } finally {
        setLoading(false);
     }
  };

  const handleCreateUser = async (e) => {
      e.preventDefault();
      if (!newUser.username || !newUser.password) return;
      
      try {
          await axios.post(`${API_URL}/users`, newUser);
          setNewUser({ username: '', password: '' });
          loadUsers();
          alert("Usuario creado");
      } catch (err) {
          alert(err.response?.data?.error || "Error al crear usuario");
      }
  };

  const handleDeleteUser = async (userId) => {
      if (!confirm("¿Eliminar usuario?")) return;
      try {
          await axios.delete(`${API_URL}/users/${userId}`);
          loadUsers();
      } catch (err) {
          alert(err.response?.data?.error || "Error al eliminar");
      }
  };

  const handleResetPassword = async (userId) => {
      const newPass = prompt("Ingrese nueva contraseña:");
      if (!newPass) return;
      
      try {
          await axios.put(`${API_URL}/users/${userId}/password`, { password: newPass });
          alert("Contraseña actualizada");
      } catch (err) {
           alert("Error al actualizar contraseña");
      }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 h-[80vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 border-b dark:border-slate-800">
          <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white">Configuración del Sistema</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-48 bg-slate-50 dark:bg-slate-950 border-r dark:border-slate-800 p-4 space-y-2">
                <Button 
                    variant={activeTab === 'general' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start dark:text-slate-300" 
                    onClick={() => setActiveTab('general')}
                >
                    <Settings className="w-4 h-4 mr-2" /> General
                </Button>
                <Button 
                    variant={activeTab === 'users' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start dark:text-slate-300"
                    onClick={() => setActiveTab('users')}
                >
                    <Users className="w-4 h-4 mr-2" /> Usuarios
                </Button>
            </div>

            {/* Content */}
            <div className="flex-1 p-6 overflow-y-auto">
                {activeTab === 'general' && (
                    <div className="space-y-6">
                        <div className="space-y-2">
                           <Label className="dark:text-slate-300">Límite por Número (Lps)</Label>
                           <Input 
                              name="limit_per_number" 
                              type="number" 
                              value={configData.limit_per_number} 
                              onChange={handleConfigChange} 
                              className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="dark:text-slate-300">Límite Total por Turno (Lps)</Label>
                           <Input 
                              name="limit_total_shift" 
                              type="number" 
                              value={configData.limit_total_shift} 
                              onChange={handleConfigChange} 
                              className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="dark:text-slate-300">WhatsApp para Reportes</Label>
                           <Input 
                              name="whatsapp_number" 
                              placeholder="Ej: 50499999999" 
                              value={configData.whatsapp_number} 
                              onChange={handleConfigChange} 
                              className="dark:bg-slate-950 dark:border-slate-800 dark:text-white"
                           />
                           <p className="text-xs text-slate-500 dark:text-slate-400">Formato internacional sin símbolos.</p>
                        </div>
                        <div className="pt-4 border-t dark:border-slate-800">
                             <Button onClick={handleSaveConfig} disabled={loading} className="w-full bg-slate-900 dark:bg-slate-800 text-white">
                                 <Save className="w-4 h-4 mr-2" />
                                 {loading ? 'Guardando...' : 'Guardar Cambios'}
                             </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'users' && (
                    <div className="space-y-6">
                        {/* Create User Form */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border dark:border-slate-800">
                            <h3 className="font-semibold mb-3 text-slate-800 dark:text-white flex items-center"><Plus className="w-4 h-4 mr-2" /> Nuevo Usuario</h3>
                            <form onSubmit={handleCreateUser} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                                <div>
                                    <Label className="text-xs dark:text-slate-400">Usuario</Label>
                                    <Input 
                                        value={newUser.username}
                                        onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                                        placeholder="ej: cajero1"
                                        className="h-8 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <Label className="text-xs dark:text-slate-400">Contraseña</Label>
                                    <Input 
                                        value={newUser.password}
                                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                                        type="password"
                                        placeholder="******"
                                        className="h-8 dark:bg-slate-950 dark:border-slate-700 dark:text-white"
                                    />
                                </div>
                                <Button size="sm" type="submit" className="md:col-span-2 mt-2 bg-blue-600 hover:bg-blue-700 text-white">Crear Usuario</Button>
                            </form>
                        </div>

                        {/* User List */}
                        <div className="space-y-2">
                             <h3 className="font-semibold text-slate-800 dark:text-white mb-2">Usuarios Existentes</h3>
                             {loadingUsers ? <p className="text-sm text-slate-500">Cargando...</p> : (
                                 <div className="border dark:border-slate-800 rounded-md overflow-hidden">
                                     {users.map(u => (
                                         <div key={u.id} className="flex items-center justify-between p-3 border-b last:border-0 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                              <div className="flex items-center gap-3">
                                                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-400">
                                                      {u.username[0].toUpperCase()}
                                                  </div>
                                                  <div>
                                                      <p className="font-medium text-sm text-slate-900 dark:text-slate-200">{u.username}</p>
                                                      <p className="text-xs text-slate-500 dark:text-slate-500 capitalize">{u.role}</p>
                                                  </div>
                                              </div>
                                              <div className="flex gap-1">
                                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-500 dark:text-blue-400" title="Cambiar Contraseña" onClick={() => handleResetPassword(u.id)}>
                                                      <Key className="w-4 h-4" />
                                                  </Button>
                                                  {currentUser?.id !== u.id && (
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 dark:text-red-400" title="Eliminar" onClick={() => handleDeleteUser(u.id)}>
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                  )}
                                              </div>
                                         </div>
                                     ))}
                                 </div>
                             )}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ConfigModal;
