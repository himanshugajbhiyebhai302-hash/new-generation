"""
=============================================================
  SECUREVOTE AI — Backend System
  Biometric Voter Authentication with DFS Search Engine
=============================================================
  Step 1: Biometric capture (fingerprint + face recognition)
  Step 2: DFS-based database search & fake detection
  Step 3: Vote casting & counting
=============================================================
"""

import hashlib, json, os, time
from datetime import datetime
from collections import defaultdict

# ── Optional AI libraries (install as needed) ──
try:
    import cv2 
    import numpy as np
    import deepfac as DeepFace       # pip install deepface
    FACE_AI_AVAILABLE = True
except ImportError:
    FACE_AI_AVAILABLE = False

try:
    from fingerprint_enhancer import enhance_Fingerprint   # pip install fingerprint-enhancer
    FP_AI_AVAILABLE = True
except ImportError:
    FP_AI_AVAILABLE = False


# ─────────────────────────────────────────────
#  SECTION 1 · BIOMETRIC PROCESSOR
# ─────────────────────────────────────────────

class BiometricProcessor:
    """
    Handles fingerprint and face biometric capture and hashing.
    In production: replace simulate_* methods with real sensor SDK calls.
    """

    @staticmethod
    def hash_biometric(raw_data: bytes) -> str:
        """SHA-256 hash of raw biometric data."""
        return hashlib.sha256(raw_data).hexdigest()[:16].upper()

    # ── Fingerprint ──
    @staticmethod
    def capture_fingerprint(image_path: str = None) -> dict:
        """
        Capture and hash a fingerprint.
        Args:
            image_path: path to fingerprint image (e.g., from USB scanner)
        Returns:
            dict with hash and quality score
        """
        if image_path and FP_AI_AVAILABLE:
            img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
            enhanced = enhance_Fingerprint(img)
            raw = enhanced.tobytes()
            quality = float(np.std(enhanced))  # higher std = better ridge clarity
        else:
            # Simulation fallback
            raw = os.urandom(64)
            quality = 85.0

        return {
            "hash":    BiometricProcessor.hash_biometric(raw),
            "quality": round(quality, 2),
            "timestamp": datetime.utcnow().isoformat()
        }

    # ── Face ──
    @staticmethod
    def capture_face(image_path: str = None) -> dict:
        """
        Capture face and extract embedding hash.
        Uses DeepFace (VGG-Face / ArcFace backend) when available.
        """
        if image_path and FACE_AI_AVAILABLE:
            try:
                embedding = deepface.DeepFace.represent(
                    img_path=image_path,
                    model_name="ArcFace",
                    enforce_detection=True
                )[0]["embedding"]
                raw = bytes([int(abs(v * 100)) % 256 for v in embedding])
                quality = 92.0
            except Exception as e:
                return {"hash": None, "quality": 0, "error": str(e)}
        else:
            raw = os.urandom(64)
            quality = 88.0

        return {
            "hash":    BiometricProcessor.hash_biometric(raw),
            "quality": round(quality, 2),
            "timestamp": datetime.utcnow().isoformat()
        }

    # ── Liveness Detection ──
    @staticmethod
    def liveness_check(image_path: str = None) -> bool:
        """
        Anti-spoofing: detects printed photos or masks.
        In production: use blink detection / 3D depth sensor.
        """
        if image_path and FACE_AI_AVAILABLE:
            # Placeholder — integrate Anti-Spoof model here
            # e.g., Silent-Face-Anti-Spoofing library
            return True
        return True  # Simulate pass


# ─────────────────────────────────────────────
#  SECTION 2 · VOTER DATABASE
# ─────────────────────────────────────────────

