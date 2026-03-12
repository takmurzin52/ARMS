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
        const [criteriaRows] = await pool.execute('SELECT * FROM Criteria ORDER BY idCriteria');

        // 3. Параметры для активного соревнования (только если оно есть)
        let compCriteria = [];
        if (compId) {
            [compCriteria] = await pool.execute(`
                SELECT
                    cc.idCompetition_Criteria AS id,
                    cc.Criteria_idCriteria,
                    c.CriteriaName,
                    cc.Competition_CriteriaMaxScore,
                    cc.Competition_CriteriaWeight,
                    cc.Competition_CriteriaDescription
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
                weight: param ? param.Competition_CriteriaWeight : null,
                description: param ? param.Competition_CriteriaDescription : ''
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

            // 3. Собираем полный список с меткой isExisting
            const allCriteria = [
                ...criteria.map(c => ({
                    id: c.id,
                    name: c.name,
                    maxScore: parseInt(c.maxScore) || 0,
                    weight: c.weight === true || c.weight === 'true' || c.weight === 1 ? 1 : 0,
                    description: c.description || '', // ← важно: фронтенд должен передавать это!
                    isExisting: true
                })),
                ...newCriteria
                    .filter(name => name?.trim())
                    .map(name => ({
                        id: newCritMap[name.trim()],
                        name: name.trim(),
                        maxScore: 0,
                        weight: 1,
                        description: '', // новые — без описания
                        isExisting: false
                    }))
            ];

            // 4. ПРОВЕРКИ
            // a) Макс. балл > 0 для всех
            for (const item of criteria) {
                const maxScore = parseInt(item.maxScore) || 0;
                if (maxScore <= 0) {
                    throw new Error(`Укажите максимальный балл для критерия: "${item.name}"`);
                }
            }

            // b) Описание обязательно — только для существующих критериев
            for (const item of allCriteria) {
                if (item.isExisting && (!item.description || item.description.trim() === '')) {
                    throw new Error(`Заполните описание всех критериев!`);
                }
            }

            // c) Сумма баллов = 100 — только если есть существующие критерии
            const totalScore = allCriteria.reduce((sum, c) => sum + c.maxScore, 0);
            if (criteria.length > 0 && totalScore !== 100) {
                throw new Error(`Сумма баллов должна быть 100. Сейчас: ${totalScore}`);
            }

            // Вместо DELETE + INSERT для всех:
            for (const item of allCriteria) {
                await connection.execute(
                    `INSERT INTO Competition_Criteria
                     (Competition_CriteriaMaxScore, Competition_CriteriaWeight, Criteria_idCriteria, Competition_idCompetition, Competition_CriteriaDescription)
                     VALUES (?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     Competition_CriteriaMaxScore = VALUES(Competition_CriteriaMaxScore),
                     Competition_CriteriaWeight = VALUES(Competition_CriteriaWeight),
                     Competition_CriteriaDescription = VALUES(Competition_CriteriaDescription)`,
                    [
                        item.maxScore,
                        item.weight ? 1 : 0,
                        item.id,          // ← это idCriteria (из фронта)
                        compId,
                        item.description?.trim() || 'Описание критерия'
                    ]
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

// === РОУТ: Удалить критерий (и все его Competition_Criteria и связанные Grades) ===
app.delete('/api/criteria/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            // 1. Сначала получаем все idCompetition_Criteria для этого критерия
            const [compCriteria] = await connection.execute(
                'SELECT idCompetition_Criteria FROM Competition_Criteria WHERE Criteria_idCriteria = ?',
                [id]
            );

            // 2. Удаляем все оценки, которые ссылаются на эти Competition_Criteria
            for (const row of compCriteria) {
                await connection.execute(
                    'DELETE FROM Grades WHERE Competition_Criteria_idCompetition_Criteria = ?',
                    [row.idCompetition_Criteria]
                );
            }

            // 3. Теперь удаляем Competition_Criteria
            await connection.execute(
                'DELETE FROM Competition_Criteria WHERE Criteria_idCriteria = ?',
                [id]
            );

            // 4. И наконец удаляем сам критерий
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
            'SELECT idTeam, TeamName FROM Team WHERE Competition_idCompetition = ? ORDER BY idTeam',
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
            'SELECT idTeam, TeamName FROM Team WHERE Competition_idCompetition = ? ORDER BY idTeam',
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

// === РОУТ: Получить команды и оценки для судьи (POST, с judgeId) ===
app.post('/api/judge/teams', async (req, res) => {
    const { judgeId } = req.body;
    if (!judgeId) {
        return res.status(400).json({ error: 'Не указан ID судьи' });
    }

    try {
        // Активное соревнование
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        if (compRows.length === 0) {
            return res.status(400).json({ error: 'Нет активного соревнования' });
        }
        const compId = compRows[0].idCompetition;

        // Команды
        const [teams] = await pool.execute(
            'SELECT idTeam, TeamName FROM Team WHERE Competition_idCompetition = ? ORDER BY TeamName',
            [compId]
        );

        // Критерии
        const [criteria] = await pool.execute(`
            SELECT
                cc.idCompetition_Criteria AS id,
                c.CriteriaName,
                cc.Competition_CriteriaMaxScore,
                cc.Competition_CriteriaWeight
            FROM Criteria c
                     JOIN Competition_Criteria cc ON c.idCriteria = cc.Criteria_idCriteria
            WHERE cc.Competition_idCompetition = ?
            ORDER BY c.idCriteria
        `, [compId]);

        // Оценки судьи
        const [grades] = await pool.execute(`
            SELECT
                g.Team_idTeam,
                g.Competition_Criteria_idCompetition_Criteria,
                g.GradesGrade
            FROM Grades g
            WHERE g.Judge_idJudge = ?
        `, [judgeId]);

        // Комментарии
        const [comments] = await pool.execute(`
            SELECT
                c.Team_idTeam,
                c.CommentaryText
            FROM Commentary c
            WHERE c.Judge_idJudge = ?
        `, [judgeId]);

        // Собираем данные — делаем запрос к Results внутри цикла
        const teamData = [];
        for (const team of teams) {
            // Запрос результатов ТОЛЬКО для текущей команды
            const [results] = await pool.execute(`
                SELECT
                    r.ResultsInstruction,
                    r.ResultsScoreForCoreFunc,
                    r.ResultsScoreForAddFunc,
                    r.ResultsFinalGrade,
                    r.ResultsTotalScore
                FROM Results r
                WHERE r.Competition_idCompetition = ? AND r.Team_idTeam = ?
            `, [compId, team.idTeam]);
            const teamResult = results[0] || {};
            const teamGrades = grades.filter(g => g.Team_idTeam === team.idTeam);
            const teamComment = comments.find(c => c.Team_idTeam === team.idTeam);
            const criteriaGrades = {};
            teamGrades.forEach(g => {
                criteriaGrades[g.Competition_Criteria_idCompetition_Criteria] = g.GradesGrade;
            });

            const [critDescs] = await pool.execute(`
                SELECT
                    cc.idCompetition_Criteria,
                    cc.Competition_CriteriaDescription
                FROM Competition_Criteria cc
                WHERE cc.Competition_idCompetition = ?
            `, [compId]);

            const descriptionMap = {};
            critDescs.forEach(row => {
                descriptionMap[row.idCompetition_Criteria] = row.Competition_CriteriaDescription || '';
            });

            teamData.push({
                id: team.idTeam,
                name: team.TeamName,
                criteriaGrades,
                instruction: teamResult.ResultsInstruction || 0,
                coreFunc: teamResult.ResultsScoreForCoreFunc || null,
                addFunc: teamResult.ResultsScoreForAddFunc || null,
                finalGrade: teamResult.ResultsFinalGrade || null,
                totalScore: teamResult.ResultsTotalScore || null,
                comment: teamComment?.CommentaryText || '',
                criteriaDescriptions: descriptionMap
            });
        }

        res.json({
            teams: teamData,
            criteria: criteria
        });
    } catch (err) {
        console.error('❌ /api/judge/teams error:', err);
        res.status(500).json({ error: 'Ошибка при получении данных для оценки' });
    }
});

// === РОУТ: Сохранить оценку команды ===
app.post('/api/judge/evaluate', async (req, res) => {
    const { teamId, criteriaGrades, instruction, coreFunc, addFunc, finalGrade, judgeId } = req.body;

    if (!teamId || !judgeId) {
        return res.status(400).json({ error: 'Не указан ID команды или судьи' });
    }

    try {
        // Активное соревнование
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        if (compRows.length === 0) {
            return res.status(400).json({ error: 'Нет активного соревнования' });
        }
        const compId = compRows[0].idCompetition;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            /*
            // 1. Удаляем старые оценки этого судьи для этой команды
            await connection.execute(
                'DELETE FROM Grades WHERE Judge_idJudge = ? AND Team_idTeam = ?',
                [judgeId, teamId]
            );
            */

            // 2. Обновляем/вставляем оценки по критериям (UPSERT)
            for (const [critId, grade] of Object.entries(criteriaGrades)) {
                if (grade != null && grade !== '') {
                    await connection.execute(
                        `INSERT INTO Grades (GradesGrade, Judge_idJudge, Team_idTeam, Competition_Criteria_idCompetition_Criteria)
                         VALUES (?, ?, ?, ?)
                             ON DUPLICATE KEY UPDATE GradesGrade = VALUES(GradesGrade)`,
                        [grade, judgeId, teamId, Number(critId)]
                    );
                }
            }

            // Сначала посчитаем сумму баллов из criteriaGrades
            const totalScore = Object.values(criteriaGrades).reduce((sum, grade) => sum + (Number(grade) || 0), 0);

            // 3. Обновляем/создаём Results
            const [existingResult] = await connection.execute(
                'SELECT idResults FROM Results WHERE Competition_idCompetition = ? AND Team_idTeam = ?',
                [compId, teamId]
            );

            if (existingResult.length > 0) {
                await connection.execute(
                    `UPDATE Results 
                    SET ResultsTotalScore = ?, 
                        ResultsInstruction = ?, 
                        ResultsScoreForCoreFunc = ?, 
                        ResultsScoreForAddFunc = ?,
                        ResultsFinalGrade = ?
                    WHERE idResults = ?`,
                    [totalScore, instruction ? 1 : 0, coreFunc || 0, addFunc || 0, finalGrade, existingResult[0].idResults]
                );
            } else {
                await connection.execute(
                    `INSERT INTO Results 
         (ResultsTotalScore, ResultsInstruction, ResultsScoreForCoreFunc, ResultsScoreForAddFunc, ResultsFinalGrade, Competition_idCompetition, Team_idTeam)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [totalScore, instruction ? 1 : 0, coreFunc || 0, addFunc || 0, finalGrade, compId, teamId]
                );
            }

            await connection.commit();
            connection.release();
            res.json({ message: 'Оценка сохранена' });
        } catch (err) {
            await connection.rollback();
            connection.release();
            throw err;
        }
    } catch (err) {
        console.error('❌ /api/judge/evaluate error:', err);
        res.status(500).json({ error: 'Ошибка при сохранении оценки' });
    }
});

