"""Transactional offline research-hold journal: unresolved never means discarded.

Keep exact original serializable evidence in a content-verified archive, and
link each rank, outlier, missingness or control failure to that immutable
archive. The journal can mark investigated/resolved, but cannot delete,
replace, average, or erase original evidence.

No services, scheduling, scientific calculations, or production integration.
"""
from __future__ import annotations
from contextlib import contextmanager
from dataclasses import asdict, is_dataclass
from pathlib import Path
import json
import sqlite3
from typing import Sequence
from .core import LocalityError, _digest


def _plain(value):
    if is_dataclass(value):
        return asdict(value)
    if isinstance(value, dict):
        return {str(k): _plain(v) for k,v in value.items()}
    if isinstance(value, (list,tuple)):
        return [_plain(v) for v in value]
    return value


class ResearchHoldRegistry:
    def __init__(self, path: str | Path, *, source_identity: str,
                 contract_identity: str, max_archive_bytes: int=32*1024*1024):
        if not source_identity or not contract_identity or max_archive_bytes<1:
            raise LocalityError("source, contract, and bounded archive required")
        self.source_identity=source_identity
        self.contract_identity=contract_identity
        self.max_archive_bytes=max_archive_bytes
        self.path=Path(path)
        self.path.parent.mkdir(parents=True,exist_ok=True)
        self.db=sqlite3.connect(str(self.path),timeout=30,isolation_level=None)
        self.db.execute("PRAGMA journal_mode=WAL")
        self.db.execute("PRAGMA synchronous=FULL")
        self.db.execute("PRAGMA busy_timeout=30000")
        with self._tx():
            self.db.execute("CREATE TABLE IF NOT EXISTS meta(k TEXT PRIMARY KEY,v TEXT NOT NULL)")
            self.db.execute("""CREATE TABLE IF NOT EXISTS archives(
                archive_name TEXT PRIMARY KEY,sha256 TEXT NOT NULL,
                evidence_json TEXT NOT NULL
            )""")
            self.db.execute("""CREATE TABLE IF NOT EXISTS cases(
                case_id TEXT PRIMARY KEY,archive_name TEXT NOT NULL,
                reason TEXT NOT NULL,detail_json TEXT NOT NULL,
                state TEXT NOT NULL CHECK(state IN
                ('RESEARCH_HOLD','UNDER_REVIEW','RETAIN_SEPARATE','REVIEWED_NO_SUPPRESSION')),
                FOREIGN KEY(archive_name) REFERENCES archives(archive_name)
            )""")
            self.db.execute("""CREATE TABLE IF NOT EXISTS changes(
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                case_id TEXT NOT NULL,state TEXT NOT NULL,
                reviewer TEXT NOT NULL,reason TEXT NOT NULL,
                previous_hash TEXT NOT NULL,entry_hash TEXT NOT NULL
            )""")
            expected={"source":source_identity,"contract":contract_identity,"schema":"1"}
            existing=dict(self.db.execute("SELECT k,v FROM meta"))
            if existing and existing!=expected:
                raise LocalityError("research-hold source/contract mismatch")
            for k,v in expected.items():
                self.db.execute("INSERT OR IGNORE INTO meta VALUES (?,?)",(k,v))
            self.db.execute("PRAGMA foreign_keys=ON")

    @contextmanager
    def _tx(self):
        self.db.execute("BEGIN IMMEDIATE")
        try:
            yield
            self.db.execute("COMMIT")
        except BaseException:
            self.db.execute("ROLLBACK")
            raise

    def __enter__(self):
        return self

    def __exit__(self,*_):
        self.close()

    def close(self):
        self.db.close()

    def archive(self, archive_name: str, evidence: Sequence[object]) -> str:
        if not archive_name or not evidence:
            raise LocalityError("archive name and complete original evidence required")
        raw={"source_identity":self.source_identity,
             "contract_identity":self.contract_identity,
             "records":[_plain(v) for v in evidence]}
        data=json.dumps(raw,sort_keys=True,separators=(",",":"),allow_nan=False)
        if len(data.encode())>self.max_archive_bytes:
            raise LocalityError("archive exceeds bounded local limit; repartition with separate manifests, never discard")
        digest=_digest(raw)
        with self._tx():
            row=self.db.execute("SELECT sha256 FROM archives WHERE archive_name=?",
                                (archive_name,)).fetchone()
            if row:
                if row[0]!=digest:
                    raise LocalityError("immutable original evidence conflict")
                return digest
            self.db.execute("INSERT INTO archives VALUES (?,?,?)",
                            (archive_name,digest,data))
        return digest

    def read_archive(self, archive_name: str) -> dict:
        row=self.db.execute("SELECT sha256,evidence_json FROM archives WHERE archive_name=?",
                            (archive_name,)).fetchone()
        if not row:
            raise LocalityError("unknown evidence archive")
        try:
            raw=json.loads(row[1])
        except ValueError as exc:
            raise LocalityError("torn evidence archive") from exc
        if raw.get("source_identity")!=self.source_identity or raw.get("contract_identity")!=self.contract_identity:
            raise LocalityError("research evidence source mismatch")
        if _digest(raw)!=row[0]:
            raise LocalityError("original research evidence digest mismatch")
        return raw

    def _append(self,case_id,state,reason,reviewer):
        parent=self.db.execute("SELECT entry_hash FROM changes ORDER BY seq DESC LIMIT 1").fetchone()
        previous=parent[0] if parent else "GENESIS"
        entry=_digest({"case":case_id,"state":state,"reason":reason,
                       "reviewer":reviewer,"previous":previous})
        self.db.execute("""INSERT INTO changes(case_id,state,reviewer,reason,
            previous_hash,entry_hash) VALUES (?,?,?,?,?,?)""",
                        (case_id,state,reviewer,reason,previous,entry))

    def hold(self, case_id: str, archive_name: str, *, reason: str,
             details: dict, reviewer: str="automatic-research-triage") -> str:
        if not case_id or not archive_name or not reason or not reviewer:
            raise LocalityError("complete research case metadata required")
        if not isinstance(details,dict):
            raise LocalityError("case details must be structured")
        text=json.dumps(_plain(details),sort_keys=True,separators=(",",":"),allow_nan=False)
        with self._tx():
            archive=self.db.execute("SELECT 1 FROM archives WHERE archive_name=?",
                                    (archive_name,)).fetchone()
            if not archive:
                raise LocalityError("missing original evidence archive")
            old=self.db.execute("""SELECT archive_name,reason,detail_json,state
                FROM cases WHERE case_id=?""",(case_id,)).fetchone()
            if old:
                if old[:3]!=(archive_name,reason,text):
                    raise LocalityError("conflicting immutable research case")
                return "ALREADY_RETAINED"
            self.db.execute("""INSERT INTO cases(case_id,archive_name,reason,detail_json,state)
                VALUES (?,?,?,?,'RESEARCH_HOLD')""",
                (case_id,archive_name,reason,text))
            self._append(case_id,"RESEARCH_HOLD",reason,reviewer)
        return "RETAINED_FOR_RESEARCH"

    def review(self, case_id: str, *, state: str, reason: str, reviewer: str) -> None:
        if state not in ("UNDER_REVIEW","RETAIN_SEPARATE","REVIEWED_NO_SUPPRESSION"):
            raise LocalityError("invalid non-destructive review state")
        if not reason or not reviewer:
            raise LocalityError("reason/reviewer required")
        with self._tx():
            row=self.db.execute("SELECT state FROM cases WHERE case_id=?",
                                (case_id,)).fetchone()
            if not row:
                raise LocalityError("unknown research hold")
            self.db.execute("UPDATE cases SET state=? WHERE case_id=?",(state,case_id))
            self._append(case_id,state,reason,reviewer)

    def get(self, case_id: str) -> dict:
        row=self.db.execute("SELECT archive_name,reason,detail_json,state FROM cases WHERE case_id=?",
                            (case_id,)).fetchone()
        if not row:
            raise LocalityError("unknown research case")
        original=self.read_archive(row[0])
        return {"case_id":case_id,"archive_name":row[0],"reason":row[1],
                "details":json.loads(row[2]),"state":row[3],
                "original_evidence":original,
                "scientific_jobs_eliminated":0}

    def verify(self) -> bool:
        for archive, in self.db.execute("SELECT archive_name FROM archives"):
            self.read_archive(archive)
        last="GENESIS"
        for case,state,reviewer,reason,previous,digest in self.db.execute(
                "SELECT case_id,state,reviewer,reason,previous_hash,entry_hash FROM changes ORDER BY seq"):
            check=_digest({"case":case,"state":state,"reason":reason,
                           "reviewer":reviewer,"previous":last})
            if previous!=last or digest!=check:
                raise LocalityError("tampered research hold ledger")
            last=digest
        return True

    def counts(self):
        states=dict(self.db.execute("SELECT state,COUNT(*) FROM cases GROUP BY state"))
        archive_count=self.db.execute("SELECT COUNT(*) FROM archives").fetchone()[0]
        return {"archives":archive_count,"cases":sum(states.values()),
                "states":states,"original_evidence_dropped":0,
                "scientific_jobs_eliminated":0}


