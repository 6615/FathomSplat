document.documentElement.classList.add("js");

const navToggle = document.querySelector(".nav-toggle");
const navLinks = document.querySelector(".nav-links");
const statusLine = document.querySelector("#link-status");
const themeToggle = document.querySelector("#theme-toggle");
const themeColor = document.querySelector('meta[name="theme-color"]');

function applyTheme(theme, persist = true) {
  const nextTheme = theme === "dark" ? "dark" : "light";
  const isDark = nextTheme === "dark";
  document.documentElement.setAttribute("data-theme", nextTheme);
  themeToggle?.setAttribute("aria-pressed", String(isDark));
  themeToggle?.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  if (themeToggle) themeToggle.title = `Use ${isDark ? "light" : "dark"} page theme`;
  if (themeColor) themeColor.content = isDark ? "#0d1716" : "#e9ecef";
  if (persist) {
    try {
      localStorage.setItem("fathomsplat-theme", nextTheme);
    } catch (error) {}
  }
}

applyTheme(document.documentElement.dataset.theme, false);
themeToggle?.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

if (navToggle && navLinks) {
  navToggle.addEventListener("click", () => {
    const open = navLinks.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(open));
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

document.querySelectorAll("[data-unavailable]").forEach((link) => {
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (!statusLine) return;
    statusLine.textContent = link.dataset.unavailable;
    window.clearTimeout(statusLine.dataset.timer);
    const timer = window.setTimeout(() => {
      statusLine.textContent = "";
    }, 4200);
    statusLine.dataset.timer = String(timer);
  });
});

document.querySelectorAll("[data-sync-group]").forEach((group) => {
  const videos = [...group.querySelectorAll("video")];
  if (videos.length < 2) return;

  const [master, ...followers] = videos;
  const syncFollowers = () => {
    followers.forEach((video) => {
      if (Math.abs(video.currentTime - master.currentTime) > 0.35) {
        video.currentTime = master.currentTime;
      }
    });
  };

  master.addEventListener("timeupdate", syncFollowers);
  master.addEventListener("play", () => followers.forEach((video) => video.play().catch(() => {})));
  master.addEventListener("pause", () => followers.forEach((video) => video.pause()));
  master.addEventListener("seeking", syncFollowers);
});

const copyButton = document.querySelector("[data-copy-target]");
if (copyButton) {
  copyButton.addEventListener("click", async () => {
    const target = document.getElementById(copyButton.dataset.copyTarget);
    if (!target) return;

    const text = target.textContent.trim();
    try {
      await navigator.clipboard.writeText(text);
      copyButton.textContent = "Copied";
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(target);
      selection.removeAllRanges();
      selection.addRange(range);
      copyButton.textContent = "Selected";
    }

    window.setTimeout(() => {
      copyButton.textContent = "Copy BibTeX";
    }, 1800);
  });
}

const revealItems = document.querySelectorAll(".reveal");
if ("IntersectionObserver" in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.08 });

  revealItems.forEach((item) => revealObserver.observe(item));
} else {
  revealItems.forEach((item) => item.classList.add("is-visible"));
}

const sections = [...document.querySelectorAll("main section[id]")];
const sectionLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];

if ("IntersectionObserver" in window && sections.length) {
  const sectionObserver = new IntersectionObserver((entries) => {
    const visible = entries
      .filter((entry) => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

    if (!visible) return;
    sectionLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${visible.target.id}`);
    });
  }, { rootMargin: "-25% 0px -60% 0px", threshold: [0.01, 0.2, 0.5] });

  sections.forEach((section) => sectionObserver.observe(section));
}

const currentYear = document.querySelector("#current-year");
if (currentYear) currentYear.textContent = String(new Date().getFullYear());
