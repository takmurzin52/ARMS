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
    console.log('→ Запрос /api/criteria получен');
    try {
        // 1. Активное соревнование
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        const compId = compRows.length > 0 ? compRows[0].idCompetition : null;

        // 2. Все общие критерии
        const [criteriaRows] = await pool.execute('SELECT * FROM Criteria ORDER BY CriteriaName');

        // 3. Параметры для активного соревнования (только если оно есть)
        let compCriteria = [];
        if (compId) {
            [compCriteria] = await pool.execute(`
                SELECT cc.*, c.CriteriaName
                FROM Competition_Criteria cc
                         JOIN Criteria c ON cc.Criteria_idCriteria = c.idCriteria
                WHERE cc.Competition_idCompetition = ?
            `, [compId]);
        }

        // Собираем критерии с параметрами
        const criteriaWithParams = criteriaRows.map(crit => {
            const param = compCriteria.find(p => p.Criteria_idCriteria === crit.idCriteria);
            return {
                idCriteria: crit.idCriteria,
                CriteriaName: crit.CriteriaName,
                maxScore: param ? param.Competition_CriteriaMaxScore : null,
                weight: param ? param.Competition_CriteriaWeight : null
            };
        });

        res.json({
            criteria: criteriaWithParams,
            hasCompetition: !!compId
        });
    } catch (err) {
        console.error('❌ /api/criteria error:', err.message || err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// === РОУТ: Сохранить критерии и параметры (исправленный) ===
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

            // 2. Создаём новые критерии и получаем их ID
            const newCritMap = {};
            for (const name of newCriteria) {
                if (!name?.trim()) continue;
                const cleanName = name.trim();
                const [existing] = await connection.execute(
                    'SELECT idCriteria FROM Criteria WHERE CriteriaName = ?',
                    [cleanName]
                );
                if (existing.length > 0) {
                    newCritMap[cleanName] = existing[0].idCriteria;
                } else {
                    const [result] = await connection.execute(
                        'INSERT INTO Criteria (CriteriaName) VALUES (?)',
                        [cleanName]
                    );
                    newCritMap[cleanName] = result.insertId;
                }
            }

            // 3. Собираем полный список: существующие + новые (с параметрами)
            // Для новых — устанавливаем maxScore = 0 (временно)
            const allCriteria = [
                ...criteria.map(c => ({
                    id: c.id,
                    maxScore: parseInt(c.maxScore) || 0,
                    weight: c.weight === true || c.weight === 'true' || c.weight === 1 ? 1 : 0
                })),
                ...newCriteria
                    .filter(name => name?.trim())
                    .map(name => ({
                        id: newCritMap[name.trim()],
                        maxScore: 0, // ← временно 0, но не проверяем сейчас
                        weight: 1
                    }))
            ];

            // ✅ 4. ПРОВЕРКА СУММЫ — ТОЛЬКО если есть хотя бы один критерий С БАЛЛАМИ > 0
            // Или если есть существующие критерии (т.е. не только новые)
            const hasExistingWithScore = criteria.some(c => (parseInt(c.maxScore) || 0) > 0);
            const totalScore = allCriteria.reduce((sum, c) => sum + c.maxScore, 0);

            if (criteria.length > 0 && totalScore !== 100) {
                throw new Error(`Сумма баллов должна быть 100. Сейчас: ${totalScore}`);
            }

            // 5. Удаляем старые параметры
            await connection.execute(
                'DELETE FROM Competition_Criteria WHERE Competition_idCompetition = ?',
                [compId]
            );

            // 6. Вставляем Competition_Criteria
            for (const item of allCriteria) {
                await connection.execute(
                    `INSERT INTO Competition_Criteria
                     (Competition_CriteriaMaxScore, Competition_CriteriaWeight, Criteria_idCriteria, Competition_idCompetition)
                     VALUES (?, ?, ?, ?)`,
                    [item.maxScore, item.weight, item.id, compId]
                );
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
        console.error('❌ /api/criteria error:', err);
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

// === РОУТ: Получить команды активного соревнования ===
app.get('/api/teams', async (req, res) => {
    try {
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        if (compRows.length === 0) {
            return res.json({ teams: [], hasCompetition: false });
        }
        const compId = compRows[0].idCompetition;

        const [teams] = await pool.execute(
            'SELECT idTeam, TeamName FROM Team WHERE Competition_idCompetition = ? ORDER BY TeamName',
            [compId]
        );

        res.json({ teams, hasCompetition: true });
    } catch (err) {
        console.error('❌ /api/teams error:', err);
        res.status(500).json({ error: 'Ошибка при получении команд' });
    }
});

// === РОУТ: Создать команду ===
app.post('/api/teams', async (req, res) => {
    const { TeamName } = req.body;

    if (!TeamName?.trim()) {
        return res.status(400).json({ error: 'Название команды обязательно' });
    }

    try {
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        if (compRows.length === 0) {
            return res.status(400).json({ error: 'Нет активного соревнования' });
        }
        const compId = compRows[0].idCompetition;

        const [result] = await pool.execute(
            'INSERT INTO Team (TeamName, Competition_idCompetition) VALUES (?, ?)',
            [TeamName.trim(), compId]
        );

        res.status(201).json({
            message: 'Команда создана',
            team: { idTeam: result.insertId, TeamName: TeamName.trim() }
        });
    } catch (err) {
        console.error('❌ /api/teams POST error:', err);
        res.status(500).json({ error: 'Ошибка при создании команды' });
    }
});

// === РОУТ: Обновить название команды ===
app.put('/api/teams/:id', async (req, res) => {
    const { id } = req.params;
    const { TeamName } = req.body;

    if (!TeamName?.trim()) {
        return res.status(400).json({ error: 'Название команды обязательно' });
    }

    try {
        const [result] = await pool.execute(
            'UPDATE Team SET TeamName = ? WHERE idTeam = ?',
            [TeamName.trim(), id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Команда не найдена' });
        }

        res.json({ message: 'Команда обновлена' });
    } catch (err) {
        console.error('❌ /api/teams PUT error:', err);
        res.status(500).json({ error: 'Ошибка при обновлении команды' });
    }
});

// === РОУТ: Удалить команду (каскадно по внешним ключам) ===
app.delete('/api/teams/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // Удаляем связанные данные (если будут: участники, оценки и т.д.)
            // Пока только саму команду — каскад будет работать через FK
            const [result] = await connection.execute(
                'DELETE FROM Team WHERE idTeam = ?',
                [id]
            );

            if (result.affectedRows === 0) {
                throw new Error('Команда не найдена');
            }

            await connection.commit();
            connection.release();
            res.json({ message: 'Команда удалена' });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (err) {
        console.error('❌ /api/teams DELETE error:', err);
        res.status(500).json({ error: err.message || 'Ошибка при удалении команды' });
    }
});

// === РОУТ: Получить простой список команд (для выбора) ===
app.get('/api/teams/simple', async (req, res) => {
    try {
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        if (compRows.length === 0) {
            return res.json({ teams: [], hasCompetition: false });
        }
        const compId = compRows[0].idCompetition;

        const [teams] = await pool.execute(
            'SELECT idTeam, TeamName FROM Team WHERE Competition_idCompetition = ? ORDER BY TeamName',
            [compId]
        );

        res.json({ teams, hasCompetition: true });
    } catch (err) {
        console.error('❌ /api/teams/simple error:', err);
        res.status(500).json({ error: 'Ошибка при получении списка команд' });
    }
});

// === РОУТ: Получить участников команды ===
app.get('/api/members', async (req, res) => {
    const { teamId } = req.query;

    if (!teamId) {
        return res.status(400).json({ error: 'teamId обязателен' });
    }

    try {
        const [members] = await pool.execute(
            'SELECT idMembers, MembersSurname, MembersName, MembersEmail, MembersRole FROM Members WHERE Team_idTeam = ? ORDER BY MembersSurname',
            [teamId]
        );

        res.json({ members });
    } catch (err) {
        console.error('❌ /api/members GET error:', err);
        res.status(500).json({ error: 'Ошибка при получении участников' });
    }
});

// === РОУТ: Создать участника ===
app.post('/api/members', async (req, res) => {
    const { MembersSurname, MembersName, MembersEmail, MembersRole, Team_idTeam } = req.body;

    if (!MembersSurname?.trim() || !MembersName?.trim() || !MembersEmail?.trim() || !MembersRole?.trim() || !Team_idTeam) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Простая валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(MembersEmail)) {
        return res.status(400).json({ error: 'Некорректный email' });
    }

    try {
        const [result] = await pool.execute(
            `INSERT INTO Members (MembersSurname, MembersName, MembersEmail, MembersRole, Team_idTeam)
       VALUES (?, ?, ?, ?, ?)`,
            [MembersSurname.trim(), MembersName.trim(), MembersEmail.trim(), MembersRole.trim(), Team_idTeam]
        );

        res.status(201).json({
            message: 'Участник добавлен',
            member: {
                idMembers: result.insertId,
                MembersSurname: MembersSurname.trim(),
                MembersName: MembersName.trim(),
                MembersEmail: MembersEmail.trim(),
                MembersRole: MembersRole.trim()
            }
        });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Участник с таким email уже существует' });
        }
        console.error('❌ /api/members POST error:', err);
        res.status(500).json({ error: 'Ошибка при создании участника' });
    }
});

// === РОУТ: Обновить участника ===
app.put('/api/members/:id', async (req, res) => {
    const { id } = req.params;
    const { MembersSurname, MembersName, MembersEmail, MembersRole } = req.body;

    if (!MembersSurname?.trim() || !MembersName?.trim() || !MembersEmail?.trim() || !MembersRole?.trim()) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(MembersEmail)) {
        return res.status(400).json({ error: 'Некорректный email' });
    }

    try {
        const [result] = await pool.execute(
            `UPDATE Members 
       SET MembersSurname = ?, MembersName = ?, MembersEmail = ?, MembersRole = ?
       WHERE idMembers = ?`,
            [MembersSurname.trim(), MembersName.trim(), MembersEmail.trim(), MembersRole.trim(), id]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Участник не найден' });
        }

        res.json({ message: 'Участник обновлён' });
    } catch (err) {
        if (err.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'Email уже используется другим участником' });
        }
        console.error('❌ /api/members PUT error:', err);
        res.status(500).json({ error: 'Ошибка при обновлении участника' });
    }
});

// === РОУТ: Удалить участника ===
app.delete('/api/members/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const [result] = await pool.execute('DELETE FROM Members WHERE idMembers = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Участник не найден' });
        }
        res.json({ message: 'Участник удалён' });
    } catch (err) {
        console.error('❌ /api/members DELETE error:', err);
        res.status(500).json({ error: 'Ошибка при удалении участника' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Бэкенд запущен на http://localhost:${PORT}`);
});