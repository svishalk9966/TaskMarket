import React from 'react';
import { Headset, Mail, Clock3, ArrowRight } from 'lucide-react';

const supportMeta = [
  {
    icon: Headset,
    label: 'Support Team',
    value: 'TaskMarket Customer Support',
  },
  {
    icon: Mail,
    label: 'Email',
    value: 'supporttaskmarket@gmail.com',
    href: 'mailto:supporttaskmarket@gmail.com',
  },
  {
    icon: Clock3,
    label: 'Available',
    value: 'Mon–Sat, 10:00 AM – 6:00 PM',
  },
];

const SupportCard = () => {
  return (
    <div className="overflow-hidden rounded-2xl border border-base-300/70 bg-base-100/60 shadow-sm">

      {/* Header */}
      <div className="border-b border-base-300/50 bg-primary/[0.06] px-5 py-4">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
          <Headset size={11} />
          Need help?
        </span>
        <h3 className="mt-3 text-base font-bold leading-snug text-base-content">
          We are here to support your workflow
        </h3>
        <p className="mt-1.5 text-xs leading-5 text-base-content/60">
          Reach out for account, payment, workspace, or dispute guidance.
        </p>
      </div>

      {/* Contact rows */}
      <div className="divide-y divide-base-300/40">
        {supportMeta.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.label} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary">
                <Icon size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-base-content/45">
                  {item.label}
                </p>
                {item.href ? (
                  <a
                    href={item.href}
                    className="mt-0.5 block break-all text-sm font-semibold text-primary transition-colors hover:text-primary/75"
                  >
                    {item.value}
                  </a>
                ) : (
                  <p className="mt-0.5 text-sm font-semibold text-base-content/80">{item.value}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="border-t border-base-300/50 px-5 py-3.5">
        <a
          href="mailto:supporttaskmarket@gmail.com"
          className="flex items-center justify-between text-sm font-semibold text-primary transition-colors hover:text-primary/75"
        >
          <span>Send a support message</span>
          <ArrowRight size={15} />
        </a>
      </div>
    </div>
  );
};

export default SupportCard;
