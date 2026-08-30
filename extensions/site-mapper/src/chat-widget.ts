const STYLE_ID = "nvx-widget-styles";

const STYLES = `
.nvx-root { position: fixed; bottom: 24px; right: 24px; z-index: 2147483000; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
.nvx-launcher { width: 56px; height: 56px; border-radius: 50%; border: none; background: #4f46e5; color: #fff; font-size: 24px; cursor: pointer; box-shadow: 0 10px 30px rgba(79,70,229,.45); display: flex; align-items: center; justify-content: center; transition: transform .15s ease; }
.nvx-launcher:hover { transform: scale(1.06); }
.nvx-panel { position: absolute; bottom: 72px; right: 0; width: 340px; max-width: calc(100vw - 32px); height: 480px; max-height: calc(100vh - 120px); background: #fff; border: 1px solid #e3e6ee; border-radius: 16px; box-shadow: 0 24px 60px rgba(15,23,42,.25); display: flex; flex-direction: column; overflow: hidden; }
.nvx-hidden { display: none !important; }
.nvx-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: #4f46e5; color: #fff; }
.nvx-title { font-weight: 600; font-size: 14px; letter-spacing: .01em; }
.nvx-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #34d399; margin-right: 8px; }
.nvx-close { background: transparent; border: none; color: #e0e7ff; font-size: 20px; cursor: pointer; line-height: 1; padding: 2px 6px; border-radius: 6px; }
.nvx-close:hover { background: rgba(255,255,255,.15); color: #fff; }
.nvx-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 8px; background: #f8f9fd; }
.nvx-msg { max-width: 85%; padding: 9px 12px; border-radius: 12px; font-size: 13.5px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
.nvx-msg-user { align-self: flex-end; background: #4f46e5; color: #fff; border-bottom-right-radius: 4px; }
.nvx-msg-agent { align-self: flex-start; background: #fff; color: #1c2333; border: 1px solid #e3e6ee; border-bottom-left-radius: 4px; }
.nvx-msg-system { align-self: center; background: transparent; color: #98a2b3; font-size: 12px; text-align: center; }
.nvx-status { padding: 6px 14px; font-size: 12px; color: #667085; background: #eef2ff; display: flex; align-items: center; gap: 8px; }
.nvx-spinner { width: 12px; height: 12px; border: 2px solid #c7d2fe; border-top-color: #4f46e5; border-radius: 50%; animation: nvx-spin .7s linear infinite; }
@keyframes nvx-spin { to { transform: rotate(360deg); } }
.nvx-inputrow { display: flex; gap: 8px; padding: 12px; border-top: 1px solid #e3e6ee; background: #fff; }
.nvx-input { flex: 1; padding: 10px 12px; font: inherit; font-size: 13.5px; border: 1px solid #e3e6ee; border-radius: 10px; outline: none; }
.nvx-input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }
.nvx-input:disabled { background: #f3f4f6; }
.nvx-send { padding: 10px 14px; font: inherit; font-size: 13.5px; font-weight: 600; border: none; border-radius: 10px; background: #4f46e5; color: #fff; cursor: pointer; }
.nvx-send:hover { background: #4338ca; }
.nvx-send:disabled { opacity: .55; cursor: default; }
`;

export interface WidgetCallbacks {
  onSubmit: (message: string) => void;
}

export interface WidgetOptions {
  /** Mount inside a closed shadow root so host-site CSS cannot interfere. */
  shadow?: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

export class ChatWidget {
  private readonly mountNode: HTMLElement;
  private readonly styleRoot: Document | ShadowRoot;
  private readonly root: HTMLDivElement;
  private readonly launcher: HTMLButtonElement;
  private readonly panel: HTMLDivElement;
  private readonly messages: HTMLDivElement;
  private readonly status: HTMLDivElement;
  private readonly statusText: HTMLSpanElement;
  private readonly input: HTMLInputElement;
  private readonly send: HTMLButtonElement;

  constructor(
    private readonly callbacks: WidgetCallbacks,
    options: WidgetOptions = {},
  ) {
    const useShadow = options.shadow ?? false;

    if (useShadow) {
      this.mountNode = document.createElement("div");
      document.body.appendChild(this.mountNode);
      this.styleRoot = this.mountNode.attachShadow({ mode: "closed" });
    } else {
      this.mountNode = el("div");
      this.styleRoot = document;
    }
    this.injectStyles();

    this.root = el("div", "nvx-root");
    this.launcher = el("button", "nvx-launcher");
    this.launcher.type = "button";
    this.launcher.setAttribute("aria-label", "Open Navex assistant");
    this.launcher.textContent = "✦";

    this.panel = el("div", "nvx-panel nvx-hidden");

    const header = el("div", "nvx-header");
    const title = el("span", "nvx-title");
    const dot = el("span", "nvx-dot");
    title.appendChild(dot);
    title.appendChild(document.createTextNode("Navex Assistant"));
    const close = el("button", "nvx-close");
    close.type = "button";
    close.textContent = "×";
    header.append(title, close);

    this.messages = el("div", "nvx-messages");

    this.status = el("div", "nvx-status nvx-hidden");
    const spinner = el("span", "nvx-spinner");
    this.statusText = el("span");
    this.status.append(spinner, this.statusText);

    const inputRow = el("form", "nvx-inputrow") as HTMLFormElement;
    this.input = el("input", "nvx-input") as HTMLInputElement;
    this.input.type = "text";
    this.input.placeholder = 'Try: "Create a project called Alpha"';
    this.send = el("button", "nvx-send") as HTMLButtonElement;
    this.send.type = "submit";
    this.send.textContent = "Send";
    inputRow.append(this.input, this.send);

    this.panel.append(header, this.messages, this.status, inputRow);
    this.root.append(this.panel, this.launcher);
    this.styleRoot.appendChild(this.root);

    this.launcher.addEventListener("click", () => this.toggle());
    close.addEventListener("click", () => this.close());
    inputRow.addEventListener("submit", (event) => {
      event.preventDefault();
      this.submitInput();
    });
  }

  private injectStyles(): void {
    if (this.styleRoot.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = STYLES;
    this.styleRoot.appendChild(style);
  }

  private submitInput(): void {
    const value = this.input.value.trim();
    if (!value || this.send.disabled) return;
    this.input.value = "";
    this.addMessage("user", value);
    this.callbacks.onSubmit(value);
  }

  addMessage(kind: "user" | "agent" | "system", text: string): void {
    const bubble = el("div", `nvx-msg nvx-msg-${kind}`);
    bubble.textContent = text;
    this.messages.appendChild(bubble);
    this.messages.scrollTop = this.messages.scrollHeight;
    if (kind !== "system") this.open();
  }

  setStatus(text: string | null): void {
    if (!text) {
      this.status.classList.add("nvx-hidden");
      this.statusText.textContent = "";
      return;
    }
    this.statusText.textContent = text;
    this.status.classList.remove("nvx-hidden");
    this.messages.scrollTop = this.messages.scrollHeight;
  }

  setBusy(busy: boolean): void {
    this.send.disabled = busy;
    this.input.disabled = busy;
    if (busy) this.setStatus("Working…");
  }

  open(): void {
    this.panel.classList.remove("nvx-hidden");
  }

  close(): void {
    this.panel.classList.add("nvx-hidden");
  }

  toggle(): void {
    this.panel.classList.toggle("nvx-hidden");
  }

  destroy(): void {
    this.mountNode.remove();
  }
}
