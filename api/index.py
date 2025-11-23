from flask import Flask, request, jsonify, session
import os, psycopg2, boto3, uuid
from psycopg2.extras import RealDictCursor
from werkzeug.utils import secure_filename
from datetime import timedelta

# ==============================
#   🏫 Flask 기본 설정
# ==============================
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "change_this_secret_key")
app.config["PERMANENT_SESSION_LIFETIME"] = timedelta(days=7)


# ==============================
#   🔌 DB 연결 함수
# ==============================
def db():
    dsn = os.environ.get("SUPABASE_DB")
    conn = psycopg2.connect(dsn, sslmode="require")
    return conn


# ==============================
#   🧾 Supabase Storage 설정
# ==============================
SUPABASE_URL = os.environ.get("postgresql://postgres:hanbomadmin1234@db.trahpfqiobymcghpfjsa.supabase.co:5432/postgres")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

s3 = boto3.client(
    "s3",
    endpoint_url=f"{SUPABASE_URL}/storage/v1/s3",
    aws_access_key_id="service_role",  # Supabase Storage Key type
    aws_secret_access_key=SUPABASE_KEY
)

BUCKET = "community-img"


# ==============================
#   👤 유저 확인
# ==============================
def current_user():
    if "uid" not in session:
        return None
    conn = db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, username, is_admin FROM users WHERE id = %s", (session["uid"],))
    u = cur.fetchone()
    conn.close()
    return u


# ==============================
#   🧪 테스트
# ==============================
@app.route("/api/test")
def test():
    return jsonify({"ok": True, "msg": "API LIVE"})


# ==============================
#   🔐 로그인 / 회원가입 / 로그아웃
# ==============================
@app.route("/api/register", methods=["POST"])
def register():
    d = request.json
    username, password = d["username"], d["password"]
    conn = db()
    cur = conn.cursor()
    try:
        cur.execute("INSERT INTO users(username, password_hash) VALUES (%s, crypt(%s, gen_salt('bf')))", (username, password))
        conn.commit()
        return jsonify({"ok": True})
    except:
        conn.rollback()
        return jsonify({"ok": False, "error": "이미 존재하는 아이디"})
    finally:
        conn.close()


@app.route("/api/login", methods=["POST"])
def login():
    d = request.json
    username, password = d["username"], d["password"]

    conn = db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT id, username, is_admin FROM users WHERE username = %s AND password_hash = crypt(%s, password_hash)", (username, password))
    user = cur.fetchone()
    conn.close()

    if user:
        session["uid"] = user["id"]
        session.permanent = True
        return jsonify({"ok": True})
    return jsonify({"ok": False, "error": "아이디 또는 비밀번호 오류"})


@app.route("/api/logout", methods=["POST"])
def logout():
    session.clear()
    return jsonify({"ok": True})


@app.route("/api/user")
def userinfo():
    return jsonify({"user": current_user()})


# ==============================
#   📰 글 목록 + 검색
# ==============================
@app.route("/api/posts")
def posts():
    cat = request.args.get("category", "")

    conn = db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    if cat:
        cur.execute("""
            SELECT posts.id, category, title, users.username, to_char(time, 'YYYY-MM-DD HH24:MI') AS time
            FROM posts JOIN users ON posts.user_id = users.id
            WHERE category = %s ORDER BY posts.id DESC
        """, (cat,))
    else:
        cur.execute("""
            SELECT posts.id, category, title, users.username, to_char(time, 'YYYY-MM-DD HH24:MI') AS time
            FROM posts JOIN users ON posts.user_id = users.id
            ORDER BY posts.id DESC
        """)
    rows = cur.fetchall()
    conn.close()
    return jsonify({"posts": rows})


@app.route("/api/search")
def search():
    q = request.args.get("q", "")
    conn = db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("""
        SELECT posts.id, category, title, users.username, to_char(time, 'YYYY-MM-DD HH24:MI') AS time
        FROM posts JOIN users ON posts.user_id = users.id
        WHERE title LIKE %s
        ORDER BY posts.id DESC
    """, (f"%{q}%",))
    data = cur.fetchall()
    conn.close()
    return jsonify({"posts": data})


# ==============================
#   🖼 이미지 업로드 (Storage)
# ==============================
def upload_img(file):
    fname = secure_filename(file.filename)
    ext = fname.split(".")[-1]
    filename = f"{uuid.uuid4()}.{ext}"

    s3.upload_fileobj(
        file,
        BUCKET,
        filename,
        ExtraArgs={"ContentType": file.content_type}
    )
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{filename}"


# ==============================
#   📝 글 작성
# ==============================
@app.route("/api/write", methods=["POST"])
def write():
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "로그인 필요"})

    cat = request.form.get("category")
    title = request.form.get("title")
    content = request.form.get("content")
    files = request.files.getlist("images")

    urls = [upload_img(f) for f in files]

    conn = db()
    cur = conn.cursor()
    cur.execute("INSERT INTO posts(category, title, content, user_id) VALUES (%s, %s, %s, %s) RETURNING id",
                (cat, title, content, user["id"]))
    pid = cur.fetchone()[0]

    for u in urls:
        cur.execute("INSERT INTO post_images(post_id, url) VALUES (%s, %s)", (pid, u))

    conn.commit()
    conn.close()

    return jsonify({"ok": True})


# ==============================
#   📄 글 상세 + 댓글
# ==============================
@app.route("/api/post/<int:pid>")
def detail(pid):
    user = current_user()

    conn = db()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("""
        SELECT posts.id, category, title, content, users.username, to_char(time,'YYYY-MM-DD HH24:MI') as time
        FROM posts JOIN users ON posts.user_id = users.id WHERE posts.id = %s
    """, (pid,))
    post = cur.fetchone()

    cur.execute("SELECT url FROM post_images WHERE post_id = %s", (pid,))
    imgs = [x["url"] for x in cur.fetchall()]

    cur.execute("SELECT users.username, text FROM comments JOIN users ON comments.user_id = users.id WHERE post_id = %s ORDER BY comments.id", (pid,))
    comments = cur.fetchall()

    conn.close()

    post["images"] = imgs
    post["comments"] = comments
    post["is_admin"] = bool(user and user["is_admin"])

    return jsonify(post)


@app.route("/api/comment/<int:pid>", methods=["POST"])
def comment(pid):
    user = current_user()
    if not user:
        return jsonify({"ok": False, "error": "로그인 필요"})

    text = request.json["text"]

    conn = db()
    cur = conn.cursor()
    cur.execute("INSERT INTO comments(post_id, user_id, text) VALUES (%s, %s, %s)", (pid, user["id"], text))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


# ==============================
#   ❌ 게시글 삭제 (관리자)
# ==============================
@app.route("/api/delete/<int:pid>", methods=["DELETE"])
def delete(pid):
    user = current_user()
    if not user or not user["is_admin"]:
        return jsonify({"ok": False, "error": "관리자만 삭제 가능"})

    conn = db()
    cur = conn.cursor()
    cur.execute("DELETE FROM posts WHERE id=%s", (pid,))
    cur.execute("DELETE FROM post_images WHERE post_id=%s", (pid,))
    cur.execute("DELETE FROM comments WHERE post_id=%s", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"ok": True})
