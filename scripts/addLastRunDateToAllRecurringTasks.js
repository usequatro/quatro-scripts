import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const LIMIT = 200;

const COLLECTION_RECURRING_CONFIGS = 'recurringConfigs';

(async () => {
  console.log(`---`);

  const snapshots = await admin
    .firestore()
    .collection(COLLECTION_RECURRING_CONFIGS)
    .limit(LIMIT)
    .get();
  const recurringConfigs = snapshots.docs.map((doc) => [doc.id, doc.data()]);

  console.log(`${recurringConfigs.length} recurring configs retrieved (limit is ${LIMIT})`);

  const recurringConfigsWithoutLastRunDate = recurringConfigs.filter(
    ([, rc]) => rc.lastRunDate === undefined,
  );

  console.log(`${recurringConfigsWithoutLastRunDate.length} recurring configs without lastRunDate`);
  console.log(
    `${
      recurringConfigs.length - recurringConfigsWithoutLastRunDate.length
    } recurring configs with lastRunDate`,
  );

  // for (const [rcId] of recurringConfigsWithoutLastRunDate) {
  //   await admin
  //     .firestore()
  //     .collection(COLLECTION_RECURRING_CONFIGS)
  //     .doc(rcId)
  //     .update({ lastRunDate: null })
  //     .then(() => {
  //       console.log(`✅  ${rcId}: Recurring config now has lastRunDate`);
  //     })
  //     .catch(() => {
  //       console.log(`🔴  ${rcId}: Recurring config update error`);
  //     });
  // }
  console.log(`---`);
})();