// === РОУТ: Сохранить только комментарий (без изменения оценок) ===
app.post('/api/judge/comment', async (req, res) => {
    const { teamId, comment, judgeId } = req.body;

    if (!teamId || !judgeId) {
        return res.status(400).json({ error: 'Не указан ID команды или судьи' });
    }

    try {
        const connection = await pool.getConnection();

        try {
            // Проверяем, есть ли уже комментарий от этого судьи для этой команды
            const [existingComment] = await connection.execute(
                'SELECT idCommentary FROM Commentary WHERE Judge_idJudge = ? AND Team_idTeam = ?',
                [judgeId, teamId]
            );

            if (comment?.trim()) {
                if (existingComment.length > 0) {
                    // Обновляем существующий комментарий
                    await connection.execute(
                        'UPDATE Commentary SET CommentaryText = ? WHERE idCommentary = ?',
                        [comment.trim(), existingComment[0].idCommentary]
                    );
                } else {
                    // Создаём новый комментарий
                    await connection.execute(
                        'INSERT INTO Commentary (CommentaryText, Judge_idJudge, Team_idTeam) VALUES (?, ?, ?)',
                        [comment.trim(), judgeId, teamId]
                    );
                }
            } else {
                // Если комментарий пустой — удаляем
                if (existingComment.length > 0) {
                    await connection.execute('DELETE FROM Commentary WHERE idCommentary = ?', [existingComment[0].idCommentary]);
                }
            }

            connection.release();
            res.json({ message: 'Комментарий сохранён' });
        } catch (err) {
            connection.release();
            throw err;
        }
    } catch (err) {
        console.error('❌ /api/judge/comment error:', err);
        res.status(500).json({ error: 'Ошибка при сохранении комментария' });
    }
});

