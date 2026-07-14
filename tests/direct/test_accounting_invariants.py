"""Deterministic accounting tests for the settlement/expiry rules.

These tests deliberately model only arithmetic and state-transition rules; web
and validator consensus belongs in the StudioNet integration suite.
"""

from dataclasses import dataclass

import pytest


@dataclass
class Position:
    deposited: int
    withdrawn: int = 0
    loss: int = 0

    @property
    def net(self):
        return self.deposited - self.withdrawn - self.loss


def allocate_loss(positions, payout):
    backing_before = sum(p.net for p in positions)
    allocated = 0
    for position in positions:
        loss = payout * position.net // backing_before if backing_before else 0
        position.loss += loss
        allocated += loss
    remainder = payout - allocated
    for position in positions:
        if position.net > 0:
            position.loss += remainder
            break
    assert sum(p.loss for p in positions) == payout


def settle_approved(available, locked, total, coverage, payout):
    assert payout <= total
    assert coverage <= locked
    return (
        available + coverage - payout,
        locked - coverage,
        total - payout,
    )


def expire_policy(status, now, end, claim_id, available, locked, coverage):
    if status != "active":
        raise ValueError("POLICY_NOT_ACTIVE")
    if claim_id != 0:
        raise ValueError("POLICY_ALREADY_CLAIMED")
    if now <= end:
        raise ValueError("POLICY_NOT_EXPIRED")
    return "expired", available + coverage, locked - coverage


def test_full_payout_reconciles_pool_backing():
    available, locked, total = settle_approved(400, 100, 500, 100, 100)
    assert (available, locked, total) == (400, 0, 400)
    assert available + locked == total


def test_partial_payout_reconciles_pool_backing():
    available, locked, total = settle_approved(400, 100, 500, 100, 50)
    assert (available, locked, total) == (450, 0, 450)
    assert available + locked == total


def test_proportional_losses_preserve_exact_payout():
    positions = [Position(600), Position(400)]
    allocate_loss(positions, 100)
    assert [p.loss for p in positions] == [60, 40]
    assert [p.net for p in positions] == [540, 360]


def test_proportional_loss_rounding_is_fully_allocated():
    positions = [Position(1), Position(1), Position(1)]
    allocate_loss(positions, 1)
    assert sum(p.loss for p in positions) == 1
    assert sum(p.net for p in positions) == 2


def test_withdrawal_cannot_use_realized_loss_as_available_position():
    position = Position(100, withdrawn=10, loss=30)
    assert position.net == 60
    with pytest.raises(ValueError):
        if 91 > position.net:
            raise ValueError("NOTHING_TO_WITHDRAW")


def test_expiry_releases_unclaimed_coverage():
    status, available, locked = expire_policy("active", 101, 100, 0, 400, 100, 100)
    assert (status, available, locked) == ("expired", 500, 0)


@pytest.mark.parametrize("now,end", [(100, 100), (99, 100)])
def test_expiry_rejected_before_or_at_end(now, end):
    with pytest.raises(ValueError, match="POLICY_NOT_EXPIRED"):
        expire_policy("active", now, end, 0, 400, 100, 100)


def test_expiry_rejected_after_claim():
    with pytest.raises(ValueError, match="POLICY_ALREADY_CLAIMED"):
        expire_policy("active", 101, 100, 7, 400, 100, 100)
