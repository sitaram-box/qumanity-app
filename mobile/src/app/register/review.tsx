/**
 * Step 4 · Review, create the account, then show the
 * 9-digit Private ID once ("I have saved my Private ID → Dashboard").
 * A member can also register someone else here (e.g. a person without a smartphone): with
 * "I'm registering someone else" on, their own Private ID + PIN make them the referrer, and
 * nobody is signed in afterwards — the new member's Private ID is shown to hand over.
 * There are no referral codes any more (website 2026-10): the only referrer is the member doing the
 * registering. Registration is always free: there is no fee or payment step.
 */

import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { toStruct } from "@/api/locations";
import { register, type RegisterResult } from "@/api/qumanity";
import { CodeInput } from "@/components/CodeInput";
import {
  Button,
  ErrorText,
  Field,
  Label,
  Lead,
  Screen,
  Steps,
  Title,
} from "@/components/ui";
import { rememberedId, rememberedPublicId } from "@/lib/remembered";
import { useApp } from "@/state/app";
import { colors, fonts, radius, space } from "@/theme";

const GENDER = {
  male: "Male",
  female: "Female",
  both: "Third gender",
  "": "—",
} as const;
export default function Review() {
  const { draft, setDraft, acceptToken, resetDraft } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [copied, setCopied] = useState(false);

  const helperDigits = draft.helperId.replace(/\D/g, "");
  const helping = draft.helping;
  const helperReady =
    !helping || (helperDigits.length === 9 && draft.helperPin.length === 5);

  // On a phone that remembers a member, registering someone else is the usual case: pre-fill it.
  useEffect(() => {
    if (draft.helperId) return;
    rememberedId().then(
      (id) => id && setDraft({ helping: true, helperId: id }),
      () => undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // "Referred By": pre-filled with the Public ID of the member last signed in on this phone
  // (clearable). Only used when NOT registering someone else — then the helper is the referrer.
  useEffect(() => {
    if (draft.referredBy) return;
    rememberedPublicId().then(
      (code) => code && setDraft({ referredBy: code }),
      () => undefined,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const referredDigits = draft.referredBy.replace(/\D/g, "");

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await register({
        name: draft.name,
        middle_name: draft.middleName || undefined,
        gender: draft.gender as "male" | "female" | "both",
        dob: draft.dob,
        tob: draft.tob,
        pin: draft.pin,
        language: draft.language,
        email: draft.email || undefined,
        phone: draft.phone || undefined,
        birth_location: toStruct(draft.birth),
        present_location: toStruct(draft.present),
        ...(!helping && referredDigits.length === 12
          ? { referred_by_public_id: referredDigits }
          : {}),
        ...(helping
          ? {
              assisted: true,
              helper_private_id: helperDigits,
              helper_pin: draft.helperPin,
            }
          : {}),
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
      if (helping) setDraft({ helperPin: "" });
    } finally {
      setBusy(false);
    }
  }

  if (result?.assisted) {
    const code = result.private_code;
    const again = (to: "/register" | "/welcome") => {
      resetDraft();
      router.replace(to);
    };
    return (
      <Screen
        footer={
          <View style={{ gap: space.sm }}>
            <Button
              title="Register another member"
              icon="person-add-outline"
              onPress={() => again("/register")}
            />
            <Button
              title="Done"
              variant="ghost"
              onPress={() => again("/welcome")}
            />
          </View>
        }
      >
        <Title>{draft.name.split(" ")[0]} is registered</Title>
        <Lead>
          Write this Private ID on paper and give it to them, with the PIN they
          chose. They sign in with both — Qumanity cannot send it to them again.
          You are recorded as their referrer.
        </Lead>
        <View style={styles.idCard}>
          <Text
            style={styles.id}
            selectable
            accessibilityLabel={`Private ID ${code.split("").join(" ")}`}
          >
            {code.slice(0, 3)} {code.slice(3, 6)} {code.slice(6)}
          </Text>
          <Button
            title={copied ? "Copied" : "Copy"}
            variant="ghost"
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              setCopied(true);
            }}
          />
        </View>
        {result.donation_error && (
          <Text style={styles.warn}>{result.donation_error}</Text>
        )}
      </Screen>
    );
  }

  if (result) {
    const code = result.private_code;
    return (
      <Screen
        footer={
          <Button
            title="I have saved my Private ID → Dashboard"
            onPress={async () => {
              if (result.token) await acceptToken(result.token);
              resetDraft();
            }}
          />
        }
      >
        <Title>Your Private ID</Title>
        <Lead>
          Write it down and keep it secret. You sign in with it and your PIN.
          Qumanity cannot send it to you again.
        </Lead>
        <View style={styles.idCard}>
          <Text
            style={styles.id}
            selectable
            accessibilityLabel={`Private ID ${code.split("").join(" ")}`}
          >
            {code.slice(0, 3)} {code.slice(3, 6)} {code.slice(6)}
          </Text>
          <Button
            title={copied ? "Copied" : "Copy"}
            variant="ghost"
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              setCopied(true);
            }}
          />
        </View>
        {result.donation_error && (
          <Text style={styles.warn}>{result.donation_error}</Text>
        )}
        <ErrorText>{error}</ErrorText>
        {result.zodiac && (
          <Text style={styles.meta}>
            Sun {result.zodiac.sun_sign} ({result.zodiac.sun_element}) · Moon{" "}
            {result.zodiac.moon_sign} · Ascendant {result.zodiac.ascendant_sign}
          </Text>
        )}
      </Screen>
    );
  }

  const rows: [string, string][] = [
    ["Name", draft.name],
    ...(draft.middleName
      ? ([["Middle name", draft.middleName]] as [string, string][])
      : []),
    ["Gender", GENDER[draft.gender]],
    ["Born", `${draft.dob} at ${draft.tob}`],
    ["Mother tongue", draft.language],
    [
      "Global account · born in",
      draft.birth
        .filter((p) => p.label !== null)
        .map((p) => p.name)
        .join(" › "),
    ],
    [
      "Public account · living in",
      draft.present
        .filter((p) => p.label !== null)
        .map((p) => p.name)
        .join(" › "),
    ],
  ];

  return (
    <Screen
      footer={
        <Button
          title={helping ? "Create their account" : "Create my account"}
          onPress={create}
          busy={busy}
          disabled={
            !helperReady ||
            (!helping &&
              referredDigits.length > 0 &&
              referredDigits.length !== 12)
          }
        />
      }
    >
      <Steps at={4} of={4} />
      <Title>Review</Title>
      <View style={styles.card}>
        {rows.map(([k, v]) => (
          <View key={k} style={{ paddingVertical: 4 }}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={styles.toggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.v}>I'm registering someone else</Text>
          <Text style={styles.hint}>
            For a person without a smartphone. You become their referrer.
          </Text>
        </View>
        <Switch
          value={helping}
          onValueChange={(v) => setDraft({ helping: v, helperPin: "" })}
          trackColor={{ true: colors.gold, false: colors.line }}
          accessibilityLabel="I'm registering someone else"
        />
      </View>
      {helping && (
        <View style={styles.card}>
          <Field
            label="Your own Private ID"
            value={draft.helperId}
            onChangeText={(t) =>
              setDraft({ helperId: t.replace(/[^\d ]/g, "").slice(0, 11) })
            }
            keyboardType="number-pad"
            placeholder="123 456 789"
          />
          <Label>Your PIN — confirms it's you</Label>
          <CodeInput
            length={5}
            secure
            value={draft.helperPin}
            onChange={(v) => setDraft({ helperPin: v })}
            autoFocus={false}
            accessibilityLabel="Your PIN"
          />
          <Text style={styles.hint}>
            Only checked by the Qumanity website, never stored on this phone.
          </Text>
        </View>
      )}

      {!helping && (
        <View style={styles.card}>
          <Field
            label="Referred By (Public ID, optional)"
            value={referredDigits.replace(/(\d{4})(?=\d)/g, "$1 ")}
            onChangeText={(t) =>
              setDraft({ referredBy: t.replace(/\D/g, "").slice(0, 12) })
            }
            keyboardType="number-pad"
            placeholder="1234 5678 9012"
            error={
              referredDigits.length > 0 && referredDigits.length !== 12
                ? "A Public ID has 12 digits (or leave it empty)."
                : undefined
            }
          />
          <Text style={styles.hint}>
            The member who told you about Qumanity. They receive a small
            share of the registration Qoin. Leave it empty if nobody did.
          </Text>
        </View>
      )}

      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: space.lg,
    marginBottom: space.lg,
  },
  k: {
    color: colors.dim,
    fontFamily: fonts.medium,
    fontSize: 12,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  v: { color: colors.text, fontFamily: fonts.body, fontSize: 16 },
  hint: {
    color: colors.dim,
    fontFamily: fonts.body,
    fontSize: 13,
    marginTop: 2,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    marginBottom: space.lg,
  },
  idCard: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: space.xl,
    alignItems: "center",
    gap: space.lg,
    borderWidth: 1,
    borderColor: colors.gold,
  },
  id: {
    color: colors.gold,
    fontFamily: fonts.displayBold,
    fontSize: 34,
    letterSpacing: 3,
  },
  warn: { color: colors.saffron, fontFamily: fonts.body, marginTop: space.lg },
  meta: {
    color: colors.dim,
    fontFamily: fonts.body,
    marginTop: space.lg,
    textAlign: "center",
  },
});
