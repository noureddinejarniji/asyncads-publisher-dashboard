import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Check, Clock, Copy } from 'lucide-react'

/** Stable anchor id from a section title, e.g. "Configure S2S postback" -> "configure-s2s-postback". */
function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const OFFERWALL_BASE = 'https://wall.asyncads.com'
const SERVER_IP = '105.71.147.181'

const requiredParams = [
  ['user_id', '{user_id}', 'Your user ID. Use the same ID you pass when opening the wall.'],
  ['offer_id', '{offer_id}', 'AsyncAds offer identifier.'],
  ['tx_id', '{tx_id}', 'Unique conversion transaction ID. Store it to prevent double reward.'],
  ['amount', '{amount}', 'Reward amount for the conversion.'],
  ['signature', '{signature}', 'HMAC-SHA256 of offer_id|user_id|tx_id, keyed by your postback secret.'],
]

const optionalParams = [
  ['ip', '{ip}', "User's IP address at click time."],
  ['country', '{country}', 'ISO country code. Example: US.'],
  ['goal_id', '{goal_id}', 'AsyncAds goal key.'],
  ['offer_name', '{offer_name}', 'Readable offer name.'],
  ['goal_name', '{goal_name}', 'Readable completed goal name.'],
  ['clicked_at', '{clicked_at}', 'Unix timestamp for the click.'],
  ['converted_at', '{converted_at}', 'Unix timestamp for the conversion.'],
  ['status', '{status}', 'Conversion status text. Example: approved.'],
  ['currency', '{currency}', 'Currency code. Example: USD.'],
  ['sub_id1', '{sub_id1}', 'Custom tracking value from the wall link s1 query param.'],
  ['sub_id2', '{sub_id2}', 'Custom tracking value from the wall link s2 query param.'],
  ['sub_id3', '{sub_id3}', 'Custom tracking value from the wall link s3 query param.'],
  ['sub_id4', '{sub_id4}', 'Custom tracking value from the wall link s4 query param.'],
  ['sub_id5', '{sub_id5}', 'Custom tracking value from the wall link s5 query param.'],
  ['timestamp', '{timestamp}', 'Signed callback timestamp.'],
]

const integrationSteps = [
  ['Create your placement', 'Add your app or website as a new placement. This step completes automatically when the placement is created.'],
  ['Activate and configure your postback', 'Add your callback URL and required params, enable the postback, and validate the MAC signature.'],
  ['Build your postback endpoint', 'Stand up an endpoint on your server that receives our postback, validates the signature, and returns 1.'],
  ['Test your endpoint', 'Run a test conversion from the S2S Callbacks page and confirm your endpoint returns 1.'],
  ['You are live', 'Once the placement is live and has recorded its first click and conversion, the offerwall is serving real users.'],
]

const iframeCode = `<iframe
  src="${OFFERWALL_BASE}/{placement_public_id}/USER_123?s1=campaign-a&s2=creative-12&s3=source-app"
  width="100%"
  height="720"
  style="border:0;border-radius:12px;overflow:hidden"
  loading="lazy"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>`

const postbackExample = `GET https://your-domain.com/asyncads/postback
  ?user_id=USER_123
  &offer_id=OF-1042
  &tx_id=tx_8f3a91c2
  &amount=4.20
  &status=approved
  &timestamp=1747067432
  &signature=f4c2b9...`

const phpValidationCode = `<?php

$secret = 'YOUR_POSTBACK_SECRET';

$offerId  = $_GET['offer_id'] ?? '';
$userId   = $_GET['user_id'] ?? '';
$txId     = $_GET['tx_id'] ?? '';
$amount   = $_GET['amount'] ?? '';
$status   = $_GET['status'] ?? 'approved';
$received = $_GET['signature'] ?? '';

// signature = HMAC-SHA256( offer_id . '|' . user_id . '|' . tx_id ) keyed by your secret.
$expected = hash_hmac('sha256', $offerId . '|' . $userId . '|' . $txId, $secret);

// Reject (0): invalid signature.
if (!hash_equals($expected, $received)) {
    echo '0';
    exit;
}

// Reject (0): missing data.
if ($offerId === '' || $userId === '' || $txId === '' || (float) $amount <= 0) {
    echo '0';
    exit;
}

// status: approved = credit. Ignore anything else unless you support reversals.
if ($status !== 'approved') {
    // reverseReward($txId);
    echo '1';
    exit;
}

// Idempotency: credit only once per tx_id.
// if (conversionAlreadyCredited($txId)) { echo '1'; exit; }

// creditUser($_GET['user_id'] ?? '', (float) $amount, $txId);

// Accept (1): conversion credited.
echo '1';`

