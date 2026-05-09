# BPM Event Table

The `bpm` table is the business process monitoring table. It is designed to power the sales/admin dashboard, affiliate attribution, campaign reporting, user journey inspection, and safety/error monitoring.

## Purpose

`bpm` records high-value business events across the platform:

- traffic and landing-page visits
- blog and content CTA activity
- assessment starts and completions
- HealthScore views
- free email requests
- plan selections
- payment events when payments go live
- formulation and recommendation events
- chat clicks and channel selection
- reassessment activity
- safety flags and errors
- affiliate and promotional campaign attribution

## Safety Review Queue

Safety review has two layers:

- `bpm` records the business event that a safety issue happened, so it can appear in the dashboard and funnel timeline.
- `jobs` carries the operational work item, usually `job_type = 'human_review'`, so the admin dashboard can show pending review tasks in the same queue model as other work.
- `safety_reviews` stores the supplement, dose, rule, context, and human decision.

Use `safety_reviews` when the AI suggests a supplement or dose that fails a hard check, hits an exclusion, conflicts with known context, or needs a qualified person to accept/reject it before the client is informed.

The review row stores:

| Field | Purpose |
| --- | --- |
| `supplement_name` | The supplement or ingredient being reviewed |
| `suggested_dose_value`, `suggested_dose_unit`, `suggested_frequency` | The dose that triggered review |
| `suggested_form`, `suggested_timing` | The proposed format and timing, where available |
| `limit_value`, `limit_unit`, `rule_code` | The rule or limit involved |
| `flag_reason` | Plain-language reason this was flagged |
| `ai_suggestion` | The exact AI suggestion payload |
| `safety_context` | Relevant assessment context, exclusions, medication flags, or dosing-limit evidence |
| `status` | Human-review state: open, in review, accepted, rejected, revised, escalated, client informed, closed |
| `client_notification_status` | Whether client communication has not started, queued, sent, failed, or is not required |

This keeps the BPM table clean while still giving the team a clear human-review workflow.

Recommended flow:

1. The validator flags a supplement or dose.
2. The system writes a `bpm` event for tracking and alerting.
3. The system creates a `safety_reviews` row with the exact supplement, dose, rule, and context.
4. The system creates a `jobs` row with `job_type = 'human_review'` and links it to the review.
5. The admin dashboard lists pending human-review jobs and joins to `safety_reviews` for the decision screen.
6. The reviewer accepts, rejects, revises, escalates, or maps the item to an approved supplement/product whitelist.
7. The system completes the job and queues any client notification if required.

## Core Journey ID: `ray`

`ray` is an anonymous UUID that ties a visitor's interactions together across one journey.

Example:

1. Visitor lands from a campaign.
2. Same `ray` records `home_viewed`.
3. Same `ray` records `assessment_started`.
4. Same `ray` records `healthscore_viewed`.
5. Same `ray` records `plan_selected`.

This lets the dashboard reconstruct the path without needing a name, phone number, or raw email.

## Primary Dashboard Filters

The table is indexed to support these dashboard slices:

| Filter | Field |
| --- | --- |
| Time window | `occurred_at` |
| Session/journey | `ray` |
| Plan | `selected_plan`, `plan_id` |
| Email identity | `email_hash` |
| Campaign | `utm_campaign`, `campaign_id`, `campaign_name`, `promo_code` |
| Affiliate | `affiliate_id`, `affiliate_ref`, `affiliate_sub_id`, `affiliate_click_id` |
| Traffic source | `traffic_source`, `source_channel`, `source_detail`, `referrer` |
| Event type | `event_type` |
| Event name | `event_name` |
| Safety/error severity | `severity`, `event_type`, `error_code` |

## Time Windows

The dashboard can query `occurred_at` for:

- 1 hour
- 3 hours
- 6 hours
- 12 hours
- 1 day
- 7 days
- 1 month
- 1 year
- all time

No separate table is required for these windows at first. If traffic grows, we can add summary rollups later.

## Event Types

Allowed `event_type` values:

