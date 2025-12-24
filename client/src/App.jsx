import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import Layout from '@/components/Layout';

import Dashboard from '@/pages/Dashboard';
import Config from '@/pages/Config';
import History from '@/pages/History';
import Login from '@/pages/Login';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const ProtectedRoute = () => {
  const { user, loading } = useAuth();
  
  if (loading) return <div className="min-h-screen flex items-center justify-center">Cargando...</div>;
  
  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="history" element={<History />} />
            <Route path="config" element={<Config />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}

export default App;
