import React, { useState, useEffect } from 'react';

export default function CompetitionForm() {
    const [formData, setFormData] = useState({
        CompetitionName: '',
        CompetitionStartDate: '',
        CompetitionEndDate: ''
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    // Загрузка существующего соревнования
    useEffect(() => {
        const fetchCompetition = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/competition');
                const data = await response.json();
                if (data.competition) {
                    setFormData({
                        CompetitionName: data.competition.CompetitionName || '',
                        CompetitionStartDate: data.competition.CompetitionStartDate || '',
                        CompetitionEndDate: data.competition.CompetitionEndDate || ''
                    });
                }
            } catch (err) {
                showMessage('error', 'Не удалось загрузить данные соревнования');
            } finally {
                setLoading(false);
            }
        };

        fetchCompetition();
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
        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await fetch('http://localhost:5000/api/competition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (response.ok) {
                showMessage('success', data.message);
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

    return (
        <div>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Создание соревнования</h2>

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
                    <label htmlFor="CompetitionName" style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Название соревнования *
                    </label>
                    <input
                        id="CompetitionName"
                        name="CompetitionName"
                        type="text"
                        value={formData.CompetitionName}
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
                    <label htmlFor="CompetitionStartDate" style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Дата начала *
                    </label>
                    <input
                        id="CompetitionStartDate"
                        name="CompetitionStartDate"
                        type="date"
                        value={formData.CompetitionStartDate}
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
                    <label htmlFor="CompetitionEndDate" style={{ display: 'block', marginBottom: '4px', fontWeight: '500' }}>
                        Дата окончания *
                    </label>
                    <input
                        id="CompetitionEndDate"
                        name="CompetitionEndDate"
                        type="date"
                        value={formData.CompetitionEndDate}
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
                    {saving ? 'Сохранение...' : 'Сохранить соревнование'}
                </button>
            </form>
        </div>
    );
}