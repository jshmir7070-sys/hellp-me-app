import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { login as apiLogin } from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  isTeamLeader: boolean;
}

interface Team {
  id: number;
  name: string;
  commissionRate: number;
  businessType?: string;
}

interface AuthContextType {
  user: User | null;
  team: Team | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('partner_token');
    const storedUser = localStorage.getItem('partner_user');
    const storedTeam = localStorage.getItem('partner_team');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
        if (storedTeam) setTeam(JSON.parse(storedTeam));
      } catch {
        localStorage.removeItem('partner_token');
        localStorage.removeItem('partner_user');
        localStorage.removeItem('partner_team');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await apiLogin(email, password);
    localStorage.setItem('partner_token', response.token);
    localStorage.setItem('partner_user', JSON.stringify(response.user));
    localStorage.setItem('partner_team', JSON.stringify(response.team));
    setUser(response.user);
    setTeam(response.team);
    navigate('/');
  };

  const logout = () => {
    localStorage.removeItem('partner_token');
    localStorage.removeItem('partner_user');
    localStorage.removeItem('partner_team');
    setUser(null);
    setTeam(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        team,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
