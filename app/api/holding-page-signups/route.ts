import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { writeBpmEvent } from "@/lib/bpm";
import { getSql } from "@/lib/db";
import { validateLeadEmail } from "@/lib/email-validation";
import { isLocale } from "@/lib/i18n";

type SignupBody = Readonly<{
  attribution?: Record<string, unknown>;
  email?: unknown;
  locale?: unknown;
}>;

function jsonObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  const sql = getSql();

  if (!sql) {
    return NextResponse.json(
      { message: "Signup capture is unavailable" },
      { status: 503 }
    );
  }

  let body: SignupBody;

  try {
    body = (await request.json()) as SignupBody;
  } catch {
    return NextResponse.json({ message: "Invalid request" }, { status: 400 });
  }

  const email = validateLeadEmail(body.email);

  if (!email.ok) {
    return NextResponse.json({ message: "Invalid email" }, { status: 400 });
  }

  const locale = isLocale(body.locale) ? body.locale : "en";
  const attribution = jsonObject(body.attribution);
  const existing = await sql<Array<{ channel_id: string; identity_id: string }>>`
    select
      communication_channels.id::text as channel_id,
      communication_channels.identity_id::text as identity_id
    from public.communication_channels
    where communication_channels.channel_type = 'email'
      and lower(communication_channels.address) = ${email.email}
    order by communication_channels.created_at asc
    limit 1
  `;
  const now = new Date().toISOString();
  let identityId = existing[0]?.identity_id;
  let channelId = existing[0]?.channel_id;

  if (identityId && channelId) {
    await sql`
      update public.communication_identities
      set
        metadata = coalesce(metadata, '{}'::jsonb) || ${sql.json({
          lastCapturedAt: now,
          locale,
          source: "prd_holding_page"
        })}::jsonb,
        updated_at = now()
      where id = ${identityId}::uuid
    `;

    await sql`
      update public.communication_channels
      set
        status = 'active',
        metadata = coalesce(metadata, '{}'::jsonb) || ${sql.json({
          lastCapturedAt: now,
          locale,
          source: "prd_holding_page"
        })}::jsonb,
        updated_at = now()
      where id = ${channelId}::uuid
    `;
  } else {
    identityId = randomUUID();
    channelId = randomUUID();

    await sql`
      insert into public.communication_identities (
        id,
        display_name,
        source,
        metadata,
        created_at,
        updated_at
      )
      values (
        ${identityId}::uuid,
        null,
        'prd_holding_page',
        ${sql.json({
          locale,
          source: "prd_holding_page"
        })}::jsonb,
        now(),
        now()
      )
    `;

    await sql`
      insert into public.communication_channels (
        id,
        identity_id,
        channel_type,
        address,
        display_name,
        status,
        preference_rank,
        actor_type,
        metadata,
        created_at,
        updated_at
      )
      values (
        ${channelId}::uuid,
        ${identityId}::uuid,
        'email',
        ${email.email},
        null,
        'active',
        80,
        'human',
        ${sql.json({
          capturedAt: now,
          locale,
          source: "prd_holding_page"
        })}::jsonb,
        now(),
        now()
      )
    `;
  }

  await writeBpmEvent({
    actorType: "visitor",
    attribution: {
      campaignId: text(attribution.campaignId),
      path: text(attribution.path),
      referrer: text(attribution.referrer) ?? text(request.headers.get("referer")),
      sourceUrl: text(attribution.sourceUrl),
      trafficSource: "temporary_holding_page",
      utmCampaign: text(attribution.utmCampaign),
      utmContent: text(attribution.utmContent),
      utmMedium: text(attribution.utmMedium),
      utmSource: text(attribution.utmSource),
      utmTerm: text(attribution.utmTerm)
    },
    email: email.email,
    emittedBy: "prd_holding_page",
    eventName: "holding_page_email_captured",
    eventStatus: "captured",
    eventType: "traffic",
    locale,
    properties: {
      channelId,
      identityId,
      source: "prd_holding_page"
    },
    request
  });

  return NextResponse.json({ ok: true });
}
