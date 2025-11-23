-- ============================
--  🧑‍🎓 USERS (회원)
-- ============================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE
);

-- ============================
--  📰 POSTS (게시글)
-- ============================
CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    time TIMESTAMP DEFAULT NOW()
);

-- ============================
--  🖼 POST IMAGES (게시글 이미지)
-- ============================
CREATE TABLE IF NOT EXISTS post_images (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    url TEXT NOT NULL
);

-- ============================
--  💬 COMMENTS (댓글)
-- ============================
CREATE TABLE IF NOT EXISTS comments (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    time TIMESTAMP DEFAULT NOW()
);

-- ============================
--  👑 관리자 계정 추가
-- ============================
INSERT INTO users (username, password_hash, is_admin)
VALUES ('admin', crypt('hanbomadmin1234', gen_salt('bf')), TRUE)
ON CONFLICT (username) DO NOTHING;
