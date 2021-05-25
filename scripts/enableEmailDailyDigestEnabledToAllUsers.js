import admin from 'firebase-admin';
import dotenv from 'dotenv';

dotenv.config();

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const COLLECTION_USER_EXTERNAL_CONFIGS = 'userExternalConfigs';

const listAllUsers = async (nextPageToken) => {
  const userRecords = [];
  // List batch of users, 1000 at a time.
  await admin
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

  return userRecords;
};

const createUserExternalConfig = (userId, updates) =>
  admin.firestore().collection(COLLECTION_USER_EXTERNAL_CONFIGS).doc(userId).create(updates);

const setUserExternalConfig = (userId, updates) =>
  admin
    .firestore()
    .collection(COLLECTION_USER_EXTERNAL_CONFIGS)
    .doc(userId)
    .set(updates, { merge: true });

(async () => {
  console.log(`---`);

  const userRecords = await listAllUsers();

  let skippedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;

  for (const userRecord of userRecords) {
    const { email, uid: userId } = userRecord;

    const userExternalConfigDocumentSnapshot = await admin
      .firestore()
      .collection(COLLECTION_USER_EXTERNAL_CONFIGS)
      .doc(userId)
      .get();

    if (
      userExternalConfigDocumentSnapshot.exists &&
      userExternalConfigDocumentSnapshot.data().emailDailyDigestEnabled
    ) {
      console.log(`✋ 🟡  Already enabled for user ${userId} ${email}`);
      skippedCount += 1;
      continue;
    }

    if (!userExternalConfigDocumentSnapshot.exists) {
      // create
      console.log(`👍 🟩  Enabled for user ${userId} ${email} (Created external config)`);
      createUserExternalConfig(userId, { emailDailyDigestEnabled: true });
      createdCount += 1;
    } else {
      // update
      console.log(`👍 🟢  Enabled for user ${userId} ${email}`);
      setUserExternalConfig(userId, { emailDailyDigestEnabled: true });
      updatedCount += 1;
    }
  }

  console.log(``);

  console.log(`Total count of users: ${userRecords.length}`);
  console.log(`skippedCount=${skippedCount}`);
  console.log(`createdCount=${createdCount}`);
  console.log(`updatedCount=${updatedCount}`);

  console.log(`---`);
})();
