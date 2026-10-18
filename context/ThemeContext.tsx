import AsyncStorage, { initializeLocalStore } from '../lib/localStore';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ActivityIndicator } from 'react-native';
import { themes, type Theme, type ThemeMode } from '../lib/theme';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

interface ThemeContextValue {
  mode: ThemeMode;
  theme: Theme;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = '@ikprono_theme_mode_v1';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');
  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadPreference = useCallback(async () => {
    setLoadError(null);
    setIsReady(false);
    try {
      await initializeLocalStore();
      const savedMode = await AsyncStorage.getItem(STORAGE_KEY);
      setModeState(savedMode === 'light' ? 'light' : 'dark');
      setIsReady(true);
    } catch (error) {
      console.error('Unable to load saved theme preference:', error);
      setLoadError('Impossible d’initialiser le stockage local et de charger votre préférence de thème.');
    }
  }, []);

  useEffect(() => {
    void loadPreference();
  }, [loadPreference]);

  const setMode = useCallback(async (nextMode: ThemeMode) => {
    await AsyncStorage.setItem(STORAGE_KEY, nextMode);
    setModeState(nextMode);
  }, []);

  const value = useMemo(() => ({ mode, theme: themes[mode], setMode }), [mode, setMode]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: themes.dark.background, padding: 24 }}>
        {loadError ? (
          <>
            <Text style={{ color: themes.dark.text, textAlign: 'center', marginBottom: 16 }}>{loadError}</Text>
            <TouchableOpacity accessibilityRole="button" onPress={() => { void loadPreference(); }}>
              <Text style={{ color: themes.dark.primary, fontWeight: '700' }}>Réessayer</Text>
            </TouchableOpacity>
          </>
        ) : <ActivityIndicator color={themes.dark.primary} />}
      </View>
    );
  }

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
