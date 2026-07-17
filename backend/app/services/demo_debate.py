"""Deterministic demo debates.

This is the safety net for live demos: it must NEVER render a debate about the
wrong question. There is a hand-authored flagship debate for the open-source AI
topic (the primary demo), and a topic-aware generic template for everything else
so the fallback always matches whatever the user typed.
"""

from uuid import uuid4

from app.models import (
    DebateRequest,
    DebateSession,
    DebateTurn,
    Expert,
    InterventionRequest,
    ModeratorBrief,
)


def build_demo_debate(request: DebateRequest) -> DebateSession:
    if _is_open_source_topic(request.topic):
        return _flagship_open_source_debate(request)
    return _generic_debate(request)


def _is_open_source_topic(topic: str) -> bool:
    t = topic.lower()
    return ("open" in t and ("source" in t or "weight" in t)) and (
        "ai" in t or "model" in t or "agi" in t or "frontier" in t
    )


# ── Flagship: Should AGI / frontier models be open source? ────────────────────
def _flagship_open_source_debate(request: DebateRequest) -> DebateSession:
    return DebateSession(
        id=uuid4(),
        topic=request.topic,
        format=request.format,
        experts=[
            Expert(id="safety",    name="Dr. Mira Chen",   role="AI Safety Researcher",      stance="mixed",   confidence=71),
            Expert(id="open",      name="Rafael Okafor",    role="Open-Source Advocate",      stance="support", confidence=84),
            Expert(id="security",  name="Anika Rao",        role="Security Researcher",       stance="oppose",  confidence=79),
            Expert(id="economist", name="Prof. Elias Grant", role="Innovation Economist",     stance="support", confidence=67),
            Expert(id="policy",    name="Leah Moretti",     role="Technology Policy Lawyer",  stance="mixed",   confidence=73),
        ],
        turns=[
            DebateTurn(
                id="t0", speaker_id="moderator", relation="opens", target_id=None, confidence=50,
                headline="Open by default, unless misuse is proven",
                claim="Motion opened: powerful AI systems should be open source by default unless clear misuse risks are demonstrated.",
                evidence="Format: expert opening statements, cross-examination, user intervention, and a final reasoning brief.",
            ),
            DebateTurn(
                id="t1", speaker_id="open", relation="supports", target_id="t0", confidence=84,
                headline="Open access improves auditability",
                claim="Open access improves auditability. More independent researchers can find failure modes before deployment.",
                evidence="The history of open cryptography review and reproducible ML safety research supports broad scrutiny.",
            ),
            DebateTurn(
                id="t2", speaker_id="security", relation="challenges", target_id="t1", confidence=79,
                headline="Weight release lowers cost of misuse",
                claim="Capability release is not the same as source transparency. Some model weights directly lower the cost of misuse.",
                evidence="Cyber, biosecurity, and persuasion risks scale differently from ordinary software vulnerabilities.",
            ),
            DebateTurn(
                id="t3", speaker_id="economist", relation="supports", target_id="t1", confidence=67,
                headline="Closed frontier concentrates market power",
                claim="Concentrating frontier systems in a few firms creates market power and slows downstream innovation.",
                evidence="Platform economics shows open ecosystems often expand total market creation rather than shrink it.",
            ),
            DebateTurn(
                id="t4", speaker_id="safety", relation="revises", target_id="t2", confidence=81,
                headline="Staged openness is the defensible line",
                claim="The defensible policy is staged openness: publish evaluations, tools, and smaller models while gating the highest-risk capabilities.",
                evidence="This balances independent scrutiny against proportional release controls for the riskiest weights.",
            ),
            DebateTurn(
                id="t5", speaker_id="policy", relation="challenges", target_id="t4", confidence=68,
                headline="Who defines the risk threshold?",
                claim="Staged openness only works if a credible institution can define and audit the capability threshold that triggers gating.",
                evidence="Existing export-control and dual-use frameworks show thresholds are gameable without independent oversight.",
            ),
        ],
        brief=ModeratorBrief(
            strongest_position="Staged openness: publish evaluations and safety tools broadly while gating the highest-risk weights.",
            weakest_assumption="That independent auditors can access enough system detail without full model release.",
            unresolved_disagreement="Whether open access reduces concentrated power more than it increases misuse risk.",
            next_question="What concrete capability threshold should trigger restricted release, and who audits it?",
        ),
        mode="demo",
    )


