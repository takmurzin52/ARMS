// src/components/MembersManager.js
import React, { useState, useEffect, useCallback } from 'react';

export default function MembersManager() {
    const [teams, setTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState('');
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [hasCompetition, setHasCompetition] = useState(true);
    const [newMember, setNewMember] = useState({
        surname: '',
        name: '',
        email: '',
        role: ''
    });

    // Загрузка списка команд
    const loadTeams = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5000/api/teams/simple');
            const data = await response.json();
            setTeams(data.teams);
            setHasCompetition(data.hasCompetition);

            if (data.teams.length > 0) {
                setSelectedTeamId(String(data.teams[0].idTeam));
            }
        } catch (err) {
            showMessage('error', 'Не удалось загрузить команды');
        }
    }, []);

    // Загрузка участников выбранной команды
    const loadMembers = useCallback(async (teamId) => {
        if (!teamId) return;

        try {
            const response = await fetch(`http://localhost:5000/api/members?teamId=${teamId}`);
            const data = await response.json();
            setMembers(data.members);
        } catch (err) {
            showMessage('error', 'Не удалось загрузить участников');
        }
    }, []);

    useEffect(() => {
        loadTeams();
    }, [loadTeams]);

    useEffect(() => {
        if (selectedTeamId) {
            loadMembers(selectedTeamId);
        }
    }, [selectedTeamId, loadMembers]);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const handleTeamChange = (e) => {
        setSelectedTeamId(e.target.value);
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        const { surname, name, email, role } = newMember;
        if (!surname || !name || !email || !role) {
            return showMessage('error', 'Заполните все поля');
        }

        setSaving(true);
        try {
            const response = await fetch('http://localhost:5000/api/members', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    MembersSurname: surname,
                    MembersName: name,
                    MembersEmail: email,
                    MembersRole: role,
                    Team_idTeam: selectedTeamId
                })
            });
            const data = await response.json();
            if (response.ok) {
                setMembers(prev => [...prev, data.member]);
                setNewMember({ surname: '', name: '', email: '', role: '' });
                showMessage('success', data.message);
            } else {
                showMessage('error', data.error || 'Ошибка при добавлении');
            }
        } catch (err) {
            showMessage('error', 'Нет связи с сервером');
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteMember = async (id, name) => {
        if (!window.confirm(`Удалить участника "${name}"?`)) return;

        setSaving(true);
        try {
            const response = await fetch(`http://localhost:5000/api/members/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setMembers(prev => prev.filter(m => m.idMembers !== id));
                showMessage('success', 'Участник удалён');
            } else {
                showMessage('error', 'Ошибка при удалении');
            }
        } catch (err) {
            showMessage('error', 'Нет связи с сервером');
        } finally {
            setSaving(false);
        }
    };

    const handleInputChange = (field, value) => {
        setNewMember(prev => ({ ...prev, [field]: value }));
    };

    /* if (loading && teams.length === 0) return <div style={{ padding: '20px' }}>Загрузка...</div>; */
    if (!hasCompetition) return <div style={{ padding: '20px', color: '#EF4444' }}>❗ Создайте соревнование.</div>;
    if (teams.length === 0) return <div style={{ padding: '20', color: '#9CA3AF' }}>❗ Сначала добавьте команды в разделе «Команды».</div>;

    return (
        <div>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Участники</h2>

            {message.text && (
                <div style={{
                    padding: '12px',
                    marginBottom: '16px',
                    borderRadius: '4px',
                    backgroundColor: message.type === 'success' ? '#ECFDF5' : '#FEF2F2',
                    color: message.type === 'success' ? '#065F46' : '#DC2626',
                    fontSize: '14px'
                }}>
                    {message.text}
                </div>
            )}

            {/* Выбор команды */}
            <div style={{ marginBottom: '24px' }}>
                <label htmlFor="teamSelect" style={{ display: 'block', marginBottom: '6px', fontWeight: '500' }}>
                    Выберите команду:
                </label>
                <select
                    id="teamSelect"
                    value={selectedTeamId || ''}
                    onChange={handleTeamChange}
                    style={{
                        width: '100%',
                        padding: '8px 12px',
                        border: '1px solid #D1D5DB',
                        borderRadius: '4px',
                        fontSize: '14px'
                    }}
                >
                    {teams.map(team => (
                        <option key={team.idTeam} value={team.idTeam}>
                            {team.TeamName}
                        </option>
                    ))}
                </select>
            </div>

            {/* Форма добавления */}
            <form onSubmit={handleAddMember} style={{
                marginBottom: '24px',
                padding: '20px',
                border: '1px solid #E5E7EB',
                borderRadius: '8px',
                backgroundColor: '#F9FAFB'
            }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', marginTop: '3px', marginBottom: '16px' }}>Добавить участника</h3>

                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '16px',
                    marginBottom: '20px'
                }}>
                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#4B5563'
                        }}>
                            Фамилия
                        </label>
                        <input
                            type="text"
                            value={newMember.surname}
                            onChange={(e) => handleInputChange('surname', e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#4B5563'
                        }}>
                            Имя
                        </label>
                        <input
                            type="text"
                            value={newMember.name}
                            onChange={(e) => handleInputChange('name', e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#4B5563'
                        }}>
                            Email
                        </label>
                        <input
                            type="email"
                            value={newMember.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>

                    <div>
                        <label style={{
                            display: 'block',
                            marginBottom: '6px',
                            fontSize: '14px',
                            fontWeight: '500',
                            color: '#4B5563'
                        }}>
                            Роль в команде
                        </label>
                        <input
                            type="text"
                            value={newMember.role}
                            onChange={(e) => handleInputChange('role', e.target.value)}
                            placeholder="Капитан, разработчик и т.д."
                            required
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '6px',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            backgroundColor: saving ? '#A5B4FC' : '#4F46E5',
                            color: 'white',
                            border: 'none',
                            padding: '10px 24px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: '500',
                            fontSize: '14px',
                            transition: 'background-color 0.2s',
                            marginBottom: '3px'
                        }}
                    >
                        {saving ? 'Добавление...' : 'Добавить участника'}
                    </button>
                </div>
            </form>

            {/* Таблица участников */}
            {members.length === 0 ? (
                <p style={{ color: '#6B7280' }}>Нет участников. Добавьте первого.</p>
            ) : (
                <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                        Участники команды "{teams.find(t => String(t.idTeam) === selectedTeamId)?.TeamName}"
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>ФИО</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>Email</th>
                            <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>Роль</th>
                            <th style={{ textAlign: 'center', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>Действия</th>
                        </tr>
                        </thead>
                        <tbody>
                        {members.map(member => (
                            <tr key={member.idMembers} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                <td style={{ padding: '10px' }}>{member.MembersSurname} {member.MembersName}</td>
                                <td style={{ padding: '10px' }}>{member.MembersEmail}</td>
                                <td style={{ padding: '10px' }}>{member.MembersRole}</td> {/* ← СТАТИЧНЫЙ ТЕКСТ */}
                                <td style={{ padding: '10px', textAlign: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteMember(member.idMembers, `${member.MembersSurname} ${member.MembersName}`)}
                                        disabled={saving}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            color: '#EF4444',
                                            cursor: 'pointer',
                                            fontSize: '18px'
                                        }}
                                    >
                                        ❌
                                    </button>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}