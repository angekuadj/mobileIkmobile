export type Theme = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryDark: string;
  accentSurface: string;
  accentBorder: string;
  navBackground: string;
  warning: string;
  danger: string;
};

export type ThemeMode = 'dark' | 'light';

export const themes: Record<ThemeMode, Theme> = {
  dark: {
    background: '#050407',
    surface: '#100c15',
    surfaceRaised: '#1f1829',
    border: 'rgba(192, 132, 252, 0.16)',
    text: '#ffffff',
    muted: '#a39aaa',
    primary: '#e879f9',
    primaryDark: '#c026d3',
    accentSurface: 'rgba(126, 34, 206, 0.16)',
    accentBorder: 'rgba(192, 132, 252, 0.23)',
    navBackground: '#09070d',
    warning: '#fbbf24',
    danger: '#f87171',
  },
  light: {
    background: '#faf7fc',
    surface: '#ffffff',
    surfaceRaised: '#f1eaf7',
    border: 'rgba(126, 34, 206, 0.16)',
    text: '#21152b',
    muted: '#706579',
    primary: '#a21caf',
    primaryDark: '#86198f',
    accentSurface: 'rgba(192, 38, 211, 0.09)',
    accentBorder: 'rgba(126, 34, 206, 0.22)',
    navBackground: '#ffffff',
    warning: '#9a6700',
    danger: '#c62828',
  },
};
