import { describe, expect, it } from "vitest";

import { composeId, IdGenerator, slugify } from "../src/core/ids";

describe("slugify", () => {
  it("lowercases and converts spaces to underscores", () => {
    expect(slugify("Create Project")).toBe("create_project");
  });

  it("strips punctuation like + and …", () => {
    expect(slugify("+ Create Project")).toBe("create_project");
    expect(slugify("Search projects...")).toBe("search_projects");
    expect(slugify("Save Settings")).toBe("save_settings");
  });

  it("handles empty and punctuation-only input", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});

describe("composeId", () => {
  it("appends a type suffix", () => {
    expect(composeId("priority", "select")).toBe("priority_select");
    expect(composeId("display_name", "input")).toBe("display_name_input");
  });

  it("falls back to 'element' for empty slugs", () => {
    expect(composeId("", "button")).toBe("element_button");
  });
});

describe("IdGenerator", () => {
  function el(tag: string, attrs: Record<string, string> = {}): Element {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  }

  it("generates deterministic ids from labels", () => {
    const gen = new IdGenerator();
    const one = el("button", { "aria-label": "Create Project" });
    const two = el("button", { "aria-label": "Create Project" });
    expect(gen.assign(one, "button", "Create Project").id).toBe("create_project_button");
    expect(gen.assign(two, "button", "Create Project").id).toBe("create_project_button_2");
  });

  it("keeps author-provided data-waid ids", () => {
    const gen = new IdGenerator();
    const authored = el("button", { "data-waid": "save_project_button", "aria-label": "Save" });
    const result = gen.assign(authored, "button", "Save");
    expect(result).toEqual({ id: "save_project_button", authored: true });
  });

  it("uses ordinal fallback when no label exists", () => {
    const gen = new IdGenerator();
    const one = el("input");
    const two = el("input");
    expect(gen.assign(one, "input", "").id).toBe("el_input_1");
    expect(gen.assign(two, "input", "").id).toBe("el_input_2");
  });
});