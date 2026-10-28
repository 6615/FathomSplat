import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";

const galleryElement = document.querySelector("[data-pc-gallery]");
const dewaterElement = document.querySelector("[data-dewater-gallery]");
const standaloneElements = [...document.querySelectorAll(".pc-viewer[data-ply]")];

function formatPoints(count) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(count);
}

class PointCloudViewer {
  constructor(element, onViewChange = null) {
    this.element = element;
    this.canvasHost = element.querySelector(".pc-canvas");
    this.loading = element.querySelector(".pc-loading");
    this.loadingTitle = this.loading?.querySelector("strong");
    this.loadingDetail = this.loading?.querySelector("small");
    this.badge = element.querySelector(".pc-badge");
    this.backgroundButton = element.querySelector("[data-pc-background]");
    this.resetButton = element.querySelector("[data-pc-reset]");
    this.loaded = false;
    this.visible = true;
    this.dirty = true;
    this.initialView = null;
    this.loadToken = 0;
    this.onViewChange = onViewChange;
    this.applyingView = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.01, 1000);
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute("role", "img");
    this.canvasHost.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.075;
    this.controls.screenSpacePanning = true;
    this.controls.zoomToCursor = true;
    this.controls.addEventListener("change", () => {
      this.dirty = true;
      if (!this.applyingView) this.onViewChange?.(this);
    });

    this.backgroundButton?.addEventListener("click", () => {
      this.setLightBackground(!this.element.classList.contains("is-light"));
    });
    this.resetButton?.addEventListener("click", () => this.resetView());
    this.updateBackgroundButton();

    if ("ResizeObserver" in window) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.element);
    } else {
      window.addEventListener("resize", () => this.resize());
    }
    this.resize();
  }

  setLightBackground(useLight) {
    this.element.classList.toggle("is-light", useLight);
    this.updateBackgroundButton();
    this.dirty = true;
  }

  updateBackgroundButton() {
    if (!this.backgroundButton) return;
    const useLight = this.element.classList.contains("is-light");
    const destination = useLight ? "dark" : "light";
    this.backgroundButton.setAttribute("aria-label", `Switch this viewer to a ${destination} background`);
    this.backgroundButton.title = `Use ${destination} background`;
  }

  load(model) {
    const token = ++this.loadToken;
    this.loaded = false;
    this.element.classList.remove("is-loaded", "is-error");
    this.element.classList.add("is-loading");
    if (this.loadingTitle) this.loadingTitle.textContent = "Loading 3D preview";
    if (this.loadingDetail) this.loadingDetail.textContent = model.ply.split("/").pop();
    if (this.badge) this.badge.textContent = model.badge;
    this.renderer.domElement.setAttribute(
      "aria-label",
      `${model.name}. Drag to orbit, scroll to zoom, and right-drag to pan.`,
    );

    const loader = new PLYLoader();
    loader.load(
      model.ply,
      (geometry) => {
        if (token !== this.loadToken) {
          geometry.dispose();
          return;
        }
        this.installGeometry(geometry, model.name, model.rotation);
      },
      (event) => {
        if (token !== this.loadToken || !this.loadingDetail || !event.lengthComputable || !event.total) return;
        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        this.loadingDetail.textContent = `${percent}% · ${model.ply.split("/").pop()}`;
      },
      (error) => {
        if (token === this.loadToken) this.showError(error, model.ply);
      },
    );
  }

  installGeometry(geometry, name, rotation = [0, 0, 0]) {
    const positions = geometry.getAttribute("position");
    if (!positions?.count) {
      geometry.dispose();
      this.showError(new Error("The PLY file contains no vertices."), name);
      return;
    }

    this.disposePoints();
    geometry.rotateX(THREE.MathUtils.degToRad(rotation[0] || 0));
    geometry.rotateY(THREE.MathUtils.degToRad(rotation[1] || 0));
    geometry.rotateZ(THREE.MathUtils.degToRad(rotation[2] || 0));
    geometry.computeBoundingBox();
    const center = geometry.boundingBox.getCenter(new THREE.Vector3());
    geometry.translate(-center.x, -center.y, -center.z);
    geometry.computeBoundingSphere();

    const radius = Math.max(geometry.boundingSphere?.radius || 1, 0.01);
    const hasVertexColors = Boolean(geometry.getAttribute("color"));
    const material = new THREE.PointsMaterial({
      color: hasVertexColors ? 0xffffff : 0x58bdb0,
      opacity: 0.98,
      size: THREE.MathUtils.clamp(radius * 0.006, 0.007, 0.045),
      sizeAttenuation: true,
      transparent: true,
      vertexColors: hasVertexColors,
    });

    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.fitCamera(radius);
    this.loaded = true;
    this.element.classList.remove("is-loading");
    this.element.classList.add("is-loaded");
    this.loading?.setAttribute("aria-label", `${name} loaded`);
    this.dirty = true;
  }

  disposePoints() {
    if (!this.points) return;
    this.scene.remove(this.points);
    this.points.geometry.dispose();
    this.points.material.dispose();
    this.points = null;
  }

  fitCamera(radius) {
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov * 0.5);
    const distance = (radius / Math.sin(halfFov)) * 1.08;
    const direction = new THREE.Vector3(1.15, 0.72, 1.45).normalize();
    this.controls.target.set(0, 0, 0);
    this.camera.position.copy(direction.multiplyScalar(distance));
    this.camera.near = Math.max(radius / 1000, 0.001);
    this.camera.far = Math.max(radius * 40, 100);
    this.camera.updateProjectionMatrix();
    this.controls.minDistance = Math.max(radius * 0.15, 0.01);
    this.controls.maxDistance = radius * 14;
    this.controls.update();
    this.initialView = this.captureView();
  }

  captureView() {
    return {
      position: this.camera.position.clone(),
      target: this.controls.target.clone(),
      up: this.camera.up.clone(),
      zoom: this.camera.zoom,
    };
  }

  applyView(view) {
    if (!view) return;
    this.applyingView = true;
    this.camera.position.copy(view.position);
    this.camera.up.copy(view.up);
    this.camera.zoom = view.zoom;
    this.camera.updateProjectionMatrix();
    this.controls.target.copy(view.target);
    this.controls.update();
    this.applyingView = false;
    this.dirty = true;
  }

  resetView() {
    if (this.loaded && this.initialView) this.applyView(this.initialView);
  }

  resize() {
    const width = Math.max(1, this.canvasHost.clientWidth);
    const height = Math.max(1, this.canvasHost.clientHeight);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.dirty = true;
  }

  showError(error, path) {
    this.element.classList.remove("is-loading", "is-loaded");
    this.element.classList.add("is-error");
    if (this.loadingTitle) this.loadingTitle.textContent = "Unable to load this preview";
    if (this.loadingDetail) this.loadingDetail.textContent = "Check the local server and PLY path.";
    console.error(`[FathomSplat viewer] ${path}`, error);
  }

  render() {
    if (!this.visible || !this.loaded) return;
    const controlsChanged = this.controls.update();
    if (!controlsChanged && !this.dirty) return;
    this.renderer.render(this.scene, this.camera);
    this.dirty = false;
  }
}

