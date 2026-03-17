import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

const normalizeStatus = (value = '') => value.toLowerCase();

export const fetchOwnerDashboardData = async () => {
  const [usersSnap, tasksSnap, paymentsSnap, deliveriesSnap, workspaceSnap, disputesSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'payments'), orderBy('paymentDate', 'desc'))),
    getDocs(query(collection(db, 'deliveries'), orderBy('submittedAt', 'desc'))),
    getDocs(query(collection(db, 'workspaceEntries'), orderBy('createdAt', 'desc'))),
    getDocs(query(collection(db, 'disputes'), orderBy('createdAt', 'desc'))),
  ]);

  const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const tasks = tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const payments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const deliveries = deliveriesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const workspaceEntries = workspaceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const disputes = disputesSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const successfulPayments = payments.filter((payment) => ['success', 'captured', 'paid'].includes(normalizeStatus(payment.paymentStatus || payment.status)));
  const totalPlatformEarnings = successfulPayments.reduce((sum, payment) => sum + Number(payment.totalPlatformRevenue ?? payment.platformFee ?? 0), 0);

  return {
    users,
    tasks,
    payments,
    deliveries,
    workspaceEntries,
    stats: {
      totalUsers: users.length,
      totalTasks: tasks.length,
      pendingTasks: tasks.filter((task) => ['open', 'pending', 'in_progress', 'submitted', 'revision_requested'].includes(normalizeStatus(task.status))).length,
      completedTasks: tasks.filter((task) => normalizeStatus(task.status) === 'completed').length,
      totalPayments: payments.length,
      pendingPayments: payments.filter((payment) => normalizeStatus(payment.paymentStatus || payment.status) === 'pending').length,
      successfulPayments: successfulPayments.length,
      totalPlatformEarnings,
      totalDeliveries: deliveries.length,
      workspaceEntries: workspaceEntries.length,
      totalDisputes: disputes.length,
      openDisputes: disputes.filter((item) => ['open', 'under_review'].includes(normalizeStatus(item.status))).length,
      readyForRelease: payments.filter((item) => normalizeStatus(item.payoutStatus) === 'ready_for_release').length,
    },
    recentUsers: users.slice(0, 5),
    recentTasks: tasks.slice(0, 5),
    recentPayments: payments.slice(0, 5),
    recentDeliveries: deliveries.slice(0, 5),
    recentDisputes: disputes.slice(0, 5),
  };
};

export const fetchRecentCollection = async (collectionName, orderField, limitCount = 10) => {
  const snapshot = await getDocs(query(collection(db, collectionName), orderBy(orderField, 'desc'), limit(limitCount)));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
};
