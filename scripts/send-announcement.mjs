// Bulk announcement email to all confirmed users, via Resend.
//
// Recipients are pulled from the DB (no PII in the repo): every confirmed user,
// in their own language (user_settings.language, fallback "en"), minus anyone in
// email_unsubscribes, minus ADMIN_EMAIL, minus the campaign's own `exclude` list.
// Each mail gets a signed one-click unsubscribe link + List-Unsubscribe headers.
//
// Dry-run by default (prints who would receive what); SEND=1 actually sends.
//   dry:  node --env-file=.env scripts/send-announcement.mjs campaigns/my.json
//   send: SEND=1 node --env-file=.env scripts/send-announcement.mjs campaigns/my.json
//
// Env: NEXT_PUBLIC_SUPABASE_URL, DB_PASSWORD, RESEND_API_KEY, UNSUBSCRIBE_SECRET,
//      ADMIN_EMAIL (optional — excluded from recipients).
// See docs/ADMIN.md → "단체 공지 이메일" for the campaign file format.
import { createHmac } from "crypto";
import { readFileSync } from "fs";
import postgres from "postgres";

const DRY = process.env.SEND !== "1";

const campaignPath = process.argv[2];
if (!campaignPath) {
  console.error("Usage: node --env-file=.env scripts/send-announcement.mjs <campaign.json>");
  process.exit(1);
}
const campaign = JSON.parse(readFileSync(campaignPath, "utf8"));

const FROM = campaign.from ?? "Dear My Routines <noreply@hyeyoungjo.com>";
const REPLY_TO = campaign.replyTo ?? "jhy.vfx@gmail.com";
const BASE = campaign.baseUrl ?? "https://dearmyroutines.hyeyoungjo.com";
const langs = campaign.langs;
if (!langs?.en?.subject || !langs?.en?.html) {
  console.error("campaign.langs.en (with subject + html) is required as the fallback language.");
  process.exit(1);
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "DB_PASSWORD", "UNSUBSCRIBE_SECRET"]) {
  if (!process.env[key]) {
    console.error(`Missing env: ${key}`);
    process.exit(1);
  }
}

function unsubUrl(email) {
  const norm = email.trim().toLowerCase();
  const token = createHmac("sha256", process.env.UNSUBSCRIBE_SECRET)
    .update(norm)
    .digest("hex");
  return `${BASE}/api/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`;
}

// --- Recipients from the DB (same pooler connection as src/db/index.ts) ---
const ref = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
const sql = postgres({
  host: "aws-1-us-west-2.pooler.supabase.com",
  port: 5432,
  user: `postgres.${ref}`,
  database: "postgres",
  password: process.env.DB_PASSWORD,
  ssl: "require",
});

let users, unsubscribed;
try {
  users = await sql`
    select u.email, coalesce(s.language, 'en') as language
    from auth.users u
    left join user_settings s on s.user_id = u.id
    where u.email_confirmed_at is not null
  `;
  unsubscribed = await sql`select email from email_unsubscribes`;
} finally {
  await sql.end();
}

const unsub = new Set(unsubscribed.map((r) => r.email.toLowerCase()));
const adminEmail = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
const extraExclude = new Set((campaign.exclude ?? []).map((e) => e.toLowerCase()));

const recipients = users.filter((u) => {
  const e = u.email.toLowerCase();
  return !unsub.has(e) && e !== adminEmail && !extraExclude.has(e);
});

const pick = (lang) => langs[lang] ?? langs.en;
const render = (str, u) => str.replaceAll("{{unsubscribe_url}}", u);

const batch = recipients.map(({ email, language }) => {
  const c = pick(language);
  const u = unsubUrl(email);
  return {
    from: FROM,
    to: [email],
    replyTo: REPLY_TO,
    subject: c.subject,
    html: render(c.html, u),
    ...(c.text ? { text: render(c.text, u) } : {}),
    headers: {
      "List-Unsubscribe": `<${u}>, <mailto:${REPLY_TO}?subject=unsubscribe>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
});

// --- Summary ---
const byLang = {};
for (const { language } of recipients) {
  const l = langs[language] ? language : "en";
  byLang[l] = (byLang[l] ?? 0) + 1;
}
console.log(`Campaign: ${campaignPath}`);
console.log(`From:     ${FROM}`);
console.log(`Reply-To: ${REPLY_TO}`);
console.log(`Users:    ${users.length} confirmed`);
console.log(`Skipped:  ${users.length - recipients.length} (unsubscribed / admin / excluded)`);
console.log(`Sending:  ${batch.length}  by lang: ${JSON.stringify(byLang)}`);

if (batch.length === 0) {
  console.log("\nNo recipients. Nothing to do.");
  process.exit(0);
}

if (DRY) {
  for (const m of batch) console.log(`  ${m.to[0]}  [${m.subject}]`);
  console.log("\nDRY RUN — nothing sent. Set SEND=1 to send for real.");
  process.exit(0);
}

if (!process.env.RESEND_API_KEY) {
  console.error("Missing env: RESEND_API_KEY");
  process.exit(1);
}
const { Resend } = await import("resend");
const resend = new Resend(process.env.RESEND_API_KEY);

// Resend batch.send accepts up to 100 messages per call.
let sent = 0;
for (let i = 0; i < batch.length; i += 100) {
  const chunk = batch.slice(i, i + 100);
  const { data, error } = await resend.batch.send(chunk);
  if (error) {
    console.error(`Resend error on chunk ${i / 100}:`, error);
    process.exit(1);
  }
  sent += data?.data?.length ?? chunk.length;
}
console.log(`\nSent ${sent} emails.`);
