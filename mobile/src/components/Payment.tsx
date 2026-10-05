/**
 * Real donations, exactly as the website does them (payment_core.py):
 *   1. POST /api/payment/order  -> the website records the order (and, once Razorpay keys are set on
 *      the server, creates a Razorpay order).
 *   2. mode "razorpay": Razorpay Checkout opens here, inside a WebView (works in Expo Go — no native
 *      Razorpay SDK needed). mode "simulated" (no keys on the server yet): nothing to pay.
 *   3. POST /api/payment/verify -> the website checks Razorpay's signature and only THEN credits Qoins,
 *      using the amount stored on the order — never a number sent from the phone.
 *
 * Use: const { pay, sheet } = usePayment(); ...; {sheet}; await pay(50, 'donation').
 */

import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import * as Q from '@/api/qumanity';
import { colors, fonts, space } from '@/theme';

type Verified = Awaited<ReturnType<typeof Q.paymentVerify>>;
type Pending = { order: Extract<Q.PaymentOrder, { mode: 'razorpay' }>; resolve: (v: Verified) => void; reject: (e: Error) => void };

function checkoutHtml(o: Extract<Q.PaymentOrder, { mode: 'razorpay' }>, purpose: string) {
  const options = {
    key: o.key_id,
    amount: o.amount_paise,
    currency: o.currency,
    order_id: o.razorpay_order_id,
    name: 'Qumanity',
    description: purpose === 'registration' ? 'Registration donation' : 'Donation',
    theme: { color: '#ffc83d' },
  };
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#060c16;color:#eef3fa;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh}</style>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head><body><p>Opening secure payment…</p>
<script>
  function send(m){ window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  var o = ${JSON.stringify(options)};
  o.handler = function (r) { send({ ok: true, razorpay_payment_id: r.razorpay_payment_id, razorpay_order_id: r.razorpay_order_id, razorpay_signature: r.razorpay_signature }); };
  o.modal = { ondismiss: function () { send({ ok: false, reason: 'Payment cancelled.' }); } };
  try {
    var rzp = new Razorpay(o);
    rzp.on('payment.failed', function (r) { send({ ok: false, reason: (r && r.error && r.error.description) || 'Payment failed.' }); });
    rzp.open();
  } catch (e) { send({ ok: false, reason: 'Could not open the payment page. Check your internet connection.' }); }
</script></body></html>`;
}

export function usePayment() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [purpose, setPurpose] = useState<'donation' | 'registration'>('donation');
  const [verifying, setVerifying] = useState(false);
  const done = useRef(false);

  const pay = useCallback(async (amountRupees: number, why: 'donation' | 'registration' = 'donation'): Promise<Verified> => {
    const order = await Q.paymentOrder(amountRupees, why);
    if (order.mode === 'simulated') return Q.paymentVerify({ local_order_id: order.local_order_id });
    setPurpose(why);
    done.current = false;
    return new Promise<Verified>((resolve, reject) => setPending({ order, resolve, reject }));
  }, []);

  async function onMessage(e: WebViewMessageEvent) {
    if (!pending || done.current) return;
    done.current = true;
    const m = JSON.parse(e.nativeEvent.data) as { ok: boolean; reason?: string; razorpay_payment_id?: string; razorpay_order_id?: string; razorpay_signature?: string };
    if (!m.ok) {
      pending.reject(new Error(m.reason ?? 'Payment cancelled.'));
      setPending(null);
      return;
    }
    setVerifying(true);
    try {
      pending.resolve(
        await Q.paymentVerify({
          local_order_id: pending.order.local_order_id,
          razorpay_payment_id: m.razorpay_payment_id,
          razorpay_order_id: m.razorpay_order_id,
          razorpay_signature: m.razorpay_signature,
        }),
      );
    } catch (err) {
      pending.reject(err as Error);
    } finally {
      setVerifying(false);
      setPending(null);
    }
  }

  function cancel() {
    if (pending && !done.current) pending.reject(new Error('Payment cancelled.'));
    done.current = true;
    setPending(null);
  }

  const sheet = (
    <Modal visible={!!pending} animationType="slide" onRequestClose={cancel}>
      <View style={styles.wrap}>
        <View style={styles.head}>
          <Text style={styles.title}>Secure payment · ₹{pending?.order.amount_rupees}</Text>
          <Pressable onPress={cancel} accessibilityRole="button" hitSlop={10}>
            <Text style={styles.close}>Cancel</Text>
          </Pressable>
        </View>
        {pending && (
          <WebView
            source={{ html: checkoutHtml(pending.order, purpose), baseUrl: 'https://qumanity.in' }}
            originWhitelist={['*']}
            onMessage={onMessage}
            javaScriptEnabled
            // UPI / bank apps open outside the WebView (upi://, intent://, tez://, phonepe:// …)
            onShouldStartLoadWithRequest={(req) => {
              if (/^https?:|^about:|^data:/.test(req.url)) return true;
              Linking.openURL(req.url).catch(() => undefined);
              return false;
            }}
            style={{ flex: 1, backgroundColor: colors.ink }}
          />
        )}
        {verifying && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.gold} />
            <Text style={styles.title}>Confirming your payment…</Text>
          </View>
        )}
      </View>
    </Modal>
  );

  return { pay, sheet };
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.ink, paddingTop: 48 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: space.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  close: { color: colors.gold, fontFamily: fonts.medium },
  overlay: { ...StyleSheet.absoluteFill as object, backgroundColor: '#060c16ee', alignItems: 'center', justifyContent: 'center', gap: space.md },
});
