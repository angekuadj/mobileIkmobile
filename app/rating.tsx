import { MaterialIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { InfoCard, Screen, useScreenStyles } from '../components/Screen';
import { useTheme } from '../context/ThemeContext';
import type { Theme } from '../lib/theme';
import { LocalizedText as Text, LocalizedTextInput as TextInput } from '../lib/localization';
import { LocalizedTouchableOpacity as TouchableOpacity, LocalizedView as View } from '../lib/localization';

const reviewExamples = [
  {
    name: 'Marie D.',
    rating: 5,
    comment: 'Exemple d’avis : présentation claire et utilisation simple.',
    date: 'Exemple',
  },
  {
    name: 'Pierre L.',
    rating: 4,
    comment: 'Exemple d’avis : les informations des rencontres sont pratiques.',
    date: 'Exemple',
  },
  {
    name: 'Jean M.',
    rating: 5,
    comment: 'Exemple d’avis : une application agréable à consulter.',
    date: 'Exemple',
  },
];

function RatingStars({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.ratingRow}>
      <Text style={[styles.ratingLabel, { color: theme.text }]}>{label}</Text>
      <View style={styles.stars} accessibilityRole="radiogroup" accessibilityLabel={label}>
        {[1, 2, 3, 4, 5].map(star => (
          <TouchableOpacity
            key={star}
            accessibilityRole="radio"
            accessibilityLabel={`${star} sur 5 étoiles`}
            accessibilityState={{ checked: value === star }}
            onPress={() => onChange(star)}
            style={styles.starButton}
          >
            <MaterialIcons name={star <= value ? 'star' : 'star-border'} size={29} color={star <= value ? '#facc15' : theme.muted} />
          </TouchableOpacity>
        ))}
      </View>
      <Text style={[styles.ratingValue, { color: theme.muted }]}>{value}/5</Text>
    </View>
  );
}

export default function RatingScreen() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const screenStyles = useScreenStyles();
  const [overallRating, setOverallRating] = useState(0);
  const [predictionRating, setPredictionRating] = useState(0);
  const [uiRating, setUiRating] = useState(0);
  const [supportRating, setSupportRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const averageRating = ((overallRating + predictionRating + uiRating + supportRating) / 4).toFixed(1);

  const submit = async () => {
    if (isLoading) return;
    if (overallRating === 0) {
      setError('Veuillez donner une note globale.');
      setSubmitted(false);
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await new Promise<void>(resolve => setTimeout(resolve, 700));
      setSubmitted(true);
      setOverallRating(0);
      setPredictionRating(0);
      setUiRating(0);
      setSupportRating(0);
      setComment('');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Screen eyebrow="VOTRE AVIS" title="Évaluer IKProno">
      <InfoCard title="Votre avis nous aide à progresser">
        Évaluez votre expérience. Comme sur le site, cet envoi est une démonstration : il n’est pas enregistré ni transmis à l’équipe IKProno.
      </InfoCard>
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>Votre évaluation</Text>
        <RatingStars label="Note globale *" value={overallRating} onChange={setOverallRating} />
        <RatingStars label="Qualité des pronostics" value={predictionRating} onChange={setPredictionRating} />
        <RatingStars label="Interface utilisateur" value={uiRating} onChange={setUiRating} />
        <RatingStars label="Support client" value={supportRating} onChange={setSupportRating} />
        <Text style={styles.commentLabel}>Commentaire (optionnel)</Text>
        <TextInput
          accessibilityLabel="Commentaire optionnel"
          style={styles.commentInput}
          placeholder="Partagez votre expérience avec IKProno…"
          placeholderTextColor={theme.muted}
          value={comment}
          onChangeText={setComment}
          multiline
          textAlignVertical="top"
          maxLength={1000}
          editable={!isLoading}
        />
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        {submitted ? <Text accessibilityRole="alert" style={styles.success}>Merci pour votre évaluation !</Text> : null}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={{ disabled: isLoading, busy: isLoading }}
          disabled={isLoading}
          style={[screenStyles.button, isLoading && styles.disabled]}
          onPress={() => { void submit(); }}
        >
          {isLoading
            ? <View style={styles.loading}><ActivityIndicator color={theme.text} /><Text style={screenStyles.buttonText}>Envoi en cours…</Text></View>
            : <Text style={screenStyles.buttonText}>Envoyer mon évaluation</Text>}
        </TouchableOpacity>
      </View>
      {overallRating > 0 ? (
        <View style={styles.averageCard}>
          <Text style={styles.averageTitle}>Votre note moyenne</Text>
          <Text style={styles.averageValue}>{averageRating}</Text>
          <Text style={styles.averageCaption}>sur 5 étoiles</Text>
        </View>
      ) : null}
      <Text style={styles.reviewsTitle}>Avis récents</Text>
      <Text style={styles.examplesNote}>Exemples de présentation, non issus d’avis réellement collectés.</Text>
      {reviewExamples.map(review => (
        <View key={review.name} style={styles.reviewCard}>
          <View style={styles.reviewHeader}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{review.name[0]}</Text></View>
            <View style={styles.reviewer}>
              <Text style={styles.reviewerName}>{review.name}</Text>
              <Text style={styles.reviewDate}>{review.date}</Text>
            </View>
            <View style={styles.reviewStars}>
              {Array.from({ length: 5 }, (_, index) => (
                <MaterialIcons key={index} name={index < review.rating ? 'star' : 'star-border'} size={15} color={index < review.rating ? '#facc15' : theme.muted} />
              ))}
            </View>
          </View>
          <Text style={styles.reviewText}>{review.comment}</Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ratingRow: { marginBottom: 18 },
  ratingLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  stars: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  starButton: { padding: 2 },
  ratingValue: { fontSize: 11, marginTop: 2 },
});

const createStyles = (theme: Theme) => StyleSheet.create({
  formCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 16, marginBottom: 12 },
  sectionTitle: { color: theme.text, fontSize: 15, fontWeight: '900', marginBottom: 17 },
  commentLabel: { color: theme.text, fontSize: 12, fontWeight: '700', marginBottom: 7 },
  commentInput: { minHeight: 105, color: theme.text, backgroundColor: theme.surfaceRaised, borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 12 },
  error: { color: theme.danger, fontSize: 12, marginBottom: 12 },
  success: { color: theme.primary, fontSize: 12, marginBottom: 12 },
  disabled: { opacity: 0.6 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  averageCard: { alignItems: 'center', backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 16, padding: 18, marginBottom: 18 },
  averageTitle: { color: theme.text, fontSize: 14, fontWeight: '800' },
  averageValue: { color: theme.primary, fontSize: 42, fontWeight: '900', marginTop: 5 },
  averageCaption: { color: theme.muted, fontSize: 12 },
  reviewsTitle: { color: theme.text, fontSize: 19, fontWeight: '900', marginTop: 6, marginBottom: 5 },
  examplesNote: { color: theme.muted, fontSize: 11, lineHeight: 16, marginBottom: 10 },
  reviewCard: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 14, marginBottom: 9 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 9 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.accentSurface },
  avatarText: { color: theme.primary, fontSize: 14, fontWeight: '900' },
  reviewer: { flex: 1, marginLeft: 10 },
  reviewerName: { color: theme.text, fontSize: 12, fontWeight: '800' },
  reviewDate: { color: theme.muted, fontSize: 10, marginTop: 2 },
  reviewStars: { flexDirection: 'row' },
  reviewText: { color: theme.muted, fontSize: 12, lineHeight: 18 },
});
