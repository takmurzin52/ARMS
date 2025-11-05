import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();

        if (!login || !password) {
            setError('Логин и пароль обязательны');
            return;
        }

        setError(''); // очищаем прошлую ошибку

        try {
            console.log('Попытка входа:', { login, password });

            const response = await fetch('http://localhost:5000/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Сохраняем пользователя (например id и имя)
                localStorage.setItem('user', JSON.stringify(data.user));

                navigate('/dashboard');
            } else {
                setError(data.error || 'Ошибка входа');
            }

        } catch (err) {
            console.error(err);
            setError('Сервер недоступен. Попробуйте позже.');
        }
    };


    const handleRegisterClick = () => {
        navigate('/register');
    };

    // SVG иконки (встроенные)
    const UserIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 4-7 8-7s8 3 8 7" />
        </svg>
    );

    const LockIcon = () => (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
    );

    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#F9FAFB',
            fontFamily: 'Inter, Roboto, sans-serif',
            padding: '20px'
        }}>
            <div style={{
                width: '400px',
                padding: '32px',
                borderRadius: '8px',
                backgroundColor: 'white',
                boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
                textAlign: 'center'
            }}>
                <h1 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    marginBottom: '24px',
                    color: '#1F2937'
                }}>
                    Автоматизированное рабочее место судьи спортивного программирования
                </h1>

                {error && (
                    <div style={{
                        backgroundColor: '#fee2e2',
                        color: '#dc2626',
                        padding: '12px',
                        borderRadius: '4px',
                        marginBottom: '16px',
                        fontSize: '14px'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ textAlign: 'left', position: 'relative' }}>
                        <label htmlFor="login" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Логин:
                        </label>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            backgroundColor: '#F9FAFB'
                        }}>
              <span style={{ padding: '10px', color: '#6B7280' }}>
                <UserIcon />
              </span>
                            <input
                                id="login"
                                type="text"
                                value={login}
                                onChange={(e) => setLogin(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    border: 'none',
                                    fontSize: '14px',
                                    outline: 'none',
                                    backgroundColor: 'transparent'
                                }}
                                placeholder="Введите логин"
                            />
                        </div>
                    </div>

                    <div style={{ textAlign: 'left', position: 'relative' }}>
                        <label htmlFor="password" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Пароль:
                        </label>
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            backgroundColor: '#F9FAFB'
                        }}>
              <span style={{ padding: '10px', color: '#6B7280' }}>
                <LockIcon />
              </span>
                            <input
                                id="password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    border: 'none',
                                    fontSize: '14px',
                                    outline: 'none',
                                    backgroundColor: 'transparent'
                                }}
                                placeholder="Введите пароль"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        style={{
                            backgroundColor: '#4F46E5',
                            color: 'white',
                            border: 'none',
                            padding: '12px 24px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            fontWeight: '500',
                            transition: 'background-color 0.2s',
                            width: '100%',
                            marginTop: '16px'
                        }}
                        onMouseOver={(e) => e.target.style.backgroundColor = '#4338CA'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#4F46E5'}
                    >
                        Войти
                    </button>
                </form>

                <p style={{
                    marginTop: '24px',
                    fontSize: '14px',
                    color: '#6B7280'
                }}>
                    Еще не зарегистрированы?{' '}
                    <span
                        onClick={handleRegisterClick}
                        style={{
                            color: '#3B82F6',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                        }}
                    >
            Зарегистрироваться
          </span>
                </p>
            </div>
        </div>
    );
}

export default Login;