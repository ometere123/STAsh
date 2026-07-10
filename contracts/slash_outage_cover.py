# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import urlparse
import json


# =============================================================================
# Constants
# =============================================================================

MAX_SERVICE_SLUG_CHARS = 48
MAX_SERVICE_NAME_CHARS = 80
MAX_COMPONENT_CHARS = 96
MAX_URL_CHARS = 300
MAX_NOTE_CHARS = 500
MAX_REASON_CHARS = 240
MIN_POLICY_DAYS = 1
MAX_POLICY_DAYS = 90
DEFAULT_WAITING_PERIOD_SECONDS = 86400  # 24 hours
DEFAULT_BASE_RATE_BPS = 500  # 5% per 30 days
PARTIAL_PAYOUT_BPS = 5000  # 50%
FULL_PAYOUT_BPS = 10000  # 100%
MIN_PREMIUM_WEI = u256(10000000000000000)  # 0.01 GEN

VALID_SLUGS = [
    "github_actions",
    "vercel_deployments",
    "cloudflare_edge",
    "stripe_checkout",
    "supabase_auth",
]

VALID_VERDICTS = [
    "no_incident",
    "not_covered_component",
    "scheduled_maintenance",
    "minor_degradation",
    "qualifying_outage",
    "major_outage",
    "insufficient_evidence",
]

VALID_PAYOUT_BANDS = ["none", "partial", "full", "manual_review"]

VALID_QUALIFYING_TIERS = [
    "minor_degradation",
    "qualifying_outage",
    "major_outage",
]

POOL_ACTIVE = "active"
POOL_PAUSED = "paused"

POLICY_ACTIVE = "active"
POLICY_EXPIRED = "expired"
POLICY_CLAIMED = "claimed"
POLICY_PAID = "paid"
POLICY_DENIED = "denied"
POLICY_CANCELLED = "cancelled"


def _domain_of(url: str) -> str:
    try:
        host = urlparse(url).netloc.lower()
    except Exception:
        return ""
    if host.startswith("www."):
        host = host[4:]
    return host

CLAIM_FILED = "filed"
CLAIM_REVIEWING = "reviewing"
CLAIM_APPROVED = "approved"
CLAIM_DENIED = "denied"
CLAIM_SETTLED = "settled"


# =============================================================================
# Data Models
# =============================================================================

@allow_storage
@dataclass
class Pool:
    service_slug: str
    service_name: str
    covered_component: str
    status_url: str
    status: str
    total_backing_wei: u256
    available_wei: u256
    locked_wei: u256
    premium_earned_wei: u256
    policy_count: u256
    claim_count: u256
    paid_count: u256
    denied_count: u256
    created_at: u256


@allow_storage
@dataclass
class UnderwriterPosition:
    deposited_wei: u256
    withdrawn_wei: u256


@allow_storage
@dataclass
class Policy:
    pool_id: u256
    holder: Address
    coverage_wei: u256
    premium_paid_wei: u256
    start_time: u256
    end_time: u256
    waiting_period_end: u256
    min_minutes: u256
    qualifying_tier: str
    status: str
    claim_id: u256
    created_at: u256


@allow_storage
@dataclass
class Claim:
    policy_id: u256
    pool_id: u256
    claimant: Address
    incident_url: str
    claimed_start: u256
    claimed_end: u256
    affected_component: str
    claim_note: str
    status: str
    verdict: str
    payout_band: str
    payout_wei: u256
    reason_summary: str
    reviewed_at: u256
    settled_at: u256


# =============================================================================
# Contract
# =============================================================================

