import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Clock3,
  Cookie,
  CreditCard,
  FileText,
  Gavel,
  Globe,
  Headset,
  HelpCircle,
  LayoutGrid,
  Lock,
  Mail,
  MessageSquare,
  Rocket,
  Scale,
  Search,
  ShieldCheck,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import InfoPageLayout from '../../components/info/InfoPageLayout';
import SupportCard from '../../components/info/SupportCard';
import ContactSupportForm from '../../components/support/ContactSupportForm';

const supportDetails = {
  team: 'TaskMarket Customer Support',
  email: 'supporttaskmarket@gmail.com',
  availability: 'Mon–Sat, 10:00 AM – 6:00 PM',
};

const quickLinks = [
  { label: 'About Us', to: '/about-us' },
  { label: 'Contact', to: '/contacts' },
  { label: 'FAQ', to: '/faq' },
  { label: 'Blog', to: '/blog' },
  { label: 'How It Works', to: '/how-it-works' },
  { label: 'Feature Listing', to: '/feature-listing' },
  { label: 'Employer Registration', to: '/employer-registration' },
];

const Hero = ({ eyebrow, title, description, actions = [] }) => (
  <section className="container mx-auto px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
    <div className="mx-auto max-w-6xl rounded-[12px] border border-base-300 bg-base-200/45 p-6 shadow-sm sm:p-8 lg:p-10">
      <div className="max-w-3xl space-y-4">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary/80">{eyebrow}</p>
        <h1 className="text-3xl font-bold tracking-tight text-base-content sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="text-base leading-7 text-base-content/75 sm:text-lg">{description}</p>
      </div>
      {actions.length ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {actions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className={action.primary ? 'btn btn-primary rounded-2xl' : 'btn btn-ghost rounded-2xl'}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  </section>
);

const StatStrip = ({ items }) => (
  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
    {items.map((item) => {
      const Icon = item.icon;
      return (
        <div key={item.label} className="rounded-3xl border border-base-300 bg-base-100/70 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon size={20} />
            </span>
            <div>
              <p className="text-sm text-base-content/65">{item.label}</p>
              <p className="text-base font-semibold text-base-content">{item.value}</p>
            </div>
          </div>
        </div>
      );
    })}
  </div>
);

const CardGrid = ({ title, intro, items, columns = 'lg:grid-cols-3' }) => (
  <section className="container mx-auto px-4 pb-10 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-base-content sm:text-3xl">{title}</h2>
        {intro ? <p className="mt-3 text-base leading-7 text-base-content/75">{intro}</p> : null}
      </div>
      <div className={`mt-6 grid gap-5 ${columns}`}>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-3xl border border-base-300 bg-base-200/35 p-6 shadow-sm">
              {Icon ? (
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-base-100 text-primary ring-1 ring-base-300/70">
                  <Icon size={22} />
                </span>
              ) : null}
              <h3 className="mt-4 text-xl font-semibold text-base-content">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-base-content/75">{item.description}</p>
              {item.points?.length ? (
                <ul className="mt-4 space-y-3 text-sm leading-6 text-base-content/75">
                  {item.points.map((point) => (
                    <li key={point} className="flex gap-3">
                      <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary/80" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  </section>
);

const Timeline = ({ title, intro, steps }) => (
  <section className="container mx-auto px-4 pb-10 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-base-content sm:text-3xl">{title}</h2>
        <p className="mt-3 text-base leading-7 text-base-content/75">{intro}</p>
      </div>
      <div className="mt-8 space-y-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="grid gap-4 rounded-3xl border border-base-300 bg-base-200/35 p-5 shadow-sm md:grid-cols-[88px_minmax(0,1fr)] md:items-start md:p-6">
              <div className="flex items-center gap-3 md:flex-col md:items-start">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon size={22} />
                </span>
                <span className="inline-flex rounded-full bg-base-100 px-3 py-1 text-sm font-semibold text-base-content/75 ring-1 ring-base-300/70">
                  Step {index + 1}
                </span>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-base-content">{step.title}</h3>
                <p className="mt-3 text-sm leading-6 text-base-content/75">{step.description}</p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  </section>
);

const PolicySidebar = () => (
  <div className="space-y-4">
    <SupportCard />
    <div className="overflow-hidden rounded-2xl border border-base-300/70 bg-base-100/60 shadow-sm">
      <div className="border-b border-base-300/50 bg-base-200/40 px-5 py-4">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.18em] text-base-content/50">Related Pages</h4>
      </div>
      <div className="p-2">
        {quickLinks.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-base-content/70 transition-colors hover:bg-primary/8 hover:text-primary"
          >
            <span>{link.label}</span>
            <ArrowRight size={13} className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  </div>
);

const FaqList = ({ items }) => (
  <section className="container mx-auto px-4 pb-10 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl">
      <div className="grid gap-4">
        {items.map((item) => (
          <article key={item.question} className="rounded-3xl border border-base-300 bg-base-200/35 p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-base-100 text-primary ring-1 ring-base-300/70">
                <HelpCircle size={20} />
              </span>
              <div>
                <h2 className="text-lg font-semibold text-base-content sm:text-xl">{item.question}</h2>
                <p className="mt-3 text-sm leading-7 text-base-content/75 sm:text-base">{item.answer}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

const ContactPanel = () => (
  <section className="container mx-auto px-4 pb-10 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
      <div className="rounded-[12px] border border-base-300 bg-base-200/35 p-6 shadow-sm sm:p-8">
        <h2 className="text-2xl font-semibold text-base-content">How to reach the right support path</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              title: 'Account support',
              description: 'Login help, profile access, and general account clarification.',
            },
            {
              title: 'Task support',
              description: 'Questions about posting, bidding, hiring, task updates, and delivery flow.',
            },
            {
              title: 'Payment support',
              description: 'Clarification for charges, payout questions, platform fee concerns, and transaction review.',
            },
            {
              title: 'Dispute guidance',
              description: 'Support for misunderstandings around delivery scope, approval state, or platform records.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-3xl bg-base-100/80 p-5 ring-1 ring-base-300/70">
              <h3 className="text-lg font-semibold text-base-content">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-base-content/75">{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {[
          { icon: Headset, label: 'Support Team', value: supportDetails.team },
          { icon: Mail, label: 'Support Email', value: supportDetails.email, href: `mailto:${supportDetails.email}` },
          { icon: Clock3, label: 'Availability', value: supportDetails.availability },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="rounded-3xl border border-base-300 bg-base-100/75 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.12em] text-base-content/60">{item.label}</p>
                  {item.href ? (
                    <a href={item.href} className="mt-2 block break-all text-base font-medium text-primary hover:text-primary/80">
                      {item.value}
                    </a>
                  ) : (
                    <p className="mt-2 text-base font-medium text-base-content">{item.value}</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div className="rounded-3xl border border-base-300 bg-base-200/35 p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-base-content">Contact guidance</h3>
          <p className="mt-3 text-sm leading-6 text-base-content/75">
            Include your task reference, account email, and a short summary of the issue so the support team can review the request faster.
          </p>
        </div>
      </div>
    </div>
  </section>
);

const BlogGrid = () => {
  const posts = [
    {
      title: 'How to write a task brief that gets better bids',
      category: 'Hiring Guide',
      excerpt:
        'A strong task brief reduces confusion, improves bid quality, and helps clients compare freelancers on real scope instead of guesswork.',
    },
    {
      title: 'Ways freelancers can make their public profile more trusted',
      category: 'Freelancer Growth',
      excerpt:
        'Clear skills, honest timelines, and visible delivery quality can help freelancers look more reliable when clients review candidates.',
    },
    {
      title: 'What clients should check before selecting a bidder',
      category: 'Marketplace Tips',
      excerpt:
        'Before hiring, review proposal clarity, timeline realism, communication quality, and whether the bidder actually understands the task.',
    },
    {
      title: 'Keeping project communication clean inside a task workflow',
      category: 'Collaboration',
      excerpt:
        'When updates, revisions, and approvals stay structured, the task moves faster and both sides avoid unnecessary disputes.',
    },
  ];

  return (
    <section className="container mx-auto px-4 pb-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <h2 className="text-2xl font-semibold text-base-content sm:text-3xl">Sample editorial content</h2>
            <p className="mt-3 text-base leading-7 text-base-content/75">
              This is a static blog showcase page for TaskMarket. It presents sample article cards only and does not require any backend blog system.
            </p>
          </div>
          <span className="inline-flex w-fit rounded-full bg-base-200 px-4 py-2 text-sm text-base-content/70 ring-1 ring-base-300/70">
            Static content preview
          </span>
        </div>
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          {posts.map((post) => (
            <article key={post.title} className="rounded-[12px] border border-base-300 bg-base-200/35 p-6 shadow-sm">
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {post.category}
              </span>
              <h3 className="mt-4 text-xl font-semibold text-base-content">{post.title}</h3>
              <p className="mt-3 text-sm leading-6 text-base-content/75">{post.excerpt}</p>
              <div className="mt-5 flex items-center justify-between text-sm text-base-content/60">
                <span>TaskMarket Insights</span>
                <span className="inline-flex items-center gap-2 text-primary">
                  Read preview <ArrowRight size={16} />
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const SignupPrompt = ({ title, description, cta = 'Go to Sign Up' }) => (
  <section className="container mx-auto px-4 pb-14 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl rounded-[12px] border border-base-300 bg-base-200/45 p-6 shadow-sm sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold text-base-content">{title}</h2>
        <p className="mt-3 text-base leading-7 text-base-content/75">{description}</p>
      </div>
      <div className="mt-6 lg:mt-0">
        <Link to="/role-select" className="btn btn-primary rounded-2xl">
          {cta}
        </Link>
      </div>
    </div>
  </section>
);

const policyPages = {
  'privacy-policy': {
    eyebrow: 'Legal Center',
    title: 'Privacy Policy',
    description:
      'This policy explains how TaskMarket may collect, use, store, and protect information connected to account use, task activity, platform operations, and support communication.',
    sections: [
      {
        heading: 'Information we collect',
        body:
          'TaskMarket may collect account details, profile information, task details, communication records, payment-related references, and support messages that are necessary to operate the platform safely and reliably.',
      },
      {
        heading: 'How information is used',
        items: [
          'To create and manage user accounts and profiles.',
          'To support task posting, bidding, hiring, workspace flow, and delivery tracking.',
          'To maintain security, investigate abuse, and support dispute review when needed.',
          'To respond to help requests sent to the support team.',
        ],
      },
      {
        heading: 'Storage and protection',
        body:
          'Platform information may be stored for operational, security, legal, and support reasons. TaskMarket takes reasonable measures to protect platform records, but users should also protect their own credentials and account access.',
      },
      {
        heading: 'Account and profile responsibility',
        body:
          'Users should keep submitted information accurate and avoid sharing misleading identity, service, or payment details. Inaccurate or risky account use may lead to review or platform action.',
      },
      {
        heading: 'Contact point',
        body: `For privacy-related questions, users can contact ${supportDetails.team} at ${supportDetails.email} during ${supportDetails.availability}.`,
      },
    ],
  },
  'cookie-policy': {
    eyebrow: 'Legal Center',
    title: 'Cookie Policy',
    description:
      'This page explains how TaskMarket may use cookies and similar storage technologies to keep the product usable, secure, and easier to navigate.',
    sections: [
      {
        heading: 'Essential cookies',
        body:
          'Essential cookies help support sign-in state, security checks, and core product behavior needed for the marketplace to function properly.',
      },
      {
        heading: 'Preference cookies',
        body:
          'Preference cookies may remember choices such as theme or interface-related preferences so the user experience feels more consistent between visits.',
      },
      {
        heading: 'Analytics and improvement',
        body:
          'Analytics-related cookies may help TaskMarket understand general usage patterns, page performance, and product areas that need improvement. These insights help improve usability and reliability.',
      },
      {
        heading: 'Managing cookies',
        body:
          'Users can manage browser cookie settings directly from their browser controls. Blocking some cookies may affect convenience, saved preferences, or certain platform behavior.',
      },
    ],
  },
  disclaimer: {
    eyebrow: 'Legal Center',
    title: 'Disclaimer',
    description:
      'This disclaimer clarifies the limits of the platform and explains how TaskMarket should be understood as a marketplace environment rather than a guarantee of business outcome.',
    sections: [
      {
        heading: 'Platform role',
        body:
          'TaskMarket provides a digital environment for posting tasks, submitting bids, managing workflow, and supporting communication. The platform does not guarantee that every project will lead to a specific financial, business, or delivery outcome.',
      },
      {
        heading: 'Information and user judgment',
        body:
          'Users should evaluate task requirements, freelancer capability, timelines, and communication carefully before making hiring or work decisions. Marketplace information should be reviewed with practical judgment.',
      },
      {
        heading: 'Service limitations',
        body:
          'TaskMarket may update, pause, or refine platform features, informational pages, and support procedures without guaranteeing uninterrupted availability in every scenario.',
      },
    ],
  },
  'refund-policy': {
    eyebrow: 'Legal Center',
    title: 'Refund Policy',
    description:
      'This informational refund policy outlines how TaskMarket may review refund-related requests while keeping payment handling realistic for a task-based marketplace.',
    sections: [
      {
        heading: 'When a refund review may happen',
        items: [
          'Duplicate charges or unexpected transaction issues reported with enough context.',
          'Marketplace disputes where task status, delivery state, and payment records need review.',
          'Cases where a payment error is clearly linked to platform processing records.',
        ],
      },
      {
        heading: 'How review works',
        body:
          'Refund requests are reviewed using the task record, transaction data, communication history, and platform status at the time of the issue. Review does not guarantee approval, but it helps determine whether any correction is appropriate.',
      },
      {
        heading: 'Important limitation',
        body:
          'Refund handling depends on the actual state of the task, the payment outcome, and the applicable records available to the support team. Users should provide accurate details when requesting review.',
      },
    ],
  },
  'terms-and-conditions': {
    eyebrow: 'Legal Center',
    title: 'Terms and Conditions',
    description:
      'These terms describe the expected rules of use for TaskMarket, including account responsibility, payments, conduct, disputes, and platform limitations.',
    sections: [
      {
        heading: 'Account responsibilities',
        items: [
          'Users must provide accurate information and keep login credentials secure.',
          'Accounts should not be used for misleading identity, abuse, or harmful activity.',
          'Users are responsible for activity performed through their own account access.',
        ],
      },
      {
        heading: 'Marketplace use',
        items: [
          'Clients should post clear tasks with realistic scope, budget, and delivery expectations.',
          'Freelancers should submit fair bids and communicate honestly about capability and timeline.',
          'Both sides should use the available workflow, delivery, and communication structures responsibly.',
        ],
      },
      {
        heading: 'Payments and disputes',
        body:
          'Payments, payout visibility, and dispute review operate according to the platform workflow and available records. TaskMarket may review issues using task history, transaction context, and communication evidence.',
      },
      {
        heading: 'Conduct and limitations',
        body:
          'Users may be restricted from the platform for abuse, fraud, repeated misconduct, or attempts to damage trust and safety. TaskMarket also reserves the right to improve, update, or limit product behavior where operationally necessary.',
      },
    ],
  },
};

const policyStyleIcons = {
  'privacy-policy': [ShieldCheck, Lock, FileText, Users],
  'cookie-policy': [Cookie, LayoutGrid, Search, ShieldCheck],
  disclaimer: [Scale, Globe, FileText],
  'refund-policy': [Wallet, CreditCard, Headset],
  'terms-and-conditions': [Gavel, BadgeCheck, Wallet, ShieldCheck],
};

const PolicyPage = ({ slug }) => {
  const config = policyPages[slug];
  const icons = policyStyleIcons[slug] || [];
  const sections = config.sections.map((section, index) => ({
    ...section,
    heading: `${section.heading}`,
    icon: icons[index],
  }));

  return (
    <InfoPageLayout
      eyebrow={config.eyebrow}
      title={config.title}
      description={config.description}
      sections={sections.map(({ icon, ...section }) => ({ ...section, heading: section.heading }))}
      sidebar={<PolicySidebar />}
    />
  );
};

const InfoPage = ({ slug }) => {
  if (policyPages[slug]) {
    return <PolicyPage slug={slug} />;
  }

  switch (slug) {
    case 'about-us':
      return (
        <div className="bg-base-100">
          <Hero
            eyebrow="Company"
            title="About TaskMarket"
            description="TaskMarket is built to make task-based hiring simpler, clearer, and more practical for both employers and freelancers. The platform focuses on helping people move from task idea to completed delivery with less friction and more visibility."
            actions={[
              { label: 'Explore Tasks', to: '/browse', primary: true },
              { label: 'Create Account', to: '/signup' },
            ]}
          />
          <section className="container mx-auto px-4 pb-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-6xl">
              <StatStrip
                items={[
                  { icon: Briefcase, label: 'Purpose', value: 'Task-based work marketplace' },
                  { icon: Users, label: 'For', value: 'Freelancers and employers' },
                  { icon: ShieldCheck, label: 'Focus', value: 'Trust, clarity, and workflow' },
                  { icon: Rocket, label: 'Goal', value: 'Faster project execution' },
                ]}
              />
            </div>
          </section>
          <CardGrid
            title="What TaskMarket stands for"
            intro="TaskMarket is designed around practical marketplace experience. The product aims to reduce confusion in hiring, improve bid comparison, and keep work progress easier to follow after a task is assigned."
            items={[
              {
                icon: Rocket,
                title: 'Mission',
                description:
                  'To help users convert work opportunities into organized, trackable, and professional outcomes without making the process feel heavy or confusing.',
              },
              {
                icon: ShieldCheck,
                title: 'Trust-first thinking',
                description:
                  'The platform supports visible profiles, clear task details, and structured workflows so both sides can make better decisions with more confidence.',
              },
              {
                icon: Globe,
                title: 'Practical marketplace value',
                description:
                  'TaskMarket supports short and focused work engagements where clarity, speed, and communication quality matter from the beginning.',
              },
            ]}
          />
          <Timeline
            title="How the platform helps users"
            intro="Every major step is meant to be easier to understand and manage inside one product flow."
            steps={[
              {
                icon: FileText,
                title: 'Clients post structured tasks',
                description: 'Budgets, requirements, and delivery expectations can be presented in a cleaner way for better freelancer review.',
              },
              {
                icon: Search,
                title: 'Freelancers evaluate and bid',
                description: 'Relevant opportunities can be reviewed, and freelancers can send proposals with pricing and timeline clarity.',
              },
              {
                icon: MessageSquare,
                title: 'Teams collaborate in workflow',
                description: 'After hiring, the platform supports ongoing task progress, delivery flow, and structured communication.',
              },
              {
                icon: CheckCircle2,
                title: 'Work moves toward completion',
                description: 'Task updates, visibility, and platform structure help both sides stay aligned until the task is completed.',
              },
            ]}
          />
        </div>
      );

    case 'contacts':
      return (
        <div className="bg-base-100">
          <Hero
            eyebrow="Company"
            title="Contact TaskMarket Support"
            description="Use this page when you need help with your account, task workflow, payments, or platform guidance. The support path is kept simple so users know where to start and what details to include."
          />
          <ContactPanel />
          <SignupPrompt
            title="Need platform access before contacting support?"
            description="If you are new to TaskMarket, creating an account first can make future task, payment, and profile support easier to handle."
          />
          <ContactSupportForm />
        </div>
      );

    case 'faq':
      return (
        <div className="bg-base-100">
          <Hero
            eyebrow="Company"
            title="Frequently Asked Questions"
            description="These questions cover common TaskMarket topics for employers and freelancers, including tasks, bids, hiring, delivery, and account use."
          />
          <FaqList
            items={[
              {
                question: 'What is TaskMarket used for?',
                answer:
                  'TaskMarket is a freelance marketplace where users can post tasks, receive bids, hire freelancers, and manage work progress through a structured platform workflow.',
              },
              {
                question: 'Can freelancers browse tasks before getting hired?',
                answer:
                  'Yes. Freelancers can review available tasks, evaluate scope and budget, and then decide whether to place a bid based on capability and interest.',
              },
              {
                question: 'How does a client choose a freelancer?',
                answer:
                  'Clients can compare bids, review proposal quality, check public profile visibility, and then select the freelancer that best matches the task requirements.',
              },
              {
                question: 'Does TaskMarket handle communication after a freelancer is selected?',
                answer:
                  'The platform supports workflow and structured collaboration after hiring so both sides can keep progress and delivery more organized.',
              },
              {
                question: 'Where should I go for payment-related questions?',
                answer:
                  `Payment-related clarification should be sent to ${supportDetails.email} with enough context such as task reference and transaction details for review.`,
              },
              {
                question: 'Is there a blog or help content area?',
                answer:
                  'Yes. TaskMarket can present informational content through FAQ, blog-style content, support pages, and policy pages to help users understand the platform better.',
              },
            ]}
          />
        </div>
      );

    case 'blog':
      return (
        <div className="bg-base-100">
          <Hero
            eyebrow="Company"
            title="TaskMarket Blog"
            description="This page is a clean static placeholder for future platform articles, guides, and marketplace education content."
          />
          <BlogGrid />
        </div>
      );

    case 'how-it-works':
      return (
        <div className="bg-base-100">
          <Hero
            eyebrow="For Freelancers"
            title="How TaskMarket Works"
            description="TaskMarket uses a simple workflow so users can move from task creation to delivery without losing visibility."
            actions={[{ label: 'Start with Sign Up', to: '/signup', primary: true }]}
          />
          <Timeline
            title="Step-by-step workflow"
            intro="The platform keeps hiring and execution structured around a practical marketplace flow."
            steps={[
              { icon: UserPlus, title: 'Create your account', description: 'Users begin with the existing sign up flow and set up their basic platform identity.' },
              { icon: FileText, title: 'Post or browse tasks', description: 'Employers can post tasks while freelancers can explore active opportunities that match their interests.' },
              { icon: MessageSquare, title: 'Submit and review bids', description: 'Freelancers place bids, and employers compare candidates based on pricing, clarity, and fit.' },
              { icon: Users, title: 'Hire the right freelancer', description: 'Once the best option is selected, the task moves into the active work stage.' },
              { icon: Briefcase, title: 'Track work and delivery', description: 'The platform helps users follow updates, manage work progress, and keep delivery expectations organized.' },
              { icon: Wallet, title: 'Complete the task cycle', description: 'At the end of the task, payment and delivery records remain easier to review through the platform flow.' },
            ]}
          />
        </div>
      );

    case 'feature-listing':
      return (
        <div className="bg-base-100">
          <Hero
            eyebrow="For Freelancers"
            title="Feature Listing"
            description="TaskMarket includes core marketplace tools for task discovery, project execution, communication, visibility, and payment flow support."
          />
          <CardGrid
            title="Core platform features"
            intro="Each feature area supports a different stage of the marketplace journey."
            items={[
              { icon: FileText, title: 'Task posting', description: 'Clients can create tasks with structured requirements, budget context, and expected delivery details.' },
              { icon: MessageSquare, title: 'Bid management', description: 'Freelancers can place bids and clients can compare proposals with more clarity.' },
              { icon: Briefcase, title: 'Workspace support', description: 'After hiring, active task work can be managed through the platform workflow and delivery structure.' },
              { icon: Wallet, title: 'Payment visibility', description: 'The payment flow keeps task-linked transactions easier to understand in the marketplace context.' },
              { icon: Users, title: 'Public profile visibility', description: 'Users can evaluate profile information to make better hiring and collaboration decisions.' },
              { icon: Building2, title: 'Platform operations', description: 'Administrative oversight supports trust, review handling, and general marketplace monitoring where needed.' },
            ]}
            columns="md:grid-cols-2 xl:grid-cols-3"
          />
        </div>
      );

    case 'employer-registration':
      return (
        <div className="bg-base-100">
          <Hero
            eyebrow="For Employers"
            title="Employer Registration"
            description="Employers can use the existing TaskMarket sign up flow to create an account and begin posting tasks. No separate authentication system is required for employer onboarding."
            actions={[{ label: 'Use Existing Sign Up', to: '/signup', primary: true }]}
          />
          <CardGrid
            title="Employer onboarding guide"
            intro="This page explains the employer side of onboarding without changing any authentication behavior."
            items={[
              {
                icon: UserPlus,
                title: 'Register through sign up',
                description: 'Use the current TaskMarket sign up page to create your employer account with the existing platform flow.',
              },
              {
                icon: FileText,
                title: 'Prepare your task details',
                description: 'Before posting, keep your budget, scope, timeline, and expected deliverables clear for better freelancer responses.',
              },
              {
                icon: Users,
                title: 'Review and hire',
                description: 'After your task receives bids, compare quality, pricing, and communication before selecting a freelancer.',
              },
            ]}
            columns="md:grid-cols-3"
          />
          <SignupPrompt
            title="Ready to start as an employer?"
            description="Continue with the current sign up experience, then move into task posting and freelancer review from your account dashboard."
            cta="Register on TaskMarket"
          />
        </div>
      );

    default:
      return (
        <div className="bg-base-100">
          <Hero
            eyebrow="TaskMarket"
            title="Information Page"
            description="This page could not be matched correctly. Use the footer to open one of the dedicated informational pages."
          />
        </div>
      );
  }
};

export default InfoPage;
