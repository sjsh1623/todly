import { createBrowserRouter, Outlet } from 'react-router-dom'
import { AppShell } from '../shared/ui'
import { RootLayout } from './RootLayout'
import { RequireAuth } from './RequireAuth'
import Home from '../pages/Home'
import Groups from '../pages/Groups'
import GroupCreate from '../pages/GroupCreate'
import GroupDetail from '../pages/GroupDetail'
import TaskCreate from '../pages/TaskCreate'
import LiveMoment from '../pages/LiveMoment'
import LiveRoom from '../pages/LiveRoom'
import InviteAccept from '../pages/InviteAccept'
import Activity from '../pages/Activity'
import Routine from '../pages/Routine'
import Profile from '../pages/Profile'
import Consistency from '../pages/Consistency'
import TaskDetail from '../pages/TaskDetail'
import Friends from '../pages/Friends'
import InviteFriends from '../pages/InviteFriends'
import NotificationSettings from '../pages/NotificationSettings'
import Settings from '../pages/Settings'
import AccountSettings from '../pages/AccountSettings'
import Help from '../pages/Help'
import Login from '../pages/Login'
import Signup from '../pages/Signup'
import ResetPassword from '../pages/ResetPassword'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      // Public auth routes (no AppShell chrome).
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
      { path: '/reset-password', element: <ResetPassword /> },

      // Protected 5-tab app.
      {
        path: '/',
        element: (
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        ),
        children: [
          { index: true, element: <Home /> },
          { path: 'groups', element: <Groups /> },
          { path: 'activity', element: <Activity /> },
          { path: 'routine', element: <Routine /> },
          { path: 'profile', element: <Profile /> },
        ],
      },

      // Protected full-screen pushed views WITHOUT the bottom nav.
      {
        element: (
          <RequireAuth>
            <PushedLayout />
          </RequireAuth>
        ),
        children: [
          { path: '/groups/new', element: <GroupCreate /> },
          { path: '/groups/:id/invite', element: <InviteFriends /> },
          { path: '/groups/:id', element: <GroupDetail /> },
          { path: '/friends', element: <Friends /> },
          { path: '/consistency', element: <Consistency /> },
          { path: '/tasks/new', element: <TaskCreate /> },
          { path: '/tasks/:id', element: <TaskDetail /> },
          { path: '/settings', element: <Settings /> },
          { path: '/settings/account', element: <AccountSettings /> },
          { path: '/settings/notifications', element: <NotificationSettings /> },
          { path: '/settings/help', element: <Help /> },
          { path: '/invite/:code', element: <InviteAccept /> },
        ],
      },

      // SCR-06 live moment — full-bleed, no phone frame.
      {
        path: '/live/:taskId',
        element: (
          <RequireAuth>
            <LiveMoment />
          </RequireAuth>
        ),
      },

      // SCR-07 live room — full-bleed multi-participant room.
      {
        path: '/rooms/:id',
        element: (
          <RequireAuth>
            <LiveRoom />
          </RequireAuth>
        ),
      },
    ],
  },
], {
  // Honour the Vite base path so routing works when the app is mounted under a
  // sub-path (e.g. mohe.today/todly). BASE_URL is '/' in local dev. React Router
  // wants the basename without a trailing slash.
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
})

/** Phone-frame wrapper for pushed screens; mirrors AppShell minus BottomNav. */
function PushedLayout() {
  return (
    <div className="min-h-screen bg-bg flex justify-center">
      <div className="relative w-full max-w-[420px] min-h-screen bg-bg">
        <Outlet />
      </div>
    </div>
  )
}
