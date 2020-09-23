import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const LIMIT = 1;

const COLLECTION_RECURRING_CONFIGS = 'recurringConfigs';
const COLLECTION_TASKS = 'tasks';

(async () => {
  console.log(`---`);

  const snapshots = await admin
    .firestore()
    .collection(COLLECTION_RECURRING_CONFIGS)
    .limit(LIMIT)
    .get();
  const recurringConfigs = snapshots.docs.map((doc) => [doc.id, doc.data()]);

  console.log(`${recurringConfigs.length} recurring configs retrieved`);

  // All recurring configs should point to a task, the last one created.
  for (const [rcId, recurringConfig] of recurringConfigs) {
    if (recurringConfig.mostRecentTaskId) {
      console.log(
        `${rcId} ℹ️  skipping because it has mostRecentTaskId, ${recurringConfig.mostRecentTaskId}`,
      );
      continue;
    }

    const lastTaskForRecurringConfigQuerySnapshot = await admin
      .firestore()
      .collection(COLLECTION_TASKS)
      .where('recurringConfigId', '==', rcId)
      .orderBy('created', 'desc')
      .limit(1)
      .get();

    if (lastTaskForRecurringConfigQuerySnapshot.empty) {
      console.log(`${rcId} ⚠️ No tasks found`);
      continue;
    }

    const taskId = lastTaskForRecurringConfigQuerySnapshot.docs[0].id;

    await admin
      .firestore()
      .collection(COLLECTION_RECURRING_CONFIGS)
      .doc(rcId)
      .update({ mostRecentTaskId: taskId });

    console.log(`${rcId} ✅ Handled`);
  }
  console.log(`---`);
})();
