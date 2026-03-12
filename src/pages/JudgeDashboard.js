// src/pages/JudgeDashboard.js
import React, { useState, useEffect, useRef } from 'react';

function JudgeDashboard() {
    const [teams, setTeams] = useState([]);
    const [criteria, setCriteria] = useState([]);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [errors, setErrors] = useState({});
    const [savedStatus, setSavedStatus] = useState({});
    const [commentModal, setCommentModal] = useState({ open: false, teamId: null, teamName: '', value: '' });
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [taskData, setTaskData] = useState(null);
    const [loadingTask, setLoadingTask] = useState(false);
    const [expandedDescriptions, setExpandedDescriptions] = useState({});
    const [calculationModal, setCalculationModal] = useState({ open: false, teamId: null, details: null });
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

                // Используем totalScore (а не ResultsTotalScore) для инициализации статуса
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

    // Группировка критериев по типу (обязательные/дополнительные)
    const getGroupedCriteria = () => {
        const mandatory = [];
        const optional = [];

        criteria.forEach(crit => {
            // weight = 1 - обязательный, weight = 0 - дополнительный
            if (crit.Competition_CriteriaWeight === 1) {
                mandatory.push(crit);
            } else {
                optional.push(crit);
            }
        });

        return { mandatory, optional };
    };

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

    // ДОБАВЛЕНО: очистка ошибки при вводе
    const handleGradeChange = (teamId, critId, value) => {
        updateCriteriaGrade(teamId, critId, value);
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

        for (const crit of criteria) {
            const grade = team.criteriaGrades?.[crit.id];
            if (grade === '' || grade == null) {
                newErrors[`grade-${team.id}-${crit.id}`] = 'Обязательно';
            } else {
                const num = Number(grade);
                const maxScore = crit.Competition_CriteriaMaxScore;
                if (isNaN(num) || num < 0 || num > maxScore) {
                    newErrors[`grade-${team.id}-${crit.id}`] = `0–${maxScore}`;
                }
            }
        }

        if (team.coreFunc === '' || team.coreFunc == null) {
            newErrors[`core-${team.id}`] = 'Обязательно';
        } else {
            const num = Number(team.coreFunc);
            if (isNaN(num) || num < 0 || num > 5) {
                newErrors[`core-${team.id}`] = '0–5';
            }
        }

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

        // Вычисляем итоговую оценку
        const { finalGrade } = calculateFinalGrade(team, criteria);

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
                    finalGrade,
                    judgeId
                })
            });

            if (response.ok) {
                // Обновляем локально
                setTeams(prev => prev.map(t =>
                    t.id === teamId ? { ...t, finalGrade } : t
                ));
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

    const openCommentModal = (teamId, teamName, currentComment) => {
        setCommentModal({
            open: true,
            teamId,
            teamName,
            value: currentComment || ''
        });
    };

    const saveComment = async () => {
        const { teamId, value } = commentModal;
        try {
            const response = await fetch('http://localhost:5000/api/judge/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    teamId,
                    comment: value,
                    judgeId
                })
            });

            if (response.ok) {
                updateTeamField(teamId, 'comment', value);
                showMessage('success', 'Комментарий сохранён');
                setCommentModal({ open: false, teamId: null, teamName: '', value: '' });
            } else {
                throw new Error();
            }
        } catch (err) {
            showMessage('error', 'Не удалось сохранить комментарий');
        }
    };

    const closeModal = (e) => {
        if (modalRef.current && !modalRef.current.contains(e.target)) {
            setCommentModal({ open: false, teamId: null, teamName: '', value: '' });
        }
    };

    // Функция расчёта итоговой оценки (возвращает объект с деталями)
    const calculateFinalGrade = (team, criteriaList) => {
        // 1. Взвешенная сумма по критериям
        let weightedSum = 0;
        let totalWeight = 0;
        for (const crit of criteriaList) {
            const grade = Number(team.criteriaGrades?.[crit.id]) || 0;
            const maxScore = crit.Competition_CriteriaMaxScore;
            const norm = maxScore > 0 ? (grade / maxScore) * 5 : 0;
            const weight = crit.Competition_CriteriaWeight === 1 ? 1 : 0.5; // 1 — обязательный, 0.5 — дополнительный
            weightedSum += norm * weight;
            totalWeight += weight;
        }
        const criteriaAvg = totalWeight > 0 ? weightedSum / totalWeight : 0;

        // 2. Функциональность
        const core = Number(team.coreFunc) || 0;
        const add = Number(team.addFunc) || 0;
        const funcTotal = core + add; // от 0 до 10
        const funcNorm = (funcTotal / 10) * 5; // нормализация в 0–5

        // 3. Инструкция
        const instructionBonus = team.instruction ? 0.5 : 0;

        // 4. Итог без округления
        const rawFinal = criteriaAvg * 0.6 + funcNorm * 0.3 + instructionBonus;
        const clamped = Math.max(0, Math.min(5, rawFinal));
        const rounded = Math.round(clamped / 0.25) * 0.25;

        return {
            finalGrade: parseFloat(rounded.toFixed(2)),
            details: {
                criteria: criteriaList.map(crit => {
                    const grade = Number(team.criteriaGrades?.[crit.id]) || 0;
                    const max = crit.Competition_CriteriaMaxScore;
                    const norm = max > 0 ? (grade / max) * 5 : 0;
                    const weight = crit.Competition_CriteriaWeight === 1 ? 1 : 0.5;
                    return {
                        name: crit.CriteriaName,
                        grade,
                        max,
                        normalized: parseFloat(norm.toFixed(2)),
                        weight
                    };
                }),
                criteriaAvg: parseFloat(criteriaAvg.toFixed(2)),
                coreFunc: core,
                addFunc: add,
                funcNorm: parseFloat(funcNorm.toFixed(2)),
                instruction: team.instruction,
                instructionBonus,
                rawFinal: parseFloat(rawFinal.toFixed(2)),
                clamped: parseFloat(clamped.toFixed(2)),
                finalRounded: parseFloat(rounded.toFixed(2))
            }
        };
    };

    // Показать детали расчёта
    const showCalculationDetails = (team) => {
        const result = calculateFinalGrade(team, criteria);
        setCalculationModal({
            open: true,
            teamId: team.id,
            details: result.details
        });
    };

    if (loading) return <div style={{ padding: '20px' }}>Загрузка...</div>;

    return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Оценка команд</h1>

            {/* Кнопка "Посмотреть задание" */}
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
                            {/* НОВЫЙ СТОЛБЕЦ: Максимальный балл */}
                            <th style={{ textAlign: 'center', padding: '12px', borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                                Макс. балл
                            </th>
                            {teams.map(team => (
                                <th key={team.id} style={{ textAlign: 'center', padding: '12px', borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                                    {team.name}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody>
                        {/* Обязательные критерии */}
                        {getGroupedCriteria().mandatory.length > 0 && (
                            <>
                                <tr>
                                    <td colSpan={2 + teams.length} style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#F3F4F6',
                                        fontWeight: 'bold',
                                        fontSize: '13px',
                                        color: '#4B5563',
                                        borderTop: '2px solid #E5E7EB',
                                        borderBottom: '2px solid #E5E7EB'
                                    }}>
                                        Обязательные:
                                    </td>
                                </tr>
                                {getGroupedCriteria().mandatory.map(crit => (
                                    <tr key={crit.id}>
                                        {/* Ячейка с названием критерия + стрелочка */}
                                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>{crit.CriteriaName}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedDescriptions(prev => ({
                                                        ...prev,
                                                        [crit.id]: !prev[crit.id]
                                                    }))}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#9CA3AF',
                                                        fontSize: '14px',
                                                        cursor: 'pointer',
                                                        width: '20px',
                                                        height: '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    aria-label={expandedDescriptions[crit.id] ? 'Свернуть описание' : 'Показать описание'}
                                                >
                                                    {expandedDescriptions[crit.id] ? '▼' : '▶'}
                                                </button>
                                            </div>

                                            {/* Раскрывающееся описание */}
                                            {expandedDescriptions[crit.id] && (
                                                <div style={{
                                                    marginTop: '8px',
                                                    padding: '8px 12px',
                                                    backgroundColor: '#F9FAFB',
                                                    borderRadius: '4px',
                                                    fontSize: '13px',
                                                    color: '#6B7280',
                                                    lineHeight: '1.5',
                                                    borderLeft: '4px solid #D1D5DB'
                                                }}>
                                                    {teams[0]?.criteriaDescriptions?.[crit.id] || 'Описание не задано'}
                                                </div>
                                            )}
                                        </td>

                                        {/* НОВОЕ: Максимальный балл */}
                                        <td style={{
                                            padding: '10px',
                                            borderBottom: '1px solid #F3F4F6',
                                            textAlign: 'center',
                                            fontWeight: '500',
                                            color: '#4B5563'
                                        }}>
                                            {crit.Competition_CriteriaMaxScore}
                                        </td>

                                        {/* Оценки по командам */}
                                        {teams.map(team => {
                                            const errorKey = `grade-${team.id}-${crit.id}`;
                                            return (
                                                <td key={`${team.id}-${crit.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={crit.Competition_CriteriaMaxScore}
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
                            </>
                        )}

                        {/* Дополнительные критерии */}
                        {getGroupedCriteria().optional.length > 0 && (
                            <>
                                <tr>
                                    <td colSpan={2 + teams.length} style={{
                                        padding: '8px 12px',
                                        backgroundColor: '#F3F4F6',
                                        fontWeight: 'bold',
                                        fontSize: '13px',
                                        color: '#4B5563',
                                        borderTop: '2px solid #E5E7EB',
                                        borderBottom: '2px solid #E5E7EB'
                                    }}>
                                        Дополнительные:
                                    </td>
                                </tr>
                                {getGroupedCriteria().optional.map(crit => (
                                    <tr key={crit.id}>
                                        {/* Ячейка с названием критерия + стрелочка */}
                                        <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span>{crit.CriteriaName}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setExpandedDescriptions(prev => ({
                                                        ...prev,
                                                        [crit.id]: !prev[crit.id]
                                                    }))}
                                                    style={{
                                                        background: 'none',
                                                        border: 'none',
                                                        color: '#9CA3AF',
                                                        fontSize: '14px',
                                                        cursor: 'pointer',
                                                        width: '20px',
                                                        height: '20px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center'
                                                    }}
                                                    aria-label={expandedDescriptions[crit.id] ? 'Свернуть описание' : 'Показать описание'}
                                                >
                                                    {expandedDescriptions[crit.id] ? '▼' : '▶'}
                                                </button>
                                            </div>

                                            {/* Раскрывающееся описание */}
                                            {expandedDescriptions[crit.id] && (
                                                <div style={{
                                                    marginTop: '8px',
                                                    padding: '8px 12px',
                                                    backgroundColor: '#F9FAFB',
                                                    borderRadius: '4px',
                                                    fontSize: '13px',
                                                    color: '#6B7280',
                                                    lineHeight: '1.5',
                                                    borderLeft: '4px solid #D1D5DB'
                                                }}>
                                                    {teams[0]?.criteriaDescriptions?.[crit.id] || 'Описание не задано'}
                                                </div>
                                            )}
                                        </td>

                                        {/* НОВОЕ: Максимальный балл */}
                                        <td style={{
                                            padding: '10px',
                                            borderBottom: '1px solid #F3F4F6',
                                            textAlign: 'center',
                                            fontWeight: '500',
                                            color: '#4B5563'
                                        }}>
                                            {crit.Competition_CriteriaMaxScore}
                                        </td>

                                        {/* Оценки по командам */}
                                        {teams.map(team => {
                                            const errorKey = `grade-${team.id}-${crit.id}`;
                                            return (
                                                <td key={`${team.id}-${crit.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max={crit.Competition_CriteriaMaxScore}
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
                            </>
                        )}

                        {/* Итоговый процент */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', fontWeight: 'bold' }}>Итоговый процент</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td> {/* Пустая ячейка под макс. балл */}
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
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td> {/* Пустая ячейка под макс. балл */}
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
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td> {/* Пустая ячейка под макс. балл */}
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
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td> {/* Пустая ячейка под макс. балл */}
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
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td> {/* Пустая ячейка под макс. балл */}
                            {teams.map(team => {
                                const finalGrade = team.finalGrade; // приходит из ResultsFinalGrade
                                return (
                                    <td key={`final-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                        {finalGrade != null ? (
                                            <button
                                                type="button"
                                                onClick={() => showCalculationDetails(team)}
                                                style={{
                                                    background: 'none',
                                                    border: 'none',
                                                    color: '#4F46E5',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                    fontWeight: 'bold'
                                                }}
                                            >
                                                {finalGrade}
                                            </button>
                                        ) : '—'}
                                    </td>
                                );
                            })}
                        </tr>

                        {/* Комментарий */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}>Комментарий</td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td> {/* Пустая ячейка под макс. балл */}
                            {teams.map(team => (
                                <td key={`comment-${team.id}`} style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', textAlign: 'center' }}>
                                    <button
                                        type="button"
                                        onClick={() => openCommentModal(team.id, team.name, team.comment)}
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

                        {/* Кнопка "Сохранить" */}
                        <tr>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td>
                            <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6' }}></td> {/* Пустая ячейка под макс. балл */}
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
                        <h3 style={{ margin: 0, fontSize: '18px', marginBottom: '12px' }}>Комментарий команде "{commentModal.teamName}"</h3>
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
                                onClick={() => setCommentModal({ open: false, teamId: null, teamName: '', value: '' })}
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

            {/* Модальное окно расчёта итоговой оценки */}
            {calculationModal.open && (
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
                    onClick={() => setCalculationModal({ open: false, teamId: null, details: null })}
                >
                    <div
                        style={{
                            backgroundColor: 'white',
                            padding: '24px',
                            borderRadius: '8px',
                            width: '1000px',
                            maxWidth: '95vw',
                            maxHeight: '85vh',
                            overflowY: 'auto'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, fontSize: '20px' }}>
                                Расчёт итоговой оценки
                            </h2>
                            <button
                                onClick={() => setCalculationModal({ open: false, teamId: null, details: null })}
                                style={{
                                    background: 'none',
                                    border: 'none',
                                    fontSize: '27px',
                                    cursor: 'pointer',
                                    color: '#6B7280',
                                    padding: '0 8px',
                                    lineHeight: 1
                                }}
                                aria-label="Закрыть"
                            >
                                ×
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: '24px' }}>
                            {/* Левая колонка - расчёты */}
                            <div style={{ flex: 1 }}>
                                <div style={{ marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>Критерии</h3>
                                    {calculationModal.details.criteria.map((c, i) => (
                                        <div key={i} style={{ marginBottom: '6px', fontSize: '14px' }}>
                                            <strong>{c.name}</strong>: {c.grade}/{c.max} →
                                            <span style={{ fontFamily: 'monospace' }}>
                                                {' '}({c.grade} ÷ {c.max}) × 5 = {c.normalized} × вес {c.weight}
                                            </span>
                                        </div>
                                    ))}

                                    {/* Детальный расчёт среднего по критериям */}
                                    <div style={{ marginTop: '12px', fontWeight: 'bold', fontSize: '14px' }}>
                                        <div>Среднее по критериям = (сумма произведений) ÷ (сумма весов) =</div>
                                        <div style={{ fontFamily: 'monospace', marginTop: '4px' }}>
                                            ({calculationModal.details.criteria.map(c =>
                                            `${c.normalized} × ${c.weight}`
                                        ).join(' + ')})
                                        </div>
                                        <div style={{ fontFamily: 'monospace', marginTop: '4px' }}>
                                            ÷ ({calculationModal.details.criteria.map(c => c.weight).join(' + ')})
                                        </div>
                                        <div style={{ fontFamily: 'monospace', marginTop: '4px', fontWeight: 'normal' }}>
                                            = ({calculationModal.details.criteria.map(c =>
                                            (c.normalized * c.weight).toFixed(2)
                                        ).join(' + ')}) ÷ {calculationModal.details.criteria.reduce((sum, c) => sum + c.weight, 0).toFixed(1)}
                                        </div>
                                        <div style={{ marginTop: '4px', fontSize: '14px' }}>
                                            = <strong>{calculationModal.details.criteriaAvg}</strong>
                                        </div>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>2. Функциональность</h3>
                                    <div>Основная: {calculationModal.details.coreFunc}/5</div>
                                    <div>Дополнительная: {calculationModal.details.addFunc}/5</div>
                                    <div style={{ marginTop: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                                        Нормализовано:
                                        <span style={{ fontFamily: 'monospace', marginLeft: '8px' }}>
                                ({calculationModal.details.coreFunc} + {calculationModal.details.addFunc}) ÷ 10 × 5
                            </span>
                                        <br />
                                        <span style={{ fontFamily: 'monospace', marginLeft: '8px' }}>
                                = {calculationModal.details.coreFunc + calculationModal.details.addFunc} ÷ 10 × 5 = {calculationModal.details.funcNorm}
                            </span>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '16px' }}>
                                    <h3 style={{ fontSize: '16px', marginBottom: '8px' }}>3. Инструкция</h3>
                                    <div>{calculationModal.details.instruction ? 'Есть (+0.5)' : 'Нет (+0.0)'}</div>
                                </div>

                                <div style={{ borderTop: '1px solid #E5E7EB', paddingTop: '12px' }}>
                                    <div style={{ fontSize: '16px' }}>
                                        <strong>4. Итоговый расчёт:</strong>
                                        <div style={{ fontFamily: 'monospace', marginTop: '4px' }}>
                                            {calculationModal.details.criteriaAvg} × 0.6 + {calculationModal.details.funcNorm} × 0.3 + {calculationModal.details.instructionBonus} = {calculationModal.details.rawFinal}
                                        </div>
                                        <div style={{ marginTop: '16px' }}>
                                            5. После округления до 0.25: <strong>{calculationModal.details.finalRounded}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Вертикальная разделительная черта */}
                            <div style={{ width: '3px', backgroundColor: '#E5E7EB' }}></div>

                            {/* Правая колонка - алгоритм */}
                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '16px', marginBottom: '12px' }}>Алгоритм расчёта</h3>

                                <div style={{ fontSize: '14px', lineHeight: '1.6', color: '#4B5563' }}>
                                    <p><strong>1. Критерии:</strong><br />
                                        • Каждый критерий нормализуется к 5-балльной шкале:<br />
                                        <code style={{ backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>
                                            норм = (оценка ÷ макс. балл) × 5
                                        </code><br />
                                        • Вес: обязательные = 1, дополнительные = 0.5<br />
                                        • Взвешенное среднее:<br />
                                        <code style={{ backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>
                                            ∑(норм × вес) ÷ ∑весов
                                        </code></p>

                                    <p><strong>2. Функциональность:</strong><br />
                                        • Основная (0–5) + Дополнительная (0–5) = сумма (0–10)<br />
                                        • Нормализация к 5:<br />
                                        <code style={{ backgroundColor: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>
                                            норм = (осн + доп) ÷ 10 × 5
                                        </code></p>

                                    <p><strong>3. Инструкция:</strong><br />
                                        • Есть: +0.5<br />
                                        • Нет: +0.0</p>

                                    <p><strong>4. Итоговая формула:</strong><br />
                                        <code style={{ backgroundColor: '#F3F4F6', padding: '4px 8px', borderRadius: '4px', display: 'inline-block' }}>
                                            Итог = критерии × 0.6 + функциональность × 0.3 + инструкция
                                        </code></p>

                                    <p><strong>5. Округление:</strong><br />
                                        • До ближайшего числа кратного 0.25<br />
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default JudgeDashboard;