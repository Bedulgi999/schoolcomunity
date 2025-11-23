# 우리 학교 커뮤니티 - 배포 가이드 (Vercel + Supabase)

1) Supabase 준비
   - 프로젝트 생성
   - SQL 편집기에서 아래 실행:

     CREATE TABLE users (
       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       username TEXT UNIQUE NOT NULL,
       password_hash TEXT NOT NULL,
       is_admin BOOLEAN DEFAULT FALSE
     );

     CREATE TABLE posts (
       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       title TEXT NOT NULL,
       content TEXT NOT NULL,
       category TEXT,
       author_id BIGINT,
       created_at TIMESTAMP DEFAULT NOW(),
       FOREIGN KEY (author_id) REFERENCES users(id)
     );

     CREATE TABLE comments (
       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       content TEXT NOT NULL,
       author_id BIGINT,
       post_id BIGINT,
       created_at TIMESTAMP DEFAULT NOW(),
       FOREIGN KEY (author_id) REFERENCES users(id),
       FOREIGN KEY (post_id) REFERENCES posts(id)
     );

     CREATE TABLE post_images (
       id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
       post_id BIGINT REFERENCES posts(id) ON DELETE CASCADE,
       data TEXT NOT NULL
     );

   - 관리자 계정 만들기:

     INSERT INTO users (username, password_hash, is_admin)
     VALUES ('admin', crypt('hanbomadmin1234', gen_salt('bf')), TRUE);

2) Supabase 접속 URL 가져오기
   - Settings → Database → "Connect" 버튼 → Connection string (Type=URI)
   - postgresql://postgres:[YOUR_PASSWORD]@... 형식
   - [YOUR_PASSWORD] 를 실제 DB 비밀번호로 바꾼 뒤 복사

3) Vercel 환경 변수 설정
   - 프로젝트 Settings → Environment Variables:
     SUPABASE_DB = (위에서 복사한 postgresql://...)
     SECRET_KEY  = (아무 랜덤 문자열)

4) GitHub에 업로드
   - 이 폴더( index.html, style.css, main.js, api_index.py, vercel.json, requirements.txt, README_DEPLOY.txt ) 그대로 push

5) Vercel에서 "Import Git Repository"로 연결 후 Deploy

6) 배포가 끝나면
   - https://프로젝트이름.vercel.app 접속
   - admin / hanbomadmin1234 로 로그인 → 관리자 삭제 기능 사용 가능
