#!/usr/bin/env node
// seed-unseen-hub.mjs — create a brand-new hub on Memory.Wiki with
// synthetic content the AI has not seen during training. Measures the
// "honest" cross-AI wedge by removing the web-crawl leak risk that
// raymindai might carry.
//
// Synthetic theme: ZorblaxCorp, a fictional quantum-resistant
// cryptography company. Every fact is invented and verifiable only
// from the hub corpus.
//
// Usage:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//     node eval/seed-unseen-hub.mjs [--slug=mwbench-zorblax] [--clean]

import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";

const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
function nanoid(n = 21) {
  const bytes = randomBytes(n);
  let out = "";
  for (let i = 0; i < n; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

function args(argv) {
  const out = { slug: "mwbench-zorblax", clean: false };
  for (const a of argv.slice(2)) {
    if (a === "--clean") out.clean = true;
    else if (a.startsWith("--slug=")) out.slug = a.slice(7);
  }
  return out;
}

// Stable doc IDs so re-runs are idempotent. Each is the slug visitors
// see at memory.wiki/<id>.
const DOCS = [
  {
    id: "zx-vision",
    title: "ZorblaxCorp — Vision",
    markdown: `---
captured: 2027-03-12
status: foundational
---

# ZorblaxCorp — Vision

> "Make post-quantum encryption boring." — Talia Renford, CEO

ZorblaxCorp builds **CipherPlate**, a drop-in cryptography layer for compliance-bound industries (healthcare, finance, defense supply chain) that must replace RSA/ECC before quantum computers break them.

## Why ZorblaxCorp exists

The NIST Round 4 finalization of post-quantum standards (FALCON, SPHINCS+, ML-KEM) leaves engineering teams with a question they don't want to answer themselves: which one, when, and how do we wire it in without rewriting our auth stack?

CipherPlate is the answer — a sidecar service that accepts any cryptographic operation in a stable RPC envelope and routes it through the algorithm we recommend for the customer's threat model.

## Concrete commitments

- **Algorithm coverage**: FALCON-1024, SPHINCS+ SHAKE-256, ML-KEM-1024, plus classical RSA-4096 and ECDSA-P521 for transition periods.
- **Latency budget**: ≤ 14 ms p99 added latency on a single signature operation on Tier-3 hardware (8 vCPU, 16 GiB).
- **Customer commitment**: every CipherPlate deployment ships with a written threat-model assessment co-signed by ZorblaxCorp's cryptography review board.

## Facts

- Founded 2027-01-08 in Boulder, Colorado
- 11 employees as of 2027-03-12
- CEO: Talia Renford (ex-CipherSafe, ex-NIST PQC working group observer)
- Founding investors: Quantilever Capital ($4.2M seed), Hawthorne Defense Ventures ($1.8M seed)
- Headquarters: 1740 Pearl Street, Suite 410, Boulder, CO 80302
- Tax ID (EIN): 88-3147291
`,
  },
  {
    id: "zx-product",
    title: "CipherPlate v3.4.1 — Product",
    markdown: `---
captured: 2027-03-15
version: 3.4.1
---

# CipherPlate v3.4.1 — Product

> The sidecar service that ZorblaxCorp ships to customers.

## What it does

CipherPlate runs as a local sidecar (Docker, Podman, or raw binary) next to your application. Apps send cryptographic operations over a gRPC envelope; CipherPlate signs / verifies / encrypts / decrypts using the algorithm matched to the customer's threat model.

## Algorithm matrix

| Algorithm | Use case | Mode | Status |
| --- | --- | --- | --- |
| FALCON-1024 | Code signing, software supply chain | post-quantum signature | GA |
| SPHINCS+ SHAKE-256 | Long-term archival signature | post-quantum signature | GA |
| ML-KEM-1024 | Session key exchange | post-quantum KEM | GA |
| Hybrid (X25519 + ML-KEM-1024) | TLS transition | classical + PQ | GA |
| RSA-4096 | Legacy interop only | classical | deprecated 2028-Q4 |
| ECDSA-P521 | Legacy interop only | classical | deprecated 2028-Q4 |

## Performance envelope

Measured on Tier-3 reference hardware (8 vCPU, 16 GiB, Linux 6.10, x86_64):

- FALCON-1024 signature: 8.3 ms median, 13.7 ms p99
- ML-KEM-1024 encapsulation: 0.41 ms median, 0.78 ms p99
- SPHINCS+ signature: 192 ms median, 311 ms p99 (acknowledged tradeoff; reserved for archival)

## Configuration

CipherPlate reads its policy from \`/etc/cipherplate/policy.yaml\`. Mandatory fields: \`tenant_id\`, \`threat_model\` (one of: \`commodity\`, \`nation_state_passive\`, \`nation_state_active\`), \`audit_sink\`.

## Facts

- Current GA version: 3.4.1 (released 2027-03-09)
- Default port: 4711 (configurable)
- Binary size: 41 MB stripped, 116 MB with debug symbols
- License: source-available under the ZorblaxCorp Cryptographic Source License (ZCSL) v1.2
- Audit log default destination: \`/var/log/cipherplate/audit.jsonl\`
`,
  },
  {
    id: "zx-pricing",
    title: "ZorblaxCorp — Pricing",
    markdown: `---
captured: 2027-03-15
---

# ZorblaxCorp — Pricing

CipherPlate is licensed per deployment and per cryptographic operation count.

## Tiers

| Tier | Price (USD) | Operations/month | Threat model | Support |
| --- | --- | --- | --- | --- |
| **Evaluation** | Free | 50,000 | commodity | Community Discord |
| **Builder** | $79/month | 5,000,000 | commodity, nation_state_passive | Email, 48h SLA |
| **Team** | $499/month | 50,000,000 | all three | Email, 12h SLA, quarterly review |
| **Sovereign** | from $14,400/year | unlimited | all three + custom | Named TAM, on-call escalation, on-prem audit |

## Overage

Operations over the included quota are billed at **$0.000028 per operation** for Builder and Team. Sovereign customers contractually negotiate overage.

## Discounts

- 18% off annual prepayment
- 30% off for academic / non-profit (requires letter)
- 41% off for ZorblaxCorp design partners (cap 12 customers, currently 7 of 12 filled)

## Facts

- Current paying customers as of 2027-03-15: 137 (96 Builder, 38 Team, 3 Sovereign)
- Largest single contract: $267,000 ARR (a Tier-1 US defense subcontractor whose name is under NDA)
- Average revenue per paying customer (ARPC): $384/month
- ARR run rate: ~$632,000 at 2027-03-15
`,
  },
  {
    id: "zx-team",
    title: "ZorblaxCorp — Team",
    markdown: `---
captured: 2027-03-12
---

# ZorblaxCorp — Team

11 full-time employees as of 2027-03-12.

## Leadership

- **Talia Renford** — CEO & co-founder. Previously cryptography lead at CipherSafe (acquired by Salesforce 2024); NIST PQC working group observer 2022-2025. MSc in cryptography, University of Bristol, 2015.
- **Yuki Aralakshmi** — CTO & co-founder. Previously distributed-systems engineer at Stripe (2018-2024). Author of *Probabilistic Service Mesh Routing* (USENIX ATC 2023).
- **Diego Marsetti** — VP Engineering. Previously engineering manager at Cloudflare Edge (2019-2026).

## Cryptography Review Board (external)

- **Petra Wismer** (Chair) — Princeton, post-quantum signature schemes
- **Reginald Apothio** — Tsinghua University, lattice-based KEM analysis
- **Saskia Yelchin** — independent, formerly NSA/CSS (retired 2023)

## Engineering org chart (as of 2027-03-12)

- CTO Yuki Aralakshmi
  - Sidecar runtime: 3 engineers (Mira Anand, Joshua Polenni, Ada Westerfeldt)
  - Algorithm engineering: 2 engineers (Levi Borchard, Naomi Espergen)
  - Customer integrations: 2 engineers (Quentin Trass, Hai-Lin Vogel)
- VP Eng Diego Marsetti
  - SRE / on-call: 1 (rotates with engineering)

## Facts

- Total headcount as of 2027-03-12: 11 (3 leadership + 7 engineers + 1 SRE)
- Engineering rotation: 7 engineers + 1 SRE on a 6-week on-call cadence
- Equity reserved for employee pool: 14.7% (post-seed)
- Average tenure of co-founders' prior employers: 4.8 years
`,
  },
  {
    id: "zx-roadmap",
    title: "ZorblaxCorp — Roadmap 2027-2028",
    markdown: `---
captured: 2027-03-15
horizon: 18-months
---

# ZorblaxCorp — Roadmap 2027-2028

What ships, when, and why.

## 2027 Q2 (Apr-Jun)

- **CipherPlate 3.5** — gRPC streaming for batch signature flows. Target customers: code-signing CI pipelines processing >1k artifacts/build.
- **PolicyKit** — declarative policy migration tool. Lets customers move from RSA → FALCON in a measured rollout.
- **Sovereign tier launch** — formal SLA, dedicated TAM, on-prem audit. Currently soft-launched with 3 design partners.

## 2027 Q3 (Jul-Sep)

- **CipherPlate 4.0** — breaking API change. Old \`/v1/sign\` endpoint deprecated; new \`/v2/operation\` envelope unifies signature, verify, encrypt, decrypt under one RPC. Migration window: 9 months.
- **WASM build** — CipherPlate runs in browsers / edge functions. Unblocks edge-key-rotation customers (cap of 11 design slots).
- **First customer-facing security audit report** — published with Trail of Bits.

## 2027 Q4 (Oct-Dec)

- **HSM passthrough** — for customers who already paid for HSMs, CipherPlate becomes the abstraction layer rather than the key custodian.
- **Series A target close** — $14M-$18M target range, lead unannounced. Bridge from Quantilever Capital pre-negotiated.

## 2028 H1 (Jan-Jun)

- **CipherPlate 4.1** — formal verification of the sidecar control flow using Tamarin. Targets the NSA Commercial Solutions for Classified (CSfC) certification path.
- **Federal certification track** — FedRAMP Moderate. Estimated cost $1.4M, 14-month process.
- **30-person headcount** — 11 → 30 over 12 months. New hires concentrated in customer integrations and federal sales.

## Facts

- Series A target close date: 2027-12-15
- Series A target range: $14M-$18M
- FedRAMP Moderate certification target: 2028 Q3
- CSfC certification track activation: 2028 Q2
- Planned headcount at end of 2028: 30
- CipherPlate 4.0 API migration window: 9 months from release
`,
  },
  {
    id: "zx-customers",
    title: "ZorblaxCorp — Customer notes",
    markdown: `---
captured: 2027-03-15
status: internal-only
---

# ZorblaxCorp — Customer notes

Highlights from current paid deployments. All customer names are anonymized per the standard contract; team-internal references use letter codes.

## Customer A (Sovereign tier, US defense subcontractor)

- Deployed 2027-02-04, single region (us-east-1 equivalent on private cloud)
- 312 million operations / month
- Workload: code signing for satellite firmware images
- Annual contract value: $267,000
- Primary contact: VP of Embedded Security (cleared)

## Customer B (Sovereign tier, EU central bank)

- Deployed 2027-02-21, two regions (eu-central-1, eu-west-3 equivalents)
- 88 million operations / month
- Workload: cross-bank settlement message signatures
- Annual contract value: $194,000
- Regulatory driver: ECB internal mandate post-quantum readiness review 2026

## Customer C (Sovereign tier, NIH-funded healthcare consortium)

- Deployed 2027-03-01, multi-tenant within their internal cloud
- 47 million operations / month
- Workload: patient record signature chains
- Annual contract value: $89,500

## Team-tier patterns

- 38 Team-tier customers. Median operations: 19 million / month. Top operation: TLS session-key encapsulation (43% of total).
- 4 Team-tier customers have requested early access to CipherPlate 4.0 — primary motivation is the unified \`/v2/operation\` envelope.

## Builder-tier patterns

- 96 customers. Median operations: 1.4 million / month. Long tail of solo developers and small CI-pipeline use.

## Facts

- 3 Sovereign customers contributing total ARR of $550,500
- 38 Team customers, median ARR ~$5,988
- 96 Builder customers, median ARR ~$948
- Total monthly operations across all customers: ~4.1 billion
- Customer concentration: top 3 customers are 87.1% of ARR
`,
  },
  {
    id: "zx-architecture",
    title: "CipherPlate — Internal architecture",
    markdown: `---
captured: 2027-03-15
audience: engineering-internal
---

# CipherPlate — Internal architecture

The sidecar that ZorblaxCorp ships to every customer. This doc is the architectural reference for new engineers and for security auditors during diligence.

## Layered design

1. **gRPC envelope layer** (Rust, tonic 0.12.x). Receives client requests, validates against the policy file, attaches a request ID, and dispatches.
2. **Policy resolver** (Rust). Resolves the request against \`policy.yaml\`. Decides algorithm, audit verbosity, and rate limit.
3. **Algorithm dispatcher** (Rust + C FFI for FALCON / SPHINCS+ / ML-KEM via the Open Quantum Safe liboqs 0.11.0 bindings).
4. **Key custody** (Rust). Either local-fs (default), HashiCorp Vault, or HSM-passthrough (PKCS#11 to a customer-provided HSM).
5. **Audit sink** (Rust). Writes structured JSON Lines to one of: local file, S3-compatible object storage, or a customer Splunk HEC endpoint.

## Crash and recovery

- The sidecar runs with \`systemd\`'s \`Restart=always\` on Linux; equivalents documented for other init systems.
- Inflight operations are NOT replayed on restart — clients are expected to retry with the same request ID and CipherPlate dedupes.
- The audit log is fsync'd per record on the Sovereign tier; per second on the lower tiers (configurable).

## Threat model invariants

- The sidecar trusts the local OS kernel and \`policy.yaml\`. It does NOT trust the application that calls it.
- All algorithm calls go through the dispatcher; there is no fallback path to "raw OpenSSL." This is enforced at compile time via a feature flag locked in CI.
- Key material never leaves the custody layer in plaintext. Operations are returned to the caller, but raw keys are unreachable through any public API.

## Facts

- Implementation language: Rust 1.78 (locked in CI)
- C FFI dependency: liboqs 0.11.0
- gRPC stack: tonic 0.12.x
- Linter: clippy at \`warn(clippy::pedantic)\`; CI fails on warning
- Test suite: 1,847 tests, 94.3% line coverage as of 3.4.1 release
- Median CI pipeline duration: 18 minutes
`,
  },
];

async function main() {
  const opts = args(process.argv);
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const srv = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !srv) {
    console.error("Need SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }
  const supabase = createClient(url, srv);

  const TEST_EMAIL = `bench+${opts.slug}@mwbench.test`;

  if (opts.clean) {
    console.log("Cleaning previous synthetic hub...");
    // Lookup the user by email so we don't need to remember the UUID.
    const { data: list } = await supabase.auth.admin.listUsers();
    const u = list?.users?.find((u) => u.email === TEST_EMAIL);
    if (u) {
      await supabase.from("documents").delete().eq("user_id", u.id);
      await supabase.from("profiles").delete().eq("id", u.id);
      await supabase.auth.admin.deleteUser(u.id);
      console.log("✓ cleaned user", u.id);
    } else {
      console.log("no synthetic user to clean");
    }
    return;
  }

  // Create or find the synthetic auth user (profiles.id is FK to auth.users).
  const { data: list } = await supabase.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === TEST_EMAIL);
  if (!user) {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email: TEST_EMAIL,
      email_confirm: true,
      user_metadata: { synthetic: true, hub_slug: opts.slug },
    });
    if (createErr) {
      console.error("createUser failed:", createErr);
      process.exit(1);
    }
    user = created.user;
    console.log("✓ created synthetic user", user.id);
  } else {
    console.log("✓ reusing synthetic user", user.id);
  }
  const userId = user.id;

  // Upsert profile. hub_public must be true so the bench can fetch.
  console.log(`Upserting hub profile slug=${opts.slug}`);
  const { error: profileErr } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: TEST_EMAIL,
      display_name: "ZorblaxCorp (MWBench synthetic)",
      hub_slug: opts.slug,
      hub_public: true,
      hub_description:
        "Synthetic test hub for cross-AI eval. All facts here are fictional and not in any AI training data. Used to verify Memory.Wiki cross-AI accuracy on truly unseen content.",
    },
    { onConflict: "id" },
  );
  if (profileErr) {
    console.error("profile upsert failed:", profileErr);
    process.exit(1);
  }

  // Upsert each doc. Stable IDs => re-runnable.
  for (const d of DOCS) {
    process.stdout.write(`  ${d.id} "${d.title}" ... `);
    const { error } = await supabase.from("documents").upsert(
      {
        id: d.id,
        user_id: userId,
        title: d.title,
        markdown: d.markdown,
        is_draft: false,
        source: "mwbench-synthetic",
        edit_token: nanoid(),
      },
      { onConflict: "id" },
    );
    if (error) {
      console.log(`FAIL ${error.message}`);
      continue;
    }
    console.log("ok");
  }

  console.log(`\n✓ seeded ${DOCS.length} docs at https://memory.wiki/hub/${opts.slug}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
