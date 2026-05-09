import { writeBpmEvent, type BpmEventInput } from "@/lib/bpm";

type SkippedPaymentSuccessInput = Omit<
  BpmEventInput,
  "actorType" | "emittedBy" | "eventName" | "eventStatus" | "eventType"
>;

export async function writeSkippedPaymentSuccessEvent({
  properties,
  ...input
}: SkippedPaymentSuccessInput) {
  await writeBpmEvent({
    ...input,
    actorType: "system",
    emittedBy: "payment_skip_mock",
    eventName: "plan_paid",
    eventStatus: "paid",
    eventType: "payment",
    properties: {
      ...properties,
      mocked: true,
      paymentSkipped: true,
      reason: "payments_not_live"
    }
  });
}