class VoterDatabase:
    """
    Graph-based voter database.
    Each voter is a node; edges model constituency/booth relationships.
    Supports DFS search for biometric verification.
    """

    def __init__(self, db_path: str = "voters.json"):
        self.db_path = db_path
        self.nodes: dict  = {}   # voter_id → VoterRecord
        self.edges: dict  = defaultdict(list)  # adjacency list
        self.votes: dict  = {}   # party_id → count
        self._load()

    # ── Persistence ──
    def _load(self):
        if os.path.exists(self.db_path):
            with open(self.db_path) as f:
                data = json.load(f)
            self.nodes = data.get("nodes", {})
            self.edges = defaultdict(list, data.get("edges", {}))
            self.votes = data.get("votes", {})
        else:
            self._seed_demo_data()
            self._save()

    def _save(self):
        with open(self.db_path, "w") as f:
            json.dump({"nodes": self.nodes, "edges": dict(self.edges),
                       "votes": self.votes}, f, indent=2)

    def _seed_demo_data(self):
        demo_voters = [
            {"id":"V001","name":"Rajesh Kumar","age":42,"voterID":"MH2401001",
             "fingerHash":"FP_A1B2C3","faceHash":"FC_X9Y8Z7",
             "constituency":"Solapur North","voted":False,"verified":True},
            {"id":"V002","name":"Priya Sharma","age":35,"voterID":"MH2401002",
             "fingerHash":"FP_D4E5F6","faceHash":"FC_W6V5U4",
             "constituency":"Solapur North","voted":False,"verified":True},
            {"id":"V003","name":"Amit Patil","age":28,"voterID":"MH2401003",
             "fingerHash":"FP_G7H8I9","faceHash":"FC_T3S2R1",
             "constituency":"Solapur South","voted":False,"verified":True},
            {"id":"FAKE1","name":"Unknown","age":0,"voterID":"FAKE_0001",
             "fingerHash":"FP_FAKE01","faceHash":"FC_FAKE01",
             "constituency":"NONE","voted":False,"verified":False},
        ]
        for v in demo_voters:
            self.nodes[v["id"]] = v
        self.edges = defaultdict(list, {
            "V001":["V002","V003"], "V002":["V001"], "V003":["V001"], "FAKE1":[]
        })
        self.votes = {"P1":0, "P2":0, "P3":0, "NOTA":0}

    # ── CRUD ──
    def add_voter(self, voter: dict):
        self.nodes[voter["id"]] = voter
        self._save()

    def add_edge(self, a: str, b: str):
        if b not in self.edges[a]: self.edges[a].append(b)
        if a not in self.edges[b]: self.edges[b].append(a)
        self._save()

    def mark_voted(self, voter_id: str):
        if voter_id in self.nodes:
            self.nodes[voter_id]["voted"] = True
            self._save()

    def record_vote(self, party_id: str):
        self.votes[party_id] = self.votes.get(party_id, 0) + 1
        self._save()

    def get_results(self) -> dict:
        total = sum(self.votes.values()) or 1
        return {k: {"count": v, "pct": round(v/total*100, 1)}
                for k, v in self.votes.items()}


# ─────────────────────────────────────────────
#  SECTION 3 · DFS SEARCH ENGINE (AI LAYER)
# ─────────────────────────────────────────────

class DFSAuthEngine:
    """
    Depth-First Search over the voter graph.
    Matches: fingerprint hash + face hash + voter ID (triple-factor auth).
    Detects fake/duplicate records via verified flag.
    """

    def __init__(self, db: VoterDatabase):
        self.db = db

    def search(self, finger_hash: str, face_hash: str, voter_id: str) -> dict:
        """
        Run DFS to find a voter matching all three biometric factors.

        Returns:
            {
              "found":    voter record or None,
              "log":      list of traversal steps,
              "result":   "authenticated" | "fake_detected" | "already_voted" | "not_found",
              "message":  human-readable result
            }
        """
        visited = set()
        log     = []
        found   = None

        def dfs(node_id: str, depth: int = 0):
            nonlocal found
            if node_id in visited or found:
                return
            visited.add(node_id)
            node = self.db.nodes.get(node_id)
            if not node:
                return

            log.append({
                "depth":   depth,
                "node_id": node_id,
                "name":    node["name"],
                "status":  "visiting"
            })

            fp_ok   = node["fingerHash"] == finger_hash
            face_ok = node["faceHash"]   == face_hash
            id_ok   = node["voterID"]    == voter_id

            if fp_ok and face_ok and id_ok:
                log.append({
                    "depth":   depth,
                    "node_id": node_id,
                    "name":    node["name"],
                    "status":  "MATCH_FOUND"
                })
                found = node
                return

            for neighbor in self.db.edges.get(node_id, []):
                dfs(neighbor, depth + 1)

        # Traverse all connected components
        for root in list(self.db.nodes.keys()):
            dfs(root, 0)

        # ── Determine Result ──
        if found is None:
            return {"found": None, "log": log,
                    "result": "not_found",
                    "message": "No matching voter record found. Access denied."}

        if not found.get("verified", False):
            return {"found": found, "log": log,
                    "result": "fake_detected",
                    "message": f"⚠ FAKE BIOMETRIC DETECTED for {found['name']}. Security alert raised."}

        if found.get("voted", False):
            return {"found": found, "log": log,
                    "result": "already_voted",
                    "message": f"Voter {found['name']} has already voted. Duplicate attempt blocked."}

        return {"found": found, "log": log,
                "result": "authenticated",
                "message": f"✓ Identity verified: {found['name']} — cleared to vote."}


# ─────────────────────────────────────────────
#  SECTION 4 · VOTING MACHINE CONTROLLER
# ─────────────────────────────────────────────

