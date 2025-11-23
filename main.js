/* ================================
 🏫 우리 학교 커뮤니티 main.js
================================ */

/* ====== 기본 변수 ====== */
const apiBase = "/api";
let currentUser = null;
let currentCategory = "";
let currentPostId = null;

/* ====== DOM ====== */
const authArea = document.getElementById("auth-area");
const postListBody = document.getElementById("post-list");
const writeCard = document.getElementById("write-card");
const writeForm = document.getElementById("write-form");
const detailCard = document.getElementById("post-detail");
const commentList = document.getElementById("comment-list");
const commentFormArea = document.getElementById("comment-form");
const deletePostBtn = document.getElementById("delete-post");
const flashMsg = document.getElementById("flash-msg");
const detailImagesBox = document.getElementById("detail-images");

/* =====================================
  🚨 Flash 메시지
===================================== */
function flash(text, color = "#4a7dfc") {
  flashMsg.textContent = text;
  flashMsg.style.background = color;
  flashMsg.classList.remove("hidden");
  setTimeout(() => flashMsg.classList.add("hidden"), 2000);
}

/* =====================================
  👤 유저 정보 확인
===================================== */
async function checkUser() {
  const res = await fetch(`${apiBase}/user`);
  const data = await res.json();
  currentUser = data.user;

  if (currentUser) {
    authArea.innerHTML = `
      <span><b>${currentUser.username}</b>님</span>
      <button class="btn-login" id="write-btn">글쓰기</button>
      <button class="btn-logout" id="logout-btn">로그아웃</button>
    `;
    document.getElementById("write-btn").onclick = () => showWrite();
    document.getElementById("logout-btn").onclick = () => logout();
  } else {
    authArea.innerHTML = `
      <button class="btn-login" id="goto-login">로그인</button>
    `;
    document.getElementById("goto-login").onclick = () =>
      document.querySelector("#login-card").scrollIntoView({ behavior: "smooth" });
  }
}

/* =====================================
  📌 로그인 / 회원가입
===================================== */
document.getElementById("login-form").onsubmit = async (e) => {
  e.preventDefault();
  const username = loginUsername.value;
  const password = loginPassword.value;

  const res = await fetch(`${apiBase}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!data.ok) return flash(data.error, "red");
  flash("로그인 완료!");
  checkUser();
};

document.getElementById("register-form").onsubmit = async (e) => {
  e.preventDefault();
  const username = registerUsername.value;
  const password = registerPassword.value;

  const res = await fetch(`${apiBase}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const data = await res.json();

  if (!data.ok) return flash(data.error, "red");
  flash("회원가입 완료!");
};

/* 로그인/회원가입 토글 */
document.getElementById("goto-register").onclick = () => {
  loginCard.classList.add("hidden");
  registerCard.classList.remove("hidden");
};
document.getElementById("goto-login").onclick = () => {
  registerCard.classList.add("hidden");
  loginCard.classList.remove("hidden");
};

/* =====================================
  🚪 로그아웃
===================================== */
async function logout() {
  await fetch(`${apiBase}/logout`, { method: "POST" });
  flash("로그아웃 되었습니다.");
  checkUser();
}

/* =====================================
  📝 글 불러오기
===================================== */
async function loadPosts() {
  const res = await fetch(`${apiBase}/posts?category=${currentCategory}`);
  const data = await res.json();

  postListBody.innerHTML = "";
  data.posts.forEach((p) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.category}</td>
      <td>${p.title}</td>
      <td>${p.username}</td>
      <td>${p.time}</td>
    `;
    row.onclick = () => loadDetail(p.id);
    postListBody.appendChild(row);
  });
}

/* =====================================
  🔎 검색
===================================== */
document.getElementById("search-form").onsubmit = async (e) => {
  e.preventDefault();
  const q = document.getElementById("search-input").value;

  const res = await fetch(`${apiBase}/search?q=${encodeURIComponent(q)}`);
  const data = await res.json();

  postListBody.innerHTML = "";
  data.posts.forEach((p) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${p.category}</td>
      <td>${p.title}</td>
      <td>${p.username}</td>
      <td>${p.time}</td>
    `;
    row.onclick = () => loadDetail(p.id);
    postListBody.appendChild(row);
  });
};

