window.ForNow = window.ForNow || {};

ForNow.createEnding = function (options) {
  const h = ForNow.helpers;
  const collection = options.collection;
  const other = options.other;
  const named = options.wording !== "plain";

  const slide = h.el("section", "slide slide--ending");
  slide.setAttribute("aria-labelledby", "ending-heading");

  const panel = h.el("div", "ending theme-paper");

  const head = h.el("div", "ending__head");
  const heading = h.el("h2", "type-display ending__title",
    named ? "That’s " + collection.title + "." : "End of this collection.");
  heading.id = "ending-heading";
  heading.tabIndex = -1;
  head.append(
    h.el("p", "type-label", named ? "Collection " + collection.number : h.labelFor(collection)),
    heading
  );

  const note = options.hasNext
    ? (named ? "This collection has ended." : "")
    : "You’ve reached the end of the available collections.";
  if (note) head.append(h.el("p", "ending__note", note));

  const decision = h.el("div", "ending__decision");

  const intro = h.el("p", "ending__intro", options.hasNext
    ? "You can finish watching or choose another collection."
    : "Finish watching or revisit a collection.");
  intro.id = "ending-intro";

  const nextTitle = h.el("p", "ending__next-title", other.title);
  nextTitle.id = "ending-next";

  const next = h.el("div", "ending__next");
  const describedBy = [];
  if (options.hasNext) {
    const nextLabel = h.el("p", "type-label ending__next-label", "Another collection");
    nextLabel.id = "ending-next-label";
    next.append(nextLabel);
    describedBy.push(nextLabel.id);
  } else {
    describedBy.push(intro.id);
  }
  next.append(nextTitle);
  describedBy.push(nextTitle.id);

  if (other.description) {
    const about = h.el("p", "ending__about", other.description);
    about.id = "ending-about";
    next.append(about);
    describedBy.push(about.id);
  }

  const facts = h.el("p", "type-meta ending__facts", h.clipCount(other));
  facts.id = "ending-facts";
  h.collectionDuration(other).then(function (seconds) {
    if (seconds) facts.textContent += " · " + h.formatDuration(seconds);
  });
  next.append(facts);
  describedBy.push(facts.id);
  decision.append(intro, next);

  const finishChoice = h.button("btn btn--choice", "Finish watching", options.onFinish);
  const finishNote = h.el("p", "type-meta ending__finish-note", "Ends this visit.");
  finishNote.id = "ending-finish-note";
  finishChoice.setAttribute("aria-describedby", finishNote.id);
  const finish = h.el("div", "ending__finish");
  finish.append(finishChoice, finishNote);

  const openOther = h.button("btn btn--choice", "Open " + other.title, options.onOpenOther);
  openOther.setAttribute("aria-describedby", describedBy.join(" "));

  const back = h.button("btn btn--link ending__back", "Back to " + collection.title, options.onBack);

  const actions = h.el("div", "ending__actions");
  actions.append(finish, openOther, back);
  decision.append(actions);

  panel.append(head, decision);
  slide.append(panel);

  return { slide: slide, heading: heading };
};
