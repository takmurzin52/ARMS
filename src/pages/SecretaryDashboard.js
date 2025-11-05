import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import CompetitionForm from '../components/CompetitionForm';
import TaskForm from '../components/TaskForm';
import CriteriaForm from '../components/CriteriaForm';
import TeamsManager from '../components/TeamsManager';
import MembersManager from '../components/MembersManager';

function SecretaryDashboard() {
    const [activeSection, setActiveSection] = useState('competition'); // по умолчанию — соревнование
    const [user, setUser] = useState(null);

    // Получаем данные пользователя из localStorage
    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }
    }, []);

    // Компонент для отображения текущего раздела
    const renderContent = () => {
        switch (activeSection) {
            case 'competition': return <CompetitionForm />;
            case 'task': return <TaskForm />;
            case 'criteria': return <CriteriaForm />;
            case 'teams': return <TeamsManager />;
            case 'members': return <MembersManager />;
            default: return <CompetitionForm />;
        }
    };

    return (
        <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F3F4F6', fontFamily: 'Inter, sans-serif' }}>
            {/* Боковое меню */}
            <Sidebar activeSection={activeSection} setActiveSection={setActiveSection} />

            {/* Основная область */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
                <header style={{ marginBottom: '24px' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1F2937' }}>
                        Панель секретаря
                    </h1>
                    {user && (
                        <p style={{ color: '#6B7280', fontSize: '14px' }}>
                            Привет, {user.surname} {user.name.charAt(0)}. {user.role}
                        </p>
                    )}
                </header>

                {/* Динамический контент */}
                {renderContent()}
            </div>
        </div>
    );
}

export default SecretaryDashboard;