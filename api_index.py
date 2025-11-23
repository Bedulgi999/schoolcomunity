import os
from flask import Flask, request, jsonify, session
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime

app = Flask(__name__)

# 환경변수에서 읽기 (Vercel Settings → Environment Variables)
app.secret_key = os.environ.get("SECRET_KEY", "change_this_secret_key")


def get_db():
    dsn = os.environ.get("SUPABASE_DB")
    if not dsn:
        raise RuntimeError("SUPABASE_DB env var is not set")
    # sslmode=require 로 Supabase 접속
    conn = psycopg2.connect(dsn, sslmode="require")
    return conn


# ------------------------------------------------
# 유틸
# ------------------------------------------------
def get_current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, username, is_admin FROM users WHERE id = %s", (user_id,))
    user = cur.fetchone()
    conn.close()
    return user


# ------------------------------------------------
# 인증 관련
# ------------------------------------------------
@app.route("/api/me", methods=["GET"])
def me():
    user = get_current_user()
    if not user:
        return jsonify({"ok": False, "user": None})
    return jsonify({"ok": True, "user": user})


@app.route("/api/register", methods=["POST"])
def register():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"ok": False, "msg": "아이디와 비밀번호를 입력해 주세요."}), 400

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 중복 체크
    cur.execute("SELECT id FROM users WHERE username = %s", (username,))
    if cur.fetchone():
        conn.close()
        return jsonify({"ok": False, "msg": "이미 존재하는 아이디입니다."}), 400

    # pgcrypto 기반 bcrypt 해시
    cur.execute(
        "INSERT INTO users (username, password_hash) "
        "VALUES (%s, crypt(%s, gen_salt('bf')))",
        (username, password),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True, "msg": "회원가입 완료. 로그인 해 주세요."})


@app.route("/api/login", methods=["POST"])
def login():
    data = request.json or {}
    username = (data.get("username") or "").strip()
    password = (data.get("password") or "").strip()

    if not username or not password:
        return jsonify({"ok": False, "msg": "아이디와 비밀번호를 입력해 주세요."}), 400

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 비밀번호 검증: crypt 사용 (pgcrypto)
    cur.execute(
        """
        SELECT id, username, is_admin
        FROM users
        WHERE username = %s
          AND password_hash = crypt(%s, password_hash)
        """,
        (username, password),
    )
    user = cur.fetchone()
    conn.close()

    if not user:
        return jsonify({"ok": False, "msg": "아이디 또는 비밀번호가 잘못되었습니다."}), 401

    session["user_id"] = user["id"]
    session["is_admin"] = bool(user["is_admin"])
    return jsonify({"ok": True, "user": user})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})
    

# ------------------------------------------------
# 게시글 목록 / 작성 / 상세
# ------------------------------------------------
@app.route("/api/posts", methods=["GET"])
def list_posts():
    category = (request.args.get("category") or "").strip()
    q = (request.args.get("q") or "").strip()

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    base_sql = """
        SELECT p.id, p.title, p.category, p.created_at,
               u.username AS author
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
    """
    conditions = []
    params = []

    if category:
        conditions.append("p.category = %s")
        params.append(category)
    if q:
        conditions.append("(p.title ILIKE %s OR p.content ILIKE %s)")
        like = f"%{q}%"
        params.extend([like, like])

    if conditions:
        base_sql += " WHERE " + " AND ".join(conditions)

    base_sql += " ORDER BY p.id DESC"

    cur.execute(base_sql, params)
    posts = cur.fetchall()

    # 각 게시글의 첫 번째 이미지 썸네일
    post_ids = [p["id"] for p in posts]
    thumbs = {}
    if post_ids:
        cur.execute(
            """
            SELECT DISTINCT ON (post_id) post_id, data
            FROM post_images
            WHERE post_id = ANY(%s)
            ORDER BY post_id, id ASC
            """,
            (post_ids,),
        )
        for row in cur.fetchall():
            thumbs[row["post_id"]] = row["data"]

    conn.close()

    for p in posts:
        p["thumbnail"] = thumbs.get(p["id"])

    return jsonify({"ok": True, "posts": posts})


