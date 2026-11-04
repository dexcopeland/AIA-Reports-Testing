import { SECTIONS, visibleFields, type Field, type FormSection } from "../content/form";
import { CONTRACT_TERMS, GROUPS, RELATIONS, STATEMENT_BY_ID, THREATS } from "../content/statements";
import { displayedSamePlace, threatApplies } from "../engine/visibility";
import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerValue } from "../content/types";
import type { Answers } from "../engine/answers";
import { many, text } from "../engine/answers";
import { buildReport } from "../engine/report";
import { ensureSignoff, upsertAck } from "../engine/signoff";
import { downloadBlob } from "../docx/build-docx";
import { packageZipName, reportPackageZip } from "../report/zip";
import { renderReport } from "./report-view";
import { exampleIndex, loadExampleFile } from "../examples/load";
import { autoload, autosave, clearAutosave, downloadJson, emptyFile, normalizeFile } from "./storage";

const ROLE_WORDS = ["officer", "lead", "manager", "supervisor", "director", "analyst", "specialist", "coordinator", "chief", "admin", "counsel", "owner"];

type Screen = "home" | "form" | "report";

export function mount(root: Element): void {
  let file = autoload() ?? emptyFile();
  let screen: Screen = "home";
  let sectionIndex = 0;
  let saveNote = "Nothing is stored on a server.";
  let formError = "";
  let dirty = false;

  const redraw = (opts?: { restoreId?: string }) => {
    renderChrome();
    root.replaceChildren();
    if (screen === "home") root.append(renderHome());
    else if (screen === "form") root.append(renderForm());
    else root.append(renderReportScreen());
    if (opts?.restoreId) {
      const next = root.querySelector(`[id="${CSS.escape(opts.restoreId)}"]`);
      if (next instanceof HTMLElement) next.focus();
    }
    requestAnimationFrame(syncHeaderOffset);
  };

  const touch = () => {
    file.saved_at = new Date().toISOString();
    file.rules_version = RULES_VERSION;
    file.form_version = FORM_VERSION;
    file.schema_version = SCHEMA_VERSION;
    autosave(file);
    saveNote = "Saved in this browser.";
    const live = root.querySelector("#save-status");
    if (live) live.textContent = saveNote;
  };

  const syncSaveButton = () => {
    const save = document.querySelector("#save-draft");
    if (save instanceof HTMLButtonElement) save.disabled = Object.keys(file.answers).length === 0;
  };

  const setAnswer = (key: string, value: AnswerValue) => {
    file.answers[key] = value;
    file.example = false;
    touch();
    dirty = true;
    syncSaveButton();
  };

  function renderHome(): HTMLElement {
    const box = document.createElement("div");
    const saved = autoload();
    const heading = el("h2", "Start an assessment");
    heading.id = "section-heading";
    heading.tabIndex = -1;
    box.append(heading);
    box.append(el("p", "Work section by section. You can save a JSON file and load it later on this computer. The draft report is for DoIT AI Governance review."));
    const actions = document.createElement("div");
    actions.className = "row";
    actions.append(button("Start a new assessment", () => {
      file = emptyFile();
      clearAutosave();
      dirty = false;
      sectionIndex = 0;
      saveNote = "Nothing is stored on a server.";
      screen = "form";
      redraw();
      focusHeading();
    }));
    if (saved && Object.keys(saved.answers).length > 0) {
      actions.append(button("Continue saved draft", () => {
        file = saved;
        dirty = false;
        sectionIndex = 0;
        screen = "form";
        redraw();
        focusHeading();
      }, "secondary"));
    }
    box.append(actions);
    box.append(renderExamplePicker());
    box.append(loadControl());
    return box;
  }

  function renderForm(): HTMLElement {
    const box = document.createElement("div");
    const section = SECTIONS[sectionIndex];
    const card = document.createElement("div");
    card.className = "card";
    const heading = el("h2", section.title);
    heading.id = "section-heading";
    heading.tabIndex = -1;
    card.append(heading);
    if (file.example && file.example_label) card.append(el("p", file.example_label));
    const form = document.createElement("form");
    form.noValidate = true;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      goNext();
    });
    for (const field of visibleFields(section, file.answers)) form.append(renderField(field));
    if (formError) {
      const err = el("p", formError);
      err.className = "warn";
      err.id = "form-error";
      err.setAttribute("role", "alert");
      form.append(err);
    }
    const actions = document.createElement("div");
    actions.className = "row";
    if (sectionIndex > 0) actions.append(button("Back", () => { sectionIndex -= 1; formError = ""; redraw(); focusHeading(); }, "secondary"));
    actions.append(button(sectionIndex === SECTIONS.length - 1 ? "Review and create draft" : "Save and continue", () => goNext()));
    form.append(actions);
    card.append(form);
    const status = el("p", saveNote);
    status.id = "save-status";
    status.className = "status";
    status.setAttribute("aria-live", "polite");
    card.append(status);
    box.append(card);
    box.append(loadControl());
    return box;
  }

  function goNext(): void {
    const blanks = missing(SECTIONS[sectionIndex], file.answers);
    if (blanks.length && sectionIndex < SECTIONS.length - 1) {
      formError = `Still blank: ${blanks.join("; ")}. You can continue. A blank answer counts as a gap.`;
      if (!root.querySelector("#form-error")) {
        redraw();
        return;
      }
    }
    formError = "";
    if (sectionIndex < SECTIONS.length - 1) {
      sectionIndex += 1;
      redraw();
      focusHeading();
      return;
    }
    screen = "report";
    redraw();
    focusHeading();
  }

  function renderReportScreen(): HTMLElement {
    const box = document.createElement("div");
    const doc = buildReport(file);
    const heading = el("h2", "Draft report");
    heading.id = "section-heading";
    heading.tabIndex = -1;
    heading.className = "no-print";
    box.append(heading);
    if (file.example_label) {
      const note = el("p", file.example_label);
      note.className = "no-print";
      box.append(note);
    }
    const blanks = SECTIONS.flatMap((section) => missing(section, file.answers));
    if (blanks.length) {
      const warn = el("p", `Some required answers are blank (${blanks.length}). Blank answers are treated as gaps or as not yet in place.`);
      warn.className = "warn no-print";
      box.append(warn);
    }
    const actions = document.createElement("div");
    actions.className = "row no-print";
    actions.append(button("Back to answers", () => { screen = "form"; redraw(); focusHeading(); }, "secondary"));
    const exportNote = el("p", "");
    exportNote.className = "status";
    exportNote.setAttribute("aria-live", "polite");
    const attested = text(file.answers, "q25_confirm") === "confirm" || many(file.answers, "q25_confirm").includes("confirm");
    const blocked = !attested;
    actions.append(button("Download report package (.zip)", () => {
      if (!(text(file.answers, "q25_confirm") === "confirm" || many(file.answers, "q25_confirm").includes("confirm"))) {
        exportNote.textContent = "Confirm Q25 before you download the report package. This block is a proposed rule. The on-screen draft is still available.";
        return;
      }
      const current = buildReport(file);
      void reportPackageZip(current).then(({ blob, warnings }) => {
        downloadBlob(blob, packageZipName(current.systemName));
        if (warnings.length === 0) {
          exportNote.textContent = "Report package downloaded. It contains four PDFs and the same four documents as Word files.";
          return;
        }
        const listed = warnings.map((warning) => `${warning.character} (${warning.questions.join(", ")})`).join("; ");
        exportNote.textContent = `Report package downloaded. These characters are not in the report fonts, so they may not appear: ${listed}.`;
      }).catch(() => {
        exportNote.textContent = "The report package could not be built in this browser.";
      });
    }, "secondary"));
    box.append(actions);
    if (blocked) {
      const note = el("p", "The report package stays off until Q25 is confirmed.");
      note.className = "no-print";
      box.append(note);
    }
    const fillNote = el("p", "Fill the dates, comments, and Agency Lead name in the executive summary before you download. They are saved in this draft. The signature stays blank for a handwritten or PDF signature.");
    fillNote.className = "no-print";
    box.append(exportNote, fillNote);
    const details = document.createElement("details");
    details.className = "no-print";
    const summary = document.createElement("summary");
    summary.textContent = "Draft checks";
    details.append(summary);
    const checks = document.createElement("ul");
    checks.className = "check-list";
    for (const check of doc.checks) {
      const li = document.createElement("li");
      li.textContent = `${check.ok ? "Pass" : "Check"}: ${check.id}. ${check.detail}`;
      if (!check.ok) li.className = "bad";
      checks.append(li);
    }
    details.append(checks);
    box.append(details);
    box.append(renderReport(doc, (signId, fieldName, value) => {
      if (signId === "lead") {
        const signoff = ensureSignoff(file);
        if (fieldName === "lead_name") signoff.lead_name = value;
        else if (fieldName === "lead_title") signoff.lead_title = value;
        else if (fieldName === "lead_date") signoff.lead_date = value;
      } else if (signId) {
        const ack = upsertAck(file, signId);
        if (fieldName.startsWith("ack_")) ack.choice = value === "no" ? "no" : "yes";
        else if (fieldName.startsWith("date_")) ack.date = value;
        else if (fieldName.startsWith("comment_")) ack.comment = value;
      }
      touch();
    }));
    return box;
  }

  function renderField(field: Field): HTMLElement {
    if (field.type === "info") {
      const p = el("p", `${field.label}. ${field.help ?? ""}`);
      p.className = "help";
      return p;
    }
    if (field.type === "groups") return renderGroups(field);
    if (field.type === "statement") return renderStatement(field);
    const wrap = document.createElement("div");
    wrap.className = "field";
    const helpId = `${field.id}-help`;
    if (field.type === "radio" || field.type === "check") {
      const set = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = (field.legend?.(file.answers) ?? field.label) + (field.required ? " (required)" : "");
      set.append(legend);
      if (field.help) set.append(help(field.help, helpId));
      for (const option of field.options ?? []) {
        const line = document.createElement("div");
        line.className = "choice";
        const input = document.createElement("input");
        input.type = field.type === "radio" ? "radio" : "checkbox";
        input.name = field.id;
        input.id = `${field.id}-${option.id}`;
        input.value = option.id;
        const current = text(file.answers, field.id);
        const selected = field.id === "q15_same_place" ? displayedSamePlace(file.answers) : current;
        if (field.type === "radio") input.checked = selected === option.id;
        else input.checked = many(file.answers, field.id).includes(option.id);
        input.addEventListener("change", () => {
          if (field.type === "radio") setAnswer(field.id, option.id);
          else setAnswer(field.id, toggleCheck(field.id, option.id, input.checked));
          if (field.type === "check" || field.id === "q3_is_lead" || field.id === "q5_builder" || field.id === "q6_method" || field.id === "q6_hosting" || field.id === "q12_outside" || field.id === "q13_level" || field.id === "q15_same_place" || field.id === "q17_status" || field.id === "q9_groups" || field.id === "q16_assurances" || field.id === "q14_overlays") {
            redraw({ restoreId: input.id });
          }
        });
        const label = document.createElement("label");
        label.htmlFor = input.id;
        label.textContent = option.label;
        line.append(input, label);
        set.append(line);
      }
      wrap.append(set);
      return wrap;
    }
    const label = document.createElement("label");
    label.htmlFor = field.id;
    label.textContent = field.label + (field.required ? " (required)" : "");
    const input = field.type === "paragraph" ? document.createElement("textarea") : document.createElement("input");
    if (input instanceof HTMLInputElement) {
      input.type = field.type === "email" ? "email" : field.type === "date" ? "date" : "text";
      if (field.autocomplete) input.setAttribute("autocomplete", field.autocomplete);
      if (field.spellcheck === false) {
        input.spellcheck = false;
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("autocorrect", "off");
      }
    }
    input.id = field.id;
    input.name = field.id;
    input.value = text(file.answers, field.id);
    if (field.help) input.setAttribute("aria-describedby", helpId);
    input.addEventListener("input", () => setAnswer(field.id, input.value));
    wrap.append(label);
    if (field.help) wrap.append(help(field.help, helpId));
    wrap.append(input);
    if (field.role) {
      const showRoleWarning = () => {
        const existing = wrap.querySelector(`#${field.id}-role`);
        const warning = roleWarning(input.value);
        if (warning) {
          if (existing) {
            existing.textContent = warning;
            return;
          }
          const next = el("p", warning);
          next.className = "warn";
          next.id = `${field.id}-role`;
          next.setAttribute("role", "status");
          wrap.append(next);
          return;
        }
        existing?.remove();
      };
      showRoleWarning();
      input.addEventListener("blur", showRoleWarning);
    }
    return wrap;
  }

  function renderGroups(field: Field): HTMLElement {
    const set = document.createElement("fieldset");
    set.className = "field";
    const legend = document.createElement("legend");
    legend.textContent = `${field.label} (required)`;
    set.append(legend);
    if (field.help) set.append(help(field.help, `${field.id}-help`));
    for (const option of field.options ?? []) {
      const line = document.createElement("div");
      line.className = "choice";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = `${field.id}-${option.id}`;
      input.checked = many(file.answers, field.id).includes(option.id);
      input.addEventListener("change", () => {
        setAnswer(field.id, toggleCheck(field.id, option.id, input.checked));
        redraw({ restoreId: input.id });
      });
      const label = document.createElement("label");
      label.htmlFor = input.id;
      label.textContent = option.label;
      line.append(input, label);
      set.append(line);
      if (!input.checked) continue;
      const rel = document.createElement("fieldset");
      const relLegend = document.createElement("legend");
      relLegend.textContent = `How is ${option.label} affected?`;
      rel.append(relLegend);
      for (const relation of RELATIONS) {
        const row = document.createElement("div");
        row.className = "choice";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = `q9_rel__${option.id}`;
        radio.id = `q9_rel__${option.id}-${relation.id}`;
        radio.checked = text(file.answers, `q9_rel__${option.id}`) === relation.id;
        radio.addEventListener("change", () => setAnswer(`q9_rel__${option.id}`, relation.id));
        const lab = document.createElement("label");
        lab.htmlFor = radio.id;
        lab.textContent = relation.label;
        row.append(radio, lab);
        rel.append(row);
      }
      set.append(rel);
    }
    return set;
  }

  function renderStatement(field: Field): HTMLElement {
    const def = STATEMENT_BY_ID[field.statementId ?? ""];
    const host = document.createElement("div");
    if (!def) return host;
    const instances = statementInstances(field);
    for (const instance of instances) {
      const set = document.createElement("fieldset");
      set.className = "field";
      const legend = document.createElement("legend");
      legend.textContent = instance.title;
      set.append(legend);
      if (field.help && instance === instances[0]) set.append(help(field.help, `${instance.key}-help`));
      const hint = el("p", "Pick the statement closest to today, from weakest to strongest. Planned asks for a date. The strongest line can ask for one line of evidence.");
      hint.className = "help";
      set.append(hint);
      for (const choice of def.choices) {
        const row = document.createElement("div");
        row.className = "choice";
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = instance.key;
        radio.id = `${instance.key}-${choice.value}`;
        radio.value = choice.value;
        radio.checked = text(file.answers, instance.key) === choice.value;
        radio.addEventListener("change", () => {
          setAnswer(instance.key, choice.value);
          redraw({ restoreId: radio.id });
        });
        const label = document.createElement("label");
        label.htmlFor = radio.id;
        label.textContent = choice.text;
        row.append(radio, label);
        set.append(row);
      }
      const selected = def.choices.find((choice) => choice.value === text(file.answers, instance.key));
      if (selected?.asks === "target_date") {
        set.append(inlineInput(`${instance.key}__date`, "Target date", "date"));
      }
      if (selected?.asks === "evidence") {
        const note = selected.evidenceRequired
          ? "One line: the document, record, contract clause or test result. A blank or token line (such as yes or done) drops this item to Partial."
          : "Optional for this recommended-practice item. A thin line still drops the status.";
        set.append(inlineInput(`${instance.key}__evidence`, "Evidence", "text", note));
      }
      host.append(set);
    }
    return host;
  }

  function statementInstances(field: Field): { key: string; title: string }[] {
    const id = field.statementId ?? "";
    const def = STATEMENT_BY_ID[id];
    if (!def) return [];
    if (field.repeat === "group") {
      return many(file.answers, "q9_groups")
        .filter((groupId) => GROUPS.some((group) => group.id === groupId))
        .map((groupId) => ({
          key: `st12e__${groupId}`,
          title: `Access path for ${GROUPS.find((group) => group.id === groupId)?.label ?? groupId}`,
        }));
    }
    if (field.repeat === "term") {
      return CONTRACT_TERMS.map((term) => ({ key: `st16b__${term.id}`, title: `${def.title}: ${term.label}` }));
    }
    if (field.repeat === "threat") {
      return THREATS.filter((threat) => threatApplies(threat.id, file.answers)).map((threat) => ({ key: `st22__${threat.id}`, title: `${def.title}: ${threat.label}` }));
    }
    return [{ key: `st${id}`, title: field.label }];
  }

  function inlineInput(key: string, labelText: string, kind: "text" | "date", hint?: string): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const label = document.createElement("label");
    label.htmlFor = key;
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = kind;
    input.id = key;
    input.name = key;
    input.value = text(file.answers, key);
    if (hint) {
      const id = `${key}-hint`;
      wrap.append(help(hint, id));
      input.setAttribute("aria-describedby", id);
    }
    input.addEventListener("input", () => setAnswer(key, input.value));
    wrap.append(label, input);
    return wrap;
  }

  function loadControl(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "card no-print";
    wrap.append(el("h2", "Load a saved file"));
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json,.json";
    input.id = "load-file";
    const label = document.createElement("label");
    label.htmlFor = "load-file";
    label.textContent = "Answers JSON file";
    const message = el("p", "");
    message.setAttribute("aria-live", "polite");
    input.addEventListener("change", () => {
      const picked = input.files?.[0];
      if (!picked) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          file = normalizeFile(JSON.parse(String(reader.result)));
          touch();
          dirty = false;
          sectionIndex = 0;
          screen = "form";
          message.textContent = "File loaded.";
          redraw();
        } catch (error) {
          message.textContent = error instanceof Error ? error.message : "Could not read that file.";
        }
      };
      reader.readAsText(picked);
    });
    wrap.append(label, input, message);
    return wrap;
  }

  function toggleCheck(id: string, option: string, checked: boolean): string[] {
    const current = new Set(many(file.answers, id));
    const exclusive = new Set(["none", "unknown", "none_of_these", "not_applicable"]);
    if (checked) {
      if (exclusive.has(option)) {
        current.clear();
        current.add(option);
      } else {
        for (const item of exclusive) current.delete(item);
        current.add(option);
      }
    } else current.delete(option);
    return [...current];
  }

  function focusHeading(): void {
    const heading = root.querySelector("#section-heading");
    if (heading instanceof HTMLElement) heading.focus();
  }

  function saveDraft(): void {
    touch();
    downloadJson(file);
    dirty = false;
    saveNote = "Draft file downloaded.";
    const pageStatus = root.querySelector("#save-status");
    if (pageStatus) pageStatus.textContent = saveNote;
    const headerStatus = document.querySelector("#header-save-status");
    if (headerStatus) headerStatus.textContent = saveNote;
  }

  function finishHome(message?: string): void {
    screen = "home";
    formError = "";
    redraw();
    if (message) {
      const headerStatus = document.querySelector("#header-save-status");
      if (headerStatus) headerStatus.textContent = message;
    }
    focusHeading();
  }

  function requestHome(): void {
    if (screen !== "home" && dirty) {
      const dialog = document.querySelector("#leave-dialog");
      if (dialog instanceof HTMLDialogElement && !dialog.open) dialog.showModal();
      return;
    }
    finishHome();
  }

  function renderChrome(): void {
    const actions = document.querySelector("#header-actions");
    const progress = document.querySelector("#header-progress");
    if (!(actions instanceof HTMLElement) || !(progress instanceof HTMLElement)) return;
    actions.replaceChildren();
    const home = button("Home", requestHome, "secondary");
    home.id = "go-home";
    if (screen === "home") home.disabled = true;
    const save = button("Save draft", () => {
      saveDraft();
    });
    save.id = "save-draft";
    save.disabled = Object.keys(file.answers).length === 0;
    const live = document.createElement("p");
    live.id = "header-save-status";
    live.className = "visually-hidden";
    live.setAttribute("aria-live", "polite");
    actions.append(home, save, live);
    renderProgress(progress);
  }

  function renderProgress(host: HTMLElement): void {
    host.replaceChildren();
    if (screen === "home") {
      host.hidden = true;
      return;
    }
    host.hidden = false;
    const wrap = document.createElement("div");
    wrap.className = "wrap";
    const done = SECTIONS.filter((item) => missing(item, file.answers).length === 0).length;
    const shown = screen === "report" ? SECTIONS.length : sectionIndex + 1;
    const bar = document.createElement("progress");
    bar.max = SECTIONS.length;
    bar.value = shown;
    bar.setAttribute("aria-valuemin", "1");
    bar.setAttribute("aria-valuemax", String(SECTIONS.length));
    bar.setAttribute("aria-valuenow", String(shown));
    bar.setAttribute("aria-valuetext", screen === "report"
      ? `Draft report. ${done} sections have no blank required answers.`
      : `Section ${sectionIndex + 1} of ${SECTIONS.length}. ${done} sections have no blank required answers.`);
    const nav = document.createElement("ol");
    nav.className = "steps";
    nav.setAttribute("aria-label", "Sections");
    SECTIONS.forEach((item, index) => {
      const li = document.createElement("li");
      const step = document.createElement("button");
      step.type = "button";
      step.textContent = `${index + 1}. ${item.title.replace("Section ", "").replace(/^\d+: /, "")}`;
      if (screen === "form" && index === sectionIndex) step.setAttribute("aria-current", "step");
      step.addEventListener("click", () => {
        sectionIndex = index;
        formError = "";
        screen = "form";
        redraw();
        focusHeading();
      });
      li.append(step);
      nav.append(li);
    });
    if (screen === "report") {
      const li = document.createElement("li");
      const step = document.createElement("button");
      step.type = "button";
      step.textContent = "Report";
      step.setAttribute("aria-current", "step");
      li.append(step);
      nav.append(li);
    }
    wrap.append(bar, nav);
    host.append(wrap);
    requestAnimationFrame(() => {
      const current = nav.querySelector("[aria-current='step']");
      if (current instanceof HTMLElement) nav.scrollLeft = Math.max(0, current.offsetLeft - 8);
    });
  }

  function renderExamplePicker(): HTMLElement {
    const card = document.createElement("div");
    card.className = "card example-picker";
    const label = document.createElement("label");
    label.htmlFor = "example-select";
    label.textContent = "Load an example";
    const select = document.createElement("select");
    select.id = "example-select";
    select.name = "example";
    select.className = "example-select";
    const rich = CSS.supports("appearance", "base-select");
    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose an example";
    placeholder.disabled = true;
    placeholder.selected = true;
    select.append(placeholder);
    for (const group of exampleIndex.groups) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.label;
      for (const item of group.examples) {
        const option = document.createElement("option");
        option.value = item.id;
        if (rich) {
          const title = document.createElement("span");
          title.className = "opt-title";
          title.textContent = item.title;
          const desc = document.createElement("span");
          desc.className = "opt-desc";
          desc.textContent = item.description;
          option.append(title, desc);
          option.setAttribute("aria-label", `${item.title}. ${item.description}`);
        } else {
          option.textContent = `${item.title} — ${item.description}`;
        }
        optgroup.append(option);
      }
      select.append(optgroup);
    }
    if (rich) {
      const trigger = document.createElement("button");
      trigger.type = "button";
      trigger.append(document.createElement("selectedcontent"));
      select.prepend(trigger);
    }
    const blurb = document.createElement("p");
    blurb.id = "example-description";
    blurb.className = "help";
    blurb.setAttribute("aria-live", "polite");
    select.setAttribute("aria-describedby", "example-description");
    const load = button("Load this example", () => {
      const entry = exampleIndex.groups.flatMap((group) => group.examples).find((item) => item.id === select.value);
      if (!entry) return;
      file = loadExampleFile(entry.file);
      touch();
      dirty = false;
      sectionIndex = 0;
      formError = "";
      saveNote = "Example loaded. Saved in this browser.";
      screen = "form";
      redraw();
      focusHeading();
    });
    load.id = "load-example";
    load.disabled = true;
    select.addEventListener("change", () => {
      const entry = exampleIndex.groups.flatMap((group) => group.examples).find((item) => item.id === select.value);
      blurb.textContent = entry?.description ?? "";
      load.disabled = !entry;
    });
    card.append(label, select, blurb, load);
    return card;
  }

  const leaveDialog = document.querySelector("#leave-dialog");
  if (leaveDialog instanceof HTMLDialogElement) {
    leaveDialog.addEventListener("close", () => {
      const choice = leaveDialog.returnValue;
      leaveDialog.returnValue = "";
      if (choice === "save") {
        saveDraft();
        finishHome("Draft file downloaded.");
        return;
      }
      if (choice === "leave") finishHome();
    });
  }

  redraw();
}