// === РОУТ: Получить данные для оценки конкретной команды (POST, чтобы передать judgeId) ===
app.post('/api/judge/team/:teamId', async (req, res) => {
    const { teamId } = req.params;
    const { judgeId } = req.body;

    if (!judgeId) {
        return res.status(400).json({ error: 'Не указан ID судьи' });
    }

    try {
        // Активное соревнование
        const [compRows] = await pool.execute('SELECT idCompetition FROM Competition WHERE IsActive = 1');
        if (compRows.length === 0) {
            return res.status(400).json({ error: 'Нет активного соревнования' });
        }
        const compId = compRows[0].idCompetition;

        // Команда
        const [teamRows] = await pool.execute(
            'SELECT TeamName FROM Team WHERE idTeam = ? AND Competition_idCompetition = ?',
            [teamId, compId]
        );
        if (teamRows.length === 0) {
            return res.status(404).json({ error: 'Команда не найдена' });
        }

        // Критерии (с idCompetition_Criteria)
        const [criteria] = await pool.execute(`
      SELECT 
        cc.idCompetition_Criteria AS id,
        c.CriteriaName,
        cc.Competition_CriteriaMaxScore
      FROM Criteria c
      JOIN Competition_Criteria cc ON c.idCriteria = cc.Criteria_idCriteria
      WHERE cc.Competition_idCompetition = ?
      ORDER BY c.idCriteria
    `, [compId]);

        // Оценки судьи
        const [grades] = await pool.execute(`
      SELECT 
        g.Competition_Criteria_idCompetition_Criteria,
        g.GradesGrade
      FROM Grades g
      WHERE g.Judge_idJudge = ? AND g.Team_idTeam = ?
    `, [judgeId, teamId]);

        // Результаты
        const [results] = await pool.execute(`
            SELECT
                ResultsInstruction,
                ResultsScoreForCoreFunc,
                ResultsScoreForAddFunc
            FROM Results
            WHERE Competition_idCompetition = ? AND Team_idTeam = ?
        `, [compId, teamId]);

        // Комментарий
        const [comments] = await pool.execute(`
            SELECT CommentaryText
            FROM Commentary
            WHERE Judge_idJudge = ? AND Team_idTeam = ?
        `, [judgeId, teamId]);

        // Собираем данные
        const gradesMap = {};
        grades.forEach(g => {
            gradesMap[g.Competition_Criteria_idCompetition_Criteria] = g.GradesGrade;
        });

        const result = results[0] || {};
        const comment = comments[0]?.CommentaryText || '';

        res.json({
            team: { id: teamId, name: teamRows[0].TeamName },
            criteria: criteria.map(c => ({
                ...c,
                grade: gradesMap[c.id] || ''
            })),
            instruction: result.ResultsInstruction === 1,
            coreFunc: result.ResultsScoreForCoreFunc || '',
            addFunc: result.ResultsScoreForAddFunc || '',
            comment: comment
        });
    } catch (err) {
        console.error('❌ /api/judge/team/:id (POST) error:', err);
        res.status(500).json({ error: 'Ошибка при получении данных команды' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Бэкенд запущен на http://localhost:${PORT}`);
});