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
    EvidenceSource,
    Expert,
    InterventionRequest,
    ModeratorBrief,
)


def build_demo_debate(request: DebateRequest) -> DebateSession:
    if _is_open_source_topic(request.topic):
        return _flagship_open_source_debate(request)
    if _is_death_penalty_topic(request.topic):
        return _death_penalty_debate(request)
    return _generic_debate(request)


def _is_open_source_topic(topic: str) -> bool:
    t = topic.lower()
    return ("open" in t and ("source" in t or "weight" in t)) and (
        "ai" in t or "model" in t or "agi" in t or "frontier" in t
    )


def _is_death_penalty_topic(topic: str) -> bool:
    t = topic.lower()
    return "death penalty" in t or "capital punishment" in t or "execution" in t


def _source(label: str, source_type: str, relevance: str) -> EvidenceSource:
    return EvidenceSource(label=label, source_type=source_type, relevance=relevance)


def _display_topic(topic: str) -> str:
    stripped = topic.strip()
    if _is_death_penalty_topic(stripped):
        return "Should the death penalty exist?"
    return stripped


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
                sources=[
                    _source("NIST AI Risk Management Framework", "policy framework", "Frames risk as measurable governance rather than a binary release decision."),
                ],
            ),
            DebateTurn(
                id="t1", speaker_id="open", relation="supports", target_id="t0", confidence=84,
                headline="Open access improves auditability",
                claim="Open access improves auditability. More independent researchers can find failure modes before deployment.",
                evidence="The history of open cryptography review and reproducible ML safety research supports broad scrutiny.",
                sources=[
                    _source("Open cryptography review", "historical precedent", "Shows how public scrutiny can expose implementation and protocol weaknesses."),
                    _source("Reproducible ML safety research", "research practice", "Supports the claim that external labs need enough access to validate safety results."),
                ],
            ),
            DebateTurn(
                id="t2", speaker_id="security", relation="challenges", target_id="t1", confidence=79,
                headline="Weight release lowers cost of misuse",
                claim="Capability release is not the same as source transparency. Some model weights directly lower the cost of misuse.",
                evidence="Cyber, biosecurity, and persuasion risks scale differently from ordinary software vulnerabilities.",
                sources=[
                    _source("Dual-use AI risk taxonomies", "security framework", "Separates transparency benefits from capability transfer risks."),
                    _source("Biosecurity misuse evaluations", "evaluation category", "Tests whether model access changes operational misuse capability."),
                ],
            ),
            DebateTurn(
                id="t3", speaker_id="economist", relation="supports", target_id="t1", confidence=67,
                headline="Closed frontier concentrates market power",
                claim="Concentrating frontier systems in a few firms creates market power and slows downstream innovation.",
                evidence="Platform economics shows open ecosystems often expand total market creation rather than shrink it.",
                sources=[
                    _source("Platform economics literature", "research category", "Explains why open complements can expand downstream market creation."),
                    _source("Open-source software ecosystems", "historical precedent", "Shows adoption and innovation effects from shared infrastructure."),
                ],
            ),
            DebateTurn(
                id="t4", speaker_id="safety", relation="revises", target_id="t2", confidence=81,
                headline="Staged openness is the defensible line",
                claim="The defensible policy is staged openness: publish evaluations, tools, and smaller models while gating the highest-risk capabilities.",
                evidence="This balances independent scrutiny against proportional release controls for the riskiest weights.",
                sources=[
                    _source("Staged release practices", "governance pattern", "Provides a middle path between full secrecy and irreversible publication."),
                    _source("Capability evaluation thresholds", "evaluation category", "Connects release decisions to measured model risk."),
                ],
            ),
            DebateTurn(
                id="t5", speaker_id="policy", relation="challenges", target_id="t4", confidence=68,
                headline="Who defines the risk threshold?",
                claim="Staged openness only works if a credible institution can define and audit the capability threshold that triggers gating.",
                evidence="Existing export-control and dual-use frameworks show thresholds are gameable without independent oversight.",
                sources=[
                    _source("Export-control thresholds", "policy precedent", "Shows the difficulty of governing rapidly shifting technical capabilities."),
                    _source("Independent audit regimes", "governance pattern", "Identifies who must verify claims about model risk and release controls."),
                ],
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


# ── Sensitive policy: death penalty / capital punishment ─────────────────────
def _death_penalty_debate(request: DebateRequest) -> DebateSession:
    topic = _display_topic(request.topic)
    return DebateSession(
        id=uuid4(),
        topic=topic,
        format=request.format,
        experts=[
            Expert(id="prosecutor", name="Dana Whitaker", role="Former Capital Prosecutor", stance="support", confidence=70),
            Expert(id="innocence", name="Dr. Samuel Ortiz", role="Wrongful Convictions Researcher", stance="oppose", confidence=86),
            Expert(id="victims", name="Maya Desai", role="Victims' Rights Advocate", stance="mixed", confidence=66),
            Expert(id="criminologist", name="Prof. Helen Cho", role="Criminologist", stance="oppose", confidence=78),
            Expert(id="judge", name="Justice Elena Brooks", role="Retired Appellate Judge", stance="mixed", confidence=73),
        ],
        turns=[
            DebateTurn(
                id="t0", speaker_id="moderator", relation="opens", target_id=None, confidence=50,
                headline="Justice, deterrence, and irreversible error",
                claim="The panel considers whether the death penalty should exist. The central tension is whether retribution and public safety can justify an irreversible punishment in a fallible legal system.",
                evidence="This requires separating moral justification, deterrence claims, error risk, cost, and unequal application.",
                sources=[
                    _source("Capital sentencing jurisprudence", "legal framework", "Frames proportional punishment and constitutional limits."),
                    _source("Wrongful conviction research", "evidence category", "Tests how often legal systems produce irreversible factual errors."),
                ],
            ),
            DebateTurn(
                id="t1", speaker_id="prosecutor", relation="supports", target_id="t0", confidence=70,
                headline="Some crimes warrant ultimate punishment",
                claim="For the rarest aggravated murders, the state can argue that life imprisonment does not fully express proportional justice or protect prison staff and other inmates.",
                evidence="Capital statutes typically require aggravating factors, penalty-phase review, and appellate scrutiny before execution.",
                sources=[
                    _source("Aggravating-factor statutes", "legal framework", "Defines the narrow class of crimes eligible for capital punishment."),
                    _source("Penalty phase review", "procedure", "Shows the safeguards claimed by supporters of the death penalty."),
                ],
            ),
            DebateTurn(
                id="t2", speaker_id="innocence", relation="challenges", target_id="t1", confidence=86,
                headline="Irreversibility changes the standard",
                claim="Those safeguards are not enough if even a small number of innocent people are sentenced to death. An irreversible penalty demands a level of certainty the system cannot guarantee.",
                evidence="Exonerations in capital cases show that eyewitness error, false confessions, bad forensics, and misconduct can survive trial and appeals.",
                sources=[
                    _source("Death-row exoneration data", "research category", "Documents cases where capital convictions were later overturned."),
                    _source("Forensic error reviews", "evidence category", "Identifies recurring causes of wrongful convictions."),
                ],
            ),
            DebateTurn(
                id="t3", speaker_id="criminologist", relation="supports", target_id="t2", confidence=78,
                headline="Deterrence evidence remains weak",
                claim="The deterrence case is also contested. If the death penalty does not clearly deter more than life without parole, the irreversible-error risk carries much more weight.",
                evidence="Criminology reviews often find deterrence estimates sensitive to model choice, jurisdiction, and small sample assumptions.",
                sources=[
                    _source("Deterrence literature reviews", "research category", "Evaluates whether executions reduce homicide beyond alternative sentences."),
                    _source("Life without parole comparison", "policy comparison", "Tests the public-safety claim against a non-execution alternative."),
                ],
            ),
            DebateTurn(
                id="t4", speaker_id="victims", relation="revises", target_id="t1", confidence=68,
                headline="Closure is real, but not uniform",
                claim="I revise the pro-death-penalty case: some families experience execution as accountability, but others experience decades of appeals as prolonged trauma.",
                evidence="Victim-impact accounts are morally important but not uniform enough to settle punishment policy by themselves.",
                sources=[
                    _source("Victim-impact testimony", "legal practice", "Shows why families' interests are central but diverse."),
                    _source("Appeals delay research", "procedure", "Explains how capital litigation can extend trauma for victims' families."),
                ],
            ),
            DebateTurn(
                id="t5", speaker_id="judge", relation="challenges", target_id="t4", confidence=73,
                headline="Administration is the decisive problem",
                claim="The strongest objection is not only moral; it is administrative. If capital punishment is applied unevenly by race, geography, counsel quality, or prosecutorial discretion, its legitimacy collapses.",
                evidence="Capital sentencing patterns vary sharply across counties and defendants, raising equal-protection and arbitrariness concerns.",
                sources=[
                    _source("Geographic disparity studies", "research category", "Shows how death eligibility and sentencing differ by county."),
                    _source("Effective counsel standards", "legal framework", "Tests whether defendants receive adequate representation in capital cases."),
                ],
            ),
        ],
        brief=ModeratorBrief(
            strongest_position="The strongest position is abolition or a moratorium unless the system can prove near-zero wrongful execution risk and non-arbitrary application.",
            weakest_assumption="That procedural safeguards can reliably eliminate wrongful convictions and unequal sentencing in capital cases.",
            unresolved_disagreement="Whether retribution for the most aggravated murders can ever justify an irreversible punishment despite systemic error risk.",
            next_question="Compared with life without parole, what measurable benefit does the death penalty provide after accounting for error, cost, delay, and disparity?",
        ),
        mode="demo",
    )


# ── Topic-aware generic debate (fallback for any other question) ──────────────
def _generic_debate(request: DebateRequest) -> DebateSession:
    topic = _display_topic(request.topic)
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
                claim=f"The panel considers: {topic}. We will identify the best case for the proposal, the strongest objection, and what evidence would change the conclusion.",
                evidence="Format: opening statements, cross-examination, user intervention, and a final reasoning brief.",
            ),
            DebateTurn(
                id="t1", speaker_id="advocate", relation="supports", target_id="t0", confidence=82,
                headline="The affirmative case is concrete",
                claim=f"The strongest case for this proposal is that it may solve a real problem the current system is failing to address: {topic}.",
                evidence="The first evidence test is whether the problem is large, recurring, and not already handled by existing policy.",
            ),
            DebateTurn(
                id="t2", speaker_id="skeptic", relation="challenges", target_id="t1", confidence=78,
                headline="Benefits are overstated, risks underpriced",
                claim="That case may understate second-order harms. A policy can solve the visible problem while creating enforcement, fairness, or abuse risks elsewhere.",
                evidence="Comparable policy debates often turn on who bears the downside and whether safeguards are enforceable.",
            ),
            DebateTurn(
                id="t3", speaker_id="economist", relation="supports", target_id="t2", confidence=69,
                headline="Incentives decide the real outcome",
                claim="The real outcome depends on incentives: who has power to apply the rule, who pays the cost, and who can avoid the burden.",
                evidence="Distributional analysis tests whether costs and benefits fall on the same groups or are shifted to weaker parties.",
            ),
            DebateTurn(
                id="t4", speaker_id="scientist", relation="challenges", target_id="t1", confidence=75,
                headline="The evidence base is thinner than claimed",
                claim="Before adopting the proposal, the panel needs stronger causal evidence that it produces the promised outcome better than less risky alternatives.",
                evidence="The right test is comparative: proposal versus status quo versus narrower reforms.",
            ),
            DebateTurn(
                id="t5", speaker_id="ethicist", relation="revises", target_id="t3", confidence=74,
                headline="A conditional, safeguarded yes",
                claim="I revise toward a conditional position: the proposal is only defensible if safeguards, appeal routes, and public accountability are specified before adoption.",
                evidence="Governance frameworks are strongest when they define oversight, measurement, and reversal conditions up front.",
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

    if _is_death_penalty_topic(session.topic):
        session.turns.append(
            DebateTurn(
                id=f"t{n}", speaker_id=challenger, relation="challenges", target_id=last_id, confidence=82,
                headline="Your challenge tests legitimacy",
                claim="The user's challenge shifts the debate toward legitimacy: a punishment can be morally argued for in theory and still fail if administered unequally in practice.",
                evidence=f"Intervention considered: {request.instruction}",
                sources=[
                    _source("User-provided intervention", "live input", "Records the exact instruction that changed the debate state."),
                    _source("Capital sentencing disparity", "research category", "Tests whether application varies by race, geography, counsel, or prosecutorial discretion."),
                ],
            )
        )
        session.turns.append(
            DebateTurn(
                id=f"t{n + 1}", speaker_id=reviser, relation="revises", target_id=f"t{n}", confidence=72,
                headline="Revised: legitimacy before punishment",
                claim="I revise the pro-death-penalty position: no capital system is defensible unless it can demonstrate extremely low error risk and consistent application across comparable cases.",
                evidence="This reframes the issue from abstract desert to whether the actual institution can administer the penalty justly.",
                sources=[
                    _source("Wrongful conviction safeguards", "legal procedure", "Identifies what would have to work before irreversible punishment is defensible."),
                    _source("Comparative sentencing review", "audit method", "Checks whether similar cases receive similar punishment."),
                ],
            )
        )
        session.brief = ModeratorBrief(
            strongest_position="A moratorium is strongest unless the system can prove both near-zero wrongful execution risk and non-arbitrary application.",
            weakest_assumption="That existing safeguards can reliably catch factual error, weak counsel, misconduct, and inconsistent charging decisions.",
            unresolved_disagreement="Whether retribution for the most aggravated murders can justify execution when institutional legitimacy remains contested.",
            next_question="What independent audit would prove capital sentencing is accurate, consistent, and superior to life without parole?",
        )
    elif _is_open_source_topic(session.topic):
        session.turns.append(
            DebateTurn(
                id=f"t{n}", speaker_id=challenger, relation="challenges", target_id=last_id, confidence=80,
                headline="Your challenge shifts the burden of proof",
                claim="The user's challenge changes the burden of proof: advocates must now separate the auditability benefits from the unrestricted release of high-risk capability.",
                evidence=f"Intervention considered: {request.instruction}",
                sources=[
                    _source("User-provided intervention", "live input", "Records the exact instruction that changed the debate state."),
                    _source("Dual-use release analysis", "security framework", "Tests whether the new premise changes the balance of access and risk."),
                ],
            )
        )
        session.turns.append(
            DebateTurn(
                id=f"t{n + 1}", speaker_id=reviser, relation="revises", target_id=f"t{n}", confidence=76,
                headline="Revised: layered, not binary",
                claim="I revise my position: openness should be layered — public evaluations and reproducible safety tooling released before any full frontier-weight access.",
                evidence="This preserves independent scrutiny while acknowledging asymmetric misuse risks.",
                sources=[
                    _source("Layered disclosure models", "governance pattern", "Supports separating auditability from unrestricted capability release."),
                    _source("Model release evaluations", "evaluation category", "Connects release tiers to observable model risk thresholds."),
                ],
            )
        )
        session.brief = ModeratorBrief(
            strongest_position="Layered openness is now strongest: open evaluations, safety tooling, and lower-risk models first; gate frontier weights behind audited thresholds.",
            weakest_assumption="That we can define capability thresholds before a model is widely tested by independent researchers.",
            unresolved_disagreement="Whether gatekeeping frontier weights protects society or concentrates too much power in a few labs.",
            next_question="Which concrete evaluations should trigger public, staged, or restricted release?",
        )
    else:
        session.turns.append(
            DebateTurn(
                id=f"t{n}", speaker_id=challenger, relation="challenges", target_id=last_id, confidence=78,
                headline="Your challenge narrows the test",
                claim="The user's challenge makes the key test sharper: the proposal must now show that its benefits outweigh enforcement, fairness, and unintended-consequence risks.",
                evidence=f"Intervention considered: {request.instruction}",
                sources=[
                    _source("User-provided intervention", "live input", "Records the exact instruction that changed the debate state."),
                    _source("Policy stress test", "evaluation method", "Checks how the proposal behaves under adverse assumptions."),
                ],
            )
        )
        session.turns.append(
            DebateTurn(
                id=f"t{n + 1}", speaker_id=reviser, relation="revises", target_id=f"t{n}", confidence=72,
                headline="Revised: conditional and auditable",
                claim="I revise toward a narrower position: proceed only if success metrics, oversight, and reversal conditions are defined before implementation.",
                evidence="A reversible policy design is more defensible when uncertainty and distributional risks remain unresolved.",
                sources=[
                    _source("Policy pilot design", "governance pattern", "Defines how to test a policy before broad adoption."),
                    _source("Independent oversight", "accountability method", "Specifies who checks whether the policy is working as promised."),
                ],
            )
        )
        session.brief = ModeratorBrief(
            strongest_position="The strongest position is conditional adoption only if measurable benefits, oversight, and reversal rules are specified first.",
            weakest_assumption="That the policy's benefits will survive real-world enforcement and not shift costs onto less powerful groups.",
            unresolved_disagreement="Whether the main risk is manageable through safeguards or inherent to the proposal.",
            next_question="What measurement would show the proposal is working better than narrower alternatives?",
        )
    return session
