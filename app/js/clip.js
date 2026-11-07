window.ForNow = window.ForNow || {};

ForNow.createClip = function (data, options) {
  const h = ForNow.helpers;

  const slide = h.el("section", "slide");
  slide.setAttribute("aria-label", "Clip " + (options.index + 1) + " of " + options.total);

  const frame = h.el("div", "frame");
  if (data.colour) frame.style.backgroundColor = data.colour;

  const progress = h.el("div", "progress");
  const progressFill = h.el("span", "progress__fill");
  progress.append(progressFill);

  const playFallback = h.el("button", "frame__chip", "Play");
  playFallback.type = "button";
  playFallback.hidden = true;

  const pausedMark = h.el("span", "frame__paused");
  pausedMark.setAttribute("aria-hidden", "true");
  pausedMark.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 6.5v11l9-5.5z"/></svg>';
  pausedMark.hidden = true;

  frame.append(playFallback, pausedMark);

  const isLast = options.index === options.total - 1;
  const count = h.el("p", "type-label caption__count", "Clip " + (options.index + 1) + " of " + options.total);
  count.append(h.el("span", "caption__state", " · Finished"));

  const hint = h.el("p", "caption__hint", isLast
    ? "Scroll or select View ending."
    : "Scroll or select Next.");

  const caption = h.el("div", "caption");
  caption.append(count, h.el("p", "caption__text", data.caption), hint);
  slide.append(frame, caption, progress);

  const clip = {
    data: data,
    slide: slide,
    frame: frame,
    video: null,
    unavailable: false,
    playing: false,
    ended: false,
    isLast: isLast,
    hasVideo: function () { return Boolean(clip.video) && !clip.unavailable; },
    play: play,
    pause: pause,
    reset: reset,
    setMuted: function (muted) { if (clip.video) clip.video.muted = muted; },

    seek: function (time) { if (clip.video) clip.video.currentTime = time; },
    showPausedMark: function (show) { pausedMark.hidden = !show; },
    fallbackVisible: function () { return !playFallback.hidden; }
  };

  let muted = true;
  let holder = null;

  if (data.src) {
    attachVideo();
  } else {
    frame.classList.add("frame--placeholder");
    frame.append(h.el("span", "frame__label", "Placeholder · no video yet"));
    progress.hidden = true;
  }

  playFallback.addEventListener("click", function () {
    options.onPlayFallback();
    play(muted);
  });

  frame.addEventListener("click", function (event) {
    if (event.target.closest("button")) return;
    if (!options.isActive() || !clip.hasVideo()) return;
    if (clip.playing) pause();
    else play(muted);
  });

  function attachVideo() {
    const video = document.createElement("video");
    video.className = "frame__video";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    if (data.poster) video.poster = data.poster;
    if (data.label) video.setAttribute("aria-label", data.label);
    if (data.subtitles) {
      const track = document.createElement("track");
      track.kind = "subtitles";
      track.srclang = "en";
      track.label = "English";
      track.src = data.subtitles;
      track.default = true;
      video.append(track);
    }
    video.src = data.src;

    holder = h.el("div", "frame__picture");

    const setShape = function (w, hgt) {
      holder.style.aspectRatio = w + " / " + hgt;
      slide.style.setProperty("--picture-ratio", String(w / hgt));
      slide.classList.toggle("slide--landscape", w > hgt);
    };
    if (data.picture) {
      const parts = data.picture.split("/").map(Number);
      setShape(parts[0], parts[1]);
    } else {
      setShape(9, 16);
      video.addEventListener("loadedmetadata", function () {
        if (video.videoWidth && video.videoHeight) setShape(video.videoWidth, video.videoHeight);
      });
    }
    holder.append(video);

    video.addEventListener("timeupdate", function () {
      if (video.duration) setProgress(video.currentTime / video.duration);
    });
    video.addEventListener("ended", handleEnded);
    video.addEventListener("error", markUnavailable);

    clip.video = video;
    frame.prepend(holder);
    frame.classList.add("frame--video");
  }

  function setProgress(fraction) {
    progressFill.style.transform = "scaleX(" + Math.min(Math.max(fraction, 0), 1) + ")";
  }

  function play(soundMuted) {
    muted = soundMuted;
    if (!clip.hasVideo()) return;
    if (clip.ended) {
      clip.ended = false;
      clip.video.currentTime = 0;
      showFinished(false);
    }
    playFallback.hidden = true;
    clip.video.muted = muted;
    clip.playing = true;
    const attempt = clip.video.play();
    if (attempt && attempt.catch) {
      attempt.catch(function () {
        clip.playing = false;
        if (!clip.unavailable && options.isActive()) playFallback.hidden = false;
        options.onChange();
      });
    }
    options.onChange();
  }

  function pause() {
    if (!clip.video) return;
    clip.video.pause();
    clip.playing = false;
    options.onChange();
  }

  function reset() {
    if (clip.video) {
      clip.video.pause();
      try { clip.video.currentTime = 0; } catch (e) {  }
    }
    clip.playing = false;
    clip.ended = false;
    playFallback.hidden = true;
    setProgress(0);
    showFinished(false);
  }

  function handleEnded() {
    clip.playing = false;
    clip.ended = true;
    setProgress(1);
    if (options.isActive()) {
      showFinished(true);
      options.onEnded(clip);
    }
    options.onChange();
  }

  function showFinished(show) {
    slide.classList.toggle("is-finished", show);
  }

  function markUnavailable() {
    if (clip.unavailable) return;
    clip.unavailable = true;
    clip.playing = false;
    if (holder) holder.remove();
    clip.video = null;
    playFallback.hidden = true;
    frame.classList.remove("frame--video");
    frame.classList.add("frame--placeholder");
    frame.append(h.el("span", "frame__label", "This clip couldn't be loaded"));
    frame.append(h.el("span", "frame__detail", "Missing file: " + data.src));
    setProgress(0);
    options.onChange();
  }

  return clip;
};
