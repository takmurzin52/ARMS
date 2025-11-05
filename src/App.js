import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './Login';
import Register from './Register';
import Dashboard from './Dashboard';
import SecretaryDashboard from './pages/SecretaryDashboard';

function App() {
    // Простая проверка: если залогинен — показываем панель
    // Позже добавим проверку роли
    const isAuthenticated = () => {
        return !!localStorage.getItem('user');
    };

    // Защита маршрутов
    const ProtectedRoute = ({ children }) => {
        if (!isAuthenticated()) {
            return <Navigate to="/" replace />;
        }
        return children;
    };

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route
                    path="/dashboard"
                    element={
                        <ProtectedRoute>
                            <SecretaryDashboard />
                        </ProtectedRoute>
                    }
                />
            </Routes>
        </Router>
    );
}

export default App;