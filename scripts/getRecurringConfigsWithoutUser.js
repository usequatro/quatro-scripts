import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const LIMIT = 1000;

const COLLECTION_RECURRING_CONFIGS = 'recurringConfigs';

(async () => {
  console.log(`---`);

  const snapshots = await admin
    .firestore()
    .collection(COLLECTION_RECURRING_CONFIGS)
    .limit(LIMIT)
    .get();
  const recurringConfigs = snapshots.docs.map((doc) => [doc.id, doc.data()]);

  console.log(`${recurringConfigs.length} recurring configs retrieved`);

  for (const [rcId, recurringConfig] of recurringConfigs) {
    if (!recurringConfig.userId) {
      console.log(`🚫 No userId for recurring config ${rcId}`);
    }

    await admin
      .auth()
      .getUser(recurringConfig.userId)
      .then((userRecord) => {
        console.log(`✅ Recurring config ${rcId} has user ${userRecord.uid}`);
      })
      .catch(() => {
        console.log(`🔥 Recurring config ${rcId} user doesn't exist (${recurringConfig.userId})`);
      });
  }
  console.log(`---`);
})();
