import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import API_URL from '@/config/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            // Validate token or just decode? For now simple decode/persist
            // Ideally we could verify with backend, but we'll assume valid and let 401s handle logout
            try {
                // Decode payload simply for user info if needed, or rely on persisted user
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    setUser(JSON.parse(storedUser));
                }
            } catch (e) {
                console.error("Auth init error", e);
                logout();
            }
        }
        setLoading(false);
    }, []);

    const login = async (username, password) => {
        try {
            const res = await axios.post(`${API_URL}/auth/login`, { username, password });
            const { token, user } = res.data;
            
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
            
            setToken(token);
            setUser(user);
            return { success: true };
        } catch (e) {
            return { success: false, error: e.response?.data?.error || "Error al iniciar sesión" };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setToken(null);
        setUser(null);
    };

    // Axios interceptor to add token
    useEffect(() => {
        const reqInterceptor = axios.interceptors.request.use(config => {
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        const resInterceptor = axios.interceptors.response.use(
            response => response,
            error => {
                if (error.response?.status === 401 || error.response?.status === 403) {
                    // Only logout if it's strictly auth error (and maybe not just a bad login attempt)
                    // But for general API protection, usually 401 means expired
                    // Be careful not to loop on login page
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.request.eject(reqInterceptor);
            axios.interceptors.response.eject(resInterceptor);
        };
    }, [token]);

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};
