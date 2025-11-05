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

// === РОУТ: Получить текущее соревнование ===
app.get('/api/competition', async (req, res) => {
    try {
        const [rows] = await pool.execute('SELECT * FROM Competition LIMIT 1');
        if (rows.length === 0) {
            return res.json({ competition: null });
        }
        res.json({ competition: rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при получении соревнования' });
    }
});

// === РОУТ: Создать или обновить соревнование ===
app.post('/api/competition', async (req, res) => {
    const { CompetitionName, CompetitionStartDate, CompetitionEndDate } = req.body;

    // Валидация
    if (!CompetitionName || !CompetitionStartDate || !CompetitionEndDate) {
        return res.status(400).json({ error: 'Все поля обязательны' });
    }

    // Проверка: дата окончания >= даты начала
    if (new Date(CompetitionEndDate) < new Date(CompetitionStartDate)) {
        return res.status(400).json({ error: 'Дата окончания не может быть раньше даты начала' });
    }

    try {
        const [existing] = await pool.execute('SELECT idCompetition FROM Competition LIMIT 1');

        if (existing.length > 0) {
            // Обновляем существующее
            const id = existing[0].idCompetition;
            await pool.execute(
                `UPDATE Competition 
         SET CompetitionName = ?, CompetitionStartDate = ?, CompetitionEndDate = ? 
         WHERE idCompetition = ?`,
                [CompetitionName, CompetitionStartDate, CompetitionEndDate, id]
            );
            res.json({ message: 'Соревнование обновлено', id });
        } else {
            // Создаём новое
            const [result] = await pool.execute(
                `INSERT INTO Competition (CompetitionName, CompetitionStartDate, CompetitionEndDate) 
         VALUES (?, ?, ?)`,
                [CompetitionName, CompetitionStartDate, CompetitionEndDate]
            );
            res.status(201).json({ message: 'Соревнование создано', id: result.insertId });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Ошибка при сохранении соревнования' });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`✅ Бэкенд запущен на http://localhost:${PORT}`);
});