class PointCloudGallery {
  constructor(element) {
    this.element = element;
    this.viewer = new PointCloudViewer(element.querySelector(".pc-viewer"));
    this.collectionTabs = element.querySelector("[data-gallery-collections]");
    this.strip = element.querySelector("[data-gallery-strip]");
    this.title = element.querySelector("[data-gallery-title]");
    this.counter = element.querySelector("[data-gallery-counter]");
    this.status = element.querySelector("[data-gallery-status]");
    this.caption = element.querySelector("[data-gallery-caption]");
    this.previousButton = element.querySelector("[data-gallery-previous]");
    this.nextButton = element.querySelector("[data-gallery-next]");
    this.activeCollectionIndex = -1;
    this.activeSceneIndex = -1;

    this.previousButton?.addEventListener("click", () => this.stepScene(-1));
    this.nextButton?.addEventListener("click", () => this.stepScene(1));
    this.strip?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      this.stepScene(event.key === "ArrowRight" ? 1 : -1, true);
    });
  }

  async initialize() {
    try {
      const response = await fetch(this.element.dataset.manifest);
      if (!response.ok) throw new Error(`Gallery manifest returned ${response.status}`);
      const manifest = await response.json();
      this.collections = manifest.collections || [];
      if (!this.collections.length) throw new Error("Gallery manifest has no collections");
      this.renderCollectionTabs();
      this.selectCollection(0);
    } catch (error) {
      this.viewer.showError(error, this.element.dataset.manifest);
      if (this.title) this.title.textContent = "Gallery unavailable";
      if (this.status) this.status.textContent = "Error";
    }
  }

  renderCollectionTabs() {
    const fragment = document.createDocumentFragment();
    this.collectionButtons = this.collections.map((collection, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gallery-collection";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", "false");
      button.textContent = collection.label;
      button.addEventListener("click", () => this.selectCollection(index));
      fragment.appendChild(button);
      return button;
    });
    this.collectionTabs.replaceChildren(fragment);
  }

  selectCollection(index) {
    this.activeCollectionIndex = index;
    this.collection = this.collections[index];
    this.scenes = this.collection.scenes || [];
    this.collectionButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === index;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    this.renderSceneButtons();
    this.selectScene(0, false, false);
  }

  renderSceneButtons() {
    const fragment = document.createDocumentFragment();
    this.sceneButtons = this.scenes.map((scene, index) => {
      const button = document.createElement("button");
      button.className = "gallery-thumb";
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      button.innerHTML = `
        <span class="gallery-thumb-image"><img src="${scene.cover}" alt="" loading="lazy"></span>
        <span class="gallery-thumb-copy"><strong>${scene.title}</strong><small>${scene.detail}</small></span>
      `;
      button.addEventListener("click", () => this.selectScene(index));
      fragment.appendChild(button);
      return button;
    });
    this.strip.replaceChildren(fragment);
  }

  selectScene(index, focus = false, scroll = true) {
    if (!this.scenes.length) return;
    const nextIndex = (index + this.scenes.length) % this.scenes.length;
    this.activeSceneIndex = nextIndex;
    const scene = this.scenes[nextIndex];
    const model = scene.model;

    this.sceneButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === nextIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const activeButton = this.sceneButtons[nextIndex];
    if (scroll) activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    if (focus) activeButton.focus({ preventScroll: true });

    if (this.title) this.title.textContent = `${this.collection.label} · ${scene.title}`;
    if (this.counter) this.counter.textContent = `${this.collection.label} · Scene ${nextIndex + 1} / ${this.scenes.length}`;
    if (this.status) this.status.textContent = `${formatPoints(model.points)} points`;
    if (this.caption) this.caption.textContent = `${scene.detail}. Lightweight preview generated only from the verified ${this.collection.label} PLY directory.`;
    this.viewer.load({
      ply: model.ply,
      name: `${this.collection.label} — ${scene.title}`,
      badge: this.collection.label,
      rotation: scene.rotation,
    });
  }

  stepScene(direction, focus = false) {
    this.selectScene(this.activeSceneIndex + direction, focus);
  }
}