/* =====================================
  🖼 이미지 미리보기
===================================== */
document.getElementById("write-images").onchange = function () {
  const preview = document.getElementById("write-preview");
  preview.innerHTML = "";
  [...this.files].forEach((file) => {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(file);
    preview.appendChild(img);
  });
};

/* =====================================
  ✏️ 글 작성
===================================== */
async function showWrite() {
  writeCard.classList.remove("hidden");
  detailCard.classList.add("hidden");
}

document.getElementById("cancel-write").onclick = () => {
  writeCard.classList.add("hidden");
};

writeForm.onsubmit = async (e) => {
  e.preventDefault();

  const formData = new FormData();
  formData.append("category", writeCategory.value);
  formData.append("title", writeTitle.value);
  formData.append("content", writeContent.value);

  [...writeImages.files].forEach((file) => formData.append("images", file));

  const res = await fetch(`${apiBase}/write`, { method: "POST", body: formData });
  const data = await res.json();

  if (!data.ok) return flash(data.error, "red");

  flash("등록 완료!");
  writeCard.classList.add("hidden");
  loadPosts();
};

/* =====================================
  📄 글 상세보기 + 댓글
===================================== */
async function loadDetail(id) {
  currentPostId = id;
  const res = await fetch(`${apiBase}/post/${id}`);
  const data = await res.json();

  if (!data.ok) return flash("게시글 오류", "red");

  detailCard.classList.remove("hidden");
  writeCard.classList.add("hidden");

  detailTitle.textContent = data.title;
  detailCategory.textContent = data.category;
  detailContent.textContent = data.content;
  detailAuthor.textContent = data.username;
  detailDate.textContent = data.time;

  // 이미지 출력
  detailImagesBox.innerHTML = "";
  data.images.forEach((url) => {
    const img = document.createElement("img");
    img.src = url;
    detailImagesBox.appendChild(img);
  });

  commentList.innerHTML = "";
  data.comments.forEach((c) => {
    const li = document.createElement("li");
    li.innerHTML = `<b>${c.username}</b> : ${c.text}`;
    commentList.appendChild(li);
  });

  // 댓글 폼
  if (currentUser) {
    commentFormArea.innerHTML = `
      <form id="comment-form">
        <input type="text" id="comment-text" placeholder="댓글 입력...">
        <button class="btn-primary small">등록</button>
      </form>
    `;
    document.getElementById("comment-form").onsubmit = commentSubmit;
  } else {
    commentFormArea.innerHTML = `<div>댓글 작성은 로그인 후 가능합니다.</div>`;
  }

  // 관리자 버튼
  deletePostBtn.classList.toggle("hidden", !data.is_admin);
  deletePostBtn.onclick = () => deletePost(id);
}

async function commentSubmit(e) {
  e.preventDefault();
  const text = document.getElementById("comment-text").value;

  const res = await fetch(`${apiBase}/comment/${currentPostId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const data = await res.json();
  if (!data.ok) return flash(data.error, "red");
  loadDetail(currentPostId);
}

/* =====================================
  ❌ 게시글 삭제 (관리자)
===================================== */
async function deletePost(id) {
  const res = await fetch(`${apiBase}/delete/${id}`, { method: "DELETE" });
  const data = await res.json();

  if (!data.ok) return flash(data.error, "red");

  flash("삭제 완료!");
  detailCard.classList.add("hidden");
  loadPosts();
}

/* =====================================
  📌 카테고리 버튼
===================================== */
document.querySelectorAll(".nav-btn").forEach((btn) => {
  btn.onclick = () => {
    currentCategory = btn.dataset.category;
    loadPosts();
  };
});

/* =====================================
  🚀 실행 초기
===================================== */
checkUser();
loadPosts();
