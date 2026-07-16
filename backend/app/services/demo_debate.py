from uuid import uuid4

from app.models import (
    ClaimNode,
    DebateRequest,
    DebateSession,
    DebateTurn,
    Expert,
    InterventionRequest,
    ModeratorBrief,
)


def build_demo_debate(request: DebateRequest) -> DebateSession:
    return DebateSession(
        id=uuid4(),
        topic=request.topic,
        format=request.format,
        experts=[
            Expert(
                id="safety",
                name="Dr. Mira Chen",
                role="AI Safety Researcher",
                stance="mixed",
                confidence=71,
            ),
            Expert(
                id="open",
                name="Rafael Okafor",
                role="Open-Source Advocate",
                stance="support",
                confidence=84,
            ),
            Expert(
                id="security",
                name="Anika Rao",
                role="Security Researcher",
                stance="oppose",
                confidence=79,
            ),
            Expert(
                id="economist",
                name="Prof. Elias Grant",
                role="Innovation Economist",
                stance="support",
                confidence=67,
            ),
            Expert(
                id="policy",
                name="Leah Moretti",
                role="Technology Policy Lawyer",
                stance="mixed",
                confidence=73,
            ),
        ],
        turns=[
            DebateTurn(
                speaker_id="moderator",
                claim="Motion opened: powerful AI systems should be open source by default unless clear misuse risks are demonstrated.",
                evidence="Format: expert opening statements, cross-examination, user intervention, final reasoning brief.",
                relation="opens",
            ),
            DebateTurn(
                speaker_id="open",
                claim="Open access improves auditability. More independent researchers can find failure modes before deployment.",
                evidence="Supported by the history of open cryptography review and reproducible ML safety research.",
                relation="supports",
            ),
            DebateTurn(
                speaker_id="security",
                claim="Capability release is not the same as source transparency. Some model weights can directly lower the cost of misuse.",
                evidence="Cyber, biosecurity, and persuasion risks scale differently from normal software vulnerabilities.",
                relation="challenges",
            ),
            DebateTurn(
                speaker_id="economist",
                claim="Concentrating frontier systems in a few firms creates market power and slows downstream innovation.",
                evidence="Platform economics suggests open ecosystems often expand total market creation.",
                relation="supports",
            ),
            DebateTurn(
                speaker_id="safety",
                claim="The defensible policy is staged openness: publish evaluations, tools, and smaller models while gating the highest-risk capabilities.",
                evidence="This balances independent scrutiny with proportional release controls.",
                relation="revises",
            ),
        ],
        graph=[
            ClaimNode(
                label="Auditability increases with access",
                confidence=82,
                status="supported",
            ),
            ClaimNode(
                label="Misuse risk rises with capability",
                confidence=78,
                status="contested",
            ),
            ClaimNode(
                label="Open ecosystems accelerate innovation",
                confidence=74,
                status="supported",
            ),
            ClaimNode(
                label="Staged release is the strongest compromise",
                confidence=86,
                status="revised",
            ),
        ],
        brief=ModeratorBrief(
            strongest_position="Staged openness: publish evaluations and safety tools broadly while gating the highest-risk weights.",
            weakest_assumption="That independent auditors can access enough system detail without full model release.",
            unresolved_disagreement="Whether open access reduces concentrated power more than it increases misuse risk.",
            next_question="What concrete capability threshold should trigger restricted release?",
        ),
        mode="demo",
    )


def build_demo_intervention(request: InterventionRequest) -> DebateSession:
    session = request.session.model_copy(deep=True)
    session.turns.append(
        DebateTurn(
            speaker_id="security",
            claim="The user's challenge changes the burden of proof: advocates must separate auditability benefits from unrestricted release of high-risk weights.",
            evidence=f"Intervention considered: {request.instruction}",
            relation="challenges",
        )
    )
    session.turns.append(
        DebateTurn(
            speaker_id="open",
            claim="I revise my position: openness should be layered, with public evaluations and reproducible safety tooling released before full frontier-weight access.",
            evidence="This preserves independent scrutiny while acknowledging asymmetric misuse risks.",
            relation="revises",
        )
    )
    session.graph.append(
        ClaimNode(
            label="Layered openness beats binary release",
            confidence=89,
            status="revised",
        )
    )
    session.brief = ModeratorBrief(
        strongest_position="Layered openness is now strongest: open evaluations, safety tooling, and lower-risk models first; gate frontier weights behind thresholds.",
        weakest_assumption="That we can define capability thresholds before a model is widely tested by independent researchers.",
        unresolved_disagreement="Whether gatekeeping frontier weights protects society or concentrates too much power in a few labs.",
        next_question="Which concrete evaluations should trigger public release, staged release, or restricted access?",
    )
    return session
