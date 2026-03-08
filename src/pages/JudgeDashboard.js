// src/pages/JudgeDashboard.js
import React, { useState, useEffect, useCallback, useRef } from 'react';

function JudgeDashboard() {
    const [teams, setTeams] = useState([]);
    const [criteria, setCriteria] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [errors, setErrors] = useState({});
    const [savedStatus, setSavedStatus] = useState({}); // teamId → 'saved' | 'error' | 'pending' | 'unsaved'
    const [commentModal, setCommentModal] = useState({ open: false, teamId: null, value: '' });
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskData, setTaskData] = useState(null);
    const [loadingTask, setLoadingTask] = useState(false);
    const modalRef = useRef(null);

    const user = JSON.parse(localStorage.getItem('user'));
    const judgeId = user?.id;

    // Загрузка данных
    useEffect(() => {
        const fetchEvaluationData = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/judge/teams', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ judgeId })
                });
                const data = await response.json();
                setTeams(data.teams || []);
                setCriteria(data.criteria || []);

                // ДОБАВЛЕНО: используем totalScore (а не ResultsTotalScore) для инициализации статуса
                const status = {};
                data.teams?.forEach(team => {
                    status[team.id] = team.totalScore != null ? 'saved' : 'unsaved';
                });
                setSavedStatus(status);
            } catch (err) {
                showMessage('error', 'Не удалось загрузить данные');
            } finally {
                setLoading(false);
            }
        };

        if (judgeId) fetchEvaluationData();
    }, [judgeId]);

    const loadTask = async () => {
        setLoadingTask(true);
        try {
            const response = await fetch('http://localhost:5000/api/task');
            const data = await response.json();
            if (data.task) {
                setTaskData(data.task);
            } else {
                setTaskData({ TaskName: 'Задание не задано', TaskDescription: '—', TaskCustomer: '—' });
            }
        } catch (err) {
            console.error('❌ Ошибка загрузки задания:', err);
            setTaskData({ TaskName: 'Ошибка загрузки', TaskDescription: 'Не удалось загрузить задание', TaskCustomer: '' });
        } finally {
            setLoadingTask(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const updateTeamField = (teamId, field, value) => {
        setTeams(prev => prev.map(t => t.id === teamId ? { ...t, [field]: value } : t));
        if (field !== 'comment') {
            setSavedStatus(prev => ({ ...prev, [teamId]: 'unsaved' }));
        }
    };

    const updateCriteriaGrade = (teamId, critId, value) => {
        setTeams(prev => prev.map(team => {
            if (team.id !== teamId) return team;
            const newGrades = { ...team.criteriaGrades, [critId]: value };
            return { ...team, criteriaGrades: newGrades };
        }));
        setSavedStatus(prev => ({ ...prev, [teamId]: 'unsaved' }));
    };

    // ДОБАВЛЕНО: очистка ошибки при вводе (все обработчики теперь чистят свои ошибки)
    const handleGradeChange = (teamId, critId, value) => {
        updateCriteriaGrade(teamId, critId, value);

        // Очистка ошибки для этого критерия при вводе
        const errorKey = `grade-${teamId}-${critId}`;
        if (errors[errorKey]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    const handleInstructionChange = (teamId, checked) => {
        updateTeamField(teamId, 'instruction', checked);

        // Очистка ошибки для "Наличие инструкции"
        const errorKey = `instruction-${teamId}`;
        if (errors[errorKey]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    const handleCoreFuncChange = (teamId, value) => {
        updateTeamField(teamId, 'coreFunc', value);

        // Очистка ошибки для основной функциональности
        const errorKey = `core-${teamId}`;
        if (errors[errorKey]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    const handleAddFuncChange = (teamId, value) => {
        updateTeamField(teamId, 'addFunc', value);

        // Очистка ошибки для доп. функциональности
        const errorKey = `add-${teamId}`;
        if (errors[errorKey]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[errorKey];
                return newErrors;
            });
        }
    };

    const validateTeam = (team) => {
        const newErrors = {};

        // Валидация критериев — динамически по maxScore
        for (const crit of criteria) {
            const grade = team.criteriaGrades?.[crit.id];
            if (grade === '' || grade == null) {
                newErrors[`grade-${team.id}-${crit.id}`] = 'Обязательно';
            } else {
                const num = Number(grade);
                const maxScore = crit.Competition_CriteriaMaxScore; // ДОБАВЛЕНО: динамический максимум
                if (isNaN(num) || num < 0 || num > maxScore) {
                    newErrors[`grade-${team.id}-${crit.id}`] = `0–${maxScore}`; // ДОБАВЛЕНО: подстановка maxScore
                }
            }
        }

        // Валидация основной функциональности
        if (team.coreFunc === '' || team.coreFunc == null) {
            newErrors[`core-${team.id}`] = 'Обязательно';
        } else {
            const num = Number(team.coreFunc);
            if (isNaN(num) || num < 0 || num > 5) {
                newErrors[`core-${team.id}`] = '0–5';
            }
        }

        // Валидация доп. функциональности
        if (team.addFunc === '' || team.addFunc == null) {
            newErrors[`add-${team.id}`] = 'Обязательно';
        } else {
            const num = Number(team.addFunc);
            if (isNaN(num) || num < 0 || num > 5) {
                newErrors[`add-${team.id}`] = '0–5';
            }
        }

        setErrors(prev => ({ ...prev, ...newErrors }));
        return Object.keys(newErrors).length === 0;
    };

    const saveTeam = async (teamId) => {
        const team = teams.find(t => t.id === teamId);
        if (!team) return;

        if (!validateTeam(team)) {
            showMessage('error', 'Проверьте обязательные поля');
            return;
        }

        setSavedStatus(prev => ({ ...prev, [teamId]: 'pending' }));

        try {
            const response = await fetch('http://localhost:5000/api/judge/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId,
                    criteriaGrades: team.criteriaGrades,
                    instruction: team.instruction,
                    coreFunc: team.coreFunc,
                    addFunc: team.addFunc,
                    comment: team.comment,
                    judgeId
                })
            });

            if (response.ok) {
                setSavedStatus(prev => ({ ...prev, [teamId]: 'saved' }));
                showMessage('success', 'Оценка команды сохранена');
            } else {
                throw new Error('Ошибка сохранения');
            }
        } catch (err) {
            setSavedStatus(prev => ({ ...prev, [teamId]: 'error' }));
            showMessage('error', 'Не удалось сохранить оценку');
        }
    };

    const openCommentModal = (teamId, currentComment) => {
        setCommentModal({ open: true, teamId, value: currentComment || '' });
    };

    const saveComment = async () => {
        const { teamId, value } = commentModal;
        try {
            const response = await fetch('http://localhost:5000/api/judge/evaluate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId,
                    criteriaGrades: teams.find(t => t.id === teamId)?.criteriaGrades || {},
                    instruction: teams.find(t => t.id === teamId)?.instruction || false,
                    coreFunc: teams.find(t => t.id === teamId)?.coreFunc || '',
                    addFunc: teams.find(t => t.id === teamId)?.addFunc || '',
                    comment: value,
                    judgeId
                })
            });

            if (response.ok) {
                updateTeamField(teamId, 'comment', value);
                showMessage('success', 'Комментарий сохранён');
                setCommentModal({ open: false, teamId: null, value: '' });
            } else {
                throw new Error();
            }
        } catch (err) {
            showMessage('error', 'Не удалось сохранить комментарий');
        }
    };

    const closeModal = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            setCommentModal({ open: false, teamId: null, value: '' });
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Загрузка...</div>;

    return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Оценка команд</h1>

            <div style={{ marginBottom: '20px' }}>
                <button
                    type="button"
                    onClick={() => {
                        loadTask();
                        setTaskModalOpen(true);
                    }}
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
                    Посмотреть задание
                </button>
            </div>

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

            {teams.length === 0 ? (
                <p>Нет команд для оценки.</p>
            ) : (
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '800px' }}>
                        <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                                Критерии
                            </th>
                            {teams.map(team => (
                                <th key={team.id} style={{ textAlign: 'center', padding: '12px', borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                                    {team.name}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {/* Критерии */}
                        {criteria.map(crit => (
                            <tr key={crit.id}>
                                <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>{crit.CriteriaName}</td>
                                {teams.map(team => {
                                    const errorKey = `grade-${team.id}-${crit.id}`;
                                    return (
                                        <td key={`${team.id}-${crit.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                            <input
                                                type="number"
                                                min="0"
                                                max={crit.Competition_CriteriaMaxScore} // ДОБАВЛЕНО: динамический max
                                                value={team.criteriaGrades?.[crit.id] ?? ''}
                                                onChange={(e) => handleGradeChange(team.id, crit.id, e.target.value)}
                                                onBlur={() => handleGradeChange(team.id, crit.id, team.criteriaGrades?.[crit.id] ?? '')}
                                                style={{
                                                    width: '60px',
                                                    height: '36px',
                                                    padding: '0 4px 0 16px',
                                                    border: errors[errorKey] ? '1px solid #EF4444' : '1px solid #D1D5DB',
                                                    borderRadius: '4px',
                                                    textAlign: 'center',
                                                    fontSize: '14px',
                                                    lineHeight: '36px',
                                                    boxSizing: 'border-box',
                                                    appearance: 'textfield'
                                                }}
                                                onWheel={(e) => e.target.blur()}
                                            />
                                            {errors[errorKey] && (
                                                <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors[errorKey]}</div>
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}

                        {/* Итоговый процент */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', fontWeight: 'bold' }}>Итоговый процент</td>
                            {teams.map(team => {
                                const total = Object.values(team.criteriaGrades || {}).reduce((sum, g) => sum + (Number(g) || 0), 0);
                                return (
                                    <td key={`total-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                        {total || '—'}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* Инструкция */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>Наличие инструкции</td>
                            {teams.map(team => (
                                <td key={`instr-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                    <input
                                        type="checkbox"
                                        checked={team.instruction}
                                        onChange={(e) => handleInstructionChange(team.id, e.target.checked)}
                                        style={{ width: '16px', height: '16px' }}
                                    />
                                </td>
                            ))}
                        </tr>

                        {/* Основная функциональность */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>Основная функциональность (0–5)</td>
                            {teams.map(team => {
                                const errorKey = `core-${team.id}`;
                                return (
                                    <td key={`core-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            max="5"
                                            value={team.coreFunc ?? ''}
                                            onChange={(e) => handleCoreFuncChange(team.id, e.target.value)}
                                            style={{
                                                width: '60px',
                                                height: '36px',
                                                padding: '0 4px 0 16px',
                                                border: errors[errorKey] ? '1px solid #EF4444' : '1px solid #D1D5DB',
                                                borderRadius: '4px',
                                                textAlign: 'center',
                                                fontSize: '14px',
                                                lineHeight: '36px',
                                                boxSizing: 'border-box',
                                                appearance: 'textfield'
                                            }}
                                            onWheel={(e) => e.target.blur()}
                                        />
                                        {errors[errorKey] && (
                                            <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors[errorKey]}</div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* Доп. функциональность */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>Доп. функциональность (0–5)</td>
                            {teams.map(team => {
                                const errorKey = `add-${team.id}`;
                                return (
                                    <td key={`add-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                        <input
                                            type="number"
                                            min="0"
                                            max="5"
                                            value={team.addFunc ?? ''}
                                            onChange={(e) => handleAddFuncChange(team.id, e.target.value)}
                                            style={{
                                                width: '60px',
                                                height: '36px',
                                                padding: '0 4px 0 16px',
                                                border: errors[errorKey] ? '1px solid #EF4444' : '1px solid #D1D5DB',
                                                borderRadius: '4px',
                                                textAlign: 'center',
                                                fontSize: '14px',
                                                lineHeight: '36px',
                                                boxSizing: 'border-box',
                                                appearance: 'textfield'
                                            }}
                                            onWheel={(e) => e.target.blur()}
                                        />
                                        {errors[errorKey] && (
                                            <div style={{ fontSize: '12px', color: '#EF4444', marginTop: '4px' }}>{errors[errorKey]}</div>
                                        )}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* Итоговая оценка */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', fontWeight: 'bold' }}>Итоговая оценка</td>
                            {teams.map(team => (
                                <td key={`final-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                    —
                                </td>
                            ))}
                        </tr>

                        {/* Комментарий */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>Комментарий</td>
                            {teams.map(team => (
                                <td key={`comment-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => openCommentModal(team.id, team.comment)}
                                        style={{
                                            background: 'none',
                                            border: '1px solid #D1D5DB',
                                            borderRadius: '4px',
                                            padding: '4px 8px',
                                            cursor: 'pointer',
                                            fontSize: '14px'
                                        }}
                                    >
                                        {team.comment?.trim() ? '✎' : '➕'}
                                    </button>
                                </td>
                            ))}
                        </tr>

                        {/* Кнопка "Сохранить" — под каждой командой */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td>
                            {teams.map(team => {
                                const status = savedStatus[team.id] || 'unsaved';
                                let btnText, btnStyle;
                                switch (status) {
                                    case 'saved':
                                        btnText = 'Сохранено';
                                        btnStyle = { backgroundColor: '#10B981', color: 'white' };
                                        break;
                                    case 'pending':
                                        btnText = 'Сохранение...';
                                        btnStyle = { backgroundColor: '#6B7280', color: 'white', cursor: 'not-allowed' };
                                        break;
                                    case 'error':
                                        btnText = 'Ошибка';
                                        btnStyle = { backgroundColor: '#EF4444', color: 'white' };
                                        break;
                                    default:
                                        btnText = 'Сохранить';
                                        btnStyle = { backgroundColor: '#4F46E5', color: 'white' };
                                }

                                return (
                                    <td key={`save-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                        <button
                                            type="button"
                                            onClick={() => saveTeam(team.id)}
                                            disabled={status === 'pending'}
                                            style={{
                                                ...btnStyle,
                                                border: 'none',
                                                padding: '6px 12px',
                                                borderRadius: '4px',
                                                cursor: status === 'pending' ? 'not-allowed' : 'pointer',
                                                fontSize: '14px'
                                            }}
                                        >
                                            {btnText}
                                        </button>
                                    </td>
                                );
                            })}
                        </tr>
                        </tbody>
                    </table>
                </div>
            )}

            {/* Модальное окно комментария */}
            {commentModal.open && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000
                    }}
                    onClick={closeModal}
                >
                    <div
                        ref={modalRef}
                        style={{
                            backgroundColor: 'white',
                            padding: '20px',
                            borderRadius: '8px',
                            width: '400px',
                            maxWidth: '90vw'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 style={{ margin: 0, fontSize: '18px', marginBottom: '12px' }}>Комментарий</h3>
                        <textarea
                            value={commentModal.value}
                            onChange={(e) => setCommentModal(prev => ({ ...prev, value: e.target.value }))}
                            rows="4"
                            style={{
                                width: '100%',
                                padding: '8px 16px',
                                border: '1px solid #D1D5DB',
                                borderRadius: '4px',
                                resize: 'vertical',
                                fontSize: '14px',
                                boxSizing: 'border-box'
                            }}
                        />
                        <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                            <button
                                onClick={saveComment}
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
                                Сохранить
                            </button>
                            <button
                                onClick={() => setCommentModal({ open: false, teamId: null, value: '' })}
                                style={{
                                    backgroundColor: '#F3F4F6',
                                    color: '#4B5563',
                                    border: '1px solid #D1D5DB',
                                    padding: '8px 16px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '14px'
                                }}
                            >
                                Отмена
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Модальное окно задания */}
            {taskModalOpen && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        backgroundColor: 'rgba(0,0,0,0.5)',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        zIndex: 1000
                    }}
                    onClick={() => setTaskModalOpen(false)}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            padding: '24px',
                            borderRadius: '8px',
                            width: '600px',
                            maxWidth: '90vw',
                            maxHeight: '80vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 style={{ margin: 0, fontSize: '20px', marginBottom: '16px' }}>
                            {loadingTask ? 'Загрузка...' : taskData?.TaskName || 'Задание'}
                        </h2>

                        {loadingTask ? (
                            <p>Загрузка задания...</p>
                        ) : (
                            <>
                                <div style={{ marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Описание</h3>
                                    <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{taskData.TaskDescription}</p>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Заказчик</h3>
                                    <p>{taskData.TaskCustomer}</p>
                                </div>
                            </>
                        )}

                        <div style={{ marginTop: '20px', textAlign: 'right' }}>
                            <button
                                type="button"
                                onClick={() => setTaskModalOpen(false)}
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
                                Закрыть
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default JudgeDashboard;