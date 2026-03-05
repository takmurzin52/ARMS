import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import SecretaryDashboard from './pages/SecretaryDashboard';
import JudgeDashboard from './pages/JudgeDashboard';

// Защита маршрутов с проверкой роли
const ProtectedRoute = ({ children, allowedRoles }) => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        return <Navigate to="/" replace />;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        return <Navigate to="/unauthorized" replace />;
    }
    return children;
};

// Страница "Доступ запрещён"
const Unauthorized = () => (
    <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>Доступ запрещён</h2>
        <p>У вас нет прав для просмотра этой страницы.</p>
        <button onClick={() => window.location.href = '/'} style={{
            marginTop: '16px',
            padding: '8px 16px',
            backgroundColor: '#4F46E5',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
        }}>
            Вернуться на главную
        </button>
    </div>
);

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />

                {/* Панель секретаря */}
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute allowedRoles={['Секретарь']}>
                            <SecretaryDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Панель основного судьи */}
                <Route
                    path="/judge"
                    element={
                        <ProtectedRoute allowedRoles={['Основной судья']}>
                            <JudgeDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Доступ запрещён */}
                <Route path="/unauthorized" element={<Unauthorized />} />

                {/* Перенаправление после входа */}
                <Route
                    path="/"
                    element={
                        <ProtectedRoute>
                            <RedirectBasedOnRole />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </Router>
    );
}

// Автоматическое перенаправление после входа
const RedirectBasedOnRole = () => {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user.role === 'Секретарь') {
        return <Navigate to="/dashboard" replace />;
    } else if (user.role === 'Основной судья') {
        return <Navigate to="/judge" replace />;
    } else if (user.role === 'Главный судья') {
        return <Navigate to="/chief" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
};

export default App;