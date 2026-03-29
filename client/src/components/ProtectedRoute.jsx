import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children }) {
  const { session, hasProfile, loading } = useAuth();

  if (loading || (session && hasProfile === null)) {
    return (
      <div className="state-msg">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (hasProfile === false) {
    return <Navigate to="/setup" replace />;
  }

  return children;
}
