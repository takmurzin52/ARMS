import React, { useState, useEffect, useCallback } from 'react';

export default function CriteriaForm() {
    const [criteria, setCriteria] = useState([]); // существующие критерии (с id)
    const [newCriteriaInput, setNewCriteriaInput] = useState('');
    const [newCriteriaList, setNewCriteriaList] = useState([]); // новые (только названия)
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [hasCompetition, setHasCompetition] = useState(true);

    const loadCriteria = useCallback(async () => {
        try {
            const response = await fetch('http://localhost:5000/api/criteria');
            const data = await response.json();

            setCriteria(data.criteria.map(c => ({
                id: c.idCriteria,
                name: c.CriteriaName,
                maxScore: c.maxScore != null ? String(c.maxScore) : '',
                weight: c.weight === 1 || c.weight === '1' || c.weight === true
            })));
            setHasCompetition(data.hasCompetition);
        } catch (err) {
            console.error('❌ Ошибка загрузки критериев:', err);
            showMessage('error', 'Не удалось загрузить критерии');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCriteria(); }, [loadCriteria]);

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const handleInputChange = (index, field, value) => {
        const updated = [...criteria];
        if (field === 'maxScore') {
            const num = value === '' ? '' : Math.min(100, Math.max(1, parseInt(value))) || '';
            updated[index] = { ...updated[index], maxScore: String(num) };
        } else if (field === 'weight') {
            updated[index] = { ...updated[index], weight: value };
        }
        setCriteria(updated);
    };

    const handleAddNewCriteria = () => {
        const name = newCriteriaInput.trim();
        if (!name) return;
        setNewCriteriaList(prev => [...prev, name]);
        setNewCriteriaInput('');
    };

    const handleRemoveNewCriteria = (index) => {
        setNewCriteriaList(prev => prev.filter((_, i) => i !== index));
    };

    const handleRemoveExisting = async (id, index) => {
        if (!window.confirm('Удалить критерий? Все данные по нему будут потеряны.')) return;

        try {
            const response = await fetch(`http://localhost:5000/api/criteria/${id}`, { method: 'DELETE' });
            if (response.ok) {
                await loadCriteria();
                showMessage('success', 'Критерий удалён');
            } else {
                showMessage('error', 'Ошибка при удалении');
            }
        } catch (err) {
            showMessage('error', 'Нет связи с сервером');
        }
    };

    const totalScore = criteria.reduce((sum, c) => sum + (parseInt(c.maxScore) || 0), 0);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!hasCompetition) return showMessage('error', 'Сначала создайте соревнование');

        if (newCriteriaList.length === 0 && criteria.length === 0) {
            return showMessage('error', 'Добавьте хотя бы один критерий');
        }

        // Если есть только новые — сохраняем без проверки суммы
        if (criteria.length === 0 && newCriteriaList.length > 0) {
            // OK — можно сохранять
        } else if (criteria.length > 0) {
            // Если есть существующие — проверяем сумму
            if (totalScore !== 100) {
                return showMessage('error', `Сумма баллов должна быть 100. Сейчас: ${totalScore}`);
            }
        }

        setSaving(true);
        setMessage({ type: '', text: '' });

        try {
            const response = await fetch('http://localhost:5000/api/criteria', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    criteria: criteria.map(c => ({
                        id: c.id,
                        name: c.name,
                        maxScore: c.maxScore,
                        weight: c.weight
                    })),
                    newCriteria: newCriteriaList
                })
            });

            const data = await response.json();
            if (response.ok) {
                showMessage('success', data.message);
                setNewCriteriaList([]);
                await loadCriteria();
            } else {
                showMessage('error', data.error || 'Ошибка при сохранении');
            }
        } catch (err) {
            console.error('❌ Ошибка сохранения:', err);
            showMessage('error', 'Нет связи с сервером');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Загрузка...</div>;
    if (!hasCompetition) return <div style={{ padding: '20px', color: '#EF4444' }}>❗ Создайте соревнование.</div>;

    return (
        <div>
            <h2 style={{ fontSize: '20px', marginBottom: '16px' }}>Критерии оценки</h2>

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

            <form onSubmit={handleSubmit}>
                {/* Общие критерии */}
                <div style={{ marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>Общие критерии</h3>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                        <input
                            type="text"
                            value={newCriteriaInput}
                            onChange={(e) => setNewCriteriaInput(e.target.value)}
                            placeholder="Название критерия"
                            style={{
                                flex: 1,
                                padding: '8px 12px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px'
                            }}
                        />
                        <button
                            type="button"
                            onClick={handleAddNewCriteria}
                            style={{
                                backgroundColor: '#4F46E5',
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

                    {/* Новые критерии */}
                    {newCriteriaList.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>Новые критерии:</p>
                            {newCriteriaList.map((name, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    padding: '6px 12px',
                                    backgroundColor: '#DBEAFE',
                                    borderRadius: '4px',
                                    marginBottom: '6px',
                                    borderLeft: '4px solid #4F46E5'
                                }}>
                                    <span>{name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveNewCriteria(i)}
                                        style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '18px' }}
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Существующие критерии */}
                    {criteria.length > 0 && (
                        <div>
                            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>Существующие критерии:</p>
                            {criteria.map((crit, i) => (
                                <div key={crit.id} style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    marginBottom: '8px',
                                    padding: '6px 12px',
                                    backgroundColor: '#F9FAFB',
                                    borderRadius: '4px',
                                    borderLeft: '4px solid #D1D5DB'
                                }}>
                                    <span style={{ flex: 1 }}>{crit.name}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveExisting(crit.id, i)}
                                        style={{ background: 'none', border: 'none', color: '#EF4444', fontSize: '18px' }}
                                    >
                                        &times;
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {criteria.length === 0 && newCriteriaList.length === 0 && (
                        <p style={{ color: '#9CA3AF' }}>Нет критериев. Добавьте новый выше.</p>
                    )}
                </div>

                {/* Параметры */}
                <div>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>
                        Параметры для текущего соревнования
                        {criteria.length > 0 && (
                            <span style={{ fontSize: '14px', color: '#6B7280', marginLeft: '8px' }}>
                (сумма: <strong style={{ color: totalScore === 100 ? '#10B981' : '#EF4444' }}>{totalScore}/100</strong>)
              </span>
                        )}
                    </h3>

                    {criteria.length === 0 && newCriteriaList.length > 0 && (
                        <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '12px' }}>
                            После сохранения новые критерии появятся здесь, и вы сможете задать параметры.
                        </p>
                    )}

                    {criteria.length === 0 && newCriteriaList.length === 0 && (
                        <p style={{ color: '#9CA3AF' }}>Добавьте критерии, чтобы задать параметры.</p>
                    )}

                    {criteria.length > 0 && (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>Критерий</th>
                                <th style={{ textAlign: 'center', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>Макс. балл (1–100)</th>
                                <th style={{ textAlign: 'center', padding: '8px', borderBottom: '2px solid #E5E7EB' }}>Тип</th>
                            </tr>
                            </thead>
                            <tbody>
                            {criteria.map((crit, i) => (
                                <tr key={crit.id}>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>{crit.name}</td>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                        <input
                                            type="number"
                                            min="1"
                                            max="100"
                                            value={crit.maxScore}
                                            onChange={(e) => handleInputChange(i, 'maxScore', e.target.value)}
                                            style={{
                                                width: '80px',
                                                padding: '6px',
                                                border: '1px solid #D1D5DB',
                                                borderRadius: '4px',
                                                textAlign: 'center'
                                            }}
                                        />
                                    </td>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={crit.weight}
                                                onChange={(e) => handleInputChange(i, 'weight', e.target.checked)}
                                                style={{ width: '16px', height: '16px' }}
                                            />
                                            <span style={{ fontSize: '14px' }}>
                          {crit.weight ? 'Обязательный' : 'Дополнительный'}
                        </span>
                                        </label>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    )}

                    {criteria.length > 0 && totalScore !== 100 && (
                        <div style={{ marginTop: '12px', padding: '10px', backgroundColor: '#FEF2F2', borderRadius: '4px', color: '#DC2626', fontSize: '14px' }}>
                            ⚠️ Сумма баллов должна быть ровно 100 для сохранения.
                        </div>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={
                        saving ||
                        (newCriteriaList.length === 0 && criteria.length === 0) ||
                        (criteria.length > 0 && totalScore !== 100)
                    }
                    style={{
                        backgroundColor: (
                            saving ||
                            (newCriteriaList.length === 0 && criteria.length === 0) ||
                            (criteria.length > 0 && totalScore !== 100)
                        ) ? '#D1D5DB' : '#4F46E5',
                        color: 'white',
                        border: 'none',
                        padding: '12px 24px',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '16px',
                        marginTop: '20px'
                    }}
                >
                    {saving ? 'Сохранение...' : 'Сохранить критерии'}
                </button>
            </form>
        </div>
    );
}