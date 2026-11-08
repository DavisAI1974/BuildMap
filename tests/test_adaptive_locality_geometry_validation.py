"""Independent evidence-recovery and conditioning controls for geometric research."""
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

from adaptive_locality.core import LocalityError
from adaptive_locality.geometry_probe import geometric_dipole_probe
from adaptive_locality.information import RawMember, RawFrame, FixedBins, derive_information
from adaptive_locality.research_holds import (
    ResearchHoldRegistry, preserve_geometric_holds, preserve_rejected_geometric_inputs)
from test_adaptive_locality_geometry import series


def original_series(n=48):
    bins=FixedBins("geometry-raw","frozen-bins-v1",
                   (("a",(0.,1.,2.,3.,4.)),("b",(0.,1.,2.,3.,4.))))
    raw=[]
    for t in range(n):
        members=[]
        for j in range(8):
            for node in ("a","b"):
                k=(t % 7)+1 if node=="a" else ((t*3+1)%7)+1
                value=0.5 if j<k else 1.5
                members.append(RawMember(f"raw-{t}-{node}-{j}",str(j),node,
                                         value,"raw-synthetic",
                                         order_id=f"order-{t}-{j}",
                                         direction="AB" if node=="a" else "BA"))
        raw.append(RawFrame(t,"geometry-raw",tuple(members)))
    return tuple(raw),bins,tuple(derive_information(r,bins) for r in raw)


class GeometricResearchPreservationTests(unittest.TestCase):
    def test_rank_condition_and_equal_entropy_are_explicit_diagnostics(self):
        data=series(n=70,equal=True)
        report=geometric_dipole_probe(data,"a","b")
        self.assertEqual(report["status"],"RESEARCH_HOLD")
        self.assertIsNotNone(report["design_basis_audit"])
        self.assertEqual(report["design_basis_audit"]["estimated_rank"],3)
        self.assertLess(report["max_equal_entropy_identity_float_residual"],1e-12)
        self.assertEqual(report["scientific_jobs_eliminated"],0)
        constant=tuple(replace(f,entropy=(("a",0.7),("b",0.9))) for f in data)
        rank=geometric_dipole_probe(constant,"a","b")
        self.assertEqual(rank["design_basis_audit"]["estimated_rank"],1)
        self.assertEqual(rank["status"],"RESEARCH_HOLD")
        self.assertEqual(len(rank["preserved_frame_identities"]),len(constant))

    def test_frozen_support_and_residual_are_not_conflated(self):
        data=list(series())
        data[-3]=replace(data[-3],entropy=(("a",6.4),("b",1.)))
        report=geometric_dipole_probe(tuple(data),"a","b",tolerance=0.01)
        flagged=report["points"][-3]
        self.assertTrue(flagged.outside_frozen_support)
        self.assertFalse(flagged.residual_exceeds_tolerance)
        self.assertGreater(flagged.frozen_support_x_excess,0)
        self.assertGreater(flagged.frozen_support_y_excess,0)
        self.assertEqual(report["frozen_support_novelty_point_count"],1)
        self.assertEqual(report["large_residual_point_count"],0)
        self.assertEqual(report["frames_dropped"],0)

    def test_complete_original_raw_to_information_to_geometry_archive_and_reopen(self):
        raw,bins,info=original_series()
        self.assertTrue(all(f.status=="READY" for f in info))
        report=geometric_dipole_probe(info,"a","b")
        with tempfile.TemporaryDirectory() as folder:
            path=Path(folder)/"geometry.sqlite"
            with ResearchHoldRegistry(path,source_identity="geometry-raw",
                                      contract_identity=bins.identity()) as store:
                receipt=preserve_geometric_holds(report,info,raw,bins,store,
                                                archive_name="geometry-full-raw")
                self.assertEqual(receipt["retained_full_raw_frames"],len(raw))
                self.assertEqual(receipt["retained_geometry_points"],len(raw))
                self.assertEqual(receipt["scientific_jobs_eliminated"],0)
                self.assertEqual(receipt, preserve_geometric_holds(
                    report,info,raw,bins,store,archive_name="geometry-full-raw"))
                records=store.read_archive("geometry-full-raw")["records"]
                self.assertEqual(len(records),len(raw))
                self.assertEqual(records[0]["raw_frame"]["samples"][0]["order_id"],
                                 raw[0].samples[0].order_id)
                self.assertEqual(records[0]["raw_frame"]["samples"][0]["direction"],"AB")
                self.assertEqual(records[0]["information_frame"]["raw_identity"],
                                 raw[0].identity())
                self.assertTrue(store.verify())
                self.assertGreaterEqual(receipt["cases"],1)
                case=store.get(receipt["research_case_ids"][0])
                self.assertEqual(len(case["original_evidence"]["records"]),len(raw))
            with ResearchHoldRegistry(path,source_identity="geometry-raw",
                                      contract_identity=bins.identity()) as store:
                self.assertEqual(store.read_archive("geometry-full-raw")["records"],
                                 records)
                self.assertTrue(store.verify())

    def test_mismatched_raw_or_modified_information_refused_without_overwrite(self):
        raw,bins,info=original_series()
        report=geometric_dipole_probe(info,"a","b")
        altered_sample=replace(raw[0].samples[0],value=2.5)
        tampered_raw=(replace(raw[0],samples=(altered_sample,)+raw[0].samples[1:]),)+raw[1:]
        altered_info=(replace(info[0],entropy=(("a",0.9),("b",0.8))),)+info[1:]
        with tempfile.TemporaryDirectory() as folder:
            with ResearchHoldRegistry(Path(folder)/"r.sqlite",
                                      source_identity="geometry-raw",
                                      contract_identity=bins.identity()) as store:
                with self.assertRaises(LocalityError):
                    preserve_geometric_holds(report,info,tampered_raw,bins,store,
                                             archive_name="not-allowed")
                with self.assertRaises(LocalityError):
                    preserve_geometric_holds(report,altered_info,raw,bins,store,
                                             archive_name="not-allowed")
                with self.assertRaises(LocalityError):
                    preserve_geometric_holds(report,info,raw[:-1],bins,store,
                                             archive_name="not-allowed")
                self.assertEqual(store.counts()["archives"],0)

    def test_rejected_original_inputs_archived_even_when_fitting_disallowed(self):
        raw,bins,info=original_series()
        first=list(raw[0].samples)
        first[0]=replace(first[0],value=50.)
        disallowed=(replace(raw[0],samples=tuple(first)),)+raw[1:]
        self.assertEqual(derive_information(disallowed[0],bins).status,"REVIEW_REQUIRED")
        with tempfile.TemporaryDirectory() as folder:
            with ResearchHoldRegistry(Path(folder)/"r.sqlite",
                                      source_identity="geometry-raw",
                                      contract_identity=bins.identity()) as store:
                receipt=preserve_rejected_geometric_inputs(
                    disallowed,bins,store,archive_name="rejected-raw",
                    reason="OUT_OF_FROZEN_RANGE")
                self.assertEqual(receipt["retained_full_raw_frames"],len(disallowed))
                self.assertEqual(store.get(receipt["research_case_ids"][0])
                                 ["original_evidence"]["records"][0]["samples"][0]["value"],50.)
                self.assertTrue(store.verify())


if __name__=="__main__":
    unittest.main()
