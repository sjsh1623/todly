/**
 * English resource bundle for todly. Must mirror every key in `ko.ts`.
 * Flat dotted keys (see i18n.ts: keySeparator:false / nsSeparator:false).
 */
import { authEn } from './parts/auth'
import { homeEn } from './parts/home'
import { tasksEn } from './parts/tasks'
import { socialEn } from './parts/social'
import { settingsEn } from './parts/settings'
import { uiEn } from './parts/ui'
import { groupsEn } from './parts/groups'
import { timeEn } from './parts/time'
import { errorsEn } from './parts/errors'

export const en = {
  translation: {
    // Per-component bundles (migrated strings) merged first; shared keys below
    // take precedence on any accidental overlap.
    ...authEn,
    ...homeEn,
    ...tasksEn,
    ...socialEn,
    ...settingsEn,
    ...uiEn,
    ...groupsEn,
    ...timeEn,
    ...errorsEn,

    // nav
    'nav.home': 'Home',
    'nav.groups': 'Groups',
    'nav.activity': 'Activity',
    'nav.routine': 'Routines',
    'nav.profile': 'Profile',

    // common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.done': 'Done',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.retry': 'Try again',
    'common.loading': 'Loading…',
    'common.saving': 'Saving…',
    'common.skipToContent': 'Skip to content',

    // offline
    'offline.banner': "You're offline. Some features may be limited.",
    'offline.backOnline': 'Back online',

    // empty states
    'empty.activityTitle': 'No activity yet',
    'empty.activitySubtitle': "Start a to-do together and it'll show up here",
    'empty.routineTitle': 'No routines yet',
    'empty.routineSubtitle': 'Tap + to add a routine to repeat',
    'empty.notificationsTitle': 'No new notifications',
    'empty.notificationsSubtitle': "We'll let you know here when something happens",
    'empty.friendsTitle': 'No friends yet',
    'empty.friendsSubtitle': 'Invite friends to get started together',
    'empty.searchTitle': 'No results',
    'empty.searchSubtitle': 'Try a different search term',
    'empty.groupsTitle': 'No groups yet',
    'empty.groupsSubtitle': 'Create your first group to get started together',

    // settings — language switcher
    'settings.language': 'Language',
    'settings.languageKo': '한국어',
    'settings.languageEn': 'English',
  },
} as const
