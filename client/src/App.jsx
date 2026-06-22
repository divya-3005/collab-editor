import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Document from './pages/Document'
import AuthCallback from './pages/AuthCallback'
import SharedDocument from './pages/SharedDocument'
import { ThemeProvider, useTheme } from './context/ThemeContext'

const ThemedToaster = () => {
  const { theme } = useTheme()
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          fontFamily: 'Inter, sans-serif',
          fontSize: '0.875rem',
          borderRadius: '10px',
          padding: '10px 14px',
          ...(theme === 'dark' ? {
            background: '#1e293b',
            color: '#f1f5f9',
            border: '1px solid #334155',
          } : {
            background: '#fff',
            color: '#0f172a',
            border: '1px solid #e2e8f0',
          })
        },
        duration: 3000,
      }}
    />
  )
}

function PrivateRoute({ children }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/login" />
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ThemedToaster />
        <Routes>
          <Route path="/" element={<Landing />} />
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
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/share/:shareToken" element={<SharedDocument />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}