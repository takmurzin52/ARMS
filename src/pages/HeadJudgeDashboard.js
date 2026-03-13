// src/pages/HeadJudgeDashboard.js
import React, { useState, useEffect } from 'react';

export default function HeadJudgeDashboard() {
    const [summary, setSummary] = useState({
        teams: [],
        judges: [],
        matrix: {}
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/head-judge/summary');
                if (!response.ok) {
                    const data = await response.json();
                    throw new Error(data.error || 'Ошибка загрузки');
                }
                const data = await response.json();
                setSummary(data);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        fetchSummary();
    }, []);

    if (loading) return <div style={{ padding: '20px' }}>Загрузка...</div>;
    if (error) return <div style={{ padding: '20px', color: '#EF4444' }}>Ошибка: {error}</div>;

    const { teams, judges, matrix } = summary;

    // Для каждой команды считаем сумму и проверяем, все ли судьи оценили
    const teamStats = teams.map(team => {
        const grades = judges.map(judge => matrix[team.id]?.[judge.id] || null);
        const validGrades = grades.filter(g => g !== null);
        const sum = validGrades.reduce((a, b) => a + b, 0);
        const isComplete = validGrades.length === judges.length;
        return { ...team, grades, sum, isComplete };
    });

    // Определяем места команд (только для полностью оцененных)
    const rankedTeams = [...teamStats]
        .filter(team => team.isComplete)
        .sort((a, b) => b.sum - a.sum);

    // Функция для определения места с учётом одинаковых сумм
    const getPlaceInfo = (teamId) => {
        const index = rankedTeams.findIndex(t => t.id === teamId);
        if (index === -1) return { place: null, color: 'transparent' };

        const teamSum = rankedTeams[index].sum;

        // Находим все команды с такой же суммой до текущей позиции
        const teamsWithSameSum = rankedTeams.filter(t => t.sum === teamSum);
        const firstIndexWithThisSum = rankedTeams.findIndex(t => t.sum === teamSum);

        // Если это первое вхождение такой суммы
        if (index === firstIndexWithThisSum) {
            if (firstIndexWithThisSum === 0) return { place: 1, color: '#FFED8A' };
            if (firstIndexWithThisSum === 1) return { place: 2, color: '#DBDBDB' };
            if (firstIndexWithThisSum === 2) return { place: 3, color: '#DFAD7C' };
        }

        // Если это повторение суммы, которая уже дала место
        if (firstIndexWithThisSum === 0) return { place: 1, color: '#FFED8A' };
        if (firstIndexWithThisSum === 1) return { place: 2, color: '#DBDBDB' };
        if (firstIndexWithThisSum === 2) return { place: 3, color: '#DFAD7C' };

        return { place: null, color: 'transparent' };
    };

    const getPlaceColor = (teamId) => {
        return getPlaceInfo(teamId).color;
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Inter, sans-serif' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '16px' }}>Сводка оценок</h1>

            {teams.length === 0 ? (
                <p>Нет команд на соревновании.</p>
            ) : judges.length === 0 ? (
                <p>Нет основных судей.</p>
            ) : (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                            <tr>
                                <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                                    Судья / Команда
                                </th>
                                {teams.map(team => {
                                    const placeColor = getPlaceColor(team.id);
                                    return (
                                        <th
                                            key={team.id}
                                            style={{
                                                textAlign: 'center',
                                                padding: '12px',
                                                borderBottom: '2px solid #E5E7EB',
                                                backgroundColor: placeColor !== 'transparent' ? placeColor : '#F9FAFB',
                                                color: placeColor !== 'transparent' ? '#000' : 'inherit',
                                                fontWeight: 'bold'
                                            }}
                                        >
                                            {team.name}
                                        </th>
                                    );
                                })}
                            </tr>
                            </thead>
                            <tbody>
                            {/* Оценки по судьям */}
                            {judges.map(judge => (
                                <tr key={judge.id}>
                                    <td style={{ padding: '10px', borderBottom: '1px solid #F3F4F6', fontWeight: '500' }}>
                                        {judge.name}
                                    </td>
                                    {teams.map(team => {
                                        const grade = matrix[team.id]?.[judge.id];
                                        const placeColor = getPlaceColor(team.id);
                                        return (
                                            <td
                                                key={`${judge.id}-${team.id}`}
                                                style={{
                                                    padding: '10px',
                                                    borderBottom: '1px solid #F3F4F6',
                                                    textAlign: 'center',
                                                    backgroundColor: placeColor !== 'transparent' ? placeColor : 'transparent'
                                                }}
                                            >
                                                {grade != null ? grade.toFixed(2) : '—'}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}

                            {/* Суммарная итоговая оценка */}
                            <tr>
                                <td style={{ padding: '10px', borderBottom: '2px solid #E5E7EB', fontWeight: 'bold', backgroundColor: '#F9FAFB' }}>
                                    Суммарная итоговая оценка
                                </td>
                                {teamStats.map(stat => {
                                    const placeColor = getPlaceColor(stat.id);
                                    return (
                                        <td
                                            key={`sum-${stat.id}`}
                                            style={{
                                                padding: '10px',
                                                borderBottom: '2px solid #E5E7EB',
                                                textAlign: 'center',
                                                fontWeight: 'bold',
                                                backgroundColor: placeColor !== 'transparent' ? placeColor : '#F9FAFB'
                                            }}
                                        >
                                            {stat.isComplete ? stat.sum.toFixed(2) : '—'}
                                        </td>
                                    );
                                })}
                            </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Легенда мест */}
                    <div style={{ marginTop: '24px', display: 'flex', gap: '24px', justifyContent: 'center', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', backgroundColor: '#FFED8A', borderRadius: '4px' }}></div>
                            <span>— 1 место</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', backgroundColor: '#DBDBDB', borderRadius: '4px' }}></div>
                            <span>— 2 место</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '24px', height: '24px', backgroundColor: '#DFAD7C', borderRadius: '4px' }}></div>
                            <span>— 3 место</span>
                        </div>
                    </div>
                    {rankedTeams.filter(t => t.sum === rankedTeams[2]?.sum).length > 1 && (
                        <p style={{ marginTop: '12px', textAlign: 'center', color: '#6B7280', fontSize: '14px' }}>
                            * При равенстве баллов команды делят соответствующее место
                        </p>
                    )}
                </>
            )}
        </div>
    );
}