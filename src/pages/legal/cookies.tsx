import LegalDoc, { P, Bullets, type LegalSection } from './LegalDoc'

const UPDATED = 'June 1, 2026'

const SECTIONS: LegalSection[] = [
  {
    heading: 'What cookies are',
    body: (
      <P>
        Cookies are small text files stored on your device. We also use similar technologies such as local
        storage and tokens. Together they let the dashboard remember you and keep your session secure. This
        policy supplements our{' '}
        <a href="/legal/privacy" className="font-medium text-brand-fuchsia hover:text-brand-violet">
          Privacy Policy
        </a>
        .
      </P>
    ),
  },
  {
    heading: 'How we use them',
    body: (
      <Bullets
        items={[
          'Essential: an httpOnly refresh-token cookie that keeps you signed in and protects your session.',
          'Preferences: local storage that remembers your access token and UI choices.',
          'Security: tokens and identifiers used to detect and prevent fraudulent activity.',
        ]}
      />
    ),
  },
  {
    heading: 'Cookies we set',
    body: (
      <>
        <P>The dashboard relies on a small number of first-party items:</P>
        <Bullets
          items={[
            'publisher_refresh_token — essential; httpOnly cookie that maintains your signed-in session. Expires after about 7 days.',
            'auth (local storage) — essential; holds your short-lived access token and profile so the app can call the API.',
            'UI preferences (local storage) — functional; remembers choices such as selected ranges and filters.',
          ]}
        />
      </>
    ),
  },
  {
    heading: 'First-party and third-party',
    body: (
      <P>
        The items above are first-party. Service providers that help us operate the platform (for example,
        hosting or payment processors) may set their own strictly necessary cookies when you interact with their
        components. We do not use third-party advertising cookies to track you across other websites.
      </P>
    ),
  },
  {
    heading: 'Analytics',
    body: (
      <P>
        We may use privacy-respecting analytics to understand aggregate dashboard usage and improve the product.
        These do not track you across other websites and, where required, are used only with your consent.
      </P>
    ),
  },
  {
    heading: 'Legal basis and consent',
    body: (
      <P>
        Strictly necessary cookies are used on the basis of our legitimate interest in providing a secure,
        functioning service and do not require consent. Where non-essential cookies or similar technologies are
        used, we rely on your consent, which you can withdraw at any time.
      </P>
    ),
  },
  {
    heading: 'Managing cookies',
    body: (
      <P>
        You can clear or block cookies in your browser settings, but disabling essential cookies will sign you
        out and prevent the dashboard from working correctly. Clearing local storage will also end your session.
      </P>
    ),
  },
  {
    heading: 'Changes',
    body: (
      <P>
        We may update this Cookie Policy as our practices evolve. Material changes will be reflected by the
        “last updated” date above.
      </P>
    ),
  },
]

export default function CookiePolicy() {
  return (
    <LegalDoc
      title="Cookie Policy"
      updated={UPDATED}
      intro="This policy explains how AsyncAds uses cookies and similar technologies in the publisher dashboard."
      sections={SECTIONS}
    />
  )
}
