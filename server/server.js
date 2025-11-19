const express = require('express');
const bcrypt = require('bcrypt');
const cors = require('cors');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors()); // разрешить запросы с http://localhost:3000
app.use(express.json());

// === РОУТ: Регистрация ===
app.post('/api/register', async (req, res) => {
    const { surname, name, patronymic, category, role, login, password } = req.body;

    // Валидация
    if (!surname || !name || !category || !role || !login || !password) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    try {
        // 1. Проверить, существует ли логин
        const [existing] = await pool.execute('SELECT idCredentials FROM Credentials WHERE CredentialsLogin = ?', [login]);
        if (existing.length > 0) {
            return res.status(400).json({ error: 'Логин уже занят' });
        }

        // 2. Найти idJudgeRole по названию роли
        const [roles] = await pool.execute('SELECT idJudgeRole FROM JudgeRole WHERE JudgeRoleName = ?', [role]);
        if (roles.length === 0) {
            return res.status(400).json({ error: 'Некорректная роль судьи' });
        }
        const roleId = roles[0].idJudgeRole;

        // 3. Хешируем пароль
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Начинаем транзакцию
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 5. Вставляем судью
            const [judgeResult] = await connection.execute(
                `INSERT INTO Judge (JudgeSurname, JudgeName, JudgePatronymic, JudgeCategory, JudgeRole_idJudgeRole)
         VALUES (?, ?, ?, ?, ?)`,
                [surname, name, patronymic || null, category, roleId]
            );
            const judgeId = judgeResult.insertId;

            // 6. Вставляем учётные данные
            await connection.execute(
                `INSERT INTO Credentials (CredentialsLogin, CredentialsPassword, CredentialsRegistrationDate, Judge_idJudge)
         VALUES (?, ?, NOW(), ?)`,
                [login, hashedPassword, judgeId]
            );

            await connection.commit();
            connection.release();

            res.status(201).json({ message: 'Судья успешно зарегистрирован' });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
});

// === РОУТ: Авторизация ===
app.post('/api/login', async (req, res) => {
    const { login, password } = req.body;

    if (!login || !password) {
        return res.status(400).json({ error: 'Логин и пароль обязательны' });
    }

    try {
        // 1. Найти учётные данные + судью + роль
        const [rows] = await pool.execute(`
      SELECT 
        c.CredentialsPassword,
        j.idJudge,
        j.JudgeSurname,
        j.JudgeName,
        jr.JudgeRoleName
      FROM Credentials c
      JOIN Judge j ON c.Judge_idJudge = j.idJudge
      JOIN JudgeRole jr ON j.JudgeRole_idJudgeRole = jr.idJudgeRole
      WHERE c.CredentialsLogin = ?
    `, [login]);

        if (rows.length === 0) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        const user = rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.CredentialsPassword);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Неверный логин или пароль' });
        }

        // Успешный вход — возвращаем данные (без пароля!)
        res.json({
            message: 'Успешный вход',
            user: {
                id: user.idJudge,
                surname: user.JudgeSurname,
                name: user.JudgeName,
                role: user.JudgeRoleName
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка сервера при входе' });
    }
});

// === РОУТ: Получить активное соревнование (только для отладки) ===
app.get('/api/competition', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM Competition WHERE IsActive = 1');
        if (rows.length === 0) {
            return res.json({ competition: null });
        }
        res.json({ competition: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении соревнования' });
    }
});

// === РОУТ: Сохранить соревнование (создать или обновить активное) ===
app.post('/api/competition', async (req, res) => {
    const { CompetitionName, CompetitionStartDate, CompetitionEndDate } = req.body;

    if (!CompetitionName || !CompetitionStartDate || !CompetitionEndDate) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    if (new Date(CompetitionEndDate) < new Date(CompetitionStartDate)) {
        return res.status(400).json({ error: 'Дата окончания не может быть раньше даты начала' });
    }

    try {
        const [activeRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');

        if (activeRows.length > 0) {
            // Обновляем существующее
            const id = activeRows[0].idCompetition;
            await pool.execute(
                `UPDATE Competition 
         SET CompetitionName = ?, CompetitionStartDate = ?, CompetitionEndDate = ? 
         WHERE idCompetition = ?`,
                [CompetitionName, CompetitionStartDate, CompetitionEndDate, id]
            );
            res.json({ message: 'Соревнование обновлено', id, action: 'update' });
        } else {
            // Создаём новое
            const [result] = await pool.execute(
                `INSERT INTO Competition (CompetitionName, CompetitionStartDate, CompetitionEndDate, IsActive) 
         VALUES (?, ?, ?, 1)`,
                [CompetitionName, CompetitionStartDate, CompetitionEndDate]
            );
            res.status(201).json({ message: 'Соревнование создано', id: result.insertId, action: 'create' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при сохранении соревнования' });
    }
});

// === РОУТ: Получить задание текущего соревнования ===
app.get('/api/task', async (req, res) => {
    try {
        // Сначала получаем id активного соревнования
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition LIMIT 1');
        if (compRows.length === 0) {
            return res.status(400).json({ error: 'Сначала создайте соревнование' });
        }
        const compId = compRows[0].idCompetition;

        // Получаем задание для этого соревнования
        const [taskRows] = await pool.execute(
            'SELECT * FROM Task WHERE Competition_idCompetition = ?',
            [compId]
        );

        if (taskRows.length === 0) {
            return res.json({ task: null, competitionId: compId });
        }
        res.json({ task: taskRows[0], competitionId: compId });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении задания' });
    }
});

// === РОУТ: Сохранить задание (создать или обновить для активного соревнования) ===
app.post('/api/task', async (req, res) => {
    const { TaskName, TaskDescription, TaskCustomer } = req.body;

    if (!TaskName || !TaskDescription || !TaskCustomer) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    try {
        // Получаем активное соревнование
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        if (compRows.length === 0) {
            return res.status(400).json({ error: 'Нет активного соревнования' });
        }
        const compId = compRows[0].idCompetition;

        // Проверяем, есть ли уже задание для этого соревнования
        const [taskRows] = await pool.execute(
            'SELECT idTask FROM Task WHERE Competition_idCompetition = ?',
            [compId]
        );

        if (taskRows.length > 0) {
            // Обновляем существующее
            const taskId = taskRows[0].idTask;
            await pool.execute(
                `UPDATE Task 
         SET TaskName = ?, TaskDescription = ?, TaskCustomer = ? 
         WHERE idTask = ?`,
                [TaskName, TaskDescription, TaskCustomer, taskId]
            );
            res.json({ message: 'Задание обновлено', id: taskId, action: 'update' });
        } else {
            // Создаём новое
            const [result] = await pool.execute(
                `INSERT INTO Task (TaskName, TaskDescription, TaskCustomer, Competition_idCompetition) 
         VALUES (?, ?, ?, ?)`,
                [TaskName, TaskDescription, TaskCustomer, compId]
            );
            res.status(201).json({ message: 'Задание создано', id: result.insertId, action: 'create' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при сохранении задания' });
    }
});

// === РОУТ: Получить все критерии + параметры для активного соревнования ===
app.get('/api/criteria', async (req, res) => {
    try {
        // 1. Активное соревнование
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        const compId = compRows.length > 0 ? compRows[0].idCompetition : null;

        // 2. Все общие критерии
        const [criteriaRows] = await pool.execute('SELECT * FROM Criteria ORDER BY CriteriaName');

        // 3. Параметры для активного соревнования (если есть)
        let compCriteria = [];
        if (compId) {
            [compCriteria] = await pool.execute(`
        SELECT * FROM Competition_Criteria 
        WHERE Competition_idCompetition = ?
      `, [compId]);
        }

        // Привяжем параметры к критериям
        const criteriaWithParams = criteriaRows.map(crit => {
            const param = compCriteria.find(p => p.Criteria_idCriteria === crit.idCriteria);
            return {
                ...crit,
                maxScore: param ? param.Competition_CriteriaMaxScore : null,
                weight: param ? param.Competition_CriteriaWeight : null,
                compCritId: param ? param.idCompetition_Criteria : null
            };
        });

        res.json({
            criteria: criteriaWithParams,
            hasCompetition: !!compId
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении критериев' });
    }
});

// === РОУТ: Сохранить критерии и параметры (с проверкой Σ = 100) ===
app.post('/api/criteria', async (req, res) => {
    const { criteria, newCriteria } = req.body;

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Активное соревнование
            const [compRows] = await connection.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
            if (compRows.length === 0) {
                throw new Error('Нет активного соревнования');
            }
            const compId = compRows[0].idCompetition;

            // 2. Проверяем сумму баллов ДО сохранения
            const totalScore = criteria.reduce((sum, c) => sum + (parseInt(c.maxScore) || 0), 0);
            if (totalScore !== 100) {
                throw new Error(`Сумма максимальных баллов должна быть 100. Сейчас: ${totalScore}`);
            }

            // 3. Добавляем новые общие критерии
            const newCritIds = [];
            for (const name of newCriteria) {
                if (!name.trim()) continue;
                const [result] = await connection.execute(
                    'INSERT INTO Criteria (CriteriaName) VALUES (?)',
                    [name.trim()]
                );
                newCritIds.push(result.insertId);
            }

            // 4. Обновляем/создаём Competition_Criteria
            for (const item of criteria) {
                const critId = item.id;
                const maxScore = parseInt(item.maxScore) || 0;
                // Вес: true/false → 1/0
                const weight = item.weight === true || item.weight === 'true' || item.weight === 1 ? 1 : 0;

                const [existing] = await connection.execute(
                    'SELECT idCompetition_Criteria FROM Competition_Criteria WHERE Criteria_idCriteria = ? AND Competition_idCompetition = ?',
                    [critId, compId]
                );

                if (existing.length > 0) {
                    await connection.execute(
                        `UPDATE Competition_Criteria
                         SET Competition_CriteriaMaxScore = ?, Competition_CriteriaWeight = ?
                         WHERE idCompetition_Criteria = ?`,
                        [maxScore, weight, existing[0].idCompetition_Criteria]
                    );
                } else {
                    await connection.execute(
                        `INSERT INTO Competition_Criteria
                         (Competition_CriteriaMaxScore, Competition_CriteriaWeight, Criteria_idCriteria, Competition_idCompetition)
                         VALUES (?, ?, ?, ?)`,
                        [maxScore, weight, critId, compId]
                    );
                }
            }

            await connection.commit();
            connection.release();
            res.json({ message: 'Критерии сохранены', totalScore });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message || 'Ошибка при сохранении критериев' });
    }
});

// === РОУТ: Удалить критерий (и все его Competition_Criteria) ===
app.delete('/api/criteria/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Сначала удаляем Competition_Criteria (дочерние)
            await connection.execute(
                'DELETE FROM Competition_Criteria WHERE Criteria_idCriteria = ?',
                [id]
            );

            // Потом — сам критерий
            await connection.execute(
                'DELETE FROM Criteria WHERE idCriteria = ?',
                [id]
            );

            await connection.commit();
            connection.release();
            res.json({ message: 'Критерий удалён' });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при удалении критерия' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Бэкенд запущен на http://localhost:${PORT}`);
});