import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const COLLECTION_USER_EXTERNAL_CONFIGS = 'userExternalConfigs';
const COLLECTION_RECURRING_CONFIGS = 'recurringConfigs';

(async () => {
  console.log(`---`);

  const userRecords = [];

  const listAllUsers = (nextPageToken) => {
    // List batch of users, 1000 at a time.
    return admin
      .auth()
      .listUsers(1000, nextPageToken)
      .then((listUsersResult) => {
        listUsersResult.users.forEach((userRecord) => {
          userRecords.push(userRecord);
        });
        if (listUsersResult.pageToken) {
          // List next batch of users.
          listAllUsers(listUsersResult.pageToken);
        }
      })
      .catch((error) => {
        console.log('Error listing users:', error);
      });
  };

  await listAllUsers();

  let noConfigCount = 0;
  let noTimeZoneNorCalendarCount = 0;
  let noTimeZoneCount = 0;
  let noRecurringTasksCount = 0;
  let hasTimeZoneCount = 0;

  for (const userRecord of userRecords) {
    const { email, uid: userId } = userRecord;

    const userExternalConfigDocumentSnapshot = await admin
      .firestore()
      .collection(COLLECTION_USER_EXTERNAL_CONFIGS)
      .doc(userId)
      .get();

    const recurringConfigsSnapshot = await admin
      .firestore()
      .collection(COLLECTION_RECURRING_CONFIGS)
      .where('userId', '==', userId)
      .limit(1)
      .get();
    const hasRecurringTasks = !recurringConfigsSnapshot.empty;

    if (!hasRecurringTasks) {
      // console.log(`☘️  No recurring tasks for user ${userId} ${email}`);
      noRecurringTasksCount += 1;
      continue;
    }

    if (!userExternalConfigDocumentSnapshot.exists) {
      console.log(
        `🥵  No userExternalConfig for user ${userId} ${email} ${userRecord.metadata.lastSignInTime}`,
      );
      noConfigCount += 1;
      continue;
    }

    const userExternalConfig = userExternalConfigDocumentSnapshot.data();

    if (!userExternalConfig.timeZone) {
      if (userExternalConfig.defaultCalendarId) {
        console.log(
          `🙏  No timeZone but has defaultCalendarId for user ${userId} ${email} ${userRecord.metadata.lastSignInTime}`,
        );
        noTimeZoneCount += 1;
        continue;
      }

      console.log(
        `🔥  No timeZone, defaultCalendarId and has RCs! for user ${userId} ${email} ${userRecord.metadata.lastSignInTime}`,
      );
      noTimeZoneNorCalendarCount += 1;
      continue;
    }

    console.log(`✅  Found timeZone for user ${userId} ${email} ${userExternalConfig.timeZone}`);
    hasTimeZoneCount += 1;
  }

  console.log(``);

  console.log(`Total count of users: ${userRecords.length}`);
  console.log(`noRecurringTasksCount=${noRecurringTasksCount}`);
  console.log(`noConfigCount=${noConfigCount}`);
  console.log(`noTimeZoneNorCalendarCount=${noTimeZoneNorCalendarCount}`);
  console.log(`noTimeZoneCount=${noTimeZoneCount}`);
  console.log(`hasTimeZoneCount=${hasTimeZoneCount}`);

  console.log(`---`);
})();