def preserve_level2_holds(report: dict, registry: ResearchHoldRegistry,
                          *, archive_name: str) -> dict:
    """Persist EVERY Level 1 input once, then link each unresolved fit/issue."""
    if (report.get("source_identity")!=registry.source_identity or
        report.get("calibration_identity")!=registry.contract_identity or
        report.get("scientific_jobs_eliminated")!=0 or
        report.get("input_windows_dropped")!=0):
        raise LocalityError("incompatible or destructive Level 2 research report")
    original=report.get("retained_original_windows")
    if not isinstance(original,tuple) or len(original)!=report.get("original_window_count"):
        raise LocalityError("incomplete original window set")
    digest=registry.archive(archive_name,original)
    cases=[]
    for i,issue in enumerate(report["unresolved_research_items"]):
        case_id=_digest({"analysis":report["evidence_identity"],"issue_index":i,
                         "issue":issue})
        reason=issue["reason"]
        registry.hold(case_id,archive_name,reason=reason,
                      details={"issue":issue,"analysis":report["evidence_identity"],
                               "archive_digest":digest})
        cases.append(case_id)
    return {"archive_name":archive_name,"archive_digest":digest,
            "retained_windows":len(original),"research_case_ids":tuple(cases),
            "cases":len(cases),"scientific_jobs_eliminated":0}


