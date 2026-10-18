import { useMemo } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet } from 'react-native';
import { useBasket } from '../../hooks/useBasket';
import { useGeneratedCombinations } from '../../hooks/useGeneratedCombinations';
import { useAnonymousCombinationQuota } from '../../hooks/useAnonymousCombinationQuota';
import { useAuth } from '../../context/AuthContext';
import type { GeneratedCoupon } from '../../lib/coupons';
import { fetchFixtureStatuses, getLocalDate, isLiveFixtureStatus, isUpcomingFixture, shiftDate, type Fixture } from '../../lib/fixtures';
import { suggestAutomaticCoupon, suggestCoupons } from '../../lib/fotmobClient';
import { useTheme } from '../../context/ThemeContext';
import type { Theme } from '../../lib/theme';
import {
  notifyCombinationSaved,
  notifyCombinationsGenerated,
  trackSavedCombination,
} from '../../services/combinationNotifications';
import { LocalizedText as Text } from '../../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../../lib/localization';
import { LocalizedAlert as Alert } from '../../lib/localization';
import { useLanguage } from '../../lib/localization';

type RiskLevel = 'very-safe' | 'safe' | 'medium' | 'bold' | 'very-risky';
type SaveDialog = { title: string; message: string; tone: 'success' | 'warning' };

const RISK_LEVELS: Array<{ value: RiskLevel; label: string; note: string }> = [
  { value: 'very-safe', label: 'Très prudent', note: 'Historique privilégié' },
  { value: 'safe', label: 'Prudent', note: 'Double chance & buts' },
  { value: 'medium', label: 'Équilibré', note: 'Résultats fréquents' },
  { value: 'bold', label: 'Audacieux', note: 'Vainqueur favori' },
  { value: 'very-risky', label: 'Très risqué', note: 'Scénarios offensifs' },
];

const PICK_LABELS: Record<string, string> = {
  home: 'Victoire domicile (1)',
  draw: 'Match nul (N)',
  away: 'Victoire extérieur (2)',
  'home-or-draw': 'Domicile ou nul (1X)',
  'away-or-draw': 'Extérieur ou nul (X2)',
  'either-win': 'Victoire d’une équipe (12)',
  'over-0.5': 'Plus de 0,5 but',
  'over-1.5': 'Plus de 1,5 buts',
  'over-2.5': 'Plus de 2,5 buts',
};

