import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Document from './pages/Document'
import AuthCallback from './pages/AuthCallback'
import SharedDocument from './pages/SharedDocument'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        } />
        <Route path="/document/:id" element={
          <PrivateRoute>
            <Document />
          </PrivateRoute>
        } />
        <Route path="*" element={<Navigate to="/login" />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/share/:shareToken" element={<SharedDocument />} />
      </Routes>
    </BrowserRouter>
  )
}