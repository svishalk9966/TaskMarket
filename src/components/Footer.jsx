import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Clock3, Headset } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="border-t border-base-300/40 bg-base-200/60">

      {/* ── Support strip ── */}
      <div className="border-b border-base-300/40 bg-base-100/70">
        <div className="mx-auto flex max-w-[1200px] flex-col items-center justify-between gap-6 px-6 py-6 sm:flex-row sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Headset size={17} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/50">Need help?</p>
              <p className="text-sm font-semibold text-base-content">TaskMarket Customer Support</p>
            </div>
          </div>

          <div className="h-px w-full bg-base-300/50 sm:h-8 sm:w-px" />

          <div className="flex items-center gap-2 text-sm text-base-content/60">
            <Mail size={15} className="shrink-0 text-primary" />
            <a href="mailto:supporttaskmarket@gmail.com" className="font-medium text-primary transition hover:text-primary/70">
              supporttaskmarket@gmail.com
            </a>
          </div>

          <div className="h-px w-full bg-base-300/50 sm:h-8 sm:w-px" />

          <div className="flex items-center gap-2 text-sm text-base-content/60">
            <Clock3 size={15} className="shrink-0" />
            <span>Mon–Sat, 10:00 AM – 6:00 PM</span>
          </div>
        </div>
      </div>

      {/* ── Main footer body ── */}
      <div className="mx-auto max-w-[1200px] px-6 py-12 sm:px-8 lg:px-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4 lg:gap-12">

          {/* Brand column */}
          <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
            <p className="text-base font-bold tracking-tight text-base-content">TaskMarket</p>
            <p className="text-sm leading-6 text-base-content/55">
              A platform for posting tasks, finding freelancers, and managing work from brief to delivery.
            </p>
            <p className="mt-2 text-xs text-base-content/40">© 2026 TaskMarket. All rights reserved.</p>
          </div>

          {/* Company */}
          <div>
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-base-content/40">Company</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'About Us', href: '/about-us' },
                { label: 'Contacts', href: '/contacts' },
                { label: 'FAQ', href: '/faq' },
                { label: 'Blog', href: '/blog' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="group flex items-center gap-2 text-sm text-base-content/65 transition-colors hover:text-primary">
                    <span className="h-px w-3 shrink-0 rounded bg-base-300 transition-all duration-200 group-hover:w-5 group-hover:bg-primary" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Center */}
          <div>
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-base-content/40">Legal Center</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Privacy Policy', href: '/privacy-policy' },
                { label: 'Cookie Policy', href: '/cookie-policy' },
                { label: 'Disclaimer', href: '/disclaimer' },
                { label: 'Refund Policy', href: '/refund-policy' },
                { label: 'Terms & Conditions', href: '/terms-and-conditions' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="group flex items-center gap-2 text-sm text-base-content/65 transition-colors hover:text-primary">
                    <span className="h-px w-3 shrink-0 rounded bg-base-300 transition-all duration-200 group-hover:w-5 group-hover:bg-primary" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* For Users */}
          <div>
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-base-content/40">For Users</h3>
            <ul className="space-y-2.5">
              {[
                { label: 'Sign Up', href: '/signup' },
                { label: 'How It Works', href: '/how-it-works' },
                { label: 'Feature Listing', href: '/feature-listing' },
                { label: 'Employer Registration', href: '/employer-registration' },
              ].map((link) => (
                <li key={link.label}>
                  <Link to={link.href} className="group flex items-center gap-2 text-sm text-base-content/65 transition-colors hover:text-primary">
                    <span className="h-px w-3 shrink-0 rounded bg-base-300 transition-all duration-200 group-hover:w-5 group-hover:bg-primary" />
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
