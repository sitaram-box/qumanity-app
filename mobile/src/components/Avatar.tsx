/**
 * A person's avatar, the same everywhere (website static/js/avatar.js "Avatar Sweep"):
 * their profile picture when there is one, else a coloured circle with initials and a small
 * gender badge. The picture is fetched with the sign-in header because the website decides per
 * viewer (a hidden identity's face is shown only to family) — a 404 simply falls back to initials.
 *
 *   <Avatar user={{ name, gender, profile_picture_url }} size={40} />
 *   <Avatar name="Asha Test" />            // older call style, still supported
 */

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Image, Text, View } from 'react-native';
import { authHeaders, currentServer } from '@/api/client';
import { colors, fonts, tint } from '@/theme';

export type AvatarUser = {
  name: string;
  gender?: 'male' | 'female' | 'both' | string | null;
  /** "/api/users/<id>/profile-picture" as sent by the website, or null/undefined for none. */
  profile_picture_url?: string | null;
};

const GENDER_ICON = { male: 'male', female: 'female', both: 'male-female' } as const;
const GENDER_COLOR = { male: colors.water, female: colors.fire, both: colors.violet } as const;
type G = keyof typeof GENDER_ICON;
const isGender = (g: unknown): g is G => g === 'male' || g === 'female' || g === 'both';

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

type Props = {
  user?: AvatarUser;
  /** Older call style: just a name. */
  name?: string;
  size?: number;
  /** Override the circle colour (e.g. gold for "you"); default follows gender. */
  color?: string;
  /** Change after an upload so the new picture is fetched instead of the cached one. */
  version?: string | number;
};

export function Avatar({ user, name, size = 40, color, version }: Props) {
  const person: AvatarUser = user ?? { name: name ?? '' };
  const [failed, setFailed] = useState(false);
  const url = person.profile_picture_url;
  useEffect(() => setFailed(false), [url, version]);

  const g = isGender(person.gender) ? person.gender : undefined;
  const tone = color ?? (g ? GENDER_COLOR[g] : colors.saffron);
  const round = { width: size, height: size, borderRadius: size / 2 };

  if (url && !failed) {
    const uri = `${currentServer()}${url}${version ? `${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(String(version))}` : ''}`;
    return (
      <Image
        source={{ uri, headers: authHeaders() }}
        style={[round, { backgroundColor: colors.panelRaised }]}
        onError={() => setFailed(true)}
        accessibilityLabel={person.name}
      />
    );
  }

  return (
    <View
      style={[round, { backgroundColor: tint(tone, '33'), alignItems: 'center', justifyContent: 'center' }]}
      accessibilityLabel={person.name}
    >
      <Text style={{ color: tone, fontFamily: fonts.bold, fontSize: size * 0.38 }}>{initialsOf(person.name) || '•'}</Text>
      {g && size >= 28 && (
        <View
          style={{
            position: 'absolute',
            right: -2,
            bottom: -2,
            width: size * 0.42,
            height: size * 0.42,
            borderRadius: size * 0.21,
            backgroundColor: colors.ink,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={GENDER_ICON[g]} size={size * 0.26} color={tone} />
        </View>
      )}
    </View>
  );
}
