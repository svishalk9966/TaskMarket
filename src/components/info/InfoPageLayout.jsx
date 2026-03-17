import React from 'react';

const InfoPageLayout = ({ eyebrow, title, description, sections = [], sidebar = null }) => {
  return (
    <div className="bg-base-100">
      <section className="container mx-auto px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="mx-auto max-w-4xl">

          {/* Page header */}
          <div className="rounded-3xl border border-base-300 bg-base-200/40 p-6 shadow-sm sm:p-8 lg:p-10">
            <div className="max-w-3xl space-y-3">
              {eyebrow ? (
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary/70">{eyebrow}</p>
              ) : null}
              <h1 className="text-3xl font-bold tracking-tight text-base-content sm:text-4xl">{title}</h1>
              {description ? (
                <p className="text-base leading-7 text-base-content/65 sm:text-lg">{description}</p>
              ) : null}
            </div>
          </div>

          {/* Content sections — full width, no sidebar */}
          <div className="mt-6 space-y-4">
            {sections.map((section) => (
              <article
                key={section.heading}
                className="rounded-2xl border border-base-300/70 bg-base-100 p-6 shadow-sm sm:p-8"
              >
                <h2 className="text-xl font-semibold text-base-content sm:text-2xl">{section.heading}</h2>
                {section.body ? (
                  <p className="mt-3 text-base leading-7 text-base-content/70">{section.body}</p>
                ) : null}
                {section.items?.length ? (
                  <ul className="mt-4 space-y-3 text-base leading-7 text-base-content/70">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-3">
                        <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </div>

        </div>
      </section>
    </div>
  );
};

export default InfoPageLayout;
