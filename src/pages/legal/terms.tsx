import LegalDoc, { P, Bullets, type LegalSection } from './LegalDoc'

const UPDATED = 'June 1, 2026'

const SECTIONS: LegalSection[] = [
  {
    heading: 'Acceptance of terms',
    body: (
      <P>
        By creating a publisher account or integrating the AsyncAds offerwall, you agree to these Terms of
        Service on behalf of yourself and the entity you represent. If you do not agree, you may not use the
        platform. These terms incorporate our{' '}
        <a href="/legal/privacy" className="font-medium text-brand-fuchsia hover:text-brand-violet">
          Privacy Policy
        </a>{' '}
        and, where applicable, our{' '}
        <a href="/legal/dpa" className="font-medium text-brand-fuchsia hover:text-brand-violet">
          Data Processing Agreement
        </a>
        .
      </P>
    ),
  },
  {
    heading: 'Eligibility and accounts',
    body: (
      <>
        <P>
          You must be at least 18 years old and able to form a binding contract to use the platform. You are
          responsible for all activity under your account.
        </P>
        <Bullets
          items={[
            'Provide accurate registration details and keep them current.',
            'Maintain the confidentiality of your credentials, API keys, and S2S secret.',
            'Notify us promptly at security@asyncads.com of any unauthorized access.',
          ]}
        />
      </>
    ),
  },
  {
    heading: 'The service',
    body: (
      <>
        <P>
          AsyncAds provides an offerwall and rewarded-advertising platform that lets publishers monetize their
          apps and websites. We connect your placements to advertiser offers and pay you for valid conversions.
        </P>
        <P>
          We may add, change, or remove features at any time. We will give reasonable notice of material changes
          that adversely affect your use of the platform.
        </P>
      </>
    ),
  },
  {
    heading: 'Publisher responsibilities',
    body: (
      <Bullets
        items={[
          'Provide accurate account, business, and payout information and keep it current.',
          'Only drive genuine, human traffic — no incentivized fraud, bots, or misrepresentation of offers.',
          'Comply with all applicable laws and the requirements of the app stores and networks you operate on.',
          'Obtain any end-user consents required for the data you send to us.',
        ]}
      />
    ),
  },
  {
    heading: 'Prohibited conduct',
    body: (
      <P>
        Fraudulent conversions, self-clicking, malware, deceptive offer presentation, and circumvention of our
        fraud controls are strictly prohibited. We may withhold payouts for, reverse, or terminate accounts
        associated with such activity.
      </P>
    ),
  },
  {
    heading: 'Fees, payments, and chargebacks',
    body: (
      <P>
        Earnings are calculated from valid conversions, net of reversals and chargebacks, and paid per the
        schedule and minimum thresholds shown on your Payouts page. Conversions later found to be invalid may be
        clawed back from current or future balances. You are responsible for the accuracy of your payout
        details; we are not liable for funds sent to an address you provided.
      </P>
    ),
  },
  {
    heading: 'Taxes',
    body: (
      <P>
        You are responsible for determining and paying any taxes, levies, or duties applicable to amounts you
        earn through the platform. Where required by law, we may withhold taxes or request tax documentation
        before issuing payouts.
      </P>
    ),
  },
  {
    heading: 'Intellectual property and license',
    body: (
      <>
        <P>
          The platform, including the SDK, dashboard, and all related software and content, is owned by
          AsyncAds and its licensors. We grant you a limited, non-exclusive, non-transferable, revocable license
          to use the SDK and APIs solely to integrate and operate the offerwall as permitted by these terms.
        </P>
        <P>
          You may not copy, modify, reverse engineer, resell, or create derivative works from the platform
          except as expressly allowed. We may use your name and logo to identify you as a publisher unless you
          opt out in writing.
        </P>
      </>
    ),
  },
  {
    heading: 'Confidentiality',
    body: (
      <P>
        Each party may access non-public information of the other (including secrets, payout rates, and
        analytics). You agree to protect such information with reasonable care and use it only to exercise your
        rights and obligations under these terms.
      </P>
    ),
  },
  {
    heading: 'Term and termination',
    body: (
      <P>
        You may stop using the platform at any time. We may suspend or terminate your access for breach of these
        terms or suspected fraud. On termination, your license ends and you must stop using the SDK and APIs.
        Outstanding valid earnings remain payable subject to verification; sections that by their nature should
        survive termination will do so.
      </P>
    ),
  },
  {
    heading: 'Disclaimers',
    body: (
      <P>
        The platform is provided “as is” and “as available” without warranties of any kind, whether express,
        implied, or statutory, including merchantability, fitness for a particular purpose, and
        non-infringement. We do not warrant uninterrupted or error-free operation, or any specific level of
        earnings.
      </P>
    ),
  },
  {
    heading: 'Limitation of liability',
    body: (
      <P>
        To the maximum extent permitted by law, AsyncAds is not liable for indirect, incidental, special,
        consequential, or punitive damages, or for lost profits or revenues. Our aggregate liability arising out
        of or relating to these terms is limited to the amounts paid or payable to you in the three months
        preceding the event giving rise to the claim.
      </P>
    ),
  },
  {
    heading: 'Indemnification',
    body: (
      <P>
        You will defend, indemnify, and hold harmless AsyncAds and its affiliates from any claims, damages, and
        expenses (including reasonable legal fees) arising from your traffic, your breach of these terms, or
        your violation of any law or third-party right.
      </P>
    ),
  },
  {
    heading: 'Changes to these terms',
    body: (
      <P>
        We may update these terms from time to time. We will post the revised version with a new “last updated”
        date and, for material changes, provide additional notice. Your continued use of the platform after the
        changes take effect constitutes acceptance.
      </P>
    ),
  },
  {
    heading: 'Governing law and disputes',
    body: (
      <P>
        These terms are governed by the laws of the jurisdiction in which AsyncAds is established, without regard
        to conflict-of-laws rules. The courts of that jurisdiction will have exclusive jurisdiction over any
        dispute, except that either party may seek injunctive relief where available.{' '}
        <span className="text-slate-400">[Specify the governing-law jurisdiction and venue before publishing.]</span>
      </P>
    ),
  },
  {
    heading: 'Miscellaneous',
    body: (
      <Bullets
        items={[
          'Entire agreement: these terms are the entire agreement between you and AsyncAds regarding the platform.',
          'Severability: if any provision is unenforceable, the remaining provisions stay in effect.',
          'Assignment: you may not assign these terms without our consent; we may assign them to an affiliate or successor.',
          'No waiver: our failure to enforce a provision is not a waiver of it.',
          'Force majeure: neither party is liable for delays caused by events beyond its reasonable control.',
        ]}
      />
    ),
  },
]

export default function Terms() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated={UPDATED}
      intro="These terms govern your access to and use of the AsyncAds publisher platform. Please read them carefully."
      sections={SECTIONS}
    />
  )
}
