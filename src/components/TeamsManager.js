import React, { useState, useEffect, useCallback } from 'react';

export default function TeamsManager() {
    const [teams, setTeams] = useState([]);
    const [newTeamName, setNewTeamName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingValue, setEditingValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [hasCompetition, setHasCompetition] = useState(true);

    const loadTeams = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5000/api/teams');
            const data = await response.json();
            setTeams(data.teams);
            setHasCompetition(data.hasCompetition);
        } catch (err) {
            showMessage('error', 'Не удалось загрузить команды');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadTeams(); }, [loadTeams]);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const handleAddTeam = async (e) => {
        e.preventDefault();
        if (!newTeamName.trim()) return;

        setSaving(true);
        try {
            const response = await fetch('http://localhost:5000/api/teams', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ TeamName: newTeamName.trim() })
            });
            const data = await response.json();
            if (response.ok) {
                setTeams(prev => [...prev, data.team]);
                setNewTeamName('');
                showMessage('success', data.message);
            } else {
                showMessage('error', data.error || 'Ошибка при создании');
            }
        } catch (err) {
            showMessage('error', 'Нет связи с сервером');
        } finally {
            setSaving(false);
        }
    };

    const handleEditStart = (id, name) => {
        setEditingId(id);
        setEditingValue(name);
    };

    const handleEditSave = async (id) => {
        if (!editingValue.trim()) {
            showMessage('error', 'Название не может быть пустым');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(`http://localhost:5000/api/teams/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ TeamName: editingValue.trim() })
            });
            if (response.ok) {
                setTeams(prev => prev.map(t => t.idTeam === id ? { ...t, TeamName: editingValue.trim() } : t));
                showMessage('success', 'Команда обновлена');
            } else {
                showMessage('error', 'Ошибка при обновлении');
            }
        } catch (err) {
            showMessage('error', 'Нет связи с сервером');
        } finally {
            setEditingId(null);
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!window.confirm(`Удалить команду "${name}"? Все связанные данные будут потеряны.`)) return;

        setSaving(true);
        try {
            const response = await fetch(`http://localhost:5000/api/teams/${id}`, { method: 'DELETE' });
            if (response.ok) {
                setTeams(prev => prev.filter(t => t.idTeam !== id));
                showMessage('success', 'Команда удалена');
            } else {
                showMessage('error', 'Ошибка при удалении');
            }
        } catch (err) {
            showMessage('error', 'Нет связи с сервером');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Загрузка...</div>;
    if (!hasCompetition) return <div style={{ padding: '20px', color: '#EF4444' }}>❗ Создайте соревнование.</div>;

    return (
        <div>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Команды</h2>

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

            {/* Форма добавления */}
            <form onSubmit={handleAddTeam} style={{ marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                        type="text"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        placeholder="Название команды"
                        style={{
                            flex: 1,
                            padding: '8px 12px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px'
                        }}
                    />
                    <button
                        type="submit"
                        disabled={saving || !newTeamName.trim()}
                        style={{
                            backgroundColor: (!newTeamName.trim() || saving) ? '#D1D5DB' : '#4F46E5',
                            color: 'white',
                            border: 'none',
                            padding: '8px 16px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}
                    >
                        +
                    </button>
                </div>
            </form>

            {/* Таблица команд */}
            {teams.length === 0 ? (
                <p style={{ color: '#6B7280' }}>Нет команд. Добавьте первую.</p>
            ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                    <tr>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>ID</th>
                        <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>Название</th>
                        <th style={{ textAlign: 'center', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>Действия</th>
                    </tr>
                    </thead>
                    <tbody>
                    {teams.map(team => (
                        <tr key={team.idTeam} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '10px' }}>{team.idTeam}</td>
                            <td style={{ padding: '10px' }}>
                                {editingId === team.idTeam ? (
                                    <div style={{ display: 'flex', gap: '6px' }}>
                                        <input
                                            type="text"
                                            value={editingValue}
                                            onChange={(e) => setEditingValue(e.target.value)}
                                            autoFocus
                                            style={{
                                                padding: '6px',
                                                border: '1px solid #4F46E5',
                                                borderRadius: '4px',
                                                fontSize: '14px'
                                            }}
                                            onBlur={() => handleEditSave(team.idTeam)}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') handleEditSave(team.idTeam);
                                                if (e.key === 'Escape') setEditingId(null);
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleEditSave(team.idTeam)}
                                            style={{
                                                background: '#4F46E5',
                                                color: 'white',
                                                border: 'none',
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '12px'
                                            }}
                                        >
                                            ✓
                                        </button>
                                    </div>
                                ) : (
                                    <span
                                        onClick={() => handleEditStart(team.idTeam, team.TeamName)}
                                        style={{
                                            cursor: 'pointer',
                                            padding: '2px 4px',
                                            borderRadius: '2px'
                                        }}
                                        onMouseEnter={(e) => e.target.style.backgroundColor = '#EEF2FF'}
                                        onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                                    >
                      {team.TeamName}
                    </span>
                                )}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>
                                <button
                                    type="button"
                                    onClick={() => handleDelete(team.idTeam, team.TeamName)}
                                    disabled={saving}
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#EF4444',
                                        cursor: 'pointer',
                                        fontSize: '18px',
                                        lineHeight: 1
                                    }}
                                    title="Удалить"
                                >
                                    ❌
                                </button>
                            </td>
                        </tr>
                    ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}