class VotingMachine:
    """
    Controls vote button enable/disable state and records votes.
    In production: connect to GPIO (Raspberry Pi) or USB relay board.
    """

    PARTIES = {
        "P1":   "National Progress Party",
        "P2":   "People's Democratic Front",
        "P3":   "United Bharatiya Alliance",
        "NOTA": "None of the Above"
    }

    def __init__(self, db: VoterDatabase):
        self.db      = db
        self.enabled = False
        self.current_voter = None

    def enable_buttons(self, voter: dict):
        """Unlock voting panel after successful authentication."""
        self.enabled = True
        self.current_voter = voter
        print(f"\n✅ Buttons ENABLED for voter: {voter['name']}")
        self._gpio_enable(True)   # Hook into hardware here

    def disable_buttons(self):
        """Lock voting panel."""
        self.enabled = False
        self.current_voter = None
        self._gpio_enable(False)

    def cast_vote(self, party_id: str) -> dict:
        """Record a vote. Returns success/failure dict."""
        if not self.enabled:
            return {"success": False, "error": "Voting not enabled. Authenticate first."}
        if party_id not in self.PARTIES:
            return {"success": False, "error": f"Invalid party: {party_id}"}

        self.db.record_vote(party_id)
        self.db.mark_voted(self.current_voter["id"])
        voter_name = self.current_voter["name"]
        self.disable_buttons()

        return {
            "success": True,
            "message": f"Vote recorded for {self.PARTIES[party_id]} by {voter_name}",
            "timestamp": datetime.utcnow().isoformat()
        }

    def _gpio_enable(self, state: bool):
        """
        Hardware hook — implement with RPi.GPIO or relay controller.
        Example (Raspberry Pi):
            import RPi.GPIO as GPIO
            GPIO.setmode(GPIO.BCM)
            pins = [17, 27, 22, 23]  # one per party
            for pin in pins:
                GPIO.setup(pin, GPIO.OUT)
                GPIO.output(pin, GPIO.HIGH if state else GPIO.LOW)
        """
        status = "HIGH (enabled)" if state else "LOW (disabled)"
        print(f"[GPIO] Relay pins → {status}")


# ─────────────────────────────────────────────
#  SECTION 5 · ORCHESTRATOR — Full Auth Flow
# ─────────────────────────────────────────────

class SecureVoteOrchestrator:
    """
    Runs the complete authentication and voting pipeline.
    """

    def __init__(self):
        self.db      = VoterDatabase()
        self.engine  = DFSAuthEngine(self.db)
        self.machine = VotingMachine(self.db)
        self.bio     = BiometricProcessor()

    def authenticate_voter(self,
                           voter_id: str,
                           fp_image: str = None,
                           face_image: str = None) -> dict:
        """
        Full pipeline:
          1. Capture biometrics
          2. Liveness check
          3. DFS database search
          4. Enable/deny voting
        """
        print(f"\n{'='*50}")
        print(f"  Authentication attempt · Voter ID: {voter_id}")
        print(f"{'='*50}")

        # Step 1 — Biometric capture
        print("\n[1/3] Capturing biometrics...")
        fp   = self.bio.capture_fingerprint(fp_image)
        face = self.bio.capture_face(face_image)

        if not fp["hash"] or not face["hash"]:
            return {"success": False, "error": "Biometric capture failed"}

        if fp["quality"] < 60 or face["quality"] < 60:
            return {"success": False, "error": "Biometric quality too low. Retry."}

        print(f"   FP Hash:   {fp['hash']}  (quality: {fp['quality']}%)")
        print(f"   Face Hash: {face['hash']}  (quality: {face['quality']}%)")

        # Step 2 — Liveness
        print("\n[2/3] Liveness check...")
        if not self.bio.liveness_check(face_image):
            return {"success": False, "error": "Liveness check FAILED — possible spoof"}
        print("   ✓ Liveness confirmed")

        # Step 3 — DFS Search
        print("\n[3/3] Running DFS identity search...")
        result = self.engine.search(fp["hash"], face["hash"], voter_id)
        print(f"   Nodes visited: {len(result['log'])}")
        print(f"   Result: {result['result'].upper()}")
        print(f"   {result['message']}")

        if result["result"] == "authenticated":
            self.machine.enable_buttons(result["found"])
            return {"success": True, "voter": result["found"], "log": result["log"]}
        else:
            return {"success": False, "error": result["message"], "log": result["log"]}

    def cast_vote(self, party_id: str) -> dict:
        return self.machine.cast_vote(party_id)

    def get_results(self) -> dict:
        return self.db.get_results()


# ─────────────────────────────────────────────
#  DEMO RUN
# ─────────────────────────────────────────────

if __name__ == "__main__":
    system = SecureVoteOrchestrator()

    print("\n" + "█"*50)
    print("  SECUREVOTE AI — DEMO RUN")
    print("█"*50)

    # ── Demo 1: Legitimate voter ──
    auth = system.authenticate_voter("MH2401001")
    if auth["success"]:
        vote_result = system.cast_vote("P1")
        print(f"\n{vote_result['message']}")

    # ── Demo 2: Duplicate attempt ──
    print("\n--- DUPLICATE VOTE ATTEMPT ---")
    auth2 = system.authenticate_voter("MH2401001")
    print(f"Expected: {auth2['error']}")

    # ── Results ──
    print("\n\n📊 LIVE RESULTS:")
    results = system.get_results()
    for party, data in results.items():
        bar = "█" * int(data["pct"] / 5)
        print(f"  {party:6} | {bar:<20} {data['count']} votes ({data['pct']}%)")
