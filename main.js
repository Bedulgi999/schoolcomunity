const API_BASE = "/api";

let currentUser = null;
let currentCategory = "";
let currentPostId = null;
let selectedImages = []; // base64 data URL 배열

// ------------------ 유틸 ------------------
function showFlash(message, type = "success") {
  const area = document.getElementById("flash-area");
  if (!area) return;
  const div = document.createElement("div");
  div.className = `flash flash-${type}`;
  div.textContent = message;
  area.appendChild(div);
  setTimeout(() => {
    div.remove();
  }, 3000);
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path, {
    credentials: "include"
  });
  return res.json();
}

async function apiPost(path, body = {}) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body)
  });
  return res.json();
}

// ------------------ 로그인 상태 ------------------
async function loadMe() {
  const data = await apiGet("/me");
  if (data.ok && data.user) {
    currentUser = data.user;
  } else {
    currentUser = null;
  }
  renderAuthArea();
  renderLoginCards();
}

// 헤더 오른쪽 영역
function renderAuthArea() {
  const area = document.getElementById("auth-area");
  area.innerHTML = "";

  if (currentUser) {
    const span = document.createElement("span");
    span.textContent = `안녕, ${currentUser.username}님`;
    area.appendChild(span);

    const writeBtn = document.createElement("button");
    writeBtn.className = "btn-outline";
    writeBtn.textContent = "✏️ 글쓰기";
    writeBtn.onclick = () => {
      document.getElementById("write-card").classList.remove("hidden");
      document.getElementById("write-title").focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    area.appendChild(writeBtn);

    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn-primary";
    logoutBtn.textContent = "로그아웃";
    logoutBtn.onclick = async () => {
      const res = await apiPost("/logout");
      if (res.ok) {
        showFlash("로그아웃 되었습니다.", "success");
        currentUser = null;
        document.getElementById("write-card").classList.add("hidden");
        document.getElementById("post-detail").classList.add("hidden");
        await loadMe();
        await loadPosts();
      }
    };
    area.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement("button");
    loginBtn.className = "btn-outline";
    loginBtn.textContent = "로그인";
    loginBtn.onclick = () => {
      document.getElementById("login-card").classList.remove("hidden");
      document.getElementById("register-card").classList.add("hidden");
    };
    const regBtn = document.createElement("button");
    regBtn.className = "btn-primary";
    regBtn.textContent = "회원가입";
    regBtn.onclick = () => {
      document.getElementById("login-card").classList.add("hidden");
      document.getElementById("register-card").classList.remove("hidden");
    };
    area.appendChild(loginBtn);
    area.appendChild(regBtn);
  }
}

// 사이드바 로그인 / 회원가입 카드
function renderLoginCards() {
  const loginCard = document.getElementById("login-card");
  const registerCard = document.getElementById("register-card");
  if (currentUser) {
    loginCard.classList.add("hidden");
    registerCard.classList.add("hidden");
  } else {
    loginCard.classList.remove("hidden");
  }
}

// ------------------ 게시글 목록 ------------------
async function loadPosts() {
  const searchInput = document.getElementById("search-input");
  const q = searchInput.value.trim();
  const params = new URLSearchParams();
  if (currentCategory) params.set("category", currentCategory);
  if (q) params.set("q", q);

  const data = await apiGet("/posts?" + params.toString());
  const tbody = document.getElementById("post-list-body");
  tbody.innerHTML = "";

  if (!data.ok || !data.posts || data.posts.length === 0) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td colspan="4" class="empty-row">등록된 게시글이 없습니다. 첫 글을 작성해 보세요!</td>`;
    tbody.appendChild(tr);
    return;
  }

  data.posts.forEach(p => {
    const tr = document.createElement("tr");
    tr.className = "post-row";
    tr.onclick = () => openPost(p.id);
    tr.innerHTML = `
      <td>[${p.category || "자유"}]</td>
      <td>${p.title}</td>
      <td>${p.author || "익명"}</td>
      <td>${formatDate(p.created_at)}</td>
    `;
    tbody.appendChild(tr);
  });
}

function formatDate(dt) {
  if (!dt) return "";
  // dt = "2025-03-10T12:34:56.123456+00:00" 형태일 수 있음
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

// ------------------ 글 상세 ------------------
async function openPost(id) {
  const data = await apiGet(`/posts/${id}`);
  if (!data.ok) {
    showFlash(data.msg || "게시글을 불러오지 못했습니다.", "error");
    return;
  }
  currentPostId = id;

  const p = data.post;
  const images = data.images || [];
  const comments = data.comments || [];

  document.getElementById("detail-category").textContent = `[${p.category || "자유"}]`;
  document.getElementById("detail-title").textContent = p.title;
  document.getElementById("detail-author").textContent = `작성자: ${p.author || "익명"}`;
  document.getElementById("detail-date").textContent = `작성일: ${formatDate(p.created_at)}`;
  document.getElementById("detail-content").textContent = p.content;

  const imgBox = document.getElementById("detail-images");
  imgBox.innerHTML = "";
  images.forEach(img => {
    const el = document.createElement("img");
    el.src = img.data;
    imgBox.appendChild(el);
  });

  // 댓글 리스트
  const list = document.getElementById("comment-list");
  list.innerHTML = "";
  if (comments.length === 0) {
    const li = document.createElement("li");
    li.className = "empty-row";
    li.textContent = "아직 댓글이 없습니다. 첫 댓글을 남겨보세요!";
    list.appendChild(li);
  } else {
    comments.forEach(c => {
      const li = document.createElement("li");
      li.className = "comment-item";
      li.innerHTML = `
        <div class="comment-meta">
          <span>${c.author || "익명"}</span>
          <span>${formatDate(c.created_at)}</span>
        </div>
        <div class="comment-content">${c.content}</div>
      `;
      list.appendChild(li);
    });
  }

  // 댓글 입력 폼
  const commentArea = document.getElementById("comment-form-area");
  commentArea.innerHTML = "";
  if (currentUser) {
    const form = document.createElement("form");
    form.className = "form-box";
    form.innerHTML = `
      <label>댓글 작성</label>
      <textarea id="comment-input" rows="3" required></textarea>
      <button type="submit" class="btn-primary">등록</button>
    `;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const content = document.getElementById("comment-input").value.trim();
      if (!content) return;
      const res = await apiPost(`/posts/${currentPostId}/comments`, { content });
      if (res.ok) {
        showFlash("댓글이 등록되었습니다.", "success");
        await openPost(currentPostId);
      } else {
        showFlash(res.msg || "댓글 등록 실패", "error");
      }
    };
    commentArea.appendChild(form);
  } else {
    const ptag = document.createElement("p");
    ptag.className = "small-text";
    ptag.innerHTML = `댓글을 작성하려면 <strong>로그인</strong> 해 주세요.`;
    commentArea.appendChild(ptag);
  }

  // 관리자 삭제 버튼
  const delBtn = document.getElementById("delete-post-btn");
  if (currentUser && currentUser.is_admin) {
    delBtn.classList.remove("hidden");
    delBtn.onclick = async () => {
      if (!confirm("정말 이 게시글을 삭제할까요?")) return;
      const res = await apiPost(`/posts/${currentPostId}/delete`);
      if (res.ok) {
        showFlash("게시글이 삭제되었습니다.", "success");
        document.getElementById("post-detail").classList.add("hidden");
        await loadPosts();
      } else {
        showFlash(res.msg || "삭제 실패", "error");
      }
    };
  } else {
    delBtn.classList.add("hidden");
  }

  document.getElementById("post-detail").classList.remove("hidden");
}

// ------------------ 글쓰기 ------------------
function setupImageInput() {
  const input = document.getElementById("write-images");
  const preview = document.getElementById("image-preview");
  input.addEventListener("change", () => {
    selectedImages = [];
    preview.innerHTML = "";

    const files = Array.from(input.files || []).slice(0, 10);
    if (files.length === 0) return;

    files.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        selectedImages.push(dataUrl);
        const img = document.createElement("img");
        img.src = dataUrl;
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });
}

function setupWriteForm() {
  const form = document.getElementById("write-form");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) {
      showFlash("로그인 후 글을 작성할 수 있습니다.", "error");
      return;
    }

    const title = document.getElementById("write-title").value.trim();
    const content = document.getElementById("write-content").value.trim();
    const category = document.getElementById("write-category").value;

    if (!title || !content) {
      showFlash("제목과 내용을 입력해 주세요.", "error");
      return;
    }

    const res = await apiPost("/posts", {
      title,
      content,
      category,
      images: selectedImages
    });

    if (res.ok) {
      showFlash("게시글이 등록되었습니다.", "success");
      form.reset();
      selectedImages = [];
      document.getElementById("image-preview").innerHTML = "";
      document.getElementById("write-card").classList.add("hidden");
      await loadPosts();
    } else {
      showFlash(res.msg || "등록 실패", "error");
    }
  });

  document.getElementById("cancel-write-btn").onclick = () => {
    document.getElementById("write-card").classList.add("hidden");
  };
}

// ------------------ 로그인 / 회원가입 ------------------
function setupAuthForms() {
  document.getElementById("show-register").onclick = () => {
    document.getElementById("login-card").classList.add("hidden");
    document.getElementById("register-card").classList.remove("hidden");
  };
  document.getElementById("show-login").onclick = () => {
    document.getElementById("register-card").classList.add("hidden");
    document.getElementById("login-card").classList.remove("hidden");
  };

  const loginForm = document.getElementById("login-form");
  loginForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim();
    const password = document.getElementById("login-password").value.trim();
    const res = await apiPost("/login", { username, password });
    if (res.ok) {
      showFlash("로그인 되었습니다.", "success");
      currentUser = res.user;
      document.getElementById("login-form").reset();
      await loadMe();
      await loadPosts();
    } else {
      showFlash(res.msg || "로그인 실패", "error");
    }
  };

  const regForm = document.getElementById("register-form");
  regForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById("register-username").value.trim();
    const password = document.getElementById("register-password").value.trim();
    const res = await apiPost("/register", { username, password });
    if (res.ok) {
      showFlash("회원가입 완료! 로그인해 주세요.", "success");
      document.getElementById("register-form").reset();
      document.getElementById("register-card").classList.add("hidden");
      document.getElementById("login-card").classList.remove("hidden");
    } else {
      showFlash(res.msg || "회원가입 실패", "error");
    }
  };
}

// ------------------ 네비 & 검색 ------------------
function setupNavAndSearch() {
  const navBtns = document.querySelectorAll(".nav-btn");
  navBtns.forEach(btn => {
    btn.addEventListener("click", async () => {
      navBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentCategory = btn.dataset.category || "";
      await loadPosts();
    });
  });

  document.getElementById("logo-btn").onclick = async () => {
    currentCategory = "";
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    await loadPosts();
  };

  const searchForm = document.getElementById("search-form");
  searchForm.onsubmit = async (e) => {
    e.preventDefault();
    await loadPosts();
  };

  document.getElementById("post-detail-close").onclick = () => {
    document.getElementById("post-detail").classList.add("hidden");
  };
}

// ------------------ 초기화 ------------------
window.addEventListener("DOMContentLoaded", async () => {
  setupImageInput();
  setupWriteForm();
  setupAuthForms();
  setupNavAndSearch();
  await loadMe();
  await loadPosts();
});
