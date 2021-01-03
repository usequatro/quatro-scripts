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
  const activeCampaignId = response.contact.id;
  if (!activeCampaignId) {
    console.info(JSON.stringify(response));
    throw new Error(
      `Active Campaign user not created for email ${user.email}. Contact ID not returned`,
    );
  }

  await addContactToList({
    contactList: {
      contact: activeCampaignId,
      list: isProd ? MAIN_LIST_ID : DEV_LIST_ID,
      status: 1,
    },
  });

  return activeCampaignId;
};

const setUserInternalConfig = ({ userId, activeCampaignId, userProviders }) =>
  admin.firestore().collection('userInternalConfigs').doc(userId).set(
    {
      activeCampaignId,
      providersSentToActiveCampaign: userProviders,
    },
    { merge: true },
  );

const GOOGLE_PROVIDER = 'google.com';
const PASSWORD_PROVIDER = 'password';

const addGoogleTagToUser = (activeCampaignId) =>
  addTagToUser({
    contactTag: {
      contact: activeCampaignId,
      tag: SIGNED_GOOGLE_TAG_ID,
    },
  });

const addPasswordTagToUser = (activeCampaignId) =>
  addTagToUser({
    contactTag: {
      contact: activeCampaignId,
      tag: SIGNED_PASSWORD_TAG_ID,
    },
  });

const tagToFunction = {
  [GOOGLE_PROVIDER]: addGoogleTagToUser,
  [PASSWORD_PROVIDER]: addPasswordTagToUser,
};

const run = async () => {
  const users = await getAllUsers();

  for (const user of users) {
    console.log('=> Adding user... 🔥');
    const userProviders = getUserProviders(user);
    const calendarCount = await getUserCalendarCount(user.uid);

    const activeCampaignId = await createContactFromUser(user, calendarCount);
    console.log('User added to active campaign!');

    const providerPromises = userProviders.map((provider) =>
      tagToFunction[provider] ? tagToFunction[provider](activeCampaignId) : () => {},
    );

    await Promise.all(providerPromises);
    console.log('User tags 🔖 added to active campaign!');

    await setUserInternalConfig({ userId: user.uid, activeCampaignId, userProviders });
    console.log('=> User added to internal config! 🎉');
  }

  console.log('Finished running! 🚀');
};

run();
