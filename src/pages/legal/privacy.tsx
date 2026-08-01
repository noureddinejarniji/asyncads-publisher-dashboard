import LegalDoc, { P, Bullets, type LegalSection } from './LegalDoc'

const UPDATED = 'June 1, 2026'

const SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    body: (
      <P>
        AsyncAds operates an offerwall and rewarded-advertising platform for publishers. For the publisher
        account data described here, AsyncAds is the data controller. For end-user data you direct us to process
        through your integration, you are the controller and we act as your processor under our{' '}
        <a href="/legal/dpa" className="font-medium text-brand-fuchsia hover:text-brand-violet">
          Data Processing Agreement
        </a>
        .{' '}
        <span className="text-slate-400">[Insert legal entity name and registered address before publishing.]</span>
      </P>
    ),
  },
  {
    heading: 'Information we collect',
    body: (
      <Bullets
        items={[
          'Account data: your name, email, company, website, and password (stored only as a hash).',
          'Usage and device data: IP address, browser/OS, and session activity used to secure your account.',
          'Integration data: placements, conversions, postback events, and payout details you configure.',
          'Communications: messages you send to support and your account manager.',
        ]}
      />
    ),
  },
  {
    heading: 'How we use information',
    body: (
      <P>
        We use your information to operate the platform, attribute conversions, calculate and send payouts,
        prevent fraud and abuse, secure accounts, provide support, send service and (where permitted) marketing
        communications, and comply with legal obligations. We do not sell your personal data.
      </P>
    ),
  },
  {
    heading: 'Legal bases',
    body: (
      <P>
        Where the GDPR or similar laws apply, we process personal data to perform our contract with you, to
        pursue our legitimate interests in operating and securing the platform, to comply with legal
        obligations, and, where required, based on your consent (which you may withdraw at any time).
      </P>
    ),
  },
  {
    heading: 'Sharing and disclosure',
    body: (
      <Bullets
        items={[
          'Advertisers and networks: only as needed to attribute and validate conversions.',
          'Service providers: hosting, analytics, and payment processors acting on our behalf under contract.',
          'Legal and safety: when required by law or to protect the rights, property, or safety of users.',
          'Business transfers: in connection with a merger, acquisition, or sale of assets.',
        ]}
      />
    ),
  },
  {
    heading: 'International transfers',
    body: (
      <P>
        We may process and store data in countries other than your own. Where personal data is transferred
        across borders, we rely on an approved transfer mechanism, such as the Standard Contractual Clauses,
        together with supplementary measures where needed.
      </P>
    ),
  },
  {
    heading: 'Data retention',
    body: (
      <P>
        We retain account and transaction records for as long as your account is active and as required to meet
        legal, tax, and audit obligations, after which they are deleted or anonymized.
      </P>
    ),
  },
  {
    heading: 'Security',
    body: (
      <P>
        We protect your account with encrypted transport, hashed passwords, scoped access tokens, and session
        controls. No system is perfectly secure, so please keep your credentials safe and report any concern to
        security@asyncads.com.
      </P>
    ),
  },
  {
    heading: 'Your rights',
    body: (
      <P>
        Subject to applicable law, you may request access to, correction of, or deletion of your personal data,
        receive a copy in a portable format, and object to or restrict certain processing. You may also lodge a
        complaint with your local data-protection authority. Contact{' '}
        <a href="mailto:privacy@asyncads.com" className="font-medium text-brand-fuchsia hover:text-brand-violet">
          privacy@asyncads.com
        </a>{' '}
        to exercise these rights.
      </P>
    ),
  },
  {
    heading: 'Cookies and tracking',
    body: (
      <P>
        We use cookies and similar technologies to keep you signed in and secure your session. For details and
        your choices, see our{' '}
        <a href="/legal/cookies" className="font-medium text-brand-fuchsia hover:text-brand-violet">
          Cookie Policy
        </a>
        .
      </P>
    ),
  },
  {
    heading: 'Automated processing and fraud prevention',
    body: (
      <P>
        We use automated systems to detect invalid traffic and fraudulent conversions. These checks can affect
        whether a conversion is credited or reversed. We do not make decisions producing legal effects about you
        based solely on automated processing without appropriate safeguards.
      </P>
    ),
  },
  {
    heading: "Children's privacy",
    body: (
      <P>
        The platform is intended for businesses and is not directed to children. We do not knowingly collect
        personal data from children. If you believe a child has provided us data, contact us so we can delete
        it.
      </P>
    ),
  },
  {
    heading: 'Changes to this policy',
    body: (
      <P>
        We may update this policy as our practices evolve. We will post the revised version with a new “last
        updated” date and, for material changes, provide additional notice.
      </P>
    ),
  },
]

export default function Privacy() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated={UPDATED}
      intro="This policy explains what information AsyncAds collects from publishers, how we use it, and the choices you have."
      sections={SECTIONS}
    />
  )
}
