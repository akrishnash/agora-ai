from uuid import uuid4

from app.models import (
    ClaimNode,
    DebateRequest,
    DebateSession,
    DebateTurn,
    Expert,
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
    )