@app.route("/api/posts", methods=["POST"])
def create_post():
    user = get_current_user()
    if not user:
        return jsonify({"ok": False, "msg": "로그인이 필요합니다."}), 401

    data = request.json or {}
    title = (data.get("title") or "").strip()
    content = (data.get("content") or "").strip()
    category = (data.get("category") or "자유").strip() or "자유"
    images = data.get("images") or []  # base64 data URL 리스트

    if not title or not content:
        return jsonify({"ok": False, "msg": "제목과 내용을 입력해 주세요."}), 400

    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        INSERT INTO posts (title, content, category, author_id, created_at)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id
        """,
        (title, content, category, user["id"], datetime.utcnow()),
    )
    post_id = cur.fetchone()["id"]

    # 이미지 저장 (base64 문자열 그대로 TEXT 컬럼에 저장)
    for img in images[:10]:  # 최대 10장 정도 제한
        if isinstance(img, str) and img.startswith("data:image"):
            cur.execute(
                "INSERT INTO post_images (post_id, data) VALUES (%s, %s)",
                (post_id, img),
            )

    conn.commit()
    conn.close()

    return jsonify({"ok": True, "post_id": post_id})


@app.route("/api/posts/<int:post_id>", methods=["GET"])
def get_post(post_id):
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute(
        """
        SELECT p.id, p.title, p.content, p.category, p.created_at,
               u.username AS author
        FROM posts p
        LEFT JOIN users u ON p.author_id = u.id
        WHERE p.id = %s
        """,
        (post_id,),
    )
    post = cur.fetchone()
    if not post:
        conn.close()
        return jsonify({"ok": False, "msg": "존재하지 않는 게시글입니다."}), 404

    cur.execute(
        """
        SELECT id, data
        FROM post_images
        WHERE post_id = %s
        ORDER BY id ASC
        """,
        (post_id,),
    )
    images = cur.fetchall()

    cur.execute(
        """
        SELECT c.id, c.content, c.created_at,
               u.username AS author
        FROM comments c
        LEFT JOIN users u ON c.author_id = u.id
        WHERE c.post_id = %s
        ORDER BY c.id ASC
        """,
        (post_id,),
    )
    comments = cur.fetchall()
    conn.close()

    return jsonify(
        {
            "ok": True,
            "post": post,
            "images": images,
            "comments": comments,
        }
    )


@app.route("/api/posts/<int:post_id>/delete", methods=["POST"])
def delete_post(post_id):
    user = get_current_user()
    if not user or not user["is_admin"]:
        return jsonify({"ok": False, "msg": "관리자만 삭제할 수 있습니다."}), 403

    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM post_images WHERE post_id = %s", (post_id,))
    cur.execute("DELETE FROM comments WHERE post_id = %s", (post_id,))
    cur.execute("DELETE FROM posts WHERE id = %s", (post_id,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ------------------------------------------------
# 댓글
# ------------------------------------------------
@app.route("/api/posts/<int:post_id>/comments", methods=["POST"])
def add_comment(post_id):
    user = get_current_user()
    if not user:
        return jsonify({"ok": False, "msg": "로그인이 필요합니다."}), 401

    data = request.json or {}
    content = (data.get("content") or "").strip()
    if not content:
        return jsonify({"ok": False, "msg": "댓글 내용을 입력해 주세요."}), 400

    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO comments (content, author_id, post_id, created_at)
        VALUES (%s, %s, %s, %s)
        """,
        (content, user["id"], post_id, datetime.utcnow()),
    )
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ------------------------------------------------
# 헬스체크
# ------------------------------------------------
@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "message": "school community api running"})


# Vercel은 모듈 레벨의 app 객체를 자동 인식
if __name__ == "__main__":
    app.run(debug=True)
