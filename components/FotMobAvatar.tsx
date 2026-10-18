import { useEffect, useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { LocalizedText as Text } from '../lib/localization';
import { LocalizedView as View } from '../lib/localization';

interface FotMobAvatarProps {
  imageUrl?: string;
  name: string;
  size: number;
}

export default function FotMobAvatar({ imageUrl, name, size }: FotMobAvatarProps) {
  const { theme } = useTheme();
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  return (
    <View
      style={[
        styles.container,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.surfaceRaised },
      ]}
    >
      {imageUrl && !imageFailed ? (
        <Image
          source={{ uri: imageUrl }}
          resizeMode="contain"
          onError={() => setImageFailed(true)}
          style={{ width: size * 0.82, height: size * 0.82 }}
        />
      ) : (
        <Text style={[styles.initial, { color: theme.primary, fontSize: Math.max(12, size * 0.42) }]}>
          {name.trim().slice(0, 1).toLocaleUpperCase('fr-FR') || '?'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  initial: { fontWeight: '800' },
});
