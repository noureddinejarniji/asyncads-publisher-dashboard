import LegalDoc, { P, Bullets, type LegalSection } from './LegalDoc'

const UPDATED = 'June 1, 2026'

const SECTIONS: LegalSection[] = [
  {
    heading: 'Scope and roles',
    body: (
      <P>
        This Data Processing Agreement (“DPA”) forms part of the{' '}
        <a href="/legal/terms" className="font-medium text-brand-fuchsia hover:text-brand-violet">
          Terms of Service
        </a>{' '}
        and applies where AsyncAds processes personal data on your behalf. For end-user data you direct us to
        process, you are the controller and AsyncAds is the processor. Each party will comply with the data
        protection laws applicable to it.
      </P>
    ),
  },
  {
    heading: 'Definitions',
    body: (
      <P>
        Terms such as “controller”, “processor”, “data subject”, “personal data”, “processing”, and “personal
        data breach” have the meanings given in applicable data-protection law, including the GDPR where it
        applies. “Applicable laws” means the data-protection and privacy laws that apply to a party’s processing.
      </P>
    ),
  },
  {
    heading: 'Processing details',
    body: (
      <Bullets
        items={[
          'Subject matter: delivery of the offerwall and rewarded-advertising services.',
          'Duration: for the term of your account, plus legally required retention.',
          'Nature and purpose: attributing, validating, and reporting conversions, and preventing fraud.',
          'Data subjects: your end users who interact with offers.',
          'Data types: pseudonymous user identifiers, device/IP data, and conversion events.',
        ]}
      />
    ),
  },
  {
    heading: 'Our obligations as processor',
    body: (
      <Bullets
        items={[
          'Process personal data only on your documented instructions, including for transfers, unless required by law.',
          'Ensure persons authorized to process data are bound by confidentiality.',
          'Implement appropriate technical and organizational security measures (see “Security measures”).',
          'Assist you, taking into account the nature of processing, with data-subject requests.',
          'Assist you with security, breach notification, and data-protection impact assessments.',
          'Make available information necessary to demonstrate compliance and submit to audits (see “Audits”).',
        ]}
      />
    ),
  },
  {
    heading: 'Your obligations as controller',
    body: (
      <P>
        You are responsible for the lawfulness of the personal data and instructions you provide, for having a
        valid legal basis and any required end-user consents, and for issuing instructions that comply with
        applicable laws.
      </P>
    ),
  },
  {
    heading: 'Sub-processors',
    body: (
      <P>
        You provide general authorization for AsyncAds to engage sub-processors (for example, cloud hosting and
        payment providers) under written terms that impose data-protection obligations equivalent to those in
        this DPA. We will maintain a list of sub-processors, give notice of intended changes, and allow you to
        object on reasonable data-protection grounds. We remain responsible for our sub-processors’ performance.
      </P>
    ),
  },
  {
    heading: 'International transfers',
    body: (
      <P>
        Where personal data is transferred to a country without an adequacy decision, we rely on an approved
        transfer mechanism, such as the Standard Contractual Clauses, together with supplementary measures where
        needed. The Standard Contractual Clauses prevail in the event of any conflict with this DPA.
      </P>
    ),
  },
  {
    heading: 'Security measures',
    body: (
      <Bullets
        items={[
          'Encryption of personal data in transit and, where appropriate, at rest.',
          'Access controls, scoped credentials, and the principle of least privilege.',
          'Network and application protections, including secrets stored only as hashes.',
          'Logging, monitoring, and regular review of the effectiveness of these measures.',
        ]}
      />
    ),
  },
  {
    heading: 'Personal data breaches',
    body: (
      <P>
        We will notify you without undue delay after becoming aware of a personal data breach affecting personal
        data we process on your behalf, and provide the information reasonably available to help you meet your
        own notification obligations.
      </P>
    ),
  },
  {
    heading: 'Data-subject requests',
    body: (
      <P>
        If we receive a request from a data subject relating to data we process for you, we will, where legally
        permitted, refer them to you and assist you in responding, taking into account the nature of the
        processing.
      </P>
    ),
  },
  {
    heading: 'Audits',
    body: (
      <P>
        On reasonable prior notice and no more than once per year (unless required by a supervisory authority),
        we will make available information necessary to demonstrate compliance with this DPA and allow for audits
        conducted by you or an independent auditor bound by confidentiality, subject to reasonable security and
        scheduling requirements.
      </P>
    ),
  },
  {
    heading: 'Return and deletion',
    body: (
      <P>
        On termination of the services, we will delete or return personal data processed on your behalf at your
        choice, and delete existing copies, except where retention is required by law.
      </P>
    ),
  },
  {
    heading: 'Liability and conflicts',
    body: (
      <P>
        Liability under this DPA is subject to the limitations and exclusions in the Terms of Service. In the
        event of a conflict between this DPA and the Terms regarding the processing of personal data, this DPA
        prevails; the Standard Contractual Clauses prevail over both.
      </P>
    ),
  },
]

export default function Dpa() {
  return (
    <LegalDoc
      title="Data Processing Agreement"
      updated={UPDATED}
      intro="This DPA describes how AsyncAds processes personal data on behalf of publishers in compliance with applicable data-protection laws."
      sections={SECTIONS}
    />
  )
}