class DewaterComparisonGallery {
  constructor(element) {
    this.element = element;
    this.strip = element.querySelector("[data-dewater-strip]");
    this.title = element.querySelector("[data-dewater-title]");
    this.counter = element.querySelector("[data-dewater-counter]");
    this.detail = element.querySelector("[data-dewater-detail]");
    this.previousButton = element.querySelector("[data-dewater-previous]");
    this.nextButton = element.querySelector("[data-dewater-next]");
    this.videos = {
      mediumFree: element.querySelector('[data-dewater-video="mediumFree"]'),
      underwaterBaked: element.querySelector('[data-dewater-video="underwaterBaked"]'),
    };
    this.statuses = {
      mediumFree: element.querySelector('[data-dewater-status="mediumFree"]'),
      underwaterBaked: element.querySelector('[data-dewater-status="underwaterBaked"]'),
    };
    this.activeSceneIndex = -1;

    const syncView = (source) => {
      if (!source.loaded) return;
      const view = source.captureView();
      this.viewers.forEach((peer) => {
        if (peer !== source && peer.loaded) peer.applyView(view);
      });
    };
    this.mediumFreeViewer = new PointCloudViewer(
      element.querySelector('[data-dewater-viewer="mediumFree"]'),
      syncView,
    );
    this.underwaterBakedViewer = new PointCloudViewer(
      element.querySelector('[data-dewater-viewer="underwaterBaked"]'),
      syncView,
    );
    this.viewers = [this.mediumFreeViewer, this.underwaterBakedViewer];

    this.previousButton?.addEventListener("click", () => this.stepScene(-1));
    this.nextButton?.addEventListener("click", () => this.stepScene(1));
    this.strip?.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      this.stepScene(event.key === "ArrowRight" ? 1 : -1, true);
    });
  }

  async initialize() {
    try {
      const response = await fetch(this.element.dataset.manifest);
      if (!response.ok) throw new Error(`Dewatering manifest returned ${response.status}`);
      const manifest = await response.json();
      this.scenes = manifest.scenes || [];
      if (!this.scenes.length) throw new Error("Dewatering manifest has no scenes");
      this.renderSceneButtons();
      this.selectScene(0, false, false);
    } catch (error) {
      this.viewers.forEach((viewer) => viewer.showError(error, this.element.dataset.manifest));
      if (this.title) this.title.textContent = "Water-removal comparison unavailable";
      if (this.detail) this.detail.textContent = "Error";
    }
  }

  renderSceneButtons() {
    const fragment = document.createDocumentFragment();
    this.sceneButtons = this.scenes.map((scene, index) => {
      const button = document.createElement("button");
      button.className = "gallery-thumb dewater-thumb";
      button.type = "button";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      button.innerHTML = `
        <span class="gallery-thumb-image"><img src="${scene.cover}" alt="" loading="lazy"></span>
        <span class="gallery-thumb-copy"><strong>${scene.title}</strong><small>${scene.detail}</small></span>
      `;
      button.addEventListener("click", () => this.selectScene(index));
      fragment.appendChild(button);
      return button;
    });
    this.strip.replaceChildren(fragment);
  }

  setVideo(video, source) {
    if (!video) return;
    video.pause();
    video.src = source;
    video.load();
    video.play().catch(() => {});
  }

  selectScene(index, focus = false, scroll = true) {
    if (!this.scenes?.length) return;
    const nextIndex = (index + this.scenes.length) % this.scenes.length;
    this.activeSceneIndex = nextIndex;
    const scene = this.scenes[nextIndex];

    this.sceneButtons.forEach((button, buttonIndex) => {
      const active = buttonIndex === nextIndex;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
      button.tabIndex = active ? 0 : -1;
    });
    const activeButton = this.sceneButtons[nextIndex];
    if (scroll) activeButton.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    if (focus) activeButton.focus({ preventScroll: true });

    if (this.title) this.title.textContent = scene.title;
    if (this.counter) this.counter.textContent = `Matched pair ${nextIndex + 1} / ${this.scenes.length}`;
    if (this.detail) this.detail.textContent = scene.detail;
    if (this.statuses.mediumFree) {
      this.statuses.mediumFree.textContent = `${formatPoints(scene.models.mediumFree.points)} points`;
    }
    if (this.statuses.underwaterBaked) {
      this.statuses.underwaterBaked.textContent = `${formatPoints(scene.models.underwaterBaked.points)} points`;
    }

    this.setVideo(this.videos.mediumFree, scene.videos.mediumFree);
    this.setVideo(this.videos.underwaterBaked, scene.videos.underwaterBaked);
    this.mediumFreeViewer.load({
      ply: scene.models.mediumFree.ply,
      name: `${scene.title} — medium-free`,
      badge: "Medium-free",
      rotation: scene.rotation,
    });
    this.underwaterBakedViewer.load({
      ply: scene.models.underwaterBaked.ply,
      name: `${scene.title} — underwater-baked`,
      badge: "Water applied",
      rotation: scene.rotation,
    });
  }

  stepScene(direction, focus = false) {
    this.selectScene(this.activeSceneIndex + direction, focus);
  }
}

