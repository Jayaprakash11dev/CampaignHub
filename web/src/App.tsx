import { Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { ClientsPage } from './pages/admin/ClientsPage'
import { UsersPage } from './pages/admin/UsersPage'
import { BoardPage } from './pages/BoardPage'
import { CalendarPage } from './pages/CalendarPage'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { PostDetailPage } from './pages/PostDetailPage'
import { PostEditorPage } from './pages/PostEditorPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Everything else needs a logged-in user and shares the top bar. */}
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<BoardPage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route
          path="posts/new"
          element={
            <RequireAuth roles={['CREATOR']}>
              <PostEditorPage />
            </RequireAuth>
          }
        />
        <Route path="posts/:id" element={<PostDetailPage />} />
        <Route
          path="posts/:id/edit"
          element={
            <RequireAuth roles={['CREATOR']}>
              <PostEditorPage />
            </RequireAuth>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireAuth roles={['ADMIN']}>
              <UsersPage />
            </RequireAuth>
          }
        />
        <Route
          path="admin/clients"
          element={
            <RequireAuth roles={['ADMIN']}>
              <ClientsPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