export function missing(section: FormSection, answers: Answers): string[] {
  const blanks: string[] = [];
  for (const field of visibleFields(section, answers)) {
    if (!field.required || field.type === "info") continue;
    if (field.type === "statement") {
      if (field.repeat === "group") {
        for (const groupId of many(answers, "q9_groups")) {
          if (!GROUPS.some((group) => group.id === groupId)) continue;
          if (!text(answers, `st12e__${groupId}`)) blanks.push(`Access path for ${groupId}`);
        }
      } else if (field.repeat === "term") {
        for (const term of CONTRACT_TERMS) {
          if (!text(answers, `st16b__${term.id}`)) blanks.push(term.label);
        }
      } else if (field.repeat === "threat") {
        for (const threat of THREATS) {
          if (!threatApplies(threat.id, answers)) continue;
          if (!text(answers, `st22__${threat.id}`)) blanks.push(threat.label);
        }
      } else if (!text(answers, `st${field.statementId}`)) blanks.push(field.label);
      continue;
    }
    if (field.type === "groups") {
      const groups = many(answers, field.id).filter((id) => GROUPS.some((group) => group.id === id));
      if (groups.length === 0) blanks.push(field.label);
      for (const groupId of groups) {
        if (!text(answers, `q9_rel__${groupId}`)) blanks.push(`Relation for ${groupId}`);
      }
      continue;
    }
    if (field.type === "check") {
      if (many(answers, field.id).length === 0) blanks.push(field.label);
      continue;
    }
    if (field.id === "q15_same_place" && displayedSamePlace(answers) === "yes" && !text(answers, field.id)) continue;
    if (!text(answers, field.id)) blanks.push(field.label);
  }
  return blanks;
}

function roleWarning(value: string): string {
  const trimmed = value.trim();
  if (!/^[-A-Za-z']+ [A-Za-z']+$/.test(trimmed)) return "";
  const lower = trimmed.toLowerCase();
  if (ROLE_WORDS.some((word) => lower.includes(word))) return "";
  return "This looks like a person's name. Write a role, such as program manager.";
}

function help(textValue: string, id: string): HTMLElement {
  const p = el("p", textValue);
  p.className = "help";
  p.id = id;
  return p;
}

function el(tag: string, textValue: string): HTMLElement {
  const node = document.createElement(tag);
  node.textContent = textValue;
  return node;
}

function button(label: string, onClick: () => void, kind?: "secondary"): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.textContent = label;
  if (kind) node.className = kind;
  node.addEventListener("click", onClick);
  return node;
}

function syncHeaderOffset(): void {
  const header = document.querySelector("#site-header");
  if (header instanceof HTMLElement) {
    document.documentElement.style.setProperty("--sticky-header-height", `${header.offsetHeight}px`);
  }
}
