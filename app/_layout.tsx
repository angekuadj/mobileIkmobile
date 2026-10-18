import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../context/AuthContext';
import { FavoritesProvider } from '../context/FavoritesContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import MatchNotificationMonitor from '../components/MatchNotificationMonitor';
import { LocalizationProvider } from '../lib/localization';

export default function RootLayout() {
  return (
    <LocalizationProvider>
      <ThemeProvider>
        <AuthProvider>
          <FavoritesProvider>
            <AppNavigator />
          </FavoritesProvider>
        </AuthProvider>
      </ThemeProvider>
    </LocalizationProvider>
  );
}

function AppNavigator() {
  const { theme, mode } = useTheme();
  return (
    <>
      <MatchNotificationMonitor />
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} backgroundColor={theme.background} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
        <Stack.Screen name="rating" options={{ headerShown: false }} />
        <Stack.Screen name="dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="profile-edit" options={{ headerShown: false }} />
        <Stack.Screen name="payment" options={{ headerShown: false }} />
        <Stack.Screen name="lottery" options={{ headerShown: false }} />
        <Stack.Screen name="help" options={{ headerShown: false }} />
        <Stack.Screen name="faq" options={{ headerShown: false }} />
        <Stack.Screen name="contact" options={{ headerShown: false }} />
        <Stack.Screen name="privacy" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ headerShown: false }} />
        <Stack.Screen name="live" options={{ headerShown: false }} />
        <Stack.Screen name="live-analysis" options={{ headerShown: false }} />
        <Stack.Screen name="notifications-test" options={{ headerShown: false }} />
        <Stack.Screen name="ai-search" options={{ headerShown: false }} />
        <Stack.Screen name="combinations" options={{ headerShown: false }} />
        <Stack.Screen name="admin/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/users" options={{ headerShown: false }} />
        <Stack.Screen name="admin/stats" options={{ headerShown: false }} />
        <Stack.Screen name="admin/payments" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}
