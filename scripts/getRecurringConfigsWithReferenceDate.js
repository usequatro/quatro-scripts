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
    if (!recurringConfig.referenceDate) {
      console.log(`🚫 No reference date for recurring config ${rcId}`);
    } else {
      console.log(
        `👀 Reference date for recurring config ${rcId} is ${recurringConfig.referenceDate}`,
      );
    }
  }
  console.log(`---`);
})();
