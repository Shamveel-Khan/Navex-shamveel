export type ElementType =
  | "button"
  | "input"
  | "textarea"
  | "select"
  | "checkbox"
  | "radio"
  | "form";

export interface UIElement {
  id: string;
  type: ElementType;
  label: string;
  disabled?: boolean;
  options?: string[];
}

export interface PageState {
  path: string;
  title?: string;
  elements: UIElement[];
}

export type AgentAction =
  | { type: "navigate"; path: string }
  | { type: "click"; element_id: string }
  | { type: "fill"; element_id: string; value: string }
  | { type: "select"; element_id: string; value: string }
  | { type: "submit"; form_id: string };

export type ActionResult =
  | { status: "success"; page: PageState }
  | { status: "failed"; error: string; page: PageState };

export type TurnResponse =
  | {
      type: "action";
      step: number;
      thought?: string;
      action: AgentAction;
    }
  | {
      type: "final";
      reason: "complete" | "failed" | "max_steps";
      message: string;
    };

export interface SessionCreated {
  session_id: string;
}
