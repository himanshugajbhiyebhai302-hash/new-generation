import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────
//  MOCK DATABASE  (simulates SQL + DFS search)
// ─────────────────────────────────────────────
const VOTER_DATABASE = {
  nodes: {
    V001: { id:"V001", name:"Rajesh Kumar",    age:42, voterID:"MH2401001", fingerHash:"FP_A1B2C3", faceHash:"FC_X9Y8Z7", constituency:"Solapur North", voted:false, verified:true  },
    V002: { id:"V002", name:"Priya Sharma",    age:35, voterID:"MH2401002", fingerHash:"FP_D4E5F6", faceHash:"FC_W6V5U4", constituency:"Solapur North", voted:false, verified:true  },
    V003: { id:"V003", name:"Amit Patil",      age:28, voterID:"MH2401003", fingerHash:"FP_G7H8I9", faceHash:"FC_T3S2R1", constituency:"Solapur South", voted:false, verified:true  },
    V004: { id:"V004", name:"Sunita Desai",    age:55, voterID:"MH2401004", fingerHash:"FP_J0K1L2", faceHash:"FC_Q0P9O8", constituency:"Solapur North", voted:true,  verified:true  },
    FAKE1:{ id:"FAKE1",name:"???  Unknown",    age:0,  voterID:"FAKE_0001",  fingerHash:"FP_FAKE01", faceHash:"FC_FAKE01", constituency:"NONE",          voted:false, verified:false },
  },
  // adjacency list for DFS traversal
  edges: { V001:["V002","V003"], V002:["V001","V004"], V003:["V001"], V004:["V002"], FAKE1:[] },
};

const PARTIES = [
  { id:"P1", name:"National Progress Party", symbol:"🌅", color:"#FF6B35", votes:0 },
  { id:"P2", name:"People's Democratic Front",symbol:"⭐", color:"#4ECDC4", votes:0 },
  { id:"P3", name:"United Bharatiya Alliance",symbol:"🔱", color:"#45B7D1", votes:0 },
  { id:"P4", name:"NOTA",                     symbol:"✗",  color:"#95A5A6", votes:0 },
];

// ─────────────────────────────────────────────
//  DFS SEARCH ENGINE
// ─────────────────────────────────────────────
function dfsSearch(graph, startNode, targetFingerHash, targetFaceHash, voterID) {
  const visited = new Set();
  const log = [];
  let found = null;

  function dfs(nodeId, depth=0) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const node = graph.nodes[nodeId];
    if (!node) return;

    log.push({ depth, nodeId, name: node.name, status: "visiting" });

    // Match criteria
    const fpMatch   = node.fingerHash === targetFingerHash;
    const faceMatch = node.faceHash   === targetFaceHash;
    const idMatch   = node.voterID    === voterID;

    if (fpMatch && faceMatch && idMatch) {
      log.push({ depth, nodeId, name: node.name, status: "MATCH_FOUND" });
      found = node;
      return;
    }

    const neighbors = graph.edges[nodeId] || [];
    for (const neighbor of neighbors) {
      if (!found) dfs(neighbor, depth + 1);
    }
  }

  // Start DFS from every node (full graph scan)
  for (const key of Object.keys(graph.nodes)) {
    if (!found) dfs(key, 0);
  }

  return { found, log, visitedCount: visited.size };
}