const renderViewers = [];
const syncGroups = new Map();

const standaloneViewers = standaloneElements.map((element) => {
  const viewer = new PointCloudViewer(element, (source) => {
    const groupName = source.element.dataset.sync;
    if (!groupName || !source.loaded) return;
    const view = source.captureView();
    (syncGroups.get(groupName) || []).forEach((peer) => {
      if (peer !== source && peer.loaded) peer.applyView(view);
    });
  });
  const groupName = element.dataset.sync;
  if (groupName) {
    const group = syncGroups.get(groupName) || [];
    group.push(viewer);
    syncGroups.set(groupName, group);
  }
  viewer.load({
    ply: element.dataset.ply,
    name: element.dataset.name || "Interactive point cloud",
    badge: element.querySelector(".pc-badge")?.textContent || "3D",
    rotation: [0, 0, 0],
  });
  renderViewers.push(viewer);
  return viewer;
});

let gallery = null;
if (galleryElement) {
  gallery = new PointCloudGallery(galleryElement);
  gallery.initialize();
  renderViewers.push(gallery.viewer);
}

let dewaterGallery = null;
if (dewaterElement) {
  dewaterGallery = new DewaterComparisonGallery(dewaterElement);
  dewaterGallery.initialize();
  renderViewers.push(...dewaterGallery.viewers);
}

if ("IntersectionObserver" in window) {
  renderViewers.forEach((viewer) => {
    const observer = new IntersectionObserver(([entry]) => {
      viewer.visible = entry.isIntersecting;
      if (entry.isIntersecting) viewer.dirty = true;
    }, { rootMargin: "240px 0px", threshold: 0 });
    observer.observe(viewer.element);
  });
}

function animate() {
  renderViewers.forEach((viewer) => viewer.render());
  window.requestAnimationFrame(animate);
}
window.requestAnimationFrame(animate);