def preserve_five_step_holds(report: dict, original_information_frames: Sequence[object],
                             registry: ResearchHoldRegistry, *,
                             archive_name: str) -> dict:
    """Archive the COMPLETE derived-information input including held fits.

    The upstream immutable RawFrames must additionally be archived by the
    caller if locally available; an InfoFrame only contains raw identities,
    not the original raw measurement values.
    """
    if (report.get("source_identity")!=registry.source_identity or
        report.get("calibration_identity")!=registry.contract_identity or
        report.get("scientific_jobs_eliminated")!=0):
        raise LocalityError("incompatible research report")
    frames=tuple(original_information_frames)
    if (len(frames)!=report.get("frames") or
        tuple(getattr(f,"raw_identity",None) for f in frames)!=
                tuple(report.get("raw_source_frame_identities",()))):
        raise LocalityError("not the exact original information series")
    digest=registry.archive(archive_name,frames)
    case_ids=[]
    for result in report.get("results",()):
        if not result.status.startswith("ABSTAIN"):
            continue
        case_id=_digest({"report":_digest(report.get("raw_source_frame_identities")),
                         "target":result.target,"donor":result.donor,
                         "status":result.status,"archive":digest})
        registry.hold(case_id,archive_name,reason=result.status,
                      details={"target":result.target,"donor":result.donor,
                               "source_frames":result.source_frames,
                               "calibration":registry.contract_identity,
                               "archive_digest":digest})
        case_ids.append(case_id)
    return {"retained_frames":len(frames),"archive_digest":digest,
            "research_case_ids":tuple(case_ids),
            "rank_and_abstention_cases":len(case_ids),
            "scientific_jobs_eliminated":0}
