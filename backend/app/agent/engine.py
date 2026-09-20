from typing import Protocol

from app.agent.decisions import AgentDecision
from app.agent.prompts import format_action
from app.agent.validator import validate_action
from app.logger import log_agent_engine_step
from app.registry import SiteRegistry
from app.schemas.protocol import ActionResultPayload, TurnAction, TurnFinal
from app.session import Session, StepRecord


class Decider(Protocol):
    def decide(self, session: Session, registry: SiteRegistry) -> AgentDecision: ...


class AgentEngine:
    def __init__(
        self,
        llm: Decider,
        registry: SiteRegistry,
        max_steps: int = 12,
        max_invalid_streak: int = 2,
    ) -> None:
        self.llm = llm
        self.registry = registry
        self.max_steps = max_steps
        self.max_invalid_streak = max_invalid_streak

    def advance(
        self,
        session: Session,
        observation: ActionResultPayload | None = None,
        registry: SiteRegistry | None = None,
    ) -> TurnAction | TurnFinal:
        active_registry = registry or self.registry
        if observation is not None:
            self._record_outcome(session, observation)

        if session.status == "done" and observation is not None:
            return TurnFinal(
                reason="complete",
                message="This task is already finished.",
            )

        if session.steps_taken >= self.max_steps:
            return self._finalize(
                session,
                "max_steps",
                "I stopped because this task took too many steps.",
            )

        for _ in range(3):
            decision = self.llm.decide(session, active_registry)

            if decision.status != "action":
                reason = (
                    "complete" if decision.status == "complete" else "failed"
                )
                if (
                    reason == "failed"
                    and session.steps_taken == 0
                    and not session.premature_failure_nudged
                ):
                    session.premature_failure_nudged = True
                    session.feedback.append(
                        "premature_failure: no actions have been taken yet, so "
                        "you have not seen any page elements. Before declaring "
                        "the task impossible, navigate to the page whose "
                        "description matches the request."
                    )
                    continue
                return self._finalize(session, reason, decision.message)

            verdict = validate_action(
                decision.action, active_registry, session.page_state
            )
            if not verdict.ok:
                session.invalid_streak += 1
                session.feedback.append(verdict.error)
                if session.invalid_streak >= self.max_invalid_streak:
                    return self._finalize(
                        session,
                        "failed",
                        f"I could not determine a valid next step ({verdict.error})",
                    )
                continue

            session.invalid_streak = 0

            previous = (
                session.history[-1].action if session.history else None
            )
            if previous is not None and decision.action == previous:
                session.repeat_streak += 1
            else:
                session.repeat_streak = 0

            if session.repeat_streak >= 2:
                return self._finalize(
                    session,
                    "failed",
                    "I got stuck repeating the same action "
                    f"({format_action(decision.action)}) and stopped.",
                )
            if session.repeat_streak == 1:
                session.feedback.append(
                    "repeated_action: you already issued "
                    f"{format_action(decision.action)} and the screen updated. "
                    "Choose a different next step."
                )
                continue

            session.steps_taken += 1
            session.previous_action = decision.action
            session.previous_action_label = getattr(decision, "choice_label", "") or format_action(decision.action)
            session.history.append(
                StepRecord(
                    step=session.steps_taken,
                    action=decision.action,
                    action_label=session.previous_action_label,
                )
            )
            log_agent_engine_step(
                step=session.steps_taken,
                action_or_final="ACTION",
                details=format_action(decision.action),
                verdict="VALID",
            )
            return TurnAction(
                step=session.steps_taken,
                thought=decision.thought,
                action=decision.action,
            )

        return self._finalize(
            session, "failed", "I could not produce a valid action."
        )

    def _record_outcome(
        self, session: Session, observation: ActionResultPayload
    ) -> None:
        outcome = (
            "ok"
            if observation.status == "success"
            else f"error: {observation.error}"
        )
        for record in reversed(session.history):
            if record.outcome == "pending":
                record.outcome = outcome
                break
        if observation.page is not None:
            session.previous_page_state = session.page_state
            session.page_state = observation.page
            session.current_page = observation.page.path
        if observation.status == "failed" and observation.error:
            session.feedback.append(f"last_action_failed: {observation.error}")

    def _finalize(
        self, session: Session, reason: str, message: str
    ) -> TurnFinal:
        session.status = "done"
        log_agent_engine_step(
            step=session.steps_taken,
            action_or_final="FINAL",
            details=f"reason='{reason}', message='{message}'",
            verdict="TERMINATED",
        )
        return TurnFinal(reason=reason, message=message)

