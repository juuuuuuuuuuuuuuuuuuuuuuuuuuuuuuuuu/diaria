import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Unlock, Loader2, PlayCircle } from 'lucide-react';


const Login = () => {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(username, password);
        if (result.success) {
            navigate('/');
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 p-4">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md p-8 rounded-lg shadow-xl border dark:border-slate-800">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                             <PlayCircle className="w-8 h-8 text-white" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Sistema La Diaria</h1>
                    <p className="text-slate-500 dark:text-slate-400">Inicie sesión para continuar</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Usuario</label>
                        <Input 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="admin"
                            className="bg-white dark:bg-slate-950"
                            autoFocus
                        />
                    </div>
                    <div className="space-y-2">
                         <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Contraseña</label>
                        <Input 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            type="password"
                            placeholder="••••••"
                            className="bg-white dark:bg-slate-950"
                        />
                    </div>

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-3 rounded text-sm text-center border border-red-200 dark:border-red-800">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full h-11 text-lg bg-blue-600 hover:bg-blue-700 text-white" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Unlock className="w-5 h-5 mr-2" />}
                        {loading ? 'Entrando...' : 'Ingresar'}
                    </Button>
                </form>
                
                <div className="mt-8 text-center text-xs text-slate-400">
                    &copy; {new Date().getFullYear()} Sistema POS
                </div>
            </div>
        </div>
    );
};

export default Login;
