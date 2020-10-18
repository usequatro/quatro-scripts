import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const LIMIT = 200;

const COLLECTION_RECURRING_CONFIGS = 'recurringConfigs';
const COLLECTION_TASKS = 'tasks';

(async () => {
  console.log(`---`);

  const snapshots = await admin
    .firestore()
    .collection(COLLECTION_TASKS)
    .where('trashed', '>', 0)
    .limit(LIMIT)
    .get();
  const trashedTasks = snapshots.docs.map((doc) => [doc.id, doc.data()]);

  console.log(`${trashedTasks.length} trashed tasks retrieved (limit is ${LIMIT})`);

  for (const [taskId, task] of trashedTasks) {
    await admin
      .firestore()
      .collection(COLLECTION_TASKS)
      .doc(taskId)
      .delete()
      .then(() => {
        console.log(`🗑  ${taskId}: Task deleted "${task.title}"`);
      })
      .catch(() => {
        console.log(`🔴  ${taskId}: Task delete error "${task.title}"`);
      });

    // If the task has recurring config, we also want to delete that one
    const { recurringConfigId } = task;
    if (recurringConfigId) {
      await admin
        .firestore()
        .collection(COLLECTION_RECURRING_CONFIGS)
        .doc(recurringConfigId)
        .delete()
        .then(() => {
          console.log(`🗑  ${taskId}:   Recurring config deleted ${recurringConfigId}`);
        })
        .catch(() => {
          console.log(`👻  ${taskId}:   Recurring config to delete not found ${recurringConfigId}`);
        });
    }
  }
  console.log(`---`);
})();
