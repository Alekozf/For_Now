(function () {
  const h = ForNow.helpers;
  const collections = ForNow.content.collections;
  const $ = function (id) { return document.getElementById(id); };

  const views = {
    entry: $("view-entry"),
    collection: $("view-collection"),
    finished: $("view-finished")
  };

  const scroller = $("scroller");
  const collectionLabel = $("collection-label");
  const statusRegion = $("status");
  const controlsRow = $("controls");
  const prevButton = $("prev");
  const nextButton = $("next");
  const playButton = $("play");
  const soundButton = $("sound");
  const finishButton = $("finish");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const requestedWording = new URLSearchParams(window.location.search).get("ending");
  const endingWording = requestedWording === "plain" || requestedWording === "named"
    ? requestedWording
    : ForNow.content.endingWording;

  const state = {
    view: "entry",
    collectionIndex: 0,
    position: -1,
    muted: true,
    resume: null
  };

  let slides = [];
  let ending = null;
  let observer = null;

  const STEP_GAP = 400;
  let lastStep = -Infinity;
  let moveTarget = null;

  const WHEEL_QUIET = 180;
  const WHEEL_MOVE = 40;
  let wheelTimer = null;
  let wheelSum = 0;
  let wheelLow = Infinity;
  let wheelMoved = false;
  let wheelMovedAt = -Infinity;

  function showView(name, focusTarget, pageTitle) {
    state.view = name;
    Object.keys(views).forEach(function (key) {
      views[key].hidden = key !== name;
    });
    window.scrollTo(0, 0);
    document.title = pageTitle;
    focusTarget.focus({ preventScroll: true });
  }

  function announce(text) {
    statusRegion.textContent = text;
  }

  function currentSlide() {
    return slides[state.position] || null;
  }

  function atEnding() {
    return state.position === slides.length - 1 && slides.length > 0;
  }

  function buildCollection() {
    const index = state.collectionIndex;
    const collection = collections[index];
    const hasNext = index < collections.length - 1;
    const otherIndex = hasNext ? index + 1 : 0;

    clearCollection();

    const total = collection.clips.length;
    slides = collection.clips.map(function (data, i) {
      const clip = ForNow.createClip(data, {
        index: i,
        total: total,
        isActive: function () { return slides[state.position] === clip; },
        onChange: updateControls,
        onEnded: function (ended) {
          announce(ended.isLast
            ? "Clip finished. Scroll or select View ending."
            : "Clip finished. Scroll or select Next.");
        },
        onPlayFallback: function () { scroller.focus({ preventScroll: true }); }
      });
      return clip;
    });

    ending = ForNow.createEnding({
      collection: collection,
      other: collections[otherIndex],
      hasNext: hasNext,
      wording: endingWording,
      onFinish: finish,
      onOpenOther: function () { openCollection(otherIndex); },
      onBack: function () { goTo(slides.length - 2, scroller); }
    });
    slides.push(ending);

    slides.forEach(function (item) {
      item.slide.inert = true;
      scroller.append(item.slide);
    });
    state.position = -1;
    collectionLabel.textContent = h.labelFor(collection);
    showCollectionInfo(collection);

    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          const index = slides.findIndex(function (s) { return s.slide === entry.target; });

          if (moveTarget !== null) {
            if (index !== moveTarget) return;
            moveTarget = null;
          }
          activate(index);
        }
      });
    }, { root: scroller, threshold: [0.6] });
    slides.forEach(function (item) { observer.observe(item.slide); });
  }

  function showCollectionInfo(collection) {
    $("collection-number").textContent = "Collection " + collection.number;
    $("collection-title").textContent = collection.title;
    $("collection-about").textContent = collection.description || "";
    $("collection-about").hidden = !collection.description;
    const facts = $("collection-facts");
    facts.textContent = h.clipCount(collection);
    h.collectionDuration(collection).then(function (seconds) {
      if (seconds && collections[state.collectionIndex] === collection) {
        facts.textContent = h.clipCount(collection) + " · " + h.formatDuration(seconds);
      }
    });
  }

  function clearCollection() {
    if (observer) observer.disconnect();
    observer = null;
    slides.forEach(function (item) { if (item.reset) item.reset(); });
    scroller.replaceChildren();
    slides = [];
    ending = null;
    state.position = -1;
    moveTarget = null;
  }

  function goTo(index, focusAfter) {
    if (index < 0 || index >= slides.length) return;
    moveTarget = index;
    slides[index].slide.scrollIntoView({
      behavior: reducedMotion.matches ? "auto" : "smooth",
      block: "start"
    });
    activate(index);
    if (focusAfter) focusAfter.focus({ preventScroll: true });
  }

  function step(delta) {
    const now = performance.now();
    if (now - lastStep < STEP_GAP) return;
    const target = state.position + delta;
    if (target < 0 || target >= slides.length) return;
    lastStep = now;

    goTo(target, target === slides.length - 1 ? ending.heading : null);
  }

  function scrollsWithin(event) {
    const panel = event.target.closest ? event.target.closest(".ending") : null;
    if (!panel || panel.scrollHeight <= panel.clientHeight + 1) return false;
    return event.deltaY > 0
      ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1
      : panel.scrollTop > 0;
  }

  function onWheel(event) {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (scrollsWithin(event)) return;
    event.preventDefault();

    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? scroller.clientHeight : 1;
    const size = Math.abs(event.deltaY) * unit;
    const now = performance.now();
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () {
      wheelMoved = false;
      wheelSum = 0;
    }, WHEEL_QUIET);

    if (wheelMoved) {
      wheelLow = Math.min(wheelLow, size);
      if (now - wheelMovedAt > STEP_GAP && size >= 10 && size > wheelLow * 3) {
        wheelMoved = false;
        wheelSum = 0;
      } else {
        return;
      }
    }

    wheelSum += size;
    if (wheelSum < WHEEL_MOVE) return;
    wheelMoved = true;
    wheelMovedAt = now;
    wheelLow = Infinity;
    const target = state.position + Math.sign(event.deltaY);
    if (target >= 0 && target < slides.length) goTo(target);
  }

  function activate(index, autoplay) {
    if (index < 0 || index === state.position) return;

    const previous = currentSlide();
    if (previous) {
      if (previous.slide.contains(document.activeElement)) scroller.focus({ preventScroll: true });
      previous.slide.inert = true;
      if (previous.reset) previous.reset();
    }

    state.position = index;
    const current = slides[index];
    current.slide.inert = false;

    if (atEnding()) {
      announce("End of this collection");
    } else {
      announce("Clip " + (index + 1) + " of " + (slides.length - 1));

      if (autoplay !== false) current.play(state.muted);
    }
    updateControls();
  }

  function setDisabled(control, disabled) {
    control.setAttribute("aria-disabled", disabled ? "true" : "false");
  }

  function isDisabled(control) {
    return control.getAttribute("aria-disabled") === "true";
  }

  function updateControls() {
    if (state.view !== "collection") return;
    const current = currentSlide();
    const clip = current && !atEnding() ? current : null;
    const hasVideo = Boolean(clip && clip.hasVideo());

    setDisabled(prevButton, state.position <= 0);
    setDisabled(nextButton, state.position >= slides.length - 1);

    nextButton.textContent = state.position === slides.length - 2 ? "View ending" : "Next";
    setDisabled(playButton, !hasVideo);
    setDisabled(soundButton, !hasVideo);

    const playState = !hasVideo ? "none"
      : clip.playing ? "playing"
      : clip.ended ? "ended"
      : "paused";
    playButton.textContent = playState === "playing" ? "Pause"
      : playState === "ended" ? "Replay"
      : "Play";
    playButton.dataset.state = playState;

    soundButton.textContent = state.muted ? "Sound off" : "Sound on";
    soundButton.setAttribute("aria-pressed", String(hasVideo && !state.muted));

    slides.forEach(function (item) {
      if (!item.showPausedMark) return;
      item.showPausedMark(item === clip && hasVideo && playState === "paused" && !item.fallbackVisible());
    });

    views.collection.classList.toggle("is-at-ending", atEnding());

    const focused = document.activeElement;
    if ((controlsRow.contains(focused) && focused.offsetParent === null) ||
        (atEnding() && focused === finishButton)) {
      scroller.focus({ preventScroll: true });
    }
  }

  function openCollection(index) {
    state.collectionIndex = index;
    const collection = collections[index];

    showView("collection", $("collection-entry"), h.labelFor(collection) + " — For Now");
    buildCollection();
    scroller.scrollTo({ top: 0, behavior: "auto" });
    activate(0);
  }

  function finish() {
    const clip = atEnding() ? null : currentSlide();
    state.resume = {
      collectionIndex: state.collectionIndex,
      position: state.position,
      time: clip && clip.video && !clip.ended ? clip.video.currentTime : 0
    };
    clearCollection();
    showView("finished", $("finished-heading"), "Finished — For Now");
  }

  function returnToCollection() {
    const resume = state.resume;
    if (!resume) return;
    state.collectionIndex = resume.collectionIndex;
    showView("collection", $("collection-entry"),
      h.labelFor(collections[resume.collectionIndex]) + " — For Now");
    buildCollection();
    slides[resume.position].slide.scrollIntoView({ block: "start" });
    activate(resume.position, false);
    if (resume.time && currentSlide().seek) currentSlide().seek(resume.time);
  }

  function newVisit() {
    state.collectionIndex = 0;
    state.resume = null;
    state.muted = true;
    showView("entry", $("entry-heading"), "For Now — A good place to stop.");
  }

  $("start").addEventListener("click", function () {
    state.muted = true;
    openCollection(0);
  });
  finishButton.addEventListener("click", finish);
  $("new-visit").addEventListener("click", newVisit);
  $("back-to-collection").addEventListener("click", returnToCollection);

  prevButton.addEventListener("click", function () {
    if (!isDisabled(prevButton)) step(-1);
  });

  nextButton.addEventListener("click", function () {
    if (!isDisabled(nextButton)) step(1);
  });

  ["pointerdown", "keydown"].forEach(function (type) {
    scroller.addEventListener(type, function () { moveTarget = null; }, { passive: true });
  });

  scroller.addEventListener("wheel", onWheel, { passive: false });

  document.addEventListener("touchstart", function () {}, { passive: true });

  playButton.addEventListener("click", function () {
    const clip = currentSlide();
    if (isDisabled(playButton) || !clip || atEnding()) return;
    if (clip.playing) clip.pause();
    else clip.play(state.muted);
  });

  soundButton.addEventListener("click", function () {
    const clip = currentSlide();
    if (isDisabled(soundButton) || !clip || atEnding()) return;
    state.muted = !state.muted;
    clip.setMuted(state.muted);
    updateControls();
  });

  document.addEventListener("visibilitychange", function () {
    const clip = currentSlide();
    if (document.hidden && clip && clip.pause && !atEnding()) clip.pause();
  });

  ForNow.state = state;
})();
