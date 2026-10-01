import { Route, Routes } from 'react-router'
import { RequireAuth } from './auth/RequireAuth'
import { Layout } from './components/Layout'
import { BoardPage } from './pages/BoardPage'
import { ComingSoon } from './pages/ComingSoon'
import { LoginPage } from './pages/LoginPage'
import { NotFoundPage } from './pages/NotFoundPage'

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
        <Route path="calendar" element={<ComingSoon title="Calendar" />} />
        <Route
          path="posts/new"
          element={
            <RequireAuth roles={['CREATOR']}>
              <ComingSoon title="New post" />
            </RequireAuth>
          }
        />
        <Route path="posts/:id" element={<ComingSoon title="Post details" />} />
        <Route
          path="posts/:id/edit"
          element={
            <RequireAuth roles={['CREATOR']}>
              <ComingSoon title="Edit post" />
            </RequireAuth>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireAuth roles={['ADMIN']}>
              <ComingSoon title="Users" />
            </RequireAuth>
          }
        />
        <Route
          path="admin/clients"
          element={
            <RequireAuth roles={['ADMIN']}>
              <ComingSoon title="Clients" />
            </RequireAuth>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
