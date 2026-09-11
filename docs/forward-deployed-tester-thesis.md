# The Forward Deployed Tester: does the idea hold up?

*Research assessment, 11 September 2026. Four independent research passes over the FDE playbook,
the eval/observability tool market, AI assurance standards and audit practice, and local-model
feasibility. Every claim below carries a source.*

## Verdict

**Yes, the idea holds up, and the category is unoccupied.** The primitives are mature and mostly
open source. What nobody offers is one system that joins them around a single unit of work:

1. a **pre-AI baseline** of the workflow (human time, error rate, throughput, cost per unit of work),
2. a **multi-axis eval** of the AI component (quality, safety, latency, regression) on that same unit,
3. a **cost ledger** (tokens per model, plus self-hosted infra) on that same unit, and
4. a **before/after verdict** with a stated causal design.

Vendors' FDEs deliver the AI. Nobody independently validates what they delivered. That is the
Forward Deployed Tester.

## What the research found

### The FDE side: value is asserted, never independently measured

- Palantir's FDE motto is "one customer, many capabilities"; success is "impact on the customer's
  goal". First weeks are data access and integration; some 8–12 week pilots spent all but the last
  week on access. ([Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/forward-deployed-engineers),
  [Qureshi](https://nabeelqu.substack.com/p/reflections-on-palantir))
- OpenAI's FDE team runs **eval-driven development**: customer experts label "trajectories" before
  anything is built. Morgan Stanley: 6–8 weeks to a pipeline, four more months of trust-building,
  98% adoption. In May 2026 OpenAI spun this into The Deployment Company at a $10B valuation.
  ([ZenML summary](https://www.zenml.io/llmops-database/forward-deployed-engineering-bringing-enterprise-llm-applications-to-production),
  [Bain](https://www.bain.com/about/media-center/press-releases/2026/bain-company-openai-a-new-venture-to-deploy-ai-at-enterprise-scale/))
- Anthropic's FDE job description names the deliverables: MCP servers, sub-agents, agent skills in
  production workflows, plus evaluation frameworks. ([Greenhouse](https://job-boards.greenhouse.io/anthropic/jobs/5302966008))
- Decagon insists on "metrics, channels, desired outcomes in writing" at deal inception; Sierra
  prices on outcomes. Under outcome pricing, customers audit vendor "resolved" tallies
  conversation by conversation, and Zendesk's 72-hour no-reopen rule can count abandonment as
  resolution. ([Decagon](https://decagon.ai/blog/how-decagon-is-redefining-forward-deployment),
  [Siena](https://www.siena.cx/blog/conversation-vs-outcome-based-pricing-ai-agent),
  [Zendesk](https://www.zendesk.com/blog/ai/agentic-ai/outcome-based-pricing/))
- MIT NANDA: 95% of ~300 deployments showed no measurable P&L impact. The strongest critique is
  that "no measurable impact" mostly reflects **absent pre-deployment baselines**, not technical
  failure. Gartner: 30%+ of GenAI projects abandoned after PoC. McKinsey: 39% report any EBIT
  impact. IBM 2026: only 29% of executives can measure AI ROI.
  ([Fortune](https://fortune.com/2025/08/18/mit-report-95-percent-generative-ai-pilots-at-companies-failing-cfo/),
  [critique](https://agentmodeai.com/the-mit-genai-pilot-failure-claim/),
  [Gartner](https://www.apmdigest.com/gartner-30-of-genai-projects-will-be-abandoned-after-proof-of-concept-by-end-of-2025),
  [McKinsey](https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai))
- Independent, rigorous studies contradict vendor claims: METR found experienced developers 19%
  *slower* with AI; DORA 2024 found AI reduced throughput 1.5% and stability 7.2%; Microsoft's own
  Copilot impact report says its comparisons are "not evaluated for statistical significance".
  ([METR](https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/),
  [DORA](https://dora.dev/research/2024/dora-report/),
  [Microsoft](https://learn.microsoft.com/en-us/viva/insights/advanced/analyst/templates/copilot-business-impact))
- Gaps with high confidence: no vendor publishes a pre-deployment baseline protocol; no named
  role or firm independently audits an FDE's delivered outcome with baseline plus counterfactual;
  no public playbook says who at the customer owns the KPI or how human-override rate is
  baselined. The lone product-shaped attempt is Acretix "AI ROI Verification", which is
  vendor-facing. ([Acretix](https://acretix.io/solutions/ai-roi-verification/))

### The tooling side: four separate categories, never one system

| Category | Mature tools | What none of them do |
|---|---|---|
| LLM eval frameworks (21 surveyed) | Promptfoo, DeepEval, Langfuse, Opik, Phoenix, Inspect, Braintrust, LangSmith, MLflow | Capture a pre-AI baseline or issue a business verdict. "Cost" means per-call dollars, never ROI. Local judges are OSS-only; the three clouds lock the judge. |
| Observability and cost | Langfuse, LiteLLM, Helicone, Portkey, Datadog LLM Obs, FinOps Foundation, FOCUS 1.4, CloudZero | Tie cost to a unit of work that also carries quality and outcome. "Cost per successful outcome" is rhetoric with the outcome left undefined. |
| Agent evals | tau-bench, SWE-bench, trajectory evals in LangSmith/Opik/Phoenix, rubric-as-checklist (Anthropic, OpenAI, HealthBench) | Score anything but the AI system in isolation. |
| Business before/after | LaunchDarkly AI Configs, Statsig, Faros, Jellyfish, DX, Copilot Dashboard, Forrester TEI | Baseline arbitrary non-engineering workflows; state a causal design; join eval quality to the value number. |

Sources: [Promptfoo](https://www.promptfoo.dev/docs/configuration/expected-outputs/model-graded/llm-rubric/),
[Langfuse cost](https://langfuse.com/docs/model-usage-and-cost), [LiteLLM](https://docs.litellm.ai/docs/proxy/cost_tracking),
[FinOps for AI](https://www.finops.org/wg/finops-for-ai-overview/), [FOCUS 1.4](https://www.finops.org/insights/introducing-focus-1-4/),
[LaunchDarkly AI ROI](https://launchdarkly.com/docs/guides/experimentation/ai-experiments-roi),
[Faros](https://www.faros.ai/ai-impact), [Anthropic on agent evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents),
[EvalGen](https://arxiv.org/abs/2404.12272). Note: OpenAI Evals goes read-only 31 Oct 2026 and Humanloop shut down Sep 2025.

### The assurance side: a real market that measures the wrong thing for this purpose

- NIST AI RMF and its GenAI profile, ISO/IEC 42001, 42005, 25059, the new ISO/IEC 42119 testing
  series, the EU AI Act (high-risk deadlines now Dec 2027 / Aug 2028), UK DSIT's AI assurance
  roadmap, IEEE 7000, Singapore AI Verify. A full-text search of NIST AI 600-1 finds zero hits
  for ROI, business outcome, productivity, or KPI. Every framework prescribes governance, risk, or
  technical quality. None prescribes measuring workflow outcomes or run cost.
  ([NIST 600-1](https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf),
  [ISO 42119-2](https://www.iso.org/standard/84127.html),
  [UK roadmap](https://questions-statements.parliament.uk/written-statements/detail/2025-09-03/hcws903))
- The Big Four, Holistic AI, BABL, Credo, Trustible, Saidot sell bias, compliance, and certification
  documentation. Engagement range: $7.5–25k SMB, $25–100k+ enterprise. Only Armilla ties
  verification to production KPIs, via an insurance-backed warranty, and only for vendor products.
  ([Armilla](https://www.armilla.ai/ai-performance-warranty-brief),
  [BABL](https://babl.ai/ai-audits/iso-42001/))
- Singapore's Global AI Assurance Pilot (17 deployers, 16 testing firms) is the closest thing to
  independent technical testing of real deployments. It measured accuracy, robustness, and safety.
  Not business or cost metrics. ([report](https://assurance.aiverifyfoundation.sg/main-report/))
- "Forward deployed QA/test engineer" exists only as vendor-side roles (Ranger, Bug0, Ellipsis
  Health) that use the vendor's AI to write tests for customers. "AI deployment verification" is
  taken by Harness and Metoro for AI verifying software rollouts. "Forward deployed tester",
  "AI workflow validation", and "measurables before AI" match no product, company, or role.
- The UK values its AI assurance market at £1.01bn (2024) growing to £18.8bn by 2035, and AI Evals
  Engineer is now a distinct role paying $230–650k. The demand and the budget line exist.
  ([BCS](https://www.bcs.org/articles-opinion-and-research/bcs-analysis-government-launches-roadmap-to-trusted-third-party-ai-assurance/),
  [HeroHunt](https://www.herohunt.ai/blog/how-to-recruit-ai-evals-engineers-2026/))

### The feasibility side: it runs on a customer's own hardware, with caveats

- **Open-weight judge: feasible with caveats.** QwQ-32B was the best judge overall on
  AgentJudgeBench when a reference answer is present; Skywork-Reward-V2 8B beats Claude 3.7 Sonnet
  on RewardBench 2; Atla Selene-Mini 8B matches GPT-4o-mini. But on JudgeBench hard pairs every
  judge is weak, and fine-tuned small judges fell below random. Mitigations with evidence: reference
  answers, permuted rubric options, pair-order swaps, a judge from a different model family than the
  system under test, and a human-labelled calibration set. Hardware: a 24 GB GPU or a 36–64 GB
  Apple Silicon Mac runs a 32B judge at Q4.
  ([JudgeBench](https://arxiv.org/pdf/2410.12784), [AgentJudgeBench](https://arxiv.org/html/2608.26623),
  [Skywork-Reward-V2](https://arxiv.org/pdf/2507.01352), [Selene-Mini](https://arxiv.org/html/2501.17195),
  [bias mitigation](https://arxiv.org/pdf/2604.23178))
- **Kimi K2 and DeepSeek V3/R1 flagships are not laptop models.** K2 needs 247 GB+ for usable
  speed; R1 671B at 1.58-bit is 131 GB. Realistic on-prem judges: Qwen3-32B, QwQ-32B,
  DeepSeek-R1-Distill-Qwen-32B, Moonlight-16B-A3B (Moonshot's small open model).
  ([Unsloth K2](https://unsloth.ai/docs/models/tutorials/kimi-k2-thinking-how-to-run-locally),
  [Unsloth R1](https://unsloth.ai/blog/deepseekr1-dynamic))
- **Cost accounting: feasible today.** Vendored pricing tables (LiteLLM, genai-prices), offline
  tokenizers for OpenAI, Llama, Qwen, DeepSeek, Kimi, Gemini. Claude has no public tokenizer, so
  record `usage` from the customer's own responses. Self-hosted infra cost via `vllm-cost-meter`
  and ML.ENERGY joules-per-token; the same H100 costs $0.21–$15.25 per million output tokens
  depending on request rate, so infra cost must be measured under real concurrency, not assumed.
  ([LiteLLM prices](https://github.com/BerriAI/litellm/blob/main/model_prices_and_context_window.json),
  [genai-prices](https://github.com/pydantic/genai-prices), [concurrency cost](https://arxiv.org/pdf/2606.11690))
- **Record and replay: feasible today.** OpenLLMetry to self-hosted Langfuse or Phoenix, Presidio
  or GLiNER-PII redaction before storage. OpenTelemetry GenAI conventions are still "Development"
  status as of July 2026, so pin a dated snapshot.
  ([OTel GenAI](https://opentelemetry.io/blog/2026/genai-observability/), [Phoenix](https://github.com/arize-ai/phoenix))

## The definition

**A Forward Deployed Tester is the independent verification and validation function for an AI
deployment.** Where the FDE walks in to inject AI into a workflow, the FDT walks in to prove, with
the organisation's own data and on the organisation's own hardware, whether the injection changed
anything, what it costs per unit of verified outcome, and whether it is safe to keep.

The core primitive is the **Unit of Work** (a ticket, a claim, a document, a PR, a call). Every
ledger keys on it:

| Ledger | Question | Keyed on |
|---|---|---|
| Baseline | What did this unit cost in human time, errors, and money before AI? | unit of work |
| Eval cube | How does the AI score on every rubric axis, every workflow step, every model or config variant? | unit of work × axis × step × variant |
| Cost | Tokens by model, plus self-hosted infra under real concurrency | unit of work |
| Outcome | What happened after, under a stated causal design (pre/post, shadow, A/B)? | unit of work |
| Verdict | Cost per verified outcome, confidence, go / no-go / conditions | engagement |

The "Rubik's cube" is the eval cube: rubric axes (correctness, safety, tone, policy, latency)
crossed with workflow steps crossed with variants (model, prompt, retrieval, temperature). Rotating
one face must not silently degrade another. A regression gate watches every cell.

## What this means for the repo

Plate 44 as built is a web-app crawler that provisions Playwright infrastructure. That is a
useful **surface probe** but it is not the Forward Deployed Tester. It becomes one probe inside
the Discover phase. The agent itself is redefined around seven phases, each producing rows in the
ledgers above and each runnable with no model at all:

1. **Discover** — map the workflow, define the unit of work, name the KPI owner on the customer
   side (the research shows this owner is usually missing), run surface probes (the existing
   crawler, API probes, log probes).
2. **Baseline** — instrument the pre-AI workflow, or replay 30–90 days of historical records, and
   freeze the baseline with the KPI owner's sign-off.
3. **Golden set** — build the eval dataset from real traffic with offline PII redaction, labelled
   by the customer's experts (the OpenAI FDE "trajectories" practice, done independently).
4. **Eval cube** — run rubric evals with a local open-weight judge, calibrated against a
   human-labelled set, with the documented bias mitigations built in.
5. **Cost ledger** — tokens per unit of work per model from the customer's own usage records,
   infra cost measured under real concurrency, vendored price tables.
6. **Pilot with a causal design** — shadow mode or A/B where possible, pre/post with stated
   limits where not.
7. **Verdict and handover** — cost per verified outcome, confidence, conditions, and the harness
   left behind so the organisation can re-run the validation on every change.

Plate 45, the SDET Architect, stays as is: it standardises the organisation's existing test estate
onto Playwright MCP, which is the deterministic regression layer under the eval cube.

## Nearest existing things, and how this differs

| Nearest thing | What it is | Difference |
|---|---|---|
| Acretix AI ROI Verification | Pre/post ROI measurement from agreed source systems | Vendor-facing; no eval quality, no cost ledger, not self-hosted |
| Armilla | KPI-backed verification with insurance warranty | Vendor products only, not bespoke workflow deployments |
| AI Verify Global Assurance Pilot | Third-party technical testing of real GenAI apps | Quality and safety only; no baseline, no cost, no outcome |
| LaunchDarkly AI Configs | Per-variant cost plus A/B | Outcome is a thumbs-up, not a business KPI; SaaS |
| Faros / Jellyfish / DX | AI-vs-non-AI comparison on SDLC metrics | Engineering only; correlational; no eval quality |
| Promptfoo / Langfuse / DeepEval | Rubric evals with local judges, CI gates | Building blocks; no baseline, no verdict; this system should reuse them |

## Risks the research surfaced

- Judge accuracy on genuinely hard cases is weak for every model, open or closed. The verdict
  must carry the calibration score and the human spot-check rate, not hide them.
- Causal attribution is the hard part. Pre/post without a control is what the vendors do, and it
  is why their numbers are disputed. The system must state the design it used and its limits.
- The Claude tokenizer is not public; cost for Claude must come from recorded usage, not estimates.
- Offline operation means vendored price tables and pinned OTel conventions that go stale; the
  report must print the snapshot dates.
- Scope creep into governance and compliance, which is a crowded market. Stay on measurement.
