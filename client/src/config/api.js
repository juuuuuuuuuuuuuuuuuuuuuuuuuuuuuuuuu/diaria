// Centralized API Configuration
// Automatically detects if we are in production (Vercel) or Development (Local/LAN)

const getBaseUrl = () => {
    // If a specific env var is set (Production in Vercel), use it
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }

    // Fallback for Local Network Development (allows 192.168.x.x access)
    // Assumes backend is always on port 3001 relative to the frontend host
    return `http://${window.location.hostname}:3001/api`;
};

const API_URL = getBaseUrl();

export default API_URL;
