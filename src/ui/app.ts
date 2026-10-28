import { SECTIONS, visibleFields, type Field, type FormSection } from "../content/form";
import { CONTRACT_TERMS, GROUPS, RELATIONS, STATEMENT_BY_ID, THREATS } from "../content/statements";
import { FORM_VERSION, RULES_VERSION, SCHEMA_VERSION, type AnswerFile, type AnswerValue } from "../content/types";
import type { Answers } from "../engine/answers";
import { many, text } from "../engine/answers";
import { buildReport } from "../engine/report";
import { downloadBlob, reportToDocxBlob } from "../docx/build-docx";
import { reportToPdfBlob } from "../pdf/build-pdf";
import { renderReport } from "./report-view";
import { autoload, autosave, clearAutosave, downloadJson, emptyFile, normalizeFile } from "./storage";

const ROLE_WORDS = ["officer", "lead", "manager", "supervisor", "director", "analyst", "specialist", "coordinator", "chief", "admin", "counsel", "owner"];

type Screen = "home" | "form" | "report";

export function mount(root: Element): void {
  let file = autoload() ?? emptyFile();
  let screen: Screen = "home";
  let sectionIndex = 0;
  let saveNote = "Nothing is stored on a server.";
  let formError = "";

  const redraw = (opts?: { restoreId?: string }) => {
    root.replaceChildren();
    if (screen === "home") root.append(renderHome());
    else if (screen === "form") root.append(renderForm());
    else root.append(renderReportScreen());
    if (opts?.restoreId) {
      const next = root.querySelector(`[id="${CSS.escape(opts.restoreId)}"]`);
      if (next instanceof HTMLElement) next.focus();
    }
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

  const setAnswer = (key: string, value: AnswerValue) => {
    file.answers[key] = value;
    file.example = false;
    touch();
  };

  function renderHome(): HTMLElement {
    const box = document.createElement("div");
    const saved = autoload();
    box.append(el("h2", "Start an assessment"));
    box.append(el("p", "Work section by section. You can save a JSON file and load it later on this computer. The draft report is for DoIT AI Governance review."));
    const actions = document.createElement("div");
    actions.className = "row";
    actions.append(button("Start a new assessment", () => {
      file = emptyFile();
      clearAutosave();
      sectionIndex = 0;
      screen = "form";
      redraw();
    }));
    if (saved && Object.keys(saved.answers).length > 0) {
      actions.append(button("Continue saved draft", () => {
        file = saved;
        screen = "form";
        redraw();
      }, "secondary"));
    }
    actions.append(button("Load an example", () => {
      file = exampleFile();
      touch();
      screen = "form";
      redraw();
    }, "secondary"));
    box.append(actions);
    box.append(loadControl());
    return box;
  }

  function renderForm(): HTMLElement {
    const box = document.createElement("div");
    const section = SECTIONS[sectionIndex];
    const done = SECTIONS.filter((item) => missing(item, file.answers).length === 0).length;
    const progress = document.createElement("div");
    progress.className = "no-print";
    const bar = document.createElement("progress");
    bar.max = SECTIONS.length;
    bar.value = sectionIndex + 1;
    bar.setAttribute("aria-valuemin", "1");
    bar.setAttribute("aria-valuemax", String(SECTIONS.length));
    bar.setAttribute("aria-valuenow", String(sectionIndex + 1));
    bar.setAttribute("aria-valuetext", `Section ${sectionIndex + 1} of ${SECTIONS.length}. ${done} sections have no blank required answers.`);
    progress.append(bar);
    const nav = document.createElement("ol");
    nav.className = "steps";
    nav.setAttribute("aria-label", "Sections");
    SECTIONS.forEach((item, index) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = `${index + 1}. ${item.title.replace("Section ", "").replace(/^\d+: /, "")}`;
      if (index === sectionIndex) b.setAttribute("aria-current", "step");
      b.addEventListener("click", () => {
        sectionIndex = index;
        formError = "";
        redraw();
        focusHeading();
      });
      li.append(b);
      nav.append(li);
    });
    progress.append(nav);
    box.append(progress);

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
    actions.append(button("Save JSON file", () => { touch(); downloadJson(file); }, "secondary"));
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
    actions.append(button("Back to answers", () => { screen = "form"; redraw(); }, "secondary"));
    actions.append(button("Save JSON file", () => downloadJson(file), "secondary"));
    const exportNote = el("p", "");
    exportNote.className = "status";
    exportNote.setAttribute("aria-live", "polite");
    const attested = text(file.answers, "q25_confirm") === "confirm" || many(file.answers, "q25_confirm").includes("confirm");
    const blocked = !attested;
    actions.append(button("Download Word", () => {
      if (!(text(file.answers, "q25_confirm") === "confirm" || many(file.answers, "q25_confirm").includes("confirm"))) {
        exportNote.textContent = "Confirm Q25 before you download the Word file. This block is a proposed rule. The on-screen draft is still available.";
        return;
      }
      void reportToDocxBlob(doc).then((blob) => {
        const safe = doc.systemName.replace(/[^\w.-]+/g, "-").slice(0, 60);
        downloadBlob(blob, `AIA-Report-${safe || "draft"}.docx`);
        exportNote.textContent = "Word file downloaded. It uses Page X of Y in the footer.";
      }).catch(() => {
        exportNote.textContent = "The Word file could not be built in this browser.";
      });
    }, "secondary"));
    actions.append(button("Download PDF", () => {
      if (!(text(file.answers, "q25_confirm") === "confirm" || many(file.answers, "q25_confirm").includes("confirm"))) {
        exportNote.textContent = "Confirm Q25 before you download the PDF. This block is a proposed rule. The on-screen draft is still available.";
        return;
      }
      void reportToPdfBlob(doc).then((blob) => {
        const safe = doc.systemName.replace(/[^\w.-]+/g, "-").slice(0, 60);
        downloadBlob(blob, `AIA-Report-${safe || "draft"}.pdf`);
        exportNote.textContent = "PDF downloaded. It is built from the same report as the Word file.";
      }).catch(() => {
        exportNote.textContent = "The PDF could not be built in this browser.";
      });
    }, "secondary"));
    box.append(actions);
    if (blocked) {
      const note = el("p", "Word and PDF downloads stay off until Q25 is confirmed.");
      note.className = "no-print";
      box.append(note);
    }
    box.append(exportNote);
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
    box.append(renderReport(doc));
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
      legend.textContent = field.label + (field.required ? " (required)" : "");
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
        if (field.type === "radio") input.checked = text(file.answers, field.id) === option.id;
        else input.checked = many(file.answers, field.id).includes(option.id);
        input.addEventListener("change", () => {
          if (field.type === "radio") setAnswer(field.id, option.id);
          else setAnswer(field.id, toggleCheck(field.id, option.id, input.checked));
          if (field.type === "check" || field.id === "q3_is_lead" || field.id === "q5_builder" || field.id === "q12_outside" || field.id === "q13_level" || field.id === "q6_capabilities" || field.id === "q9_groups" || field.id === "q16_assurances" || field.id === "q14_overlays") {
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
      return THREATS.map((threat) => ({ key: `st22__${threat.id}`, title: `${def.title}: ${threat.label}` }));
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

  redraw();
}

function missing(section: FormSection, answers: Answers): string[] {
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

function exampleFile(): AnswerFile {
  const answers: Answers = {
    response_id: "EXAMPLE-S01",
    q1_intake: "EXAMPLE-HR-2026-S01",
    q2_agency: "Maryland Department of Small Business Standards (fictional)",
    q2_unit: "Grant outreach unit (fictional)",
    q2_role: "Agency Lead",
    q3_is_lead: "yes",
    q4_name: "OutreachMap Grant Outreach Ranker (fictional)",
    q5_builder: "vendor_product",
    q5_vendor: "Example Vendor (fictional)",
    q5_product: "OutreachMap",
    q5_version: "1.0-example",
    q5_changes: "None",
    q6_capabilities: ["ranks"],
    q6_design_facts: ["no_free_text_input", "no_personal_info", "public_inputs_only"],
    q6_method: "statistical",
    q6_hosting: "state_data_center",
    q6_description: "Example: ranks ZIP codes for grant outreach from public census data. Staff decide where to send outreach. Fictional system.",
    q7_purpose: "Example: help staff choose ZIP codes for small-business grant outreach. Today staff pick counties by hand. Fictional purpose.",
    q7b_prohibited: ["none"],
    q8_areas: ["benefits_services"],
    q8_target: "places_or_groups",
    q8_how: "It ranks places for outreach. It does not decide a grant.",
    q9_groups: ["businesses"],
    q9_rel__businesses: "affected_in_general",
    q10_role: "recommends",
    q11_reviewer: "Grants outreach manager",
    q12_outside: "yes",
    q13_level: "L1",
    q14_data_types: ["public_data"],
    q14_overlays: ["none"],
    q14_sources: "Public census tables (example).",
    q15_where: "state_data_center",
    q16_assurances: ["soc2"],
    q16_cert_scope: "yes",
    q17_status: "live",
    q18_procured: "before_2026_02_01",
    q19_start: "2025-09-01",
    q19_prior: "yes",
    q20_harm: "Example: a low rank could steer outreach away from a community that was underserved in the source data. The cost falls on those businesses.",
    q20_types: ["bias_harm", "missed_service"],
    q23_monitor: "Program manager",
    q23_incident: "Agency information security",
    q23_reassess: "Agency Lead",
    q25_confirm: ["confirm"],
  };
  const evidence = "Example agency file shows the control for this fictional assessment.";
  const strong: Record<string, string> = {
    st11a: "every_written",
    st11b: "both",
    st11c: "every",
    st11d: "full",
    st12a: "at_decision",
    st12b: "set_path",
    st12c: "reviewed",
    st12e__businesses: "fits",
    st14a: "scheduled",
    st14b: "logged",
    st15b: "controls",
    st15d: "on_schedule",
    st16a: "banned",
    st16b__responsibilities: "signed",
    st16b__model_change_notice: "signed",
    st16b__incident_notice: "signed",
    st20a: "written",
    st21a: "recorded",
    st21b: "audited",
    st21c: "threshold",
    st21d: "full",
    st21e: "both",
    st22__prompt_injection: "does_not_apply",
    st22__poisoned_data: "all",
    st22__model_theft: "all",
    st22__output_leakage: "does_not_apply",
    st22__unsafe_output_handling: "all",
    st22f: "tested",
    st23a: "yearly",
    st23b: "set",
    st23c: "told",
    st24a: "all_four",
    st24b: "full",
  };
  Object.assign(answers, strong);
  for (const key of Object.keys(strong)) {
    const defId = key.startsWith("st22__") ? "22" : key.startsWith("st16b__") ? "16b" : key.startsWith("st12e__") ? "12e" : key.replace(/^st/, "");
    const def = STATEMENT_BY_ID[defId];
    const choice = def?.choices.find((item) => item.value === strong[key]);
    if (choice?.asks === "evidence") answers[`${key}__evidence`] = evidence;
  }
  return {
    schema_version: SCHEMA_VERSION,
    form_version: FORM_VERSION,
    rules_version: RULES_VERSION,
    saved_at: new Date().toISOString(),
    example: true,
    example_label: "Example data. Fictional agency and AI system, shaped like synthetic scenario S01. Not a real assessment.",
    answers,
  };
}