function Section({ eyebrow, title, children }: { eyebrow?: string; title: string; children: ReactNode }) {
  return (
    <section id={slugify(title)} className="scroll-mt-24 border-t border-slate-100 pt-12 first:border-t-0 first:pt-0">
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{eyebrow}</p>}
      <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{title}</h2>
      <div className="mt-5 space-y-5">{children}</div>
    </section>
  )
}

function Prose({ children }: { children: ReactNode }) {
  return <p className="text-[15px] leading-7 text-slate-600">{children}</p>
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// Lightweight, language-agnostic highlighter for the snippets in these docs.
// Tokens never span newlines, so this stays safe and predictable.
const HL_RE =
  /(^[ \t]*\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(\$[A-Za-z_]\w*)|(\b(?:GET|POST|PUT|PATCH|DELETE)\b)|(\b(?:true|false|null)\b)|(\b\d+(?:\.\d+)?\b)/gm

function highlight(code: string): string {
  return escapeHtml(code).replace(HL_RE, (match, comment, str, phpVar, http, keyword, num) => {
    if (comment) return `<span class="italic text-slate-400">${comment}</span>`
    if (str) return `<span class="text-emerald-600">${str}</span>`
    if (phpVar) return `<span class="text-sky-600">${phpVar}</span>`
    if (http) return `<span class="font-semibold text-fuchsia-600">${http}</span>`
    if (keyword) return `<span class="text-violet-600">${keyword}</span>`
    if (num) return `<span class="text-amber-600">${num}</span>`
    return match
  })
}

function CodeBlock({ code, title }: { code: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  const html = useMemo(() => highlight(code), [code])

  async function copy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard may be unavailable; ignore.
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2">
        <span className="font-mono text-xs text-slate-400">{title ?? 'code'}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-400 transition-colors hover:text-slate-700"
        >
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="max-h-[520px] overflow-auto p-4 text-xs leading-6 text-slate-800 sm:text-[13px]">
        <code className="font-mono" dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}

function ParamTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-400">
            <th className="px-4 py-2.5 font-semibold">Key</th>
            <th className="px-4 py-2.5 font-semibold">Macro</th>
            <th className="px-4 py-2.5 font-semibold">Meaning</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(([key, macro, description]) => (
            <tr key={`${key}-${macro}`} className="align-top">
              <td className="whitespace-nowrap px-4 py-2.5 font-mono font-medium text-slate-900">{key}</td>
              <td className="whitespace-nowrap px-4 py-2.5 font-mono text-brand-fuchsia">{macro}</td>
              <td className="px-4 py-2.5 leading-5 text-slate-500">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StepList({ rows }: { rows: string[][] }) {
  return (
    <ol className="grid gap-3">
      {rows.map(([title, body], index) => (
        <li
          key={title}
          className="grid grid-cols-[40px_1fr] gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-fuchsia/10 font-mono text-sm font-semibold text-brand-fuchsia">
            {index + 1}
          </span>
          <span>
            <span className="block text-sm font-semibold text-slate-900">{title}</span>
            <span className="mt-1 block text-sm leading-5 text-slate-500">{body}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

export default function Docs() {
  const { hash } = useLocation()

  // Deep-link support: scroll to the section named in the URL hash (e.g. links
  // from the S2S Callbacks page open /docs#configure-s2s-postback).
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <div className="mx-auto max-w-3xl px-1 pb-16">
      {/* Header */}
      <header>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Developer docs</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">AsyncAds integration</h1>
        <p className="mt-3 text-[15px] leading-7 text-slate-600">
          Create a placement, open the offerwall, receive secure server-to-server postbacks, and control offers from
          the dashboard API.
        </p>
        <Link
          to="/placements"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-fuchsia transition-colors hover:text-brand-violet"
        >
          Open placements →
        </Link>
      </header>

      <div className="mt-12 space-y-12">
        <Section title="Create a placement">
          <Prose>
            A placement is the app or website where the offerwall opens. Create it from the dashboard, or through the
            authenticated API. New placements start as <code className="font-mono text-slate-900">draft</code> — submit
            them for review before sending live traffic. Re-using a domain returns 409 with the existing slug.
          </Prose>
          <StepList rows={integrationSteps} />
        </Section>

        <Section title="Open the web offerwall">
          <Prose>
            For web placements, embed the offerwall in an iframe. Always pass a stable{' '}
            <code className="font-mono text-slate-900">user_id</code> so the postback can reward the same user later.
            Optional <code className="font-mono text-slate-900">s1</code> to{' '}
            <code className="font-mono text-slate-900">s5</code> values are saved as{' '}
            <code className="font-mono text-slate-900">sub_id1</code> to{' '}
            <code className="font-mono text-slate-900">sub_id5</code> and can flow through to your postback.
          </Prose>
          <CodeBlock title="Iframe snippet" code={iframeCode} />
        </Section>

        <Section title="Configure S2S postback">
          <Prose>
            AsyncAds sends a server-to-server request when a user completes an offer. Use GET or POST, validate the
            signature, then grant the reward once per <code className="font-mono text-slate-900">tx_id</code>. Your
            endpoint must reply with exactly <code className="font-mono text-slate-900">1</code> to accept the conversion
            or <code className="font-mono text-slate-900">0</code> to reject it — AsyncAds retries when it receives{' '}
            <code className="font-mono text-slate-900">0</code> or no response.
          </Prose>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold text-amber-900">Whitelist our server IP</h3>
            <p className="mt-1 text-sm leading-6 text-amber-800">
              AsyncAds sends every postback to your server from the IP below. Allow it through your firewall, and if you
              filter by source IP, accept postback requests only from it.
            </p>
            <code className="mt-3 inline-block rounded-md border border-amber-200 bg-white px-3 py-1.5 font-mono text-sm font-semibold text-slate-900">
              {SERVER_IP}
            </code>
          </div>

          <CodeBlock title="Example callback" code={postbackExample} />
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Expected response from your server</h3>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              After AsyncAds sends the postback request, your endpoint must return plain text only:
            </p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-md border border-emerald-100 bg-emerald-50 p-3">
                <dt className="font-mono text-2xl font-semibold text-emerald-700">1 / OK</dt>
                <dd className="mt-1 text-sm font-medium text-emerald-900">Conversion accepted</dd>
              </div>
              <div className="rounded-md border border-rose-100 bg-rose-50 p-3">
                <dt className="font-mono text-2xl font-semibold text-rose-700">0 / NO OK</dt>
                <dd className="mt-1 text-sm font-medium text-rose-900">Conversion rejected</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-5 text-slate-400">
              Do not return JSON or HTML. AsyncAds accepts 1 or OK, and treats 0, NO OK, NOT OK, false, or error as rejected.
            </p>
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Required params</h3>
            <ParamTable rows={requiredParams} />
          </div>
          <div>
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Optional params</h3>
            <ParamTable rows={optionalParams} />
          </div>
        </Section>

        <Section eyebrow="Security" title="PHP MAC validation">
          <Prose>
            The signature is{' '}
            <code className="font-mono text-slate-900">hash_hmac('sha256', offer_id . '|' . user_id . '|' . tx_id, secret)</code> —
            HMAC-SHA256 of <code className="font-mono text-slate-900">offer_id</code> +{' '}
            <code className="font-mono text-slate-900">user_id</code> +{' '}
            <code className="font-mono text-slate-900">tx_id</code> separated with pipes, keyed by your postback secret. Compare
            it with <code className="font-mono text-slate-900">hash_equals</code>, then reward each{' '}
            <code className="font-mono text-slate-900">tx_id</code> only once.
          </Prose>
          <CodeBlock title="postback.php" code={phpValidationCode} />
        </Section>

        <Section eyebrow="Controls" title="Offers API">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-fuchsia/10 text-brand-fuchsia">
              <Clock size={24} />
            </span>
            <p className="font-display text-base font-semibold text-slate-900">Coming soon</p>
            <p className="max-w-md text-sm text-slate-500">
              Programmatic access to fetch offers from your server or SDK is on the way. Documentation will appear here
              once the Offers API is available.
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}
