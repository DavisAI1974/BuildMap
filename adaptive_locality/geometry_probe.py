"""Offline operator-geometry diagnostics from Basic_equations dipole research.

Two DISTINCT questions:
* The algebraic vector (-1,-1,+2)/sqrt(6) on (Ha^2,Hb^2,Ha*Hb)
  equals -(Ha-Hb)^2 / sqrt(6), an identity. Proximity to this
  null direction can occur in unconnected equal-entropy channels:
  it is NOT evidence of coupling.
* A static fitted curve Ha^2 = a + b*(Ha*Hb) + c*(Ha*Hb)^2
  may have descriptive, out-of-sample utility. It is not necessarily
  a causal law or a physical geometric boundary.

Every input frame, including rank defects and outliers, is retained
and marked for research. Never replace source events with this curve.
No Frankie, BuildMap runtime, network, Neumann or scientific job calls.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
import math
from typing import Sequence

from .core import LocalityError, _digest
from .information import InfoFrame, validate_series
from .coupling import _qr_fit, _predict_sse

LINEAR=("const","HaHb")
QUADRATIC=("const","HaHb","HaHb2")


@dataclass(frozen=True)
class GeometryPoint:
    clock: int
    raw_identity: str
    original_evidence_ids: tuple[str,...]
    ha: float
    hb: float
    ha_squared: float | None
    hb_squared: float | None
    ha_hb: float | None
    squared_entropy_difference: float | None
    quadratic_residual: float | None
    status: str
    reason: str


def _finite_square(v: float) -> float | None:
    result=v*v
    return result if math.isfinite(result) else None


def geometric_dipole_probe(frames: Sequence[InfoFrame], target: str,
                           donor: str, *, tolerance:float=0.01,
                           min_gain:float=0.10) -> dict:
    """Conservative algebraic-space probe with chronological holdout.

    Outlier status is diagnostic only; no frame is removed from the result,
    the training fit, or later scientific calculations. No feature means,
    time averaging, source compression or equation-to-physical-law claim.
    """
    frames=tuple(frames)
    names=validate_series(frames,min_frames=24)
    if target==donor or target not in names or donor not in names:
        raise LocalityError("two distinct calibrated operator channels required")
    if not math.isfinite(tolerance) or tolerance<0 or not 0<min_gain<1:
        raise LocalityError("invalid geometry acceptance thresholds")
    n=len(frames)
    split=int(n*0.65)
    points=[]
    rows=[]
    issue_ids=[]
    for frame in frames:
        vals=dict(frame.entropy)
        a=float(vals[target])
        b=float(vals[donor])
        a2=_finite_square(a)
        b2=_finite_square(b)
        ab=a*b
        difference2=_finite_square(a-b)
        ok=(a2 is not None and b2 is not None and math.isfinite(ab)
            and difference2 is not None and math.isfinite(ab*ab))
        if not ok:
            issue_ids.append(frame.raw_identity)
        points.append(GeometryPoint(frame.clock,frame.raw_identity,
                                    frame.raw_evidence_ids,a,b,a2,b2,
                                    ab if math.isfinite(ab) else None,
                                    difference2,None,
                                    "READY_FOR_GEOMETRIC_RESEARCH" if ok else "RESEARCH_HOLD",
                                    "RAW_OBSERVABLE_OVERFLOW" if not ok else "ALL_ORIGINAL_VALUES_PRESERVED"))
        if ok:
            rows.append((1.,ab,ab*ab))
    evidence=_digest({"frames":[f.identity() for f in frames],
                      "target":target,"donor":donor})
    fitted=None
    linear_sse=None
    quad_sse=None
    gain=None
    status="RESEARCH_HOLD"
    reason="RANK_OR_NUMERICAL_INVESTIGATION_REQUIRED"
    # Do not fit a subset if any original data are unsupported. Preserve
    # ALL records rather than silently dropping out-of-range or outlier points.
    if not issue_ids:
        try:
            linear=_qr_fit([r[:2] for r in rows[:split]],
                           [p.ha_squared for p in points[:split]],LINEAR)
            quadratic=_qr_fit(rows[:split],
                              [p.ha_squared for p in points[:split]],QUADRATIC)
            y=[p.ha_squared for p in points[split:]]
            linear_sse=_predict_sse(linear,[r[:2] for r in rows[split:]],y)
            quad_sse=_predict_sse(quadratic,rows[split:],y)
            if not math.isfinite(linear_sse) or not math.isfinite(quad_sse):
                raise LocalityError("nonfinite geometric holdout residual")
            if linear_sse<=1e-14:
                reason="LINEAR_BASELINE_ALREADY_EXPLAINS_HOLDOUT"
                status="RESEARCH_HOLD"
            else:
                gain=(linear_sse-quad_sse)/linear_sse
                status=("EXPLORATORY_ALGEBRAIC_PATTERN_ONLY" if gain>=min_gain
                        else "NO_ADDITIONAL_QUADRATIC_SUPPORT")
                reason="OPERATOR_SPACE_CURVE_NOT_PHYSICAL_CAUSAL_GEOMETRY"
            fitted=quadratic.coefficients
            coeff=[v for _,v in fitted]
            # Algebraically perfect points may still be outliers. Measure
            # BOTH equation residual and extrapolation far beyond frozen
            # training support. No point is removed from fitting or reporting.
            train_x=[r[1] for r in rows[:split]]
            train_y=[p.ha_squared for p in points[:split]]
            x_lo,x_hi=min(train_x),max(train_x)
            y_lo,y_hi=min(train_y),max(train_y)
            x_span=x_hi-x_lo
            y_span=y_hi-y_lo
            updated=[]
            for p,r in zip(points,rows):
                residual=p.ha_squared-math.fsum(a*b for a,b in zip(coeff,r))
                if not math.isfinite(residual):
                    raise LocalityError("nonfinite per-point geometric residual")
                # 3-range extension is a conservative synthetic diagnostic,
                # not an estimator of scientific statistical significance.
                # At constant/zero support span, review any actual departure.
                outside_x=(r[1] < x_lo-3*x_span or r[1] > x_hi+3*x_span)
                outside_y=(p.ha_squared < y_lo-3*y_span or
                           p.ha_squared > y_hi+3*y_span)
                outlier=abs(residual)>tolerance or outside_x or outside_y
                point_reason=("STATIC_CURVE_LARGE_RESIDUAL_RESEARCH" if abs(residual)>tolerance
                              else "OUTSIDE_TRAINING_SUPPORT_RESEARCH" if outside_x or outside_y
                              else "NOT_AN_EQUIVALENCE_OR_CALCULATION_DROP")
                updated.append(GeometryPoint(p.clock,p.raw_identity,
                    p.original_evidence_ids,p.ha,p.hb,p.ha_squared,
                    p.hb_squared,p.ha_hb,p.squared_entropy_difference,
                    residual,"RESEARCH_REVIEW_OUTLIER" if outlier else "RETAINED",
                    point_reason))
            points=updated
        except (LocalityError,ArithmeticError,OverflowError) as error:
            status="RESEARCH_HOLD"
            reason="RANK_OR_NUMERICAL_INVESTIGATION_REQUIRED:"+str(error)
            # Never publish partial/invalid coefficients as science.
            fitted=None
            linear_sse=quad_sse=gain=None
    if issue_ids:
        reason="ONE_OR_MORE_ORIGINAL_OBSERVABLES_REQUIRE_NUMERICAL_REVIEW"
    source_ids=tuple(p.raw_identity for p in points)
    if len(source_ids)!=n or source_ids!=tuple(f.raw_identity for f in frames):
        raise LocalityError("source frame conservation failure")
    return {"schema":1,"kind":"OFFLINE_GEOMETRIC_DIPOLE_DIAGNOSTIC",
        "source_identity":frames[0].source_identity,
        "calibration_identity":frames[0].calibration_identity,
        "target":target,"donor":donor,"evidence_identity":evidence,
        "trust":"UNSIGNED_OPERATOR_GEOMETRY_RESEARCH_ONLY",
        "status":status,"reason":reason,"train_frames":split,
        "test_frames":n-split,"linear_holdout_sse":linear_sse,
        "quadratic_holdout_sse":quad_sse,"quadratic_gain":gain,
        "quadratic_coefficients":fitted,
        "points":tuple(points),"original_frame_count":n,
        "preserved_frame_identities":source_ids,
        "research_review_count":sum(p.status in ("RESEARCH_HOLD","RESEARCH_REVIEW_OUTLIER")
                                    for p in points),
        "squared_difference_identity":"-Ha^2-Hb^2+2HaHb == -(Ha-Hb)^2",
        "identity_is_algebra_not_coupling":True,
        "physical_boundary_condition_supported":False,
        "scientific_jobs_eliminated":0,"frames_dropped":0,
        "averaged_or_flattened_original_data":False,
        "limitations":(
            "The equal-entropy null direction is a universal algebraic identity and may arise in pure noise.",
            "The static curve can be estimator-, regime- and fit-dependent, even with high heldout R2.",
            "Each outlier/underidentified fit must be retained for scientific investigation.",
            "This does not establish continuum geometry, a Neumann PDE, or causality.",
        )}
