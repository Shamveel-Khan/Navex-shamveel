"""Terminal Logger with ANSI color formatting for NAVEX requests, OpenJev calls, and agent steps.
"""

import json
import sys
import time
from typing import Any

# ANSI Colors
RESET = "\033[0m"
BOLD = "\033[1m"
DIM = "\033[2m"

CYAN = "\033[36m"
BLUE = "\033[34m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
MAGENTA = "\033[35m"
RED = "\033[31m"
WHITE = "\033[37m"

BG_BLUE = "\033[44m"
BG_MAGENTA = "\033[45m"
BG_GREEN = "\033[42m"


def log_http_request(method: str, path: str, body: Any = None) -> None:
    print(f"\n{BOLD}{CYAN}╭─── [HTTP REQUEST] ────────────────────────────────────────────────────────────{RESET}")
    print(f"{BOLD}{CYAN}│{RESET} {BOLD}{WHITE}{method}{RESET} {CYAN}{path}{RESET}")
    if body is not None:
        try:
            if isinstance(body, (dict, list)):
                formatted = json.dumps(body, indent=2)
            elif isinstance(body, bytes):
                formatted = json.dumps(json.loads(body.decode("utf-8")), indent=2)
            else:
                formatted = str(body)
            for line in formatted.splitlines():
                print(f"{BOLD}{CYAN}│{RESET}   {DIM}{line}{RESET}")
        except Exception:
            print(f"{BOLD}{CYAN}│{RESET}   {DIM}{str(body)[:500]}{RESET}")
    print(f"{BOLD}{CYAN}╰───────────────────────────────────────────────────────────────────────────────{RESET}")
    sys.stdout.flush()


def log_http_response(status_code: int, duration_ms: float, body: Any = None) -> None:
    color = GREEN if status_code < 400 else (YELLOW if status_code < 500 else RED)
    print(f"{BOLD}{color}╭─── [HTTP RESPONSE] ───────────────────────────────────────────────────────────{RESET}")
    print(f"{BOLD}{color}│{RESET} Status: {BOLD}{color}{status_code}{RESET} | Duration: {duration_ms:.1f}ms")
    if body is not None:
        try:
            if isinstance(body, (dict, list)):
                formatted = json.dumps(body, indent=2)
            else:
                formatted = str(body)
            for line in formatted.splitlines()[:20]:
                print(f"{BOLD}{color}│{RESET}   {DIM}{line}{RESET}")
        except Exception:
            pass
    print(f"{BOLD}{color}╰───────────────────────────────────────────────────────────────────────────────{RESET}\n")
    sys.stdout.flush()


def log_openjev_request(
    endpoint: str,
    model: str,
    user_goal: str,
    previous_state: str,
    previous_action: str,
    current_state: str,
    choices: list[Any],
    instructions: str,
) -> None:
    print(f"\n{BOLD}{MAGENTA}╔═══════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{MAGENTA}║ [OPENJEV REQUEST OUTGOING]{RESET}")
    print(f"{BOLD}{MAGENTA}║{RESET} {BOLD}Endpoint:{RESET} {endpoint}  |  {BOLD}Model:{RESET} {model}")
    print(f"{BOLD}{MAGENTA}║{RESET} {BOLD}User Goal:{RESET} {WHITE}\"{user_goal}\"{RESET}")
    print(f"{BOLD}{MAGENTA}║{RESET} {BOLD}Prev State:{RESET} {DIM}{previous_state}{RESET}")
    print(f"{BOLD}{MAGENTA}║{RESET} {BOLD}Prev Action:{RESET} {YELLOW}{previous_action}{RESET}")
    print(f"{BOLD}{MAGENTA}║{RESET} {BOLD}Current State:{RESET} {CYAN}{current_state}{RESET}")
    print(f"{BOLD}{MAGENTA}║{RESET}")
    print(f"{BOLD}{MAGENTA}║ Candidate Choices ({len(choices)} options):{RESET}")
    for i, c in enumerate(choices, start=1):
        is_term = getattr(c, "is_terminal", False) or c.id == "job_already_done"
        tag = f"{GREEN}[DONE]{RESET}" if is_term else f"{CYAN}[ACTION]{RESET}"
        print(f"{BOLD}{MAGENTA}║{RESET}   {DIM}{i:02d}.{RESET} {tag} {BOLD}{c.id}{RESET} -> {c.label}")
    print(f"{BOLD}{MAGENTA}╚═══════════════════════════════════════════════════════════════════════════════{RESET}")
    sys.stdout.flush()


def log_openjev_response(
    selected_choice_id: str,
    thought: str,
    decision_action: Any,
    is_heuristic: bool = False,
) -> None:
    mode_tag = f"{YELLOW}(Heuristic Engine){RESET}" if is_heuristic else f"{GREEN}(API Response){RESET}"
    print(f"\n{BOLD}{GREEN}╔═══════════════════════════════════════════════════════════════════════════════{RESET}")
    print(f"{BOLD}{GREEN}║ [OPENJEV DECISION RECEIVED] {mode_tag}{RESET}")
    print(f"{BOLD}{GREEN}║{RESET} {BOLD}Selected Choice ID:{RESET} {WHITE}{BOLD}{selected_choice_id}{RESET}")
    print(f"{BOLD}{GREEN}║{RESET} {BOLD}Thought:{RESET} {DIM}{thought}{RESET}")
    if decision_action:
        action_dict = decision_action.model_dump() if hasattr(decision_action, "model_dump") else str(decision_action)
        print(f"{BOLD}{GREEN}║{RESET} {BOLD}Target Action:{RESET} {YELLOW}{json.dumps(action_dict)}{RESET}")
    else:
        print(f"{BOLD}{GREEN}║{RESET} {BOLD}Target Action:{RESET} {GREEN}job_already_done (Task Completed!){RESET}")
    print(f"{BOLD}{GREEN}╚═══════════════════════════════════════════════════════════════════════════════{RESET}\n")
    sys.stdout.flush()


def log_agent_engine_step(
    step: int,
    action_or_final: str,
    details: Any,
    verdict: str = "OK",
) -> None:
    print(f"{BOLD}{BLUE}► [ENGINE STEP {step}] {action_or_final}: {YELLOW}{details}{RESET} (Verdict: {GREEN}{verdict}{RESET})")
    sys.stdout.flush()