export default function PredictionsScreen() {
  const { language, t } = useLanguage();
  const dateLocale = language === 'fr' ? 'fr-FR' : 'en-US';
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const router = useRouter();
  const basket = useBasket();
  const savedCombinations = useGeneratedCombinations();
  const { isAuthenticated } = useAuth();
  const quota = useAnonymousCombinationQuota();
  const [mode, setMode] = useState<'selection' | 'automatic'>('selection');
  const [riskLevel, setRiskLevel] = useState<RiskLevel>('medium');
  const [startDate, setStartDate] = useState(getLocalDate);
  const [requestedCount, setRequestedCount] = useState(3);
  const [includeLive, setIncludeLive] = useState(false);
  const [randomizeAutomatic, setRandomizeAutomatic] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [saveDialog, setSaveDialog] = useState<SaveDialog | null>(null);
  const [coupons, setCoupons] = useState<GeneratedCoupon[]>([]);
  const [latestBasketFixtures, setLatestBasketFixtures] = useState<Fixture[]>([]);
  const [basketStatusError, setBasketStatusError] = useState('');
  const basketIds = basket.fixtures.map(fixture => fixture.id).join(',');
  const latestById = new Map(latestBasketFixtures.map(fixture => [fixture.id, fixture]));
  const currentBasketFixtures = basket.fixtures.map(fixture => latestById.get(fixture.id) || fixture);
  const canGenerate = mode === 'automatic'
    || (currentBasketFixtures.length > 0 && currentBasketFixtures.every(fixture =>
      isUpcomingFixture(fixture) || (includeLive && isLiveFixtureStatus(fixture.status))
    ));
  const quotaBlocked = !isAuthenticated
    && (quota.isLoading || quota.storageError !== null || quota.remaining === 0);
  const combinationsToGenerate = isAuthenticated ? 3 : Math.min(3, quota.remaining);

  const announceGenerated = async (count: number) => {
    try {
      if (!await notifyCombinationsGenerated(count)) {
        setError('Combinaison générée, mais les notifications locales sont indisponibles. Autorisez-les sur l’application mobile pour recevoir les alertes.');
      }
    } catch (notificationError) {
      console.error('Unable to notify about generated combinations:', notificationError);
      setError('Combinaison générée, mais sa notification n’a pas pu être envoyée.');
    }
  };

  useEffect(() => {
    setCoupons([]);
  }, [basket.fixtures]);

  useEffect(() => {
    if (!basketIds) {
      setLatestBasketFixtures([]);
      setBasketStatusError('');
      return;
    }
    let active = true;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const statuses = await fetchFixtureStatuses(basketIds.split(','));
        if (active) {
          setLatestBasketFixtures(statuses);
          setBasketStatusError('');
        }
      } catch (requestError) {
        if (active) {
          setBasketStatusError(requestError instanceof Error ? requestError.message : 'Impossible d’actualiser les cartons et les scores.');
        }
        console.error('Unable to refresh prediction match statuses:', requestError);
      } finally {
        loading = false;
      }
    };
    void refresh();
    const interval = setInterval(() => { void refresh(); }, 30_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [basketIds]);

  const generateCoupons = async (regenerate = false) => {
    if (currentBasketFixtures.length === 0 || !currentBasketFixtures.every(fixture =>
      isUpcomingFixture(fixture) || (includeLive && isLiveFixtureStatus(fixture.status))
    )) return;
    setIsGenerating(true);
    setError('');
    if (!regenerate) setCoupons([]);
    let reserved = 0;
    try {
      const couponCount = isAuthenticated ? 3 : Math.min(3, quota.remaining);
      if (!isAuthenticated) {
        if (couponCount === 0) throw new Error('Vous avez atteint la limite de deux combinaisons gratuites. Créez un compte pour continuer.');
        await quota.reserve(couponCount);
        reserved = couponCount;
      }
      const suggestions = await suggestCoupons(
        currentBasketFixtures.map(fixture => fixture.id),
        riskLevel,
        couponCount,
        regenerate,
        includeLive,
      );
      if (suggestions.length !== couponCount) throw new Error('FotMob a renvoyé un nombre invalide de combinaisons.');
      setCoupons(suggestions);
      reserved = 0;
      await announceGenerated(suggestions.length);
    } catch (requestError) {
      const message = requestError instanceof TypeError
        ? 'Impossible de charger les données FotMob nécessaires aux combinaisons. Vérifiez votre connexion Internet.'
        : requestError instanceof Error ? requestError.message : 'Impossible de proposer les combinaisons.';
      if (reserved > 0) {
        try {
          await quota.refund(reserved);
        } catch (refundError) {
          console.error('Unable to restore anonymous combination quota:', refundError);
          setError(`${message} Le quota n’a pas pu être restauré automatiquement.`);
          console.error('Combination suggestion failed:', requestError);
          return;
        }
      }
      setError(message);
      console.error('Combination suggestion failed:', requestError);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateAutomaticCoupon = async () => {
    setIsGenerating(true);
    setError('');
    setCoupons([]);
    let reserved = 0;
    try {
      if (!isAuthenticated) {
        await quota.reserve(1);
        reserved = 1;
      }
      const suggestion = await suggestAutomaticCoupon(startDate, requestedCount, riskLevel, [], includeLive, randomizeAutomatic);
      if (!Array.isArray(suggestion.matches) || suggestion.matches.length !== requestedCount) {
        throw new Error('FotMob a renvoyé une combinaison invalide.');
      }
      setCoupons([suggestion]);
      reserved = 0;
      await announceGenerated(1);
    } catch (requestError) {
      const message = requestError instanceof TypeError
        ? 'Impossible de charger les données FotMob nécessaires aux combinaisons. Vérifiez votre connexion Internet.'
        : requestError instanceof Error ? requestError.message : 'Impossible de proposer une combinaison.';
      if (reserved > 0) {
        try {
          await quota.refund(reserved);
        } catch (refundError) {
          console.error('Unable to restore anonymous combination quota:', refundError);
          setError(`${message} Le quota n’a pas pu être restauré automatiquement.`);
          console.error('Automatic combination suggestion failed:', requestError);
          return;
        }
      }
      setError(message);
      console.error('Automatic combination suggestion failed:', requestError);
    } finally {
      setIsGenerating(false);
    }
  };

  const removeFixture = (id: string) => {
    void basket.removeFixture(id).catch(removeError => {
      Alert.alert('Erreur', removeError instanceof Error ? removeError.message : 'Impossible de modifier le panier.');
    });
    setCoupons([]);
  };

  const saveCoupon = async (coupon: GeneratedCoupon) => {
    try {
      const combination = await savedCombinations.save(coupon);
      try {
        await trackSavedCombination(combination);
      } catch (trackingError) {
        console.error('Unable to start saved combination result tracking:', trackingError);
        setSaveDialog({
          title: 'Combinaison enregistrée',
          message: 'Elle est bien conservée, mais le suivi des résultats n’a pas pu démarrer. Réessayez plus tard.',
          tone: 'warning',
        });
        return;
      }
      if (!await notifyCombinationSaved(combination)) {
        setSaveDialog({
          title: 'Combinaison enregistrée',
          message: 'Activez les notifications dans les réglages de votre appareil pour recevoir les alertes de résultat.',
          tone: 'warning',
        });
        return;
      }
      setSaveDialog({
        title: 'Combinaison enregistrée',
        message: 'Vous recevrez une alerte pour chaque résultat et pour le bilan final.',
        tone: 'success',
      });
    } catch (saveError) {
      Alert.alert('Impossible d’enregistrer', saveError instanceof Error ? saveError.message : 'Réessayez.');
    }
  };

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heading}>
        <View>
          <Text style={styles.eyebrow}>VOS SÉLECTIONS</Text>
          <Text style={styles.title}>Combinaisons</Text>
        </View>
        <View style={styles.countBadge}><Text style={styles.countText}>{basket.fixtures.length}/20</Text></View>
      </View>

      <View style={styles.introCard}>
        <View style={styles.introIcon}><MaterialIcons name="auto-awesome" size={22} color={theme.primary} /></View>
        <Text style={styles.introTitle}>Des suggestions adaptées à votre sélection</Text>
        <Text style={styles.introText}>Ajoutez des rencontres à votre panier, choisissez un niveau de risque et consultez les propositions basées sur l’historique disponible.</Text>
      </View>

      {!isAuthenticated ? (
        <View style={styles.quotaCard}>
          <Text style={styles.quotaTitle}>Connexion facultative</Text>
          <Text style={styles.quotaText}>
            {language === 'fr'
              ? `La consultation des rencontres et de leurs détails reste libre. Il vous reste ${quota.remaining} combinaison${quota.remaining > 1 ? 's' : ''} gratuite${quota.remaining > 1 ? 's' : ''} sur 2, sur cet appareil.`
              : `You can browse matches and their details without signing in. You have ${quota.remaining} free combination${quota.remaining === 1 ? '' : 's'} left out of 2 on this device.`}
          </Text>
          {quota.storageError ? <Text accessibilityRole="alert" style={styles.errorText}>{quota.storageError}</Text> : null}
          <View style={styles.quotaActions}>
            <TouchableOpacity onPress={() => router.push('/register')}>
              <Text style={styles.addLink}>Créer un compte</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text style={styles.addLink}>Retrouver un profil</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.quotaFootnote}>Créez un compte pour retrouver vos combinaisons sur tous vos appareils.</Text>
        </View>
      ) : null}

      <View style={styles.modePicker}>
        {([
          ['selection', 'Ma sélection'],
          ['automatic', 'Proposition auto'],
        ] as const).map(([value, label]) => (
          <TouchableOpacity
            key={value}
            style={[styles.modeButton, mode === value && styles.modeButtonActive]}
            onPress={() => { setMode(value); setCoupons([]); setError(''); }}
          >
            <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {mode === 'selection' ? (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mes rencontres</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/matches')}>
              <Text style={styles.addLink}>+ Ajouter</Text>
            </TouchableOpacity>
          </View>
          {basket.error ? <Text style={styles.errorText}>{basket.error}</Text> : null}
          {basketStatusError ? <Text accessibilityRole="alert" style={styles.errorText}>{basketStatusError}</Text> : null}
          {basket.isLoading ? (
            <ActivityIndicator color={theme.primary} style={{ paddingVertical: 20 }} />
          ) : basket.fixtures.length === 0 ? (
            <TouchableOpacity style={styles.emptyBasket} onPress={() => router.push('/(tabs)/matches')}>
              <MaterialIcons name="add-circle-outline" size={25} color={theme.primary} />
              <Text style={styles.emptyTitle}>Votre sélection est vide</Text>
              <Text style={styles.emptyText}>Parcourir les rencontres pour ajouter jusqu’à 20 matchs.</Text>
            </TouchableOpacity>
          ) : (
            currentBasketFixtures.map(fixture => {
              const upcoming = isUpcomingFixture(fixture);
              return (
                <View key={fixture.id} style={styles.fixtureRow}>
                  <View style={styles.fixtureIcon}><MaterialIcons name="sports-soccer" size={17} color={theme.primary} /></View>
                  <View style={styles.fixtureText}>
                    <Text numberOfLines={1} style={styles.fixtureTeams} translate={false}>{fixture.homeTeam} – {fixture.awayTeam}</Text>
                    <Text style={styles.fixtureMeta} translate={false}>{fixture.league} · {fixture.date} · {fixture.time}</Text>
                    {fixture.matchStats?.redCards && (
                      <Text style={styles.redCardStat}>
                        🟥 Cartons rouges · {fixture.matchStats.redCards.home}–{fixture.matchStats.redCards.away}
                      </Text>
                    )}
                    {!upcoming && !(includeLive && isLiveFixtureStatus(fixture.status)) && <Text style={styles.unavailable}>Match non disponible pour une combinaison</Text>}
                  </View>
                  <TouchableOpacity onPress={() => removeFixture(fixture.id)} accessibilityLabel={`${t('Retirer')} ${fixture.homeTeam} - ${fixture.awayTeam}`} translateAccessibility={false}>
                    <MaterialIcons name="close" size={19} color={theme.muted} />
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </>
      ) : (
        <View style={styles.autoCard}>
          <Text style={styles.sectionTitle}>Proposition automatique</Text>
          <Text style={styles.autoDescription}>IKProno choisira les matchs programmés dans les 7 jours à partir de la date sélectionnée.</Text>
          <View style={styles.autoDateRow}>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => {
                setStartDate(date => date <= getLocalDate() ? getLocalDate() : shiftDate(date, -1));
                setCoupons([]);
              }}
              accessibilityLabel="Jour précédent"
            >
              <MaterialIcons name="chevron-left" size={22} color={theme.text} />
            </TouchableOpacity>
            <View style={styles.autoDate}>
              <Text style={styles.autoDateLabel}>À PARTIR DU</Text>
              <Text style={styles.autoDateValue}>{new Date(`${startDate}T12:00:00.000Z`).toLocaleDateString(dateLocale, { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
            </View>
            <TouchableOpacity
              style={styles.dateArrow}
              onPress={() => {
                setStartDate(date => shiftDate(date, 1));
                setCoupons([]);
              }}
              accessibilityLabel="Jour suivant"
            >
              <MaterialIcons name="chevron-right" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.countLabel}>Nombre de rencontres</Text>
          <View style={styles.countPicker}>
            {Array.from({ length: 20 }, (_, index) => index + 1).map(count => (
              <TouchableOpacity
                key={count}
                style={[styles.countOption, requestedCount === count && styles.countOptionActive]}
                onPress={() => { setRequestedCount(count); setCoupons([]); }}
              >
                <Text style={[styles.countOptionText, requestedCount === count && styles.countOptionTextActive]}>{count}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            accessibilityRole="checkbox"
            accessibilityState={{ checked: randomizeAutomatic }}
            style={styles.selectionToggle}
            onPress={() => { setRandomizeAutomatic(value => !value); setCoupons([]); }}
          >
            <MaterialIcons
              name={randomizeAutomatic ? 'check-box' : 'check-box-outline-blank'}
              size={19}
              color={randomizeAutomatic ? theme.primary : theme.muted}
            />
            <View style={styles.selectionToggleCopy}>
              <Text style={styles.selectionToggleTitle}>Choisir les matchs au hasard</Text>
              <Text style={styles.selectionToggleDescription}>Sinon, privilégier les meilleures estimations historiques.</Text>
            </View>
          </TouchableOpacity>
          </View>
      )}

      <TouchableOpacity
        accessibilityRole="checkbox"
        accessibilityState={{ checked: includeLive }}
        style={styles.liveToggle}
        onPress={() => { setIncludeLive(value => !value); setCoupons([]); }}
      >
        <MaterialIcons
          name={includeLive ? 'check-box' : 'check-box-outline-blank'}
          size={19}
          color={includeLive ? theme.primary : theme.muted}
        />
        <View style={styles.selectionToggleCopy}>
          <Text style={styles.selectionToggleTitle}>Inclure les matchs en direct</Text>
          <Text style={styles.selectionToggleDescription}>Vous pouvez intégrer vos matchs en cours aux combinaisons.</Text>
        </View>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Niveau de risque</Text>
      <View style={styles.riskList}>
        {RISK_LEVELS.map(level => (
          <TouchableOpacity
            key={level.value}
            style={[styles.riskOption, riskLevel === level.value && styles.riskOptionActive]}
            onPress={() => { setRiskLevel(level.value); setCoupons([]); }}
          >
            <View style={[styles.radio, riskLevel === level.value && styles.radioActive]}>
              {riskLevel === level.value && <View style={styles.radioDot} />}
            </View>
            <View style={styles.riskCopy}>
              <Text style={[styles.riskLabel, riskLevel === level.value && styles.riskLabelActive]}>{level.label}</Text>
              <Text style={styles.riskNote}>{level.note}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={theme.muted} />
          </TouchableOpacity>
        ))}
      </View>

      {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
      <TouchableOpacity
        style={[styles.generateButton, (!canGenerate || isGenerating || quotaBlocked) && styles.generateDisabled]}
        onPress={() => void (mode === 'automatic' ? generateAutomaticCoupon() : generateCoupons())}
        disabled={!canGenerate || isGenerating || quotaBlocked}
      >
        {isGenerating ? <ActivityIndicator color={theme.background} /> : <MaterialIcons name="auto-awesome" size={19} color={theme.background} />}
        <Text style={styles.generateText}>{isGenerating ? 'Analyse en cours…' : quota.remaining === 0 && !isAuthenticated ? 'Limite gratuite atteinte' : mode === 'automatic' ? 'Générer une proposition' : `Générer ${combinationsToGenerate} combinaison${combinationsToGenerate > 1 ? 's' : ''}`}</Text>
      </TouchableOpacity>
      <Text style={styles.disclaimer}>Suggestions indicatives, fondées sur les données historiques disponibles. Aucun résultat n’est garanti.</Text>

      {coupons.length > 0 && (
        <View style={styles.generatedSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Suggestions</Text>
            <TouchableOpacity disabled={isGenerating} onPress={() => void (mode === 'automatic' ? generateAutomaticCoupon() : generateCoupons(true))}>
              <Text style={styles.addLink}>{isGenerating ? 'Analyse…' : 'Régénérer'}</Text>
            </TouchableOpacity>
          </View>
          {coupons.map((coupon, index) => (
            <View key={`${coupon.level}-${index}`} style={styles.couponCard}>
              <View style={styles.couponHeader}>
                <View style={styles.couponNumber}><Text style={styles.couponNumberText}>{index + 1}</Text></View>
                <View style={styles.couponTitleBlock}>
                  <Text style={styles.couponTitle} translate={false}>{coupon.title}</Text>
                  <Text style={styles.couponDescription} translate={false}>{coupon.description}</Text>
                </View>
              </View>
              {coupon.estimatedCombinedRate !== undefined && (
                <View style={styles.rateRow}>
                  <Text style={styles.rateLabel}>Taux historique combiné</Text>
                  <Text style={styles.rateValue}>{coupon.estimatedCombinedRate.toFixed(1)}%</Text>
                </View>
              )}
              {coupon.matches.map((match, matchIndex) => (
                <View key={`${match.fixtureId}-${matchIndex}`} style={styles.pickMatch}>
                  <Text style={styles.pickTeams} translate={false}>{match.homeTeam} – {match.awayTeam}</Text>
                  {match.picks.map((pick, pickIndex) => (
                    <View key={`${pick.market}-${pickIndex}`} style={styles.pickRow}>
                      <Text style={styles.pickLabel}>{pick.selection ? PICK_LABELS[pick.selection] || pick.selection : 'Historique insuffisant'}</Text>
                      {pick.historicalRate !== null && <Text style={styles.pickRate}>{pick.historicalRate.toFixed(0)}%</Text>}
                    </View>
                  ))}
                </View>
              ))}
              <TouchableOpacity
                style={styles.saveCouponButton}
                onPress={() => { void saveCoupon(coupon); }}
                accessibilityLabel={`${t('Enregistrer')} ${coupon.title}`}
                translateAccessibility={false}
              >
                <MaterialIcons name="bookmark-add" size={17} color={theme.primary} />
                <Text style={styles.saveCouponText}>Enregistrer dans mon panier</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
      <Modal
        visible={saveDialog !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setSaveDialog(null)}
      >
        <View style={styles.dialogOverlay}>
          <View
            accessibilityViewIsModal
            style={styles.dialogCard}
          >
            <View style={[
              styles.dialogIcon,
              saveDialog?.tone === 'warning' && styles.dialogIconWarning,
            ]}>
              <MaterialIcons
                name={saveDialog?.tone === 'warning' ? 'notifications-active' : 'check'}
                size={28}
                color={theme.primary}
              />
            </View>
            <Text style={styles.dialogEyebrow}>
              {saveDialog?.tone === 'warning' ? 'À NOTER' : 'SUIVI ACTIVÉ'}
            </Text>
            <Text accessibilityRole="header" style={styles.dialogTitle}>
              {saveDialog?.title}
            </Text>
            <Text style={styles.dialogMessage}>{saveDialog?.message}</Text>
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.dialogButton}
              onPress={() => setSaveDialog(null)}
            >
              <Text style={styles.dialogButtonText}>Compris</Text>
              <MaterialIcons name="arrow-forward" size={18} color={theme.background} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const createStyles = (theme: Theme) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 38 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 17 },
  eyebrow: { color: theme.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1.3 },
  title: { color: theme.text, fontSize: 27, fontWeight: '900', marginTop: 3 },
  countBadge: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: theme.accentSurface },
  countText: { color: theme.primary, fontSize: 12, fontWeight: '800' },
  introCard: { padding: 17, backgroundColor: theme.surface, borderRadius: 16, borderWidth: 1, borderColor: theme.border, marginBottom: 22 },
  introIcon: { width: 39, height: 39, borderRadius: 12, backgroundColor: theme.accentSurface, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  introTitle: { color: theme.text, fontSize: 15, fontWeight: '800' },
  introText: { color: theme.muted, fontSize: 11, lineHeight: 17, marginTop: 7 },
  quotaCard: { padding: 15, backgroundColor: theme.accentSurface, borderRadius: 14, borderWidth: 1, borderColor: theme.border, marginBottom: 20 },
  quotaTitle: { color: theme.text, fontSize: 13, fontWeight: '800' },
  quotaText: { color: theme.muted, fontSize: 11, lineHeight: 16, marginTop: 6 },
  quotaActions: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 7 },
  quotaFootnote: { color: theme.muted, fontSize: 9, lineHeight: 13, marginTop: 3 },
  modePicker: { flexDirection: 'row', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 4, marginBottom: 19 },
  modeButton: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 },
  modeButtonActive: { backgroundColor: theme.accentSurface },
  modeText: { color: theme.muted, fontSize: 11, fontWeight: '700' },
  modeTextActive: { color: theme.primary },
  autoCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 15, padding: 14, marginBottom: 20 },
  autoDescription: { color: theme.muted, fontSize: 11, lineHeight: 16, marginTop: -3, marginBottom: 11 },
  autoDateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderColor: theme.border, paddingVertical: 10 },
  dateArrow: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  autoDate: { alignItems: 'center' },
  autoDateLabel: { color: theme.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  autoDateValue: { color: theme.text, fontSize: 12, fontWeight: '800', textTransform: 'capitalize', marginTop: 3 },
  countLabel: { color: theme.text, fontSize: 11, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  countPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  countOption: { width: '17%', paddingVertical: 9, alignItems: 'center', borderRadius: 9, backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border },
  countOptionActive: { backgroundColor: theme.accentSurface, borderColor: theme.primary },
  countOptionText: { color: theme.muted, fontSize: 12, fontWeight: '800' },
  countOptionTextActive: { color: theme.primary },
  selectionToggle: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 13, padding: 11, backgroundColor: theme.surfaceRaised, borderRadius: 11 },
  liveToggle: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 20, padding: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 12 },
  selectionToggleCopy: { flex: 1 },
  selectionToggleTitle: { color: theme.text, fontSize: 11, fontWeight: '800' },
  selectionToggleDescription: { color: theme.muted, fontSize: 9, lineHeight: 14, marginTop: 3 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sectionTitle: { color: theme.text, fontSize: 16, fontWeight: '800', marginBottom: 10 },
  addLink: { color: theme.primary, fontSize: 12, fontWeight: '800', paddingVertical: 5 },
  emptyBasket: { alignItems: 'center', padding: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: theme.border, borderRadius: 14, marginBottom: 22 },
  emptyTitle: { color: theme.text, fontSize: 13, fontWeight: '800', marginTop: 8 },
  emptyText: { color: theme.muted, textAlign: 'center', fontSize: 11, lineHeight: 16, marginTop: 5 },
  fixtureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, padding: 12, borderRadius: 13, marginBottom: 8 },
  fixtureIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: theme.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  fixtureText: { flex: 1 },
  fixtureTeams: { color: theme.text, fontSize: 12, fontWeight: '800' },
  fixtureMeta: { color: theme.muted, fontSize: 9, marginTop: 4 },
  redCardStat: { color: theme.danger, fontSize: 9, fontWeight: '800', marginTop: 4 },
  unavailable: { color: theme.warning, fontSize: 9, marginTop: 4 },
  riskList: { gap: 7, marginBottom: 18 },
  riskOption: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 13 },
  riskOptionActive: { borderColor: theme.primary, backgroundColor: theme.accentSurface },
  radio: { width: 18, height: 18, borderWidth: 1.5, borderColor: theme.muted, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  radioActive: { borderColor: theme.primary },
  radioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.primary },
  riskCopy: { flex: 1 },
  riskLabel: { color: theme.text, fontSize: 12, fontWeight: '800' },
  riskLabelActive: { color: theme.primary },
  riskNote: { color: theme.muted, fontSize: 10, marginTop: 3 },
  errorText: { color: theme.danger, fontSize: 12, textAlign: 'center', marginBottom: 10, lineHeight: 17 },
  generateButton: { backgroundColor: theme.primaryDark, borderRadius: 13, minHeight: 48, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9, paddingHorizontal: 14 },
  generateDisabled: { opacity: 0.45 },
  generateText: { color: theme.text, fontSize: 13, fontWeight: '900' },
  disclaimer: { color: theme.muted, fontSize: 9, lineHeight: 14, textAlign: 'center', marginTop: 10 },
  generatedSection: { marginTop: 27 },
  couponCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 14, marginBottom: 12 },
  couponHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 11 },
  couponNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: theme.accentSurface, alignItems: 'center', justifyContent: 'center' },
  couponNumberText: { color: theme.primary, fontWeight: '900', fontSize: 12 },
  couponTitleBlock: { flex: 1 },
  couponTitle: { color: theme.text, fontSize: 14, fontWeight: '900' },
  couponDescription: { color: theme.muted, fontSize: 10, marginTop: 3, lineHeight: 15 },
  saveCouponButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10, marginTop: 5, borderTopWidth: 1, borderTopColor: theme.border },
  saveCouponText: { color: theme.primary, fontSize: 11, fontWeight: '800' },
  dialogOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.72)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  dialogCard: { width: '100%', maxWidth: 390, alignItems: 'center', backgroundColor: theme.surface, borderRadius: 24, borderWidth: 1, borderColor: theme.accentBorder, paddingHorizontal: 24, paddingTop: 27, paddingBottom: 22, elevation: 18, shadowColor: '#000000', shadowOpacity: 0.3, shadowRadius: 22, shadowOffset: { width: 0, height: 12 } },
  dialogIcon: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: theme.accentSurface, borderWidth: 1, borderColor: theme.accentBorder, marginBottom: 15 },
  dialogIconWarning: { backgroundColor: theme.surfaceRaised },
  dialogEyebrow: { color: theme.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 7 },
  dialogTitle: { color: theme.text, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  dialogMessage: { color: theme.muted, fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 9, marginBottom: 22 },
  dialogButton: { minHeight: 48, alignSelf: 'stretch', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: theme.primary, borderRadius: 14, paddingHorizontal: 16 },
  dialogButtonText: { color: theme.background, fontSize: 13, fontWeight: '900' },
  rateRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderColor: theme.border, paddingVertical: 9 },
  rateLabel: { color: theme.muted, fontSize: 10 },
  rateValue: { color: theme.primary, fontSize: 11, fontWeight: '900' },
  pickMatch: { borderTopWidth: 1, borderColor: theme.border, paddingTop: 9, paddingBottom: 5 },
  pickTeams: { color: theme.text, fontSize: 11, fontWeight: '800', marginBottom: 5 },
  pickRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  pickLabel: { color: theme.muted, fontSize: 10 },
  pickRate: { color: theme.primary, fontSize: 10, fontWeight: '800' },
});
