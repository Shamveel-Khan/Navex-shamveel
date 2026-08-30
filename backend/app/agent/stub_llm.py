"""Stub decider for tests — same interface as RealLLM.decide().

Inject with `StubLLM(script=[...])` to control exactly what decisions are
returned, in order. Exposes `.script` so tests can inspect / mutate it.
"""

from app.agent.decisions import AgentDecision
from app.registry import SiteRegistry
from app.session import Session


class StubLLM:
    def __init__(self, script: list[AgentDecision] | None = None) -> None:
        self.script: list[AgentDecision] = list(script) if script else []

    def decide(self, session: Session, registry: SiteRegistry) -> AgentDecision:
        if not self.script:
            return AgentDecision(
                status="complete",
                message="Done (no script provided).",
            )
        return self.script.pop(0)
