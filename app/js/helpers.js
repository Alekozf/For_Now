window.ForNow = window.ForNow || {};

ForNow.helpers = (function () {
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function button(className, text, onClick) {
    const b = el("button", className, text);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }

  function labelFor(collection) {
    return "Collection " + collection.number + " · " + collection.title;
  }

  function clipCount(collection) {
    const count = collection.clips.length;
    return count + (count === 1 ? " clip" : " clips");
  }

  const durations = {};

  function clipDuration(src) {
    if (!durations[src]) {
      durations[src] = new Promise(function (resolve) {
        const probe = document.createElement("video");
        probe.preload = "metadata";
        probe.muted = true;
        probe.addEventListener("loadedmetadata", function () {
          resolve(isFinite(probe.duration) ? probe.duration : null);
          probe.removeAttribute("src");
          probe.load();
        });
        probe.addEventListener("error", function () { resolve(null); });
        probe.src = src;
      });
    }
    return durations[src];
  }

  function collectionDuration(collection) {
    const allReal = collection.clips.every(function (clip) { return clip.src; });
    if (!allReal) return Promise.resolve(null);
    return Promise.all(collection.clips.map(function (clip) { return clipDuration(clip.src); }))
      .then(function (times) {
        if (times.some(function (t) { return !t; })) return null;
        return times.reduce(function (sum, t) { return sum + t; }, 0);
      });
  }

  function formatDuration(seconds) {
    const total = Math.round(seconds);
    const minutes = Math.floor(total / 60);
    const rest = total % 60;
    const nb = " ";
    if (!minutes) return rest + nb + "s";
    return rest ? minutes + nb + "min" + nb + rest + nb + "s" : minutes + nb + "min";
  }

  return {
    el: el,
    button: button,
    labelFor: labelFor,
    clipCount: clipCount,
    collectionDuration: collectionDuration,
    formatDuration: formatDuration
  };
})();
