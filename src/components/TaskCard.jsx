import React from 'react';
import { formatCurrency } from '../config';
import PublicUserIdentity from './PublicUserIdentity';

const statusTone = {
  open: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  'in-progress': 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  in_progress: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  submitted: 'border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300',
  revision_requested: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-300',
  completed: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300',
  closed: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300',
  disputed: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300',
};

const formatPostedAt = (value) => {
  if (!value) return 'Recently posted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently posted';

  const diffMs = Date.now() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 24) return diffHours <= 1 ? '1 hour ago' : `${diffHours} hours ago`;
  if (diffDays < 30) return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
  return date.toLocaleDateString();
};

const createPreview = (description = '') => {
  const normalized = String(description || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return 'No preview available yet.';
  if (normalized.length <= 110) return normalized;
  return `${normalized.slice(0, 107).trimEnd()}…`;
};

const TaskCard = ({ task, onClick, selected = false }) => {
  const createdAt = task.createdAtMs || 0;
  const bidsCount = task.bids?.length || 0;
  const isNew = createdAt > 0 && Date.now() - createdAt < 1000 * 60 * 60 * 48;
  const lowCompetition = bidsCount > 0 && bidsCount <= 2;
  const isUrgent = task.deadline ? (new Date(task.deadline).getTime() - Date.now()) <= 1000 * 60 * 60 * 24 * 3 : false;
  const postedLabel = formatPostedAt(createdAt);
  const statusLabel = (task.status || 'open').replace(/[-_]/g, ' ');
  const previewText = createPreview(task.description);

  return (
    <article
      className={[
        'group cursor-pointer rounded-[9px] border bg-base-100/95 p-5 transition-all duration-200 sm:p-6',
        'hover:-translate-y-0.5 hover:border-primary/35 hover:bg-base-100 hover:shadow-[0_22px_52px_rgba(15,23,42,0.12)]',
        selected
          ? 'border-primary/40 bg-primary/[0.04] shadow-[0_24px_56px_rgba(59,130,246,0.15)] ring-1 ring-primary/15'
          : 'border-base-300/70 shadow-[0_14px_36px_rgba(15,23,42,0.08)]',
      ].join(' ')}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
    >
      <div className="flex flex-wrap items-center gap-2">
        {task.category ? (
          <span className="rounded-full border border-primary/18 bg-primary/[0.08] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
            {task.category}
          </span>
        ) : null}
        <span className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone[task.status] || 'border-base-300 bg-base-200/80 text-base-content/70'}`}>
          {statusLabel}
        </span>
        {isNew ? <span className="rounded-full bg-emerald-500/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600 dark:text-emerald-300">New</span> : null}
        {isUrgent ? <span className="rounded-full bg-rose-500/12 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-rose-600 dark:text-rose-300">Urgent</span> : null}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-xl font-semibold leading-snug text-base-content transition-colors group-hover:text-primary">
            {task.title}
          </h3>
          <p className="mt-3 line-clamp-2 max-w-2xl text-sm leading-6 text-base-content/68">
            {previewText}
          </p>
        </div>

        <div className="rounded-[1.4rem] border border-primary/12 bg-gradient-to-br from-primary/[0.08] to-transparent p-4 xl:min-w-[11rem]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/48">Budget</div>
          <div className="mt-2 text-2xl font-bold text-primary sm:text-[1.7rem]">{formatCurrency(task.budget)}</div>
          <div className="mt-2 text-xs leading-5 text-base-content/58">Competitive range for this task brief.</div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 text-xs text-base-content/65">
        <span className="rounded-full border border-base-300/70 bg-base-200/70 px-3 py-1.5">Posted {postedLabel}</span>
        <span className="rounded-full border border-base-300/70 bg-base-200/70 px-3 py-1.5">{bidsCount} bids</span>
        {task.location ? <span className="rounded-full border border-base-300/70 bg-base-200/70 px-3 py-1.5 break-words">{task.location}</span> : null}
        {lowCompetition ? <span className="rounded-full border border-secondary/16 bg-secondary/10 px-3 py-1.5 font-medium text-secondary">Low competition</span> : null}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {task.skills?.slice(0, 4).map((skill) => (
          <span key={skill} className="rounded-full border border-base-300/80 bg-base-100 px-3 py-1.5 text-xs font-medium text-base-content/75 shadow-sm">
            {skill}
          </span>
        ))}
        {task.skills?.length > 4 ? (
          <span className="rounded-full border border-base-300/80 bg-base-100 px-3 py-1.5 text-xs font-medium text-base-content/75 shadow-sm">+{task.skills.length - 4} more</span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-base-300/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 flex-1 rounded-[1.2rem] bg-base-200/45 px-3 py-2.5">
          <PublicUserIdentity
            userId={task.postedById}
            name={task.postedByName || 'Unknown user'}
            photoURL={task.postedByPhoto || ''}
            subtitle="Client"
            containerClassName="min-w-0 flex-1"
            avatarClassName="h-11 w-11"
            nameClassName="truncate text-sm font-semibold"
            subtitleClassName="mt-0.5 text-xs text-base-content/55"
          />
        </div>
        <div className={[
          'inline-flex min-h-[3rem] items-center justify-center rounded-full px-4 py-2 text-sm font-semibold transition-all',
          selected
            ? 'bg-primary text-white shadow-[0_12px_26px_rgba(59,130,246,0.24)]'
            : 'border border-base-300 bg-base-100 text-base-content/70 group-hover:border-primary/20 group-hover:text-primary',
        ].join(' ')}>
          {selected ? 'Selected' : 'View details'}
        </div>
      </div>
    </article>
  );
};

export default TaskCard;
