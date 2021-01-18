import dotenv from 'dotenv';
import admin from 'firebase-admin';

import {
  addContactToList,
  addTagToUser,
  createContact,
  CALENDARS_FIELD_ID,
  DEV_LIST_ID,
  MAIN_LIST_ID,
  SIGNED_GOOGLE_TAG_ID,
  SIGNED_PASSWORD_TAG_ID,
} from '../utils/activeCampaign';

dotenv.config();
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

const isProd = process.env.NODE_ENV === 'production';

const getAllUsers = () => {
  const auth = admin.auth();
  return auth.listUsers().then((userRecords) => userRecords.users);
};

const getUserProviders = (user) => (user.providerData || []).map(({ providerId }) => providerId);
const getUserCalendarCount = async (userId) => {
  const calendars = await admin
    .firestore()
    .collection('calendars')
    .where('userId', '==', userId)
    .get();
  return calendars.docs.length;
};

const addDevelopmentEmailFlag = (email) => email.replace(/@/, '+development@');

const createContactFromUser = async (user, calendarCount = 0) => {
  const { email = '', phoneNumber, displayName } = user;

  const acPayload = {
    contact: {
      email: isProd ? email : addDevelopmentEmailFlag(email),
      firstName: displayName,
      phone: phoneNumber,
      fieldValues: [{ field: CALENDARS_FIELD_ID, value: `${calendarCount}` }],
    },
  };

  const response = await createContact(acPayload);

  if (response.errors && response.errors.find((error) => error.code === 'duplicate')) {
    return null;
  }

  const activeCampaignContactId = response.contact.id;
  if (!activeCampaignContactId) {
    console.info(JSON.stringify(response));
    throw new Error(
      `Active Campaign user not created for email ${user.email}. Contact ID not returned`,
    );
  }

  await addContactToList({
    contactList: {
      contact: activeCampaignContactId,
      list: isProd ? MAIN_LIST_ID : DEV_LIST_ID,
      status: 1,
    },
  });

  return activeCampaignContactId;
};

const setUserInternalConfig = ({ userId, activeCampaignContactId, userProviders }) =>
  admin.firestore().collection('userInternalConfigs').doc(userId).set(
    {
      activeCampaignContactId,
      providersSentToActiveCampaign: userProviders,
    },
    { merge: true },
  );

const GOOGLE_PROVIDER = 'google.com';
const PASSWORD_PROVIDER = 'password';

const addGoogleTagToUser = (activeCampaignContactId) =>
  addTagToUser({
    contactTag: {
      contact: activeCampaignContactId,
      tag: SIGNED_GOOGLE_TAG_ID,
    },
  });

const addPasswordTagToUser = (activeCampaignContactId) =>
  addTagToUser({
    contactTag: {
      contact: activeCampaignContactId,
      tag: SIGNED_PASSWORD_TAG_ID,
    },
  });

const tagToFunction = {
  [GOOGLE_PROVIDER]: addGoogleTagToUser,
  [PASSWORD_PROVIDER]: addPasswordTagToUser,
};

const run = async () => {
  console.log(`Mode: ${isProd ? 'production list' : 'development list'}`);
  const users = await getAllUsers();

  for (const user of users) {
    console.log('');

    try {
      console.log(`=> Adding user... 🔥 uid=${user.uid} email=${user.email}`);
      const userProviders = getUserProviders(user);
      const calendarCount = await getUserCalendarCount(user.uid);

      const activeCampaignContactId = await createContactFromUser(user, calendarCount);
      if (activeCampaignContactId === null) {
        console.log(`=> Skipped because contact already in ActiveCampaign`);
        continue;
      }
      console.log(`=> User added to active campaign! contactid=${activeCampaignContactId}`);

      const providerPromises = userProviders.map((provider) =>
        tagToFunction[provider] ? tagToFunction[provider](activeCampaignContactId) : () => {},
      );

      await Promise.all(providerPromises);
      console.log('=> User tags 🔖 added to active campaign!');

      await setUserInternalConfig({ userId: user.uid, activeCampaignContactId, userProviders });
      console.log('=> User added to internal config! 🎉');
    } catch (error) {
      console.error(error);
      continue;
    }
  }

  console.log('Finished running! 🚀');
};

run();
