import React, { useState, useEffect } from 'react';

export default function TaskForm() {
    const [formData, setFormData] = useState({
        TaskName: '',
        TaskDescription: '',
        TaskCustomer: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [hasActiveTask, setHasActiveTask] = useState(false);
    const [competitionExists, setCompetitionExists] = useState(true);
    const [competitionId, setCompetitionId] = useState(null);

    // Загрузка активного соревнования + задания при открытии
    useEffect(() => {
        const fetchTask = async () => {
            try {
                // 1. Получаем активное соревнование
                const compRes = await fetch('http://localhost:5000/api/competition');
                const compData = await compRes.json();

                if (!compData.competition) {
                    setCompetitionExists(false);
                    setLoading(false);
                    return;
                }

                setCompetitionId(compData.competition.idCompetition);
                setCompetitionExists(true);

                // 2. Получаем задание для этого соревнования
                const taskRes = await fetch('http://localhost:5000/api/task');
                const taskData = await taskRes.json();

                if (taskData.task) {
                    setFormData({
                        TaskName: taskData.task.TaskName || '',
                        TaskDescription: taskData.task.TaskDescription || '',
                        TaskCustomer: taskData.task.TaskCustomer || ''
                    });
                    setHasActiveTask(true);
                } else {
                    setHasActiveTask(false);
                }
            } catch (err) {
                showMessage('error', 'Не удалось загрузить задание');
            } finally {
                setLoading(false);
            }
        };

        fetchTask();
    }, []);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!competitionId) {
            return showMessage('error', 'Нет активного соревнования');
        }

        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await fetch('http://localhost:5000/api/task', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, competitionId })
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('success', data.message);
                if (data.action === 'create') {
                    setHasActiveTask(true);
                }
            } else {
                showMessage('error', data.error || 'Ошибка при сохранении');
            }
        } catch (err) {
            showMessage('error', 'Нет связи с сервером');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div style={{ padding: '20px' }}>Загрузка...</div>;
    }

    if (!competitionExists) {
        return (
            <div style={{ padding: '20px', color: '#EF4444' }}>
                ❗ Сначала создайте <strong>соревнование</strong> во вкладке «Соревнование».
            </div>
        );
    }

    return (
        <div>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>
                {hasActiveTask ? 'Редактирование задания' : 'Создание задания'}
            </h2>

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

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                    <label htmlFor="TaskName" style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Название задания *
                    </label>
                    <input
                        id="TaskName"
                        name="TaskName"
                        type="text"
                        value={formData.TaskName}
                        onChange={handleChange}
                        required
                        style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px'
                        }}
                    />
                </div>

                <div>
                    <label htmlFor="TaskCustomer" style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Заказчик *
                    </label>
                    <input
                        id="TaskCustomer"
                        name="TaskCustomer"
                        type="text"
                        value={formData.TaskCustomer}
                        onChange={handleChange}
                        required
                        style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px'
                        }}
                    />
                </div>

                <div>
                    <label htmlFor="TaskDescription" style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Описание задания *
                    </label>
                    <textarea
                        id="TaskDescription"
                        name="TaskDescription"
                        value={formData.TaskDescription}
                        onChange={handleChange}
                        required
                        rows="6"
                        style={{
                            width: '100%',
                            padding: '10px',
                            border: '1px solid #D1D5DB',
                            borderRadius: '4px',
                            resize: 'vertical',
                            fontSize: '14px'
                        }}
                    />
                </div>

                <button
                    type="submit"
                    disabled={saving}
                    style={{
                        backgroundColor: saving ? '#A5B4FC' : '#4F46E5',
                        color: 'white',
                        border: 'none',
                        padding: '12px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '16px',
                        marginTop: '16px'
                    }}
                >
                    {saving ? 'Сохранение...' : hasActiveTask ? 'Сохранить изменения' : 'Создать задание'}
                </button>
            </form>
        </div>
    );
}