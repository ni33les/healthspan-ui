import type { Locale } from "@/lib/i18n";
import { buildReassessmentUrl, buildUnsubscribeUrl } from "@/lib/site-url";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function buildReassessmentEmailHtml({
  locale,
  planId,
  unsubscribeToken
}: Readonly<{
  locale: Locale;
  planId: string;
  unsubscribeToken: string;
}>) {
  const labels =
    locale === "th"
      ? {
          body:
            "HealthScore ของคุณเปลี่ยนได้ตามการนอน อาหาร การฝึก ความเครียด และข้อมูลใหม่ๆ กลับมาทำแบบประเมินอีกครั้งเพื่อดูว่าคะแนนเปลี่ยนไปอย่างไร และสร้างสูตรเวอร์ชันใหม่จากข้อมูลล่าสุดของคุณ",
          cta: "ทำแบบประเมินอีกครั้ง",
          eyebrow: "ถึงเวลาทบทวน HealthScore",
          plan: "แผน",
          subject: "กลับมาทบทวน HealthScore ของคุณ",
          title: "ดูว่าอะไรเปลี่ยนไปใน 60 วันที่ผ่านมา",
          unsubscribe: "ยกเลิกอีเมลการประเมินซ้ำ"
        }
      : {
          body:
            "Your HealthScore changes as sleep, food, training, stress, and new data change. Come back for a quick reassessment so we can show what moved and prepare a new formulation version from your latest answers.",
          cta: "Take the reassessment",
          eyebrow: "Your HealthScore review is ready",
          plan: "Plan",
          subject: "Review your MattaNutra HealthScore",
          title: "See what changed over the last 60 days",
          unsubscribe: "Unsubscribe from reassessment emails"
        };
  const reassessmentUrl = buildReassessmentUrl(locale, planId);
  const unsubscribeUrl = buildUnsubscribeUrl(unsubscribeToken);

  return `<!doctype html>
<html lang="${locale}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(labels.subject)}</title>
  </head>
  <body style="margin:0;background:#f3f8ff;font-family:Arial,sans-serif;color:#20343A;">
    <div style="max-width:640px;margin:0 auto;padding:28px 18px;">
      <div style="background:#ffffff;border-radius:16px;padding:28px;border:1px solid #d9e8f7;">
        <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#1FA77A;font-weight:700;">MattaNutra</div>
        <h1 style="margin:12px 0 10px;font-size:28px;line-height:1.15;color:#20343A;">${escapeHtml(labels.title)}</h1>
        <p style="margin:0;color:#5c6670;line-height:1.6;font-size:15px;">${escapeHtml(labels.body)}</p>
        <p style="margin:22px 0 0;color:#6b7280;font-size:12px;line-height:1.5;">${escapeHtml(labels.plan)}: ${escapeHtml(planId)}</p>
        <a href="${escapeHtml(reassessmentUrl)}" style="display:inline-block;margin-top:20px;background:#1FA77A;color:#ffffff;text-decoration:none;border-radius:8px;padding:13px 18px;font-size:13px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(labels.cta)}</a>
        <p style="margin:24px 0 0;color:#9aa4af;font-size:11px;line-height:1.5;">
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280;text-decoration:underline;">${escapeHtml(labels.unsubscribe)}</a>
        </p>
      </div>
    </div>
  </body>
</html>`;
}

export function buildReassessmentEmailSubject(locale: Locale) {
  return locale === "th"
    ? "กลับมาทบทวน HealthScore ของคุณ"
    : "Review your MattaNutra HealthScore";
}