class SlashOutageCover(gl.Contract):
    owner: Address
    pool_count: u256
    policy_count: u256
    claim_count: u256
    pools: TreeMap[u256, Pool]
    policies: TreeMap[u256, Policy]
    claims: TreeMap[u256, Claim]
    underwriter_positions: TreeMap[str, UnderwriterPosition]
    pool_ids: DynArray[u256]

    def __init__(self) -> None:
        self.owner = gl.message.sender_address
        self.pool_count = u256(0)
        self.policy_count = u256(0)
        self.claim_count = u256(0)

    # =========================================================================
    # Pool Management
    # =========================================================================

    @gl.public.write
    def create_pool(
        self,
        service_slug: str,
        service_name: str,
        covered_component: str,
        status_url: str,
    ) -> int:
        if gl.message.sender_address != self.owner:
            raise gl.UserError("ONLY_OWNER")
        if service_slug not in VALID_SLUGS:
            raise gl.UserError("INVALID_SERVICE")
        if len(service_slug) > MAX_SERVICE_SLUG_CHARS:
            raise gl.UserError("INVALID_SERVICE")
        if len(service_name) > MAX_SERVICE_NAME_CHARS:
            raise gl.UserError("INVALID_SERVICE")
        if len(covered_component) == 0 or len(covered_component) > MAX_COMPONENT_CHARS:
            raise gl.UserError("INVALID_COMPONENT")
        if len(status_url) == 0 or len(status_url) > MAX_URL_CHARS:
            raise gl.UserError("INVALID_INCIDENT_URL")

        self.pool_count = self.pool_count + u256(1)
        pool_id = self.pool_count

        self.pools[pool_id] = Pool(
            service_slug=service_slug,
            service_name=service_name,
            covered_component=covered_component,
            status_url=status_url,
            status=POOL_ACTIVE,
            total_backing_wei=u256(0),
            available_wei=u256(0),
            locked_wei=u256(0),
            premium_earned_wei=u256(0),
            policy_count=u256(0),
            claim_count=u256(0),
            paid_count=u256(0),
            denied_count=u256(0),
            created_at=u256(int(datetime.now(timezone.utc).timestamp())),
        )
        self.pool_ids.append(pool_id)
        return pool_id

    @gl.public.write
    def pause_pool(self, pool_id: int) -> None:
        pool_id = u256(pool_id)
        if gl.message.sender_address != self.owner:
            raise gl.UserError("ONLY_OWNER")
        if pool_id not in self.pools:
            raise gl.UserError("POOL_NOT_FOUND")
        self.pools[pool_id].status = POOL_PAUSED

    @gl.public.write
    def unpause_pool(self, pool_id: int) -> None:
        pool_id = u256(pool_id)
        if gl.message.sender_address != self.owner:
            raise gl.UserError("ONLY_OWNER")
        if pool_id not in self.pools:
            raise gl.UserError("POOL_NOT_FOUND")
        self.pools[pool_id].status = POOL_ACTIVE

    # =========================================================================
    # Underwriting
    # =========================================================================

    @gl.public.write.payable
    def underwrite_pool(self, pool_id: int) -> None:
        pool_id = u256(pool_id)
        if pool_id not in self.pools:
            raise gl.UserError("POOL_NOT_FOUND")
        pool = self.pools[pool_id]
        if pool.status == POOL_PAUSED:
            raise gl.UserError("POOL_PAUSED")

        value = gl.message.value
        if value == u256(0):
            raise gl.UserError("INVALID_PREMIUM")

        pool.total_backing_wei = pool.total_backing_wei + value
        pool.available_wei = pool.available_wei + value
        self.pools[pool_id] = pool

        pos_key = str(pool_id) + ":" + str(gl.message.sender_address)
        if pos_key in self.underwriter_positions:
            pos = self.underwriter_positions[pos_key]
            pos.deposited_wei = pos.deposited_wei + value
            self.underwriter_positions[pos_key] = pos
        else:
            self.underwriter_positions[pos_key] = UnderwriterPosition(
                deposited_wei=value,
                withdrawn_wei=u256(0),
            )

    @gl.public.write
    def withdraw_available(self, pool_id: int, amount_wei: int) -> None:
        pool_id = u256(pool_id)
        amount_wei = u256(amount_wei)
        if pool_id not in self.pools:
            raise gl.UserError("POOL_NOT_FOUND")

        pos_key = str(pool_id) + ":" + str(gl.message.sender_address)
        if pos_key not in self.underwriter_positions:
            raise gl.UserError("NOTHING_TO_WITHDRAW")

        pos = self.underwriter_positions[pos_key]
        available_for_user = pos.deposited_wei - pos.withdrawn_wei
        if amount_wei == u256(0) or amount_wei > available_for_user:
            raise gl.UserError("NOTHING_TO_WITHDRAW")

        pool = self.pools[pool_id]
        if amount_wei > pool.available_wei:
            raise gl.UserError("LOCKED_COVERAGE_INVARIANT")

        pool.available_wei = pool.available_wei - amount_wei
        pool.total_backing_wei = pool.total_backing_wei - amount_wei
        self.pools[pool_id] = pool

        pos.withdrawn_wei = pos.withdrawn_wei + amount_wei
        self.underwriter_positions[pos_key] = pos

        @gl.evm.contract_interface
        class _Recipient:
            class View:
                pass
            class Write:
                pass

        _Recipient(gl.message.sender_address).emit_transfer(value=amount_wei)

    # =========================================================================
    # Policy Purchase
    # =========================================================================

    @gl.public.write.payable
    def buy_policy(
        self,
        pool_id: int,
        coverage_wei: int,
        duration_days: int,
        min_minutes: int,
        qualifying_tier: str,
    ) -> int:
        pool_id = u256(pool_id)
        coverage_wei = u256(coverage_wei)
        duration_days = u256(duration_days)
        min_minutes = u256(min_minutes)
        if pool_id not in self.pools:
            raise gl.UserError("POOL_NOT_FOUND")
        pool = self.pools[pool_id]
        if pool.status != POOL_ACTIVE:
            raise gl.UserError("ONLY_ACTIVE_POOL")
        if qualifying_tier not in VALID_QUALIFYING_TIERS:
            raise gl.UserError("INVALID_STATUS")
        if coverage_wei == u256(0):
            raise gl.UserError("INVALID_COVERAGE_AMOUNT")
        if duration_days < u256(MIN_POLICY_DAYS) or duration_days > u256(MAX_POLICY_DAYS):
            raise gl.UserError("INVALID_DURATION")
        if coverage_wei > pool.available_wei:
            raise gl.UserError("INSUFFICIENT_POOL_LIQUIDITY")

        required_premium = self._calculate_premium(coverage_wei, duration_days)
        if gl.message.value < required_premium:
            raise gl.UserError("INVALID_PREMIUM")

        now = u256(int(datetime.now(timezone.utc).timestamp()))
        duration_seconds = duration_days * u256(86400)

        self.policy_count = self.policy_count + u256(1)
        policy_id = self.policy_count

        self.policies[policy_id] = Policy(
            pool_id=pool_id,
            holder=gl.message.sender_address,
            coverage_wei=coverage_wei,
            premium_paid_wei=gl.message.value,
            start_time=now,
            end_time=now + duration_seconds,
            waiting_period_end=now + u256(DEFAULT_WAITING_PERIOD_SECONDS),
            min_minutes=min_minutes,
            qualifying_tier=qualifying_tier,
            status=POLICY_ACTIVE,
            claim_id=u256(0),
            created_at=now,
        )

        pool.available_wei = pool.available_wei - coverage_wei
        pool.locked_wei = pool.locked_wei + coverage_wei
        pool.premium_earned_wei = pool.premium_earned_wei + gl.message.value
        pool.policy_count = pool.policy_count + u256(1)
        self.pools[pool_id] = pool

        return int(policy_id)

    def _calculate_premium(self, coverage_wei: u256, duration_days: u256) -> u256:
        premium = coverage_wei * duration_days * u256(DEFAULT_BASE_RATE_BPS) // u256(10000) // u256(30)
        if premium < MIN_PREMIUM_WEI:
            premium = MIN_PREMIUM_WEI
        return premium

    # =========================================================================
    # Claim Filing
    # =========================================================================

    @gl.public.write
    def file_claim(
        self,
        policy_id: int,
        incident_url: str,
        claimed_start: int,
        claimed_end: int,
        affected_component: str,
        claim_note: str,
    ) -> int:
        policy_id = u256(policy_id)
        claimed_start = u256(claimed_start)
        claimed_end = u256(claimed_end)
        if policy_id not in self.policies:
            raise gl.UserError("POLICY_NOT_FOUND")
        policy = self.policies[policy_id]
        if gl.message.sender_address != policy.holder:
            raise gl.UserError("ONLY_POLICY_HOLDER")
        if policy.status != POLICY_ACTIVE:
            raise gl.UserError("POLICY_NOT_ACTIVE")
        if policy.claim_id != u256(0):
            raise gl.UserError("POLICY_ALREADY_CLAIMED")

        now = u256(int(datetime.now(timezone.utc).timestamp()))

        if now > policy.end_time:
            raise gl.UserError("POLICY_NOT_ACTIVE")
        if claimed_start < policy.waiting_period_end:
            raise gl.UserError("INCIDENT_BEFORE_WAITING_PERIOD")
        if claimed_start > policy.end_time:
            raise gl.UserError("INCIDENT_AFTER_POLICY_END")
        if claimed_end <= claimed_start:
            raise gl.UserError("INVALID_INCIDENT_WINDOW")
        if len(incident_url) == 0 or len(incident_url) > MAX_URL_CHARS:
            raise gl.UserError("INVALID_INCIDENT_URL")
        if len(claim_note) > MAX_NOTE_CHARS:
            raise gl.UserError("INVALID_INCIDENT_URL")
        if len(affected_component) == 0 or len(affected_component) > MAX_COMPONENT_CHARS:
            raise gl.UserError("INVALID_COMPONENT")

        pool_for_claim = self.pools[policy.pool_id]
        if _domain_of(incident_url) != _domain_of(pool_for_claim.status_url):
            raise gl.UserError("INCIDENT_URL_NOT_ON_STATUS_DOMAIN")

        self.claim_count = self.claim_count + u256(1)
        claim_id = self.claim_count

        self.claims[claim_id] = Claim(
            policy_id=policy_id,
            pool_id=policy.pool_id,
            claimant=gl.message.sender_address,
            incident_url=incident_url,
            claimed_start=claimed_start,
            claimed_end=claimed_end,
            affected_component=affected_component,
            claim_note=claim_note,
            status=CLAIM_FILED,
            verdict="",
            payout_band="",
            payout_wei=u256(0),
            reason_summary="",
            reviewed_at=u256(0),
            settled_at=u256(0),
        )

        policy.status = POLICY_CLAIMED
        policy.claim_id = claim_id
        self.policies[policy_id] = policy

        pool = self.pools[policy.pool_id]
        pool.claim_count = pool.claim_count + u256(1)
        self.pools[policy.pool_id] = pool

        return int(claim_id)

    # =========================================================================
    # Claim Review (Non-Deterministic)
    # =========================================================================

    @gl.public.write
    def review_claim(self, claim_id: int) -> None:
        claim_id = u256(claim_id)
        if claim_id not in self.claims:
            raise gl.UserError("CLAIM_NOT_FOUND")
        claim = gl.storage.copy_to_memory(self.claims[claim_id])
        if claim.status != CLAIM_FILED:
            raise gl.UserError("CLAIM_ALREADY_REVIEWED")

        policy = gl.storage.copy_to_memory(self.policies[claim.policy_id])
        pool = gl.storage.copy_to_memory(self.pools[claim.pool_id])

        self.claims[claim_id].status = CLAIM_REVIEWING

        prompt_text = (
            "You are reviewing a parametric outage cover claim.\n\n"
            "Policy:\n"
            f"- service: {pool.service_name}\n"
            f"- covered component: {pool.covered_component}\n"
            f"- policy start: {policy.start_time}\n"
            f"- policy end: {policy.end_time}\n"
            f"- waiting period end: {policy.waiting_period_end}\n"
            f"- minimum qualifying incident duration minutes: {policy.min_minutes}\n"
            f"- qualifying tier threshold: {policy.qualifying_tier}\n\n"
            "Claim:\n"
            f"- incident url: {claim.incident_url}\n"
            f"- claimed start: {claim.claimed_start}\n"
            f"- claimed end: {claim.claimed_end}\n"
            f"- affected component: {claim.affected_component}\n"
            f"- note: {claim.claim_note}\n\n"
            "Public evidence:\n"
            "{evidence_text}\n\n"
            "Decide whether the public evidence proves a qualifying incident under this policy.\n\n"
            "Rules:\n"
            "- deny if the incident started before the waiting period ended.\n"
            "- deny if the affected component is not the covered component.\n"
            "- deny scheduled maintenance unless it caused an unplanned qualifying outage.\n"
            "- deny if evidence is too weak or unrelated.\n"
            "- classify degraded, partial, and major incidents based on impact language and policy terms.\n"
            "- output only valid JSON.\n\n"
            "Allowed verdict values:\n"
            "no_incident, not_covered_component, scheduled_maintenance, minor_degradation, qualifying_outage, major_outage, insufficient_evidence\n\n"
            "Allowed payout_band values:\n"
            "none, partial, full, manual_review\n\n"
            'Return JSON:\n'
            '{\n'
            '  "verdict": "...",\n'
            '  "payout_band": "...",\n'
            '  "reason_summary": "short explanation under 220 chars"\n'
            '}'
        )

        incident_url = claim.incident_url

        def leader_fn():
            web_response = gl.nondet.web.get(incident_url)
            evidence_text = ""
            if hasattr(web_response, 'body'):
                raw = web_response.body
                if isinstance(raw, bytes):
                    evidence_text = raw.decode("utf-8", errors="replace")[:3000]
                else:
                    evidence_text = str(raw)[:3000]

            full_prompt = prompt_text.replace("{evidence_text}", evidence_text)
            llm_response = gl.nondet.exec_prompt(full_prompt, response_format="json")

            if isinstance(llm_response, dict):
                result = llm_response
            else:
                result = json.loads(str(llm_response))

            verdict = str(result.get("verdict", "insufficient_evidence"))
            payout_band = str(result.get("payout_band", "none"))
            reason_summary = str(result.get("reason_summary", ""))[:MAX_REASON_CHARS]

            if verdict not in VALID_VERDICTS:
                verdict = "insufficient_evidence"
            if payout_band not in VALID_PAYOUT_BANDS:
                payout_band = "none"

            return {
                "verdict": verdict,
                "payout_band": payout_band,
                "reason_summary": reason_summary,
            }

        def validator_fn(leader_result):
            if not isinstance(leader_result, gl.vm.Return):
                return False
            leader_data = leader_result.calldata

            validator_data = leader_fn()

            return (
                leader_data["verdict"] == validator_data["verdict"]
                and leader_data["payout_band"] == validator_data["payout_band"]
            )

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        verdict = result["verdict"]
        payout_band = result["payout_band"]
        reason_summary = result["reason_summary"]

        now = u256(int(datetime.now(timezone.utc).timestamp()))

        if payout_band == "full" or payout_band == "partial":
            new_status = CLAIM_APPROVED
        else:
            new_status = CLAIM_DENIED

        c = self.claims[claim_id]
        c.verdict = verdict
        c.payout_band = payout_band
        c.reason_summary = reason_summary
        c.reviewed_at = now
        c.status = new_status
        self.claims[claim_id] = c

    # =========================================================================
    # Settlement
    # =========================================================================

    @gl.public.write
    def settle_claim(self, claim_id: int) -> None:
        claim_id = u256(claim_id)
        if claim_id not in self.claims:
            raise gl.UserError("CLAIM_NOT_FOUND")
        claim = self.claims[claim_id]
        if claim.status != CLAIM_APPROVED and claim.status != CLAIM_DENIED:
            raise gl.UserError("CLAIM_NOT_APPROVED")
        if claim.settled_at != u256(0):
            raise gl.UserError("CLAIM_ALREADY_SETTLED")

        policy = self.policies[claim.policy_id]
        pool = self.pools[claim.pool_id]
        now = u256(int(datetime.now(timezone.utc).timestamp()))

        if claim.status == CLAIM_APPROVED:
            payout_wei = self._calculate_payout(policy.coverage_wei, claim.payout_band)

            if payout_wei > pool.locked_wei:
                payout_wei = pool.locked_wei

            pool.locked_wei = pool.locked_wei - policy.coverage_wei
            remaining = policy.coverage_wei - payout_wei
            if remaining > u256(0):
                pool.available_wei = pool.available_wei + remaining
            pool.paid_count = pool.paid_count + u256(1)
            self.pools[claim.pool_id] = pool

            claim.payout_wei = payout_wei
            claim.status = CLAIM_SETTLED
            claim.settled_at = now
            self.claims[claim_id] = claim

            policy.status = POLICY_PAID
            self.policies[claim.policy_id] = policy

            if payout_wei > u256(0):
                @gl.evm.contract_interface
                class _Recipient:
                    class View:
                        pass
                    class Write:
                        pass

                _Recipient(claim.claimant).emit_transfer(value=payout_wei)

        else:
            pool.locked_wei = pool.locked_wei - policy.coverage_wei
            pool.available_wei = pool.available_wei + policy.coverage_wei
            pool.denied_count = pool.denied_count + u256(1)
            self.pools[claim.pool_id] = pool

            claim.payout_wei = u256(0)
            claim.status = CLAIM_SETTLED
            claim.settled_at = now
            self.claims[claim_id] = claim

            policy.status = POLICY_DENIED
            self.policies[claim.policy_id] = policy

    def _calculate_payout(self, coverage_wei: u256, payout_band: str) -> u256:
        if payout_band == "full":
            return coverage_wei
        elif payout_band == "partial":
            return coverage_wei * u256(PARTIAL_PAYOUT_BPS) // u256(FULL_PAYOUT_BPS)
        else:
            return u256(0)

    # =========================================================================
    # Read Methods
    # =========================================================================

    @gl.public.view
    def get_pool(self, pool_id: int) -> dict:
        pool_id = u256(pool_id)
        if pool_id not in self.pools:
            raise gl.UserError("POOL_NOT_FOUND")
        p = self.pools[pool_id]
        return {
            "id": int(pool_id),
            "service_slug": p.service_slug,
            "service_name": p.service_name,
            "covered_component": p.covered_component,
            "status_url": p.status_url,
            "status": p.status,
            "total_backing_wei": str(p.total_backing_wei),
            "available_wei": str(p.available_wei),
            "locked_wei": str(p.locked_wei),
            "premium_earned_wei": str(p.premium_earned_wei),
            "policy_count": int(p.policy_count),
            "claim_count": int(p.claim_count),
            "paid_count": int(p.paid_count),
            "denied_count": int(p.denied_count),
            "created_at": int(p.created_at),
        }

    @gl.public.view
    def get_policy(self, policy_id: int) -> dict:
        policy_id = u256(policy_id)
        if policy_id not in self.policies:
            raise gl.UserError("POLICY_NOT_FOUND")
        p = self.policies[policy_id]
        return {
            "id": int(policy_id),
            "pool_id": int(p.pool_id),
            "holder": str(p.holder),
            "coverage_wei": str(p.coverage_wei),
            "premium_paid_wei": str(p.premium_paid_wei),
            "start_time": int(p.start_time),
            "end_time": int(p.end_time),
            "waiting_period_end": int(p.waiting_period_end),
            "min_minutes": int(p.min_minutes),
            "qualifying_tier": p.qualifying_tier,
            "status": p.status,
            "claim_id": int(p.claim_id),
            "created_at": int(p.created_at),
        }

    @gl.public.view
    def get_claim(self, claim_id: int) -> dict:
        claim_id = u256(claim_id)
        if claim_id not in self.claims:
            raise gl.UserError("CLAIM_NOT_FOUND")
        c = self.claims[claim_id]
        return {
            "id": int(claim_id),
            "policy_id": int(c.policy_id),
            "pool_id": int(c.pool_id),
            "claimant": str(c.claimant),
            "incident_url": c.incident_url,
            "claimed_start": int(c.claimed_start),
            "claimed_end": int(c.claimed_end),
            "affected_component": c.affected_component,
            "claim_note": c.claim_note,
            "status": c.status,
            "verdict": c.verdict,
            "payout_band": c.payout_band,
            "payout_wei": str(c.payout_wei),
            "reason_summary": c.reason_summary,
            "reviewed_at": int(c.reviewed_at),
            "settled_at": int(c.settled_at),
        }

    @gl.public.view
    def get_protocol_stats(self) -> dict:
        return {
            "pool_count": int(self.pool_count),
            "policy_count": int(self.policy_count),
            "claim_count": int(self.claim_count),
        }

    @gl.public.view
    def get_pool_ids(self) -> list:
        result = []
        for i in range(len(self.pool_ids)):
            result.append(int(self.pool_ids[i]))
        return result

    @gl.public.view
    def get_policy_ids_for_holder(self, holder: str) -> list:
        addr = Address(holder)
        result = []
        for i in range(int(self.policy_count)):
            pid = u256(i + 1)
            if pid in self.policies:
                p = self.policies[pid]
                if p.holder == addr:
                    result.append(i + 1)
        return result

    @gl.public.view
    def get_claim_ids_for_holder(self, holder: str) -> list:
        addr = Address(holder)
        result = []
        for i in range(int(self.claim_count)):
            cid = u256(i + 1)
            if cid in self.claims:
                c = self.claims[cid]
                if c.claimant == addr:
                    result.append(i + 1)
        return result

    @gl.public.view
    def get_underwriter_position(self, pool_id: int, underwriter: str) -> dict:
        pool_id = u256(pool_id)
        pos_key = str(pool_id) + ":" + underwriter
        if pos_key not in self.underwriter_positions:
            return {
                "deposited_wei": "0",
                "withdrawn_wei": "0",
                "net_wei": "0",
            }
        pos = self.underwriter_positions[pos_key]
        net = pos.deposited_wei - pos.withdrawn_wei
        return {
            "deposited_wei": str(pos.deposited_wei),
            "withdrawn_wei": str(pos.withdrawn_wei),
            "net_wei": str(net),
        }

    @gl.public.view
    def get_premium_quote(self, coverage_wei: int, duration_days: int) -> str:
        return str(self._calculate_premium(u256(coverage_wei), u256(duration_days)))