// ─────────────────────────────────────────────
//  FINGERPRINT SCANNER COMPONENT
// ─────────────────────────────────────────────
function FingerprintScanner({ onScan, scanning }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame = 0;

    function draw() {
      ctx.clearRect(0,0,200,200);
      // Background
      ctx.fillStyle = "#0a0f1e";
      ctx.fillRect(0,0,200,200);

      // Fingerprint lines
      ctx.strokeStyle = scanning ? `rgba(0,255,180,${0.3 + Math.sin(frame*0.1)*0.2})` : "rgba(0,255,180,0.15)";
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 18; i++) {
        const r = 8 + i*5;
        ctx.beginPath();
        ctx.arc(100,105, r, 0.3 + Math.sin(i)*0.4, Math.PI*2 - 0.3 - Math.sin(i)*0.4);
        ctx.stroke();
      }

      // Scan line
      if (scanning) {
        const y = 30 + ((frame * 1.5) % 140);
        const grad = ctx.createLinearGradient(0, y-8, 0, y+8);
        grad.addColorStop(0,"transparent");
        grad.addColorStop(0.5,"rgba(0,255,180,0.8)");
        grad.addColorStop(1,"transparent");
        ctx.fillStyle = grad;
        ctx.fillRect(20, y-8, 160, 16);
        setProgress(Math.min(100, Math.floor(((frame*1.5)%140)/140*100)));
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(100,105,3,0,Math.PI*2);
      ctx.fillStyle = scanning ? "#00ffb4" : "#1a3a5c";
      ctx.fill();

      frame++;
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [scanning]);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <canvas ref={canvasRef} width={200} height={200}
        style={{ borderRadius:12, border:`2px solid ${scanning?"#00ffb4":"#1a3a5c"}`,
                 boxShadow: scanning?"0 0 20px rgba(0,255,180,0.4)":"none", cursor:"pointer" }}
        onClick={onScan} />
      {scanning && (
        <div style={{ width:200, height:6, background:"#0a0f1e", borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background:"linear-gradient(90deg,#00ffb4,#0080ff)",
                        borderRadius:3, transition:"width 0.1s" }} />
        </div>
      )}
      <span style={{ color:"#00ffb4", fontSize:12, fontFamily:"monospace" }}>
        {scanning ? `SCANNING... ${progress}%` : "CLICK TO SCAN"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
//  FACE RECOGNITION COMPONENT
// ─────────────────────────────────────────────
function FaceScanner({ onScan, scanning, result }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let frame = 0;
    const color = result === "ok" ? "#00ffb4" : result === "fail" ? "#ff3366" : "#0080ff";

    function draw() {
      ctx.clearRect(0,0,200,200);
      ctx.fillStyle = "#0a0f1e";
      ctx.fillRect(0,0,200,200);

      // Face outline
      ctx.strokeStyle = `rgba(${result==="ok"?"0,255,180":result==="fail"?"255,51,102":"0,128,255"},${0.5+Math.sin(frame*0.08)*0.3})`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(100,95,45,58,0,0,Math.PI*2); ctx.stroke();

      // Eyes
      [[78,78],[122,78]].forEach(([x,y])=>{
        ctx.beginPath(); ctx.ellipse(x,y,10,7,0,0,Math.PI*2);
        ctx.strokeStyle = color; ctx.lineWidth=1.5; ctx.stroke();
        if (scanning) {
          ctx.beginPath(); ctx.arc(x,y,4,0,Math.PI*2);
          ctx.fillStyle=`rgba(0,128,255,${0.5+Math.sin(frame*0.12)*0.3})`; ctx.fill();
        }
      });

      // Nose
      ctx.beginPath(); ctx.moveTo(100,85); ctx.lineTo(93,108); ctx.lineTo(107,108);
      ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();

      // Mouth
      ctx.beginPath(); ctx.arc(100,118,14, 0.2, Math.PI-0.2);
      ctx.strokeStyle=color; ctx.lineWidth=1.5; ctx.stroke();

      // Scan grid overlay
      if (scanning) {
        ctx.strokeStyle=`rgba(0,128,255,${0.15+Math.sin(frame*0.05)*0.1})`;
        ctx.lineWidth=0.5;
        for(let i=0;i<10;i++){
          ctx.beginPath();ctx.moveTo(i*20,0);ctx.lineTo(i*20,200);ctx.stroke();
          ctx.beginPath();ctx.moveTo(0,i*20);ctx.lineTo(200,i*20);ctx.stroke();
        }
        // Corner markers
        [[30,25],[170,25],[30,175],[170,175]].forEach(([x,y],i)=>{
          ctx.strokeStyle="#00ffb4"; ctx.lineWidth=2;
          const dx=i%2===0?8:-8, dy=i<2?8:-8;
          ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx,y); ctx.moveTo(x,y); ctx.lineTo(x,y+dy); ctx.stroke();
        });
      }

      frame++;
      animRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [scanning, result]);

  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
      <canvas ref={canvasRef} width={200} height={200}
        style={{ borderRadius:12, border:`2px solid ${result==="ok"?"#00ffb4":result==="fail"?"#ff3366":"#1a3a5c"}`,
                 boxShadow: scanning?"0 0 20px rgba(0,128,255,0.4)":"none", cursor:"pointer" }}
        onClick={onScan} />
      <span style={{ color: result==="ok"?"#00ffb4":result==="fail"?"#ff3366":"#0080ff", fontSize:12, fontFamily:"monospace" }}>
        {result==="ok"?"✓ FACE MATCHED":result==="fail"?"✗ FACE REJECTED":scanning?"ANALYZING...":"CLICK TO SCAN"}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
//  DFS VISUALIZER
// ─────────────────────────────────────────────
function DFSVisualizer({ log, found }) {
  return (
    <div style={{ background:"#050c18", border:"1px solid #0d2137", borderRadius:8, padding:12,
                  maxHeight:180, overflowY:"auto", fontFamily:"monospace", fontSize:11 }}>
      <div style={{ color:"#0080ff", marginBottom:6, fontSize:12, fontWeight:700 }}>
        ⟳ DFS TRAVERSAL LOG
      </div>
      {log.map((entry,i)=>(
        <div key={i} style={{ color: entry.status==="MATCH_FOUND"?"#00ffb4":entry.status==="visiting"?"#4a90d9":"#ff3366",
                               paddingLeft: entry.depth*12, lineHeight:"1.6" }}>
          {"│ ".repeat(entry.depth)}
          {entry.status==="MATCH_FOUND"?"✅":"🔍"} [{entry.nodeId}] {entry.name}
          {entry.status==="MATCH_FOUND" && " ← MATCH"}
        </div>
      ))}
      {log.length===0 && <span style={{color:"#2a4a6a"}}>Awaiting scan...</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
//  VOTE RESULTS CHART
// ─────────────────────────────────────────────
function VoteChart({ parties }) {
  const total = parties.reduce((s,p)=>s+p.votes,0) || 1;
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
      {parties.map(p=>(
        <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{fontSize:18}}>{p.symbol}</span>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
              <span style={{color:"#a0b8d0",fontSize:12}}>{p.name}</span>
              <span style={{color:"#fff",fontSize:12,fontWeight:700}}>{p.votes}</span>
            </div>
            <div style={{height:8,background:"#0a0f1e",borderRadius:4,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${(p.votes/total)*100}%`,background:p.color,
                           borderRadius:4,transition:"width 0.6s ease"}} />
            </div>
          </div>
          <span style={{color:p.color,fontSize:12,fontWeight:700,minWidth:36}}>
            {Math.round((p.votes/total)*100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────
export default function App() {
  const [step, setStep]           = useState(0); // 0=input, 1=fp, 2=face, 3=dfs, 4=vote, 5=done
  const [voterID, setVoterID]     = useState("");
  const [fpScanning, setFpScanning] = useState(false);
  const [fpDone, setFpDone]       = useState(false);
  const [faceScanning, setFaceScanning] = useState(false);
  const [faceResult, setFaceResult] = useState("idle"); // idle|ok|fail
  const [dfsLog, setDfsLog]       = useState([]);
  const [authResult, setAuthResult] = useState(null); // voter object or null
  const [authError, setAuthError] = useState("");
  const [parties, setParties]     = useState(PARTIES);
  const [votedFor, setVotedFor]   = useState(null);
  const [db, setDb]               = useState(VOTER_DATABASE);
  const [totalVotes, setTotalVotes] = useState(0);
  const [activeTab, setActiveTab] = useState("voting"); // voting | admin
  const [selectedVoter, setSelectedVoter] = useState("V001");

  // Simulate fingerprint scan
  const handleFPScan = useCallback(() => {
    if (fpDone || fpScanning) return;
    setFpScanning(true);
    setTimeout(()=>{ setFpScanning(false); setFpDone(true); }, 3000);
  },[fpDone, fpScanning]);

  // Simulate face scan
  const handleFaceScan = useCallback(() => {
    if (faceScanning || faceResult!=="idle") return;
    setFaceScanning(true);
    setTimeout(()=>{ setFaceScanning(false); setFaceResult("ok"); }, 2500);
  },[faceScanning, faceResult]);

  // Run DFS identification
  const runIdentification = useCallback(() => {
    const voter = db.nodes[selectedVoter];
    if (!voter) return;
    const result = dfsSearch(db, "V001", voter.fingerHash, voter.faceHash, voter.voterID);
    setDfsLog(result.log);
    setTimeout(()=>{
      if (result.found) {
        if (!result.found.verified) {
          setAuthError("⚠ FAKE BIOMETRIC DETECTED — Access Denied");
          setAuthResult(null);
        } else if (result.found.voted) {
          setAuthError("⚠ ALREADY VOTED — Duplicate attempt blocked");
          setAuthResult(null);
        } else {
          setAuthResult(result.found);
          setAuthError("");
        }
      } else {
        setAuthError("✗ No matching record found in database");
      }
      setStep(4);
    }, 1500);
  },[db, selectedVoter]);

  // Cast vote
  const castVote = useCallback((partyId)=>{
    if (!authResult) return;
    setParties(prev=>prev.map(p=>p.id===partyId?{...p,votes:p.votes+1}:p));
    setDb(prev=>({...prev, nodes:{...prev.nodes, [authResult.id]:{...prev.nodes[authResult.id],voted:true}}}));
    setVotedFor(partyId);
    setTotalVotes(t=>t+1);
    setStep(5);
  },[authResult]);

  // Reset for next voter
  const resetFlow = () => {
    setStep(0); setVoterID(""); setFpScanning(false); setFpDone(false);
    setFaceScanning(false); setFaceResult("idle"); setDfsLog([]);
    setAuthResult(null); setAuthError(""); setVotedFor(null);
  };

  const styles = {
    app:    { minHeight:"100vh", background:"#04080f", color:"#e0eaf5", fontFamily:"'Courier New', monospace", padding:20 },
    card:   { background:"#080e1a", border:"1px solid #0d2137", borderRadius:12, padding:20 },
    title:  { color:"#00ffb4", fontSize:28, fontWeight:900, letterSpacing:2, textAlign:"center", margin:"0 0 4px" },
    sub:    { color:"#4a90d9", fontSize:12, textAlign:"center", letterSpacing:4, margin:"0 0 24px" },
    btn:    { padding:"10px 24px", borderRadius:8, border:"none", cursor:"pointer", fontWeight:700,
              fontFamily:"monospace", fontSize:14, transition:"all 0.2s" },
    step:   { display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#2a4a6a" },
    stepActive: { color:"#00ffb4" },
    input:  { background:"#050c18", border:"1px solid #0d3050", borderRadius:8, color:"#e0eaf5",
              padding:"10px 14px", fontSize:14, fontFamily:"monospace", width:"100%", boxSizing:"border-box" },
    label:  { color:"#4a90d9", fontSize:11, letterSpacing:2, marginBottom:4, display:"block" },
    select: { background:"#050c18", border:"1px solid #0d3050", borderRadius:8, color:"#e0eaf5",
              padding:"10px 14px", fontSize:14, fontFamily:"monospace", width:"100%", boxSizing:"border-box" },
  };

  const STEPS = ["ID INPUT","FINGERPRINT","FACE SCAN","AI VERIFY","VOTE","DONE"];

  return (
    <div style={styles.app}>
      {/* Header */}
      <div style={{maxWidth:900, margin:"0 auto"}}>
        <h1 style={styles.title}>⬡ SECUREVOTE AI</h1>
        <p style={styles.sub}>BIOMETRIC ELECTION MANAGEMENT SYSTEM v2.0</p>

        {/* Tab Bar */}
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          {["voting","admin"].map(t=>(
            <button key={t} style={{...styles.btn, background:activeTab===t?"#0d2137":"#050c18",
              color:activeTab===t?"#00ffb4":"#4a90d9", border:`1px solid ${activeTab===t?"#00ffb4":"#0d2137"}`}}
              onClick={()=>setActiveTab(t)}>
              {t==="voting"?"🗳 VOTING BOOTH":"🔧 ADMIN / DB"}
            </button>
          ))}
        </div>

        {/* ── VOTING BOOTH ── */}
        {activeTab==="voting" && (
          <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16}}>

            {/* LEFT — Steps */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Progress */}
              <div style={{...styles.card, display:"flex",gap:0,padding:12}}>
                {STEPS.map((s,i)=>(
                  <div key={i} style={{flex:1,textAlign:"center"}}>
                    <div style={{...styles.step, ...(i<=step?styles.stepActive:{}), justifyContent:"center", flexDirection:"column", gap:2}}>
                      <div style={{width:20,height:20,borderRadius:"50%",margin:"0 auto",
                        background:i<step?"#00ffb4":i===step?"#0080ff":"#0a1a2e",
                        border:`1px solid ${i<=step?"#00ffb4":"#0d2137"}`,
                        display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:i<step?"#000":"#fff"}}>
                        {i<step?"✓":i+1}
                      </div>
                      <span style={{fontSize:8, letterSpacing:0.5}}>{s}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* STEP 0 — Voter ID Input */}
              {step===0 && (
                <div style={styles.card}>
                  <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:16,letterSpacing:2}}>
                    STEP 1 · VOTER IDENTIFICATION
                  </div>
                  <label style={styles.label}>SELECT VOTER (DEMO)</label>
                  <select style={styles.select} value={selectedVoter} onChange={e=>setSelectedVoter(e.target.value)}>
                    {Object.values(db.nodes).map(v=>(
                      <option key={v.id} value={v.id}>
                        {v.name} — {v.voterID} {!v.verified?"⚠ FAKE":""}
                      </option>
                    ))}
                  </select>
                  <div style={{marginTop:12}}>
                    <label style={styles.label}>VOTER ID</label>
                    <input style={styles.input} value={db.nodes[selectedVoter]?.voterID||""} readOnly />
                  </div>
                  <div style={{marginTop:12,padding:10,background:"#050c18",borderRadius:8,fontSize:11,color:"#4a90d9"}}>
                    👤 {db.nodes[selectedVoter]?.name} · Age: {db.nodes[selectedVoter]?.age}<br/>
                    📍 {db.nodes[selectedVoter]?.constituency}<br/>
                    {db.nodes[selectedVoter]?.voted && <span style={{color:"#ff6b35"}}>⚠ Already voted</span>}
                    {!db.nodes[selectedVoter]?.verified && <span style={{color:"#ff3366"}}>⚠ FLAGGED AS FAKE</span>}
                  </div>
                  <button style={{...styles.btn,background:"#0080ff",color:"#fff",marginTop:16,width:"100%"}}
                    onClick={()=>setStep(1)}>
                    PROCEED TO BIOMETRIC SCAN →
                  </button>
                </div>
              )}

              {/* STEP 1 — Fingerprint */}
              {step===1 && (
                <div style={styles.card}>
                  <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:16,letterSpacing:2}}>
                    STEP 2 · FINGERPRINT CAPTURE
                  </div>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
                    <FingerprintScanner onScan={handleFPScan} scanning={fpScanning} />
                  </div>
                  {fpDone && (
                    <div style={{padding:10,background:"#001a0d",border:"1px solid #00ffb4",borderRadius:8,
                                 fontSize:11,color:"#00ffb4",textAlign:"center",marginBottom:12}}>
                      ✓ FINGERPRINT CAPTURED · Hash: {db.nodes[selectedVoter]?.fingerHash}
                    </div>
                  )}
                  <button disabled={!fpDone}
                    style={{...styles.btn,background:fpDone?"#0080ff":"#0a1a2e",color:fpDone?"#fff":"#2a4a6a",width:"100%"}}
                    onClick={()=>setStep(2)}>
                    {fpDone?"PROCEED TO FACE SCAN →":"SCAN FINGERPRINT FIRST"}
                  </button>
                </div>
              )}

              {/* STEP 2 — Face */}
              {step===2 && (
                <div style={styles.card}>
                  <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:16,letterSpacing:2}}>
                    STEP 3 · FACIAL RECOGNITION
                  </div>
                  <div style={{display:"flex",justifyContent:"center",marginBottom:16}}>
                    <FaceScanner onScan={handleFaceScan} scanning={faceScanning} result={faceResult} />
                  </div>
                  {faceResult==="ok" && (
                    <div style={{padding:10,background:"#001a0d",border:"1px solid #00ffb4",borderRadius:8,
                                 fontSize:11,color:"#00ffb4",textAlign:"center",marginBottom:12}}>
                      ✓ FACE VERIFIED · Hash: {db.nodes[selectedVoter]?.faceHash}
                    </div>
                  )}
                  <button disabled={faceResult!=="ok"}
                    style={{...styles.btn,background:faceResult==="ok"?"#0080ff":"#0a1a2e",
                            color:faceResult==="ok"?"#fff":"#2a4a6a",width:"100%"}}
                    onClick={()=>{ setStep(3); setTimeout(runIdentification, 500); }}>
                    {faceResult==="ok"?"RUN AI DATABASE SEARCH →":"SCAN FACE FIRST"}
                  </button>
                </div>
              )}

              {/* STEP 3 — DFS */}
              {step===3 && (
                <div style={styles.card}>
                  <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:16,letterSpacing:2}}>
                    STEP 4 · AI DATABASE VERIFICATION (DFS)
                  </div>
                  <div style={{textAlign:"center",marginBottom:16}}>
                    <div style={{fontSize:32,animation:"spin 1s linear infinite"}}>⟳</div>
                    <div style={{color:"#4a90d9",fontSize:12,marginTop:8}}>Traversing biometric database...</div>
                  </div>
                  <DFSVisualizer log={dfsLog} found={authResult} />
                  <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                </div>
              )}

              {/* STEP 4 — Vote */}
              {step===4 && (
                <div style={styles.card}>
                  <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:16,letterSpacing:2}}>
                    STEP 5 · CAST YOUR VOTE
                  </div>
                  {authError ? (
                    <div style={{padding:16,background:"#1a0008",border:"1px solid #ff3366",borderRadius:8,
                                 color:"#ff3366",textAlign:"center",marginBottom:12}}>
                      {authError}
                      <br/><br/>
                      <button style={{...styles.btn,background:"#ff3366",color:"#fff"}} onClick={resetFlow}>
                        RESET
                      </button>
                    </div>
                  ) : authResult ? (
                    <>
                      <div style={{padding:10,background:"#001a0d",border:"1px solid #00ffb4",borderRadius:8,
                                   fontSize:12,color:"#00ffb4",marginBottom:16}}>
                        ✅ IDENTITY VERIFIED — Welcome, {authResult.name}<br/>
                        <span style={{color:"#4a90d9"}}>Constituency: {authResult.constituency}</span>
                      </div>
                      <div style={{color:"#4a90d9",fontSize:11,letterSpacing:2,marginBottom:12}}>
                        SELECT YOUR CANDIDATE:
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {parties.map(p=>(
                          <button key={p.id}
                            style={{...styles.btn, background:"#050c18", color:"#e0eaf5",
                                   border:`1px solid ${p.color}`, display:"flex",alignItems:"center",gap:12,
                                   padding:"12px 16px", textAlign:"left"}}
                            onClick={()=>castVote(p.id)}
                            onMouseEnter={e=>e.currentTarget.style.background=p.color+"22"}
                            onMouseLeave={e=>e.currentTarget.style.background="#050c18"}>
                            <span style={{fontSize:22}}>{p.symbol}</span>
                            <span style={{fontWeight:700}}>{p.name}</span>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {/* STEP 5 — Done */}
              {step===5 && (
                <div style={{...styles.card,textAlign:"center"}}>
                  <div style={{fontSize:60,margin:"12px 0"}}>✅</div>
                  <div style={{color:"#00ffb4",fontSize:20,fontWeight:700,marginBottom:8}}>
                    VOTE RECORDED
                  </div>
                  <div style={{color:"#4a90d9",fontSize:12,marginBottom:8}}>
                    Voted for: {parties.find(p=>p.id===votedFor)?.symbol} {parties.find(p=>p.id===votedFor)?.name}
                  </div>
                  <div style={{color:"#2a4a6a",fontSize:11,marginBottom:20}}>
                    Transaction logged · Blockchain sealed · Voter marked
                  </div>
                  <button style={{...styles.btn,background:"#0080ff",color:"#fff"}} onClick={resetFlow}>
                    NEXT VOTER →
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT — Live Results + DFS Log */}
            <div style={{display:"flex",flexDirection:"column",gap:16}}>
              <div style={styles.card}>
                <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:16,letterSpacing:2}}>
                  📊 LIVE VOTE COUNT · {totalVotes} cast
                </div>
                <VoteChart parties={parties} />
              </div>

              <div style={styles.card}>
                <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:12,letterSpacing:2}}>
                  🔍 LAST DFS SEARCH LOG
                </div>
                <DFSVisualizer log={dfsLog} found={authResult} />
              </div>

              <div style={styles.card}>
                <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:12,letterSpacing:2}}>
                  ⚙ SYSTEM STATUS
                </div>
                {[
                  ["Biometric Engine","ONLINE","#00ffb4"],
                  ["DFS Search AI","READY","#00ffb4"],
                  ["Database","CONNECTED","#00ffb4"],
                  ["Encryption","AES-256","#0080ff"],
                  ["Fake Detection","ACTIVE","#00ffb4"],
                ].map(([k,v,c])=>(
                  <div key={k} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",
                                       borderBottom:"1px solid #0d2137",fontSize:12}}>
                    <span style={{color:"#a0b8d0"}}>{k}</span>
                    <span style={{color:c,fontWeight:700}}>● {v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ADMIN / DATABASE ── */}
        {activeTab==="admin" && (
          <div style={{display:"flex",flexDirection:"column",gap:16}}>
            <div style={styles.card}>
              <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:16,letterSpacing:2}}>
                🗄 VOTER DATABASE — {Object.keys(db.nodes).length} records
              </div>
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{borderBottom:"1px solid #0d3050"}}>
                      {["ID","NAME","VOTER ID","FINGERPRINT","FACE HASH","STATUS","VOTED"].map(h=>(
                        <th key={h} style={{padding:"8px 10px",color:"#4a90d9",textAlign:"left",letterSpacing:1}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.values(db.nodes).map(v=>(
                      <tr key={v.id} style={{borderBottom:"1px solid #050c18",
                                             background:!v.verified?"rgba(255,51,102,0.08)":"transparent"}}>
                        <td style={{padding:"8px 10px",color:"#4a90d9"}}>{v.id}</td>
                        <td style={{padding:"8px 10px",color:"#e0eaf5"}}>{v.name}</td>
                        <td style={{padding:"8px 10px",color:"#a0b8d0"}}>{v.voterID}</td>
                        <td style={{padding:"8px 10px",color:"#00ffb4",fontFamily:"monospace"}}>{v.fingerHash}</td>
                        <td style={{padding:"8px 10px",color:"#0080ff",fontFamily:"monospace"}}>{v.faceHash}</td>
                        <td style={{padding:"8px 10px"}}>
                          <span style={{color:v.verified?"#00ffb4":"#ff3366",fontWeight:700}}>
                            {v.verified?"✓ REAL":"⚠ FAKE"}
                          </span>
                        </td>
                        <td style={{padding:"8px 10px"}}>
                          <span style={{color:v.voted?"#ff6b35":"#2a4a6a"}}>
                            {v.voted?"YES":"NO"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* DFS Graph Visualization */}
            <div style={styles.card}>
              <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:12,letterSpacing:2}}>
                🕸 DATABASE GRAPH (DFS STRUCTURE)
              </div>
              <div style={{background:"#050c18",borderRadius:8,padding:16,fontSize:11,fontFamily:"monospace"}}>
                {Object.entries(db.edges).map(([node,neighbors])=>(
                  <div key={node} style={{marginBottom:6}}>
                    <span style={{color:"#00ffb4"}}>[{node}]</span>
                    <span style={{color:"#4a90d9"}}> ──→ </span>
                    {neighbors.length > 0
                      ? neighbors.map((n,i)=>(
                          <span key={n}>
                            <span style={{color:"#0080ff"}}>[{n}]</span>
                            {i<neighbors.length-1&&<span style={{color:"#2a4a6a"}}>, </span>}
                          </span>
                        ))
                      : <span style={{color:"#2a4a6a"}}>(no connections)</span>
                    }
                  </div>
                ))}
                <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #0d2137",color:"#4a90d9"}}>
                  DFS searches all nodes for exact biometric + voterID triple-match.<br/>
                  Fake nodes (FAKE*) are flagged and rejected at verification layer.
                </div>
              </div>
            </div>

            {/* System Architecture */}
            <div style={styles.card}>
              <div style={{color:"#0080ff",fontSize:13,fontWeight:700,marginBottom:12,letterSpacing:2}}>
                🏗 SYSTEM ARCHITECTURE
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
                {[
                  {title:"LAYER 1",sub:"Biometric I/O",desc:"Fingerprint sensor + IR camera. Raw biometric captured & hashed via SHA-256.",icon:"🖐"},
                  {title:"LAYER 2",sub:"AI DFS Engine",desc:"Graph-based DFS traversal matches triple: fingerHash + faceHash + voterID.",icon:"🔍"},
                  {title:"LAYER 3",sub:"Voting Machine",desc:"Physical buttons enabled only after successful 3-factor authentication.",icon:"🗳"},
                ].map(l=>(
                  <div key={l.title} style={{background:"#050c18",border:"1px solid #0d2137",
                                              borderRadius:8,padding:14,textAlign:"center"}}>
                    <div style={{fontSize:28,marginBottom:8}}>{l.icon}</div>
                    <div style={{color:"#00ffb4",fontWeight:700,marginBottom:2}}>{l.title}</div>
                    <div style={{color:"#4a90d9",fontSize:11,marginBottom:8}}>{l.sub}</div>
                    <div style={{color:"#a0b8d0",fontSize:11,lineHeight:1.6}}>{l.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
