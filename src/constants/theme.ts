export const THEME = {
  colors: {
    background: '#0a0a0c',
    surface: '#121216',
    surfaceElevated: '#1a1a24',
    surfaceHover: '#242432',
    border: '#202028',
    borderSubtle: '#181822',
    primary: '#e50914', // CineBox Red
    primaryMuted: 'rgba(229, 9, 20, 0.15)',
    primaryGlow: 'rgba(229, 9, 20, 0.35)',
    text: '#ffffff',
    textMuted: '#8e8e9e',
    textSecondary: '#a0a0b2',
    gold: '#ffb800',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    xxxl: 32,
  },
  borderRadius: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
} as const;

export type ThemeColors = typeof THEME.colors;