# ── Topic-aware generic debate (fallback for any other question) ──────────────
def _generic_debate(request: DebateRequest) -> DebateSession:
    topic = request.topic.strip()
    return DebateSession(
        id=uuid4(),
        topic=topic,
        format=request.format,
        experts=[
            Expert(id="advocate",  name="Dr. Nadia Feldman", role="Lead Proponent",        stance="support", confidence=82),
            Expert(id="skeptic",   name="Marcus Reilly",     role="Critical Skeptic",      stance="oppose",  confidence=78),
            Expert(id="economist", name="Prof. Sofia Kang",  role="Economist",             stance="mixed",   confidence=69),
            Expert(id="ethicist",  name="Dr. Amara Osei",    role="Ethicist & Legal Scholar", stance="mixed", confidence=72),
            Expert(id="scientist", name="Dr. Julian Voss",   role="Domain Scientist",      stance="oppose",  confidence=75),
        ],
        turns=[
            DebateTurn(
                id="t0", speaker_id="moderator", relation="opens", target_id=None, confidence=50,
                headline="Framing the central tension",
                claim=f"The panel convenes on a live question: {topic} We will surface the core tension, pressure-test each claim with evidence, and map where consensus actually holds.",
                evidence="Format: opening statements, cross-examination, user intervention, and a final reasoning brief.",
            ),
            DebateTurn(
                id="t1", speaker_id="advocate", relation="supports", target_id="t0", confidence=82,
                headline="The affirmative case is concrete",
                claim="The strongest case in favor rests on measurable, near-term benefits, while the costs of doing nothing compound quietly over time.",
                evidence="Comparable policy shifts show early movers capture durable advantages that late adopters struggle to recover.",
            ),
            DebateTurn(
                id="t2", speaker_id="skeptic", relation="challenges", target_id="t1", confidence=78,
                headline="Benefits are overstated, risks underpriced",
                claim="That case understates second-order effects. The headline benefit is real but narrow, and the tail risks are systematically underpriced.",
                evidence="Historical precedent shows interventions like this often shift harm onto parties who were never at the table.",
            ),
            DebateTurn(
                id="t3", speaker_id="economist", relation="supports", target_id="t2", confidence=69,
                headline="Incentives decide the real outcome",
                claim="Whether this helps or harms is mostly an incentives question — who bears the cost and who captures the upside determines the actual outcome.",
                evidence="Standard welfare analysis: the sign of the net effect flips depending on how the externalities are allocated.",
            ),
            DebateTurn(
                id="t4", speaker_id="scientist", relation="challenges", target_id="t1", confidence=75,
                headline="The evidence base is thinner than claimed",
                claim="The empirical foundation is thinner than the affirmative implies. Most supporting studies are observational and rarely replicate under stress.",
                evidence="Peer-reviewed replication rates in this area remain low, so confident causal claims are premature.",
            ),
            DebateTurn(
                id="t5", speaker_id="ethicist", relation="revises", target_id="t3", confidence=74,
                headline="A conditional, safeguarded yes",
                claim="I revise toward a conditional position: proceed, but only with enforceable safeguards, transparency, and a defined off-ramp if harms materialize.",
                evidence="Precautionary governance frameworks let societies capture upside while retaining the ability to reverse course.",
            ),
        ],
        brief=ModeratorBrief(
            strongest_position="A conditional yes: proceed only with enforceable safeguards, transparency, and a defined off-ramp if measured harms appear.",
            weakest_assumption="That the headline benefits generalize beyond the specific cases where they have been observed.",
            unresolved_disagreement="Whether the tail risks are governable in practice or intrinsic to the proposal itself.",
            next_question="Which measurable indicator should trigger reversal, and who has the authority to pull it?",
        ),
        mode="demo",
    )


# ── Intervention (append two turns that respond to the user) ──────────────────
def build_demo_intervention(request: InterventionRequest) -> DebateSession:
    session = request.session.model_copy(deep=True)
    n = len(session.turns)
    last_id = session.turns[-1].id if session.turns else None

    # Route to a challenger already in the panel, else the first expert.
    challenger = next(
        (e.id for e in session.experts if e.stance == "oppose"),
        session.experts[0].id if session.experts else "skeptic",
    )
    reviser = next(
        (e.id for e in session.experts if e.stance == "support"),
        session.experts[0].id if session.experts else "advocate",
    )

    session.turns.append(
        DebateTurn(
            id=f"t{n}", speaker_id=challenger, relation="challenges", target_id=last_id, confidence=80,
            headline="Your challenge shifts the burden of proof",
            claim="The user's challenge changes the burden of proof: advocates must now separate the auditability benefits from the unrestricted release of high-risk capability.",
            evidence=f"Intervention considered: {request.instruction}",
        )
    )
    session.turns.append(
        DebateTurn(
            id=f"t{n + 1}", speaker_id=reviser, relation="revises", target_id=f"t{n}", confidence=76,
            headline="Revised: layered, not binary",
            claim="I revise my position: openness should be layered — public evaluations and reproducible safety tooling released before any full frontier-weight access.",
            evidence="This preserves independent scrutiny while acknowledging asymmetric misuse risks.",
        )
    )

    session.brief = ModeratorBrief(
        strongest_position="Layered openness is now strongest: open evaluations, safety tooling, and lower-risk models first; gate frontier weights behind audited thresholds.",
        weakest_assumption="That we can define capability thresholds before a model is widely tested by independent researchers.",
        unresolved_disagreement="Whether gatekeeping frontier weights protects society or concentrates too much power in a few labs.",
        next_question="Which concrete evaluations should trigger public, staged, or restricted release?",
    )
    return session