| Type | Example Events |
| --- | --- |
| `traffic` | `home_viewed`, `landing_viewed` |
| `content` | `blog_viewed`, `blog_cta_clicked` |
| `funnel` | `assessment_started`, `healthscore_viewed`, `plan_gate_viewed` |
| `plan` | `plan_selected`, `plan_changed` |
| `payment` | `payment_started`, `payment_completed`, `payment_failed` |
| `email` | `free_email_requested`, `free_email_sent`, `email_failed` |
| `chat` | `chat_clicked`, `chat_channel_selected` |
| `formulation` | `formulation_requested`, `formulation_ready` |
| `reassessment` | `reassessment_opted_in`, `reassessment_started` |
| `affiliate` | `affiliate_landing`, `affiliate_click` |
| `safety` | `safety_flagged`, `human_review_required` |
| `error` | `api_error`, `worker_error` |
| `system` | `worker_started`, `cron_completed` |

## Attribution Fields

Use the first landing event for a `ray` to capture source attribution:

- `traffic_source`: normalized source such as `direct`, `organic`, `paid`, `affiliate`, `social`, `email`, `blog`, `referral`
- `source_channel`: platform or broad channel, such as `google`, `line`, `facebook`, `instagram`, `tiktok`, `newsletter`
- `source_detail`: free text detail, such as campaign placement or referring partner
- `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`
- `campaign_id`, `campaign_name`, `promo_code`
- `affiliate_id`, `affiliate_ref`, `affiliate_sub_id`, `affiliate_click_id`
- `ad_id`, `click_id`

This supports future affiliate reporting and promotional campaign analysis.

## Identity Fields

The table intentionally avoids raw personal contact data.

- Store `email_hash`, not raw email.
- Store `ip_hash`, not raw IP.
- Store `plan_id` when a journey becomes linked to an assessment.
- Use `ray` for anonymous session-level analysis.

## Safety and Error Tracking

Use:

- `event_type = 'safety'` or `event_type = 'error'`
- `severity = 'medium' | 'high' | 'critical'`
- `error_code`
- `error_message`
- `safety_flags`
- `properties`

This supports a dashboard panel for:

- failed jobs
- email failures
- Grok failures
- unsafe or high-risk questionnaire answers
- human review cases from `safety_reviews`

For each safety review, also write a BPM event such as:

- `event_type = 'safety'`
- `event_name = 'human_review_required'`
- `severity = 'medium' | 'high' | 'critical'`
- `properties.safety_review_id = <id>`
- `properties.supplement_name = <name>`
- `properties.suggested_dose = <dose>`

## Dashboard Views to Build Next

The admin dashboard should begin with:

1. Traffic line chart by selected time window.
2. Funnel counts from landing to assessment to HealthScore to plan/free email.
3. Plan selection split: free, Precision, Pro.
4. Campaign and affiliate source table.
5. Free email conversion table.
6. Chat channel clicks.
7. Safety and error alert list.
8. Ray drill-down showing one user's journey timeline.

## Implementation Notes

- `bpm` is schema-ready in `db-schema.sql`.
- The public event endpoint is `POST /api/bpm`.
- The browser tracker creates a session `ray`, captures campaign/referral/affiliate parameters, and records page views and tracked CTA clicks.
- Assessment, HealthScore, plan selection, free email, reassessment, formulation, worker failure, email, chat, and marketplace events are now wired into BPM.
- The dashboard should read from `bpm`, not from application logs.
- Backend events should be treated as more reliable than frontend-only events.

## Wired Event Examples

| Area | Events |
| --- | --- |
| Website | `home_viewed`, `site_logo_clicked`, `home_hero_assessment_clicked`, `home_bottom_assessment_clicked` |
| Content | `blog_article_viewed`, `blog_card_clicked`, `blog_assessment_cta_clicked` |
| Assessment | `assessment_viewed`, `assessment_started`, `assessment_submitted`, `assessment_captured`, `healthscore_viewed` |
| Plan gate | `plan_gate_viewed`, `plan_selected_clicked`, `plan_selected` |
| Free email | `free_email_requested_clicked`, `free_email_requested`, `free_email_sent` |
| Reassessment | `reassessment_opted_in`, `reassessment_email_sent` |
| Formulation | `formulation_requested`, `formulation_ready`, `free_example_formulation_ready` |
| Chat and affiliate | `chat_channel_clicked`, `marketplace_product_clicked` |
| Errors | `assessment_api_error`, `free_email_request_error`, `worker_job_failed` |
