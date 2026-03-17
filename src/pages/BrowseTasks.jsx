import React, { useEffect, useMemo, useState } from 'react';
import { arrayUnion, collection, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import TaskCard from '../components/TaskCard';
import TaskDetailModal from '../components/TaskDetailModal';
import TaskDetailPanel from '../components/TaskDetailPanel';
import LoadingSpinner from '../components/LoadingSpinner';
import { DEFAULT_TASK_STATUS, isMarketplaceVisibleTask, normalizeTask, sortTasksNewestFirst, TASKS_COLLECTION_NAME } from '../lib/tasks';
import { createNotification } from '../lib/workflow';

const budgetRanges = [
  { value: 'all', label: 'Any budget' },
  { value: 'under_5000', label: 'Under ₹5,000' },
  { value: '5000_20000', label: '₹5,000 - ₹20,000' },
  { value: 'over_20000', label: 'Above ₹20,000' },
];

const matchesBudgetRange = (budget, filter) => {
  const amount = Number(budget || 0);
  if (filter === 'under_5000') return amount < 5000;
  if (filter === '5000_20000') return amount >= 5000 && amount <= 20000;
  if (filter === 'over_20000') return amount > 20000;
  return true;
};

const BrowseTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [mobileTaskId, setMobileTaskId] = useState(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [budgetFilter, setBudgetFilter] = useState('all');
  const [sortBy, setSortBy] = useState('latest');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, TASKS_COLLECTION_NAME), (snapshot) => {
      const nextTasks = snapshot.docs
        .map((docSnapshot) => normalizeTask({ id: docSnapshot.id, ...docSnapshot.data() }))
        .filter((task) => isMarketplaceVisibleTask(task));

      setTasks(sortTasksNewestFirst(nextTasks));
      setLoading(false);
      setError('');
    }, (snapshotError) => {
      console.error('Failed to load tasks:', snapshotError);
      setError('Unable to load tasks right now. Please try again later.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handlePlaceBid = async (taskId, bidData) => {
    const task = tasks.find((item) => item.id === taskId);

    if (!task) throw new Error('Task could not be found.');
    if (task.postedById === bidData.freelancerId) throw new Error('You cannot place a bid on your own task.');
    if (task.bids?.some((bid) => bid.freelancerId === bidData.freelancerId)) throw new Error('You have already placed a bid on this task.');

    const taskRef = doc(db, TASKS_COLLECTION_NAME, taskId);
    await updateDoc(taskRef, {
      bids: arrayUnion(bidData),
      clientUpdatedAt: Date.now(),
    });

    await createNotification({
      userId: task.postedById,
      taskId,
      type: 'bid',
      title: 'New bid received',
      message: `${bidData.freelancerName || 'A freelancer'} placed a bid on "${task.title}".`,
    });
  };

  const categories = useMemo(() => ([
    'all',
    ...Array.from(new Set(tasks.map((task) => task.category).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
  ]), [tasks]);

  const filteredTasks = useMemo(() => {
    const queryText = search.trim().toLowerCase();

    const nextTasks = tasks.filter((task) => {
      const effectiveStatus = task.status || DEFAULT_TASK_STATUS;
      const matchesStatus = statusFilter === 'all' || effectiveStatus === statusFilter;
      const matchesCategory = categoryFilter === 'all' || (task.category || '').toLowerCase() === categoryFilter.toLowerCase();
      const matchesBudget = matchesBudgetRange(task.budget, budgetFilter);
      const searchableText = task.searchText || `${task.title || ''} ${task.description || ''} ${task.category || ''} ${task.location || ''} ${(task.skills || []).join(' ')} ${task.postedByName || ''}`.toLowerCase();
      const matchesSearch = !queryText || searchableText.includes(queryText);
      return isMarketplaceVisibleTask(task) && matchesStatus && matchesCategory && matchesSearch && matchesBudget;
    });

    return [...nextTasks].sort((left, right) => {
      if (sortBy === 'highest_budget') return Number(right.budget || 0) - Number(left.budget || 0);
      if (sortBy === 'lowest_budget') return Number(left.budget || 0) - Number(right.budget || 0);
      if (sortBy === 'deadline_soon') return new Date(left.deadline || 0).getTime() - new Date(right.deadline || 0).getTime();
      return (right.createdAtMs || 0) - (left.createdAtMs || 0);
    });
  }, [tasks, statusFilter, categoryFilter, budgetFilter, search, sortBy]);

  useEffect(() => {
    if (!filteredTasks.length) {
      setSelectedTaskId(null);
      setMobileTaskId(null);
      return;
    }

    const currentTaskStillVisible = filteredTasks.some((task) => task.id === selectedTaskId);
    if (!currentTaskStillVisible) {
      setSelectedTaskId(filteredTasks[0].id);
    }
  }, [filteredTasks, selectedTaskId]);

  const selectedTask = useMemo(() => {
    if (!filteredTasks.length) return null;
    return filteredTasks.find((task) => task.id === selectedTaskId) || filteredTasks[0];
  }, [filteredTasks, selectedTaskId]);

  const mobileTask = mobileTaskId ? filteredTasks.find((task) => task.id === mobileTaskId) ?? null : null;

  if (loading) return <LoadingSpinner label="Loading open tasks..." />;

  return (
    <div className="relative mx-auto max-w-7xl animate-slide-in px-4 pb-4 pt-6 sm:px-6 sm:pt-8 lg:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.08),transparent_34%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.06),transparent_28%)]"></div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Marketplace browser</p>
          <h2 className="mt-2 text-2xl font-bold sm:text-3xl">Browse Tasks</h2>
          <p className="mt-2 text-base-content/60">Explore open projects in a faster list-detail workspace. Only publicly available tasks that can still receive bids are shown here.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-2xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Available</div>
            <div className="mt-2 text-2xl font-semibold text-primary">{tasks.length}</div>
          </div>
          <div className="rounded-2xl border border-base-300 bg-base-100 px-4 py-3 shadow-sm">
            <div className="text-xs uppercase tracking-[0.18em] text-base-content/50">Filtered</div>
            <div className="mt-2 text-2xl font-semibold">{filteredTasks.length}</div>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-[10px] border border-base-300 bg-base-100/95 p-4 shadow-[0_18px_48px_rgba(15,23,42,0.08)] sm:p-5">
        <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.25fr)_repeat(4,minmax(0,0.72fr))]">
          <label className="input input-bordered flex min-h-12 items-center gap-2 rounded-2xl px-4">
            <svg className="h-5 w-5 shrink-0 text-base-content/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by title, skills, description, or client"
              className="w-full bg-transparent outline-none"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>

          <select className="select select-bordered rounded-2xl" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            {categories.map((category) => (
              <option key={category} value={category}>{category === 'all' ? 'All categories' : category}</option>
            ))}
          </select>

          <select className="select select-bordered rounded-2xl" value={budgetFilter} onChange={(event) => setBudgetFilter(event.target.value)}>
            {budgetRanges.map((range) => (
              <option key={range.value} value={range.value}>{range.label}</option>
            ))}
          </select>

          <select className="select select-bordered rounded-2xl" value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="latest">Newest first</option>
            <option value="highest_budget">Highest budget</option>
            <option value="lowest_budget">Lowest budget</option>
            <option value="deadline_soon">Deadline soon</option>
          </select>

          <select className="select select-bordered rounded-2xl" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">Open tasks</option>
            <option value="open">Open</option>
          </select>
        </div>
      </div>

      {error ? <div className="alert alert-error mb-6 rounded-2xl"><span>{error}</span></div> : null}

      {!filteredTasks.length ? (
        <section className="rounded-[12px] border border-dashed border-base-300 bg-base-100 px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-base-200 text-2xl">🔎</div>
          <h3 className="mt-4 text-xl font-semibold">No tasks match your filters</h3>
          <p className="mt-2 text-sm text-base-content/60">Try clearing one or more filters, searching a broader keyword, or checking back later for new task posts.</p>
          <button
            type="button"
            className="btn btn-primary mt-5 rounded-full px-6 text-white"
            onClick={() => {
              setSearch('');
              setCategoryFilter('all');
              setBudgetFilter('all');
              setStatusFilter('all');
              setSortBy('latest');
            }}
          >
            Clear filters
          </button>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(24rem,0.95fr)_minmax(0,1.05fr)] xl:items-stretch">
          <section className="rounded-[12px] border border-base-300 bg-base-100/95 shadow-[0_22px_56px_rgba(15,23,42,0.09)] xl:flex xl:min-h-[calc(100vh-10.75rem)] xl:max-h-[calc(100vh-10.75rem)] xl:flex-col xl:overflow-hidden">
            <div className="border-b border-base-300 bg-base-100/90 px-5 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-semibold">Task results</h3>
                  <p className="mt-1 text-sm text-base-content/60">Choose a task to inspect the full brief, review the client, and place a bid with more confidence.</p>
                </div>
                <div className="rounded-full bg-base-200/70 px-3 py-1.5 text-xs font-semibold text-base-content/60">{filteredTasks.length} results</div>
              </div>
            </div>

            <div className="task-scroll-shell rounded-b-[2rem] bg-base-100/55 p-1 pt-0 xl:min-h-0 xl:flex-1 xl:overflow-hidden">
              <div className="task-list-scroll space-y-4 rounded-[8px] px-4 py-4 sm:px-5 sm:py-5 xl:h-full xl:min-h-0 xl:overflow-x-hidden xl:overflow-y-auto xl:bg-base-100/60">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  selected={selectedTask?.id === task.id}
                  onClick={() => {
                    setSelectedTaskId(task.id);
                    setMobileTaskId(window.innerWidth < 1280 ? task.id : null);
                  }}
                />
              ))}
              </div>
            </div>
          </section>

          <div className="hidden min-w-0 xl:block xl:min-h-[calc(100vh-10.75rem)] xl:max-h-[calc(100vh-10.75rem)]">
            <TaskDetailPanel task={selectedTask} onPlaceBid={handlePlaceBid} className="h-full" />
          </div>
        </div>
      )}

      {mobileTask ? (
        <TaskDetailModal
          task={mobileTask}
          onClose={() => setMobileTaskId(null)}
          onPlaceBid={handlePlaceBid}
        />
      ) : null}
    </div>
  );
};

export default BrowseTasks;
