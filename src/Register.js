import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function Register() {
    const [surname, setSurname] = useState('');
    const [name, setName] = useState('');
    const [patronymic, setPatronymic] = useState('');
    const [category, setCategory] = useState('');
    const [role, setRole] = useState('');
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Списки для select
    const categories = [
        'Спортивный судья всероссийской категории',
        'Спортивный судья первой категории',
        'Спортивный судья второй категории',
        'Спортивный судья третьей категории',
        'Юный спортивный судья'
    ];

    const roles = [
        'Основной судья',
        'Секретарь',
        'Главный судья'
    ];

    const handleRegister = async (e) => {
        e.preventDefault();

        // Проверка заполненности полей
        if (!surname || !name || !category || !role || !login || !password || !confirmPassword) {
            setError('Все поля обязательны');
            return;
        }

        // Проверка совпадения паролей
        if (password !== confirmPassword) {
            setError('Пароли не совпадают');
            return;
        }

        setError(''); // сбрасываем ошибку

        try {
            console.log('Регистрация:', {
                surname,
                name,
                patronymic,
                category,
                role,
                login
            });

            const response = await fetch('http://localhost:5000/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    surname, name, patronymic, category, role, login, password
                })
            });

            const data = await response.json();

            if (response.ok) {
                alert('Регистрация успешна! Перенаправление на вход...');
                navigate('/');
            } else {
                setError(data.error || 'Ошибка регистрации');
            }

        } catch (err) {
            console.error(err);
            setError('Сервер недоступен. Попробуйте позже.');
        }
    };

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
                    Регистрация нового судьи
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

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div style={{ textAlign: 'left' }}>
                        <label htmlFor="surname" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Фамилия:
                        </label>
                        <input
                            id="surname"
                            type="text"
                            value={surname}
                            onChange={(e) => setSurname(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                            placeholder="Введите фамилию"
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label htmlFor="name" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Имя:
                        </label>
                        <input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                            placeholder="Введите имя"
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label htmlFor="patronymic" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Отчество (если есть):
                        </label>
                        <input
                            id="patronymic"
                            type="text"
                            value={patronymic}
                            onChange={(e) => setPatronymic(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                            placeholder="Введите отчество"
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label htmlFor="category" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Категория:
                        </label>
                        <select
                            id="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none',
                                backgroundColor: 'white'
                            }}
                        >
                            <option value="">Выберите категорию</option>
                            {categories.map((cat, idx) => (
                                <option key={idx} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label htmlFor="role" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Роль:
                        </label>
                        <select
                            id="role"
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none',
                                backgroundColor: 'white'
                            }}
                        >
                            <option value="">Выберите роль</option>
                            {roles.map((r, idx) => (
                                <option key={idx} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label htmlFor="login" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Логин:
                        </label>
                        <input
                            id="login"
                            type="text"
                            value={login}
                            onChange={(e) => setLogin(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                            placeholder="Введите логин"
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label htmlFor="password" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Пароль:
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                            placeholder="Введите пароль"
                        />
                    </div>

                    <div style={{ textAlign: 'left' }}>
                        <label htmlFor="confirmPassword" style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: '500' }}>
                            Подтвердите пароль:
                        </label>
                        <input
                            id="confirmPassword"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                fontSize: '14px',
                                outline: 'none'
                            }}
                            placeholder="Подтвердите пароль"
                        />
                    </div>

                    <button
                        type="submit"
                        style={{
                            backgroundColor: '#3FBA55',
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
                        onMouseOver={(e) => e.target.style.backgroundColor = '#40A153'}
                        onMouseOut={(e) => e.target.style.backgroundColor = '#3FBA55'}
                    >
                        Зарегистрироваться
                    </button>
                </form>

                <p style={{
                    marginTop: '24px',
                    fontSize: '14px',
                    color: '#6B7280'
                }}>
                    Уже зарегистрированы?{' '}
                    <span
                        onClick={() => navigate('/')}
                        style={{
                            color: '#3B82F6',
                            textDecoration: 'underline',
                            cursor: 'pointer'
                        }}
                    >
            Войти
          </span>
                </p>
            </div>
        </div>
    );
}

export default Register;