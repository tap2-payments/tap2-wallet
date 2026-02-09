import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

import { authService, AuthState, AuthUser } from '@/services/auth';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, password: string, name: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshTokens: () => Promise<AuthState['tokens'] | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.JSX.Element {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    user: null,
    tokens: null,
  });

  useEffect(() => {
    // Initialize auth service
    let isMounted = true;

    authService
      .initialize()
      .then((state) => {
        if (isMounted) {
          setAuthState(state);
        }
      })
      .catch((error) => {
        console.error('Failed to initialize auth:', error);
        if (isMounted) {
          setAuthState({
            isAuthenticated: false,
            isLoading: false,
            user: null,
            tokens: null,
          });
        }
      });

    // Subscribe to auth state changes
    const unsubscribe = authService.subscribe((state) => {
      if (isMounted) {
        setAuthState(state);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    const user = await authService.login(email, password);
    return user;
  };

  const register = async (email: string, password: string, name: string) => {
    const user = await authService.register(email, password, name);
    return user;
  };

  const logout = async () => {
    await authService.logout();
  };

  const refreshTokens = async () => {
    return authService.refreshTokens();
  };

  const value: AuthContextValue = {
    ...authState,
    login,
    register,
    logout,
    refreshTokens,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
