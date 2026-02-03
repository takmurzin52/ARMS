import React from 'react';

function Sidebar({ activeSection, setActiveSection }) {
    const menuItems = [
        { id: 'competition', label: '1) Соревнование' },
        { id: 'task', label: '2) Задание' },
        { id: 'criteria', label: '3) Критерии' },
        { id: 'teams', label: '4) Команды' },
        { id: 'members', label: '5) Участники' },
    ];

    return (
        <div style={{
            width: '220px',
            backgroundColor: 'white',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            padding: '24px 0'
        }}>
            <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveSection(item.id)}
                        style={{
                            width: '100%',
                            padding: '12px 24px',
                            textAlign: 'left',
                            backgroundColor: activeSection === item.id ? '#EEF2FF' : 'transparent',
                            color: activeSection === item.id ? '#4F46E5' : '#4B5563',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: activeSection === item.id ? '600' : 'normal',
                            fontSize: '16px',
                            outline: 'none',
                            transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                            if (activeSection !== item.id) e.target.style.backgroundColor = '#F9FAFB';
                        }}
                        onMouseLeave={(e) => {
                            if (activeSection !== item.id) e.target.style.backgroundColor = 'transparent';
                        }}
                    >
                        {item.label}
                    </button>
                ))}
            </nav>
        </div>
    );
}

export default Sidebar;