import { describe, expect, it } from "vitest";

import { scanPage } from "../src/core/scanner";

function demoProjectsDoc(): Document {
  document.body.innerHTML = `
    <h1>Projects</h1>
    <p class="subtitle">Create, view, and manage your projects.</p>
    <button data-waid="create_project_button" class="primary">+ Create Project</button>
    <input data-waid="search_projects_input" type="search" placeholder="Search projects..." />
    <select data-waid="project_priority_filter"><option>All</option><option>High</option></select>
    <ul>
      <li class="project-card">
        <strong>Website Redesign</strong>
        <span class="badge">Medium</span>
        <button data-waid="project_card_prj_001" aria-label="Open Website Redesign">View details →</button>
      </li>
      <li class="project-card">
        <strong>Mobile App Beta</strong>
        <span class="badge">High</span>
        <button data-waid="project_card_prj_002" aria-label="Open Mobile App Beta">View details →</button>
      </li>
    </ul>
    <a href="/team">Team</a>
    <a href="/tasks">Tasks</a>
    <a href="https://external.example.com/x">External</a>
    <a href="#anchor">Anchor</a>
    <div id="modal" class="modal" style="display:none">
      <h2>Create Project</h2>
      <form data-waid="new_project_form">
        <label>Project Name <input data-waid="project_name_input" type="text" /></label>
        <select data-waid="priority_select"><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option></select>
        <button data-waid="save_project_button" type="submit">Save Project</button>
      </form>
    </div>
  `;
  return document;
}

describe("scanPage", () => {
  it("preserves authored data-waid ids and labels", () => {
    const { page } = scanPage(demoProjectsDoc(), "http://localhost:5173/projects", {
      inject: true,
    });
    expect(page.path).toBe("/projects");
    const ids = page.elements.map((e) => e.id);
    expect(ids).toContain("create_project_button");
    expect(ids).toContain("search_projects_input");
    expect(ids).toContain("project_card_prj_001");
    const card = page.elements.find((e) => e.id === "project_card_prj_001");
    expect(card?.label).toBe("Open Website Redesign");
  });

  it("does not inject over authored ids and is stable on rescan", () => {
    const doc = demoProjectsDoc();
    const first = scanPage(doc, "http://localhost:5173/projects", { inject: true });
    const authoredIds = Array.from(doc.querySelectorAll("[data-waid='create_project_button'], [data-waid='project_name_input'], [data-waid='search_projects_input'], [data-waid='save_project_button']"));
    for (const el of authoredIds) {
      expect(el.getAttribute("data-waid")).toBe(el.getAttribute("data-waid"));
    }
    expect(first.injected).toBeGreaterThan(0);
    const second = scanPage(doc, "http://localhost:5173/projects", { inject: true });
    expect(second.injected).toBe(0);
    expect(
      Array.from(doc.querySelectorAll<HTMLElement>("[data-waid]")).map((el) =>
        el.getAttribute("data-waid"),
      ),
    ).toEqual(
      Array.from(doc.querySelectorAll<HTMLElement>("[data-waid]")).map((el) =>
        el.getAttribute("data-waid"),
      ),
    );
  });

  it("injects generated ids for uncovered elements like links", () => {
    const doc = demoProjectsDoc();
    const { injected, page } = scanPage(doc, "http://localhost:5173/projects", {
      inject: true,
    });
    expect(injected).toBeGreaterThan(0);
    const teamLink = page.elements.find((e) => e.label === "Team");
    expect(teamLink?.id).toBe("team_button");
    expect(doc.querySelector('[data-waid="team_button"]')).not.toBeNull();
  });

  it("skips hidden modal content until it is visible", () => {
    const doc = demoProjectsDoc();
    const { page } = scanPage(doc, "http://localhost:5173/projects");
    expect(page.elements.find((e) => e.id === "project_name_input")).toBeUndefined();
    doc.getElementById("modal")!.style.display = "block";
    const reopened = scanPage(doc, "http://localhost:5173/projects");
    expect(reopened.page.elements.find((e) => e.id === "project_name_input")).toBeDefined();
  });

  it("generates stable ids across repeated scans", () => {
    const doc = demoProjectsDoc();
    const first = scanPage(doc, "http://localhost:5173/projects");
    const second = scanPage(doc, "http://localhost:5173/projects");
    expect(first.page.elements.map((e) => e.id)).toEqual(
      second.page.elements.map((e) => e.id),
    );
  });

  it("captures select options and descriptions", () => {
    const doc = demoProjectsDoc();
    doc.getElementById("modal")!.style.display = "block";
    const { page } = scanPage(doc, "http://localhost:5173/projects");
    const select = page.elements.find((e) => e.id === "priority_select");
    expect(select?.options).toEqual(["High", "Medium", "Low"]);
    expect(select?.description).toContain("Chooses one of");
    const save = page.elements.find((e) => e.id === "save_project_button");
    expect(save?.description).toContain("Submits");
  });

  it("truncates huge pages and flags it", () => {
    document.body.innerHTML = Array.from(
      { length: 100 },
      (_, i) => `<button aria-label="B${i}">b${i}</button>`,
    ).join("");
    const { page } = scanPage(document, "http://localhost:5173/x", { maxElements: 10 });
    expect(page.elements.length).toBe(10);
    expect(page.truncated).toBe(true);
  });

  it("derives a page description from the heading and element count", () => {
    const { page } = scanPage(demoProjectsDoc(), "http://localhost:5173/projects");
    expect(page.description).toContain("Projects");
    expect(page.description).toContain("interactive");
  });
});