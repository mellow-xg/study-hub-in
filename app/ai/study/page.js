"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../../lib/supabase";

export default function MyStudyPage() {
  const [courses,setCourses]=useState([]);
  const [courseId,setCourseId]=useState("");
  const [data,setData]=useState(null);
  const [goal,setGoal]=useState("");
  const [plans,setPlans]=useState([]);
  const [loading,setLoading]=useState(true);
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState("");

  async function token() {
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.access_token) throw new Error("Your session expired.");
    return session.access_token;
  }
  async function load(selected=courseId) {
    try {
      const t=await token();
      const response=await fetch("/api/ai/plan"+(selected?"?courseId="+encodeURIComponent(selected):""),{headers:{Authorization:"Bearer "+t}});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||"Could not load analytics.");
      setData(payload);
    } catch(e) { setError(e.message); }
  }
  async function createPlan(e) {
    e.preventDefault();
    if(!goal.trim()||creating)return;
    setCreating(true);setError("");
    try {
      const t=await token();
      const response=await fetch("/api/ai/plan",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+t},body:JSON.stringify({goal,courseId:courseId||undefined})});
      const payload=await response.json();
      if(!response.ok) throw new Error(payload.error||"Could not create plan.");
      setPlans(p=>[payload.plan,...p]);setGoal("");await load();
    } catch(e){setError(e.message)} finally{setCreating(false)}
  }
  useEffect(()=>{
    (async()=>{
      const {data:{user}}=await supabase.auth.getUser();
      if(!user){window.location.href="/login";return}
      const {data:cs}=await supabase.from("courses").select("id,title").eq("status","published").order("title");
      const {data:ps}=await supabase.from("ai_study_plans").select("id,title,goal,status,plan,created_at").eq("user_id",user.id).order("created_at",{ascending:false}).limit(5);
      setCourses(cs||[]);setPlans(ps||[]);setLoading(false);
      await load("");
    })();
  },[]);

  if(loading)return <div className="min-h-screen app-shell flex items-center justify-center text-sm text-gray-500">Loading My Study…</div>;
  return <div className="min-h-screen app-shell">
    <header className="sticky top-0 z-30 border-b border-black/5 dark:border-white/5 bg-white/85 dark:bg-[#11111d]/85 backdrop-blur-xl">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        <Link href="/ai" className="text-accent font-bold">← Student AI</Link>
        <div className="flex-1"><p className="font-black text-ink dark:text-white">My Study</p><p className="text-[11px] text-gray-500">Personal learning dashboard</p></div>
      </div>
    </header>
    <main className="max-w-5xl mx-auto px-4 py-5 space-y-5">
      {error&&<div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}
      <section className="grid sm:grid-cols-4 gap-3">
        {[["Progress",(data?.progress?.pct||0)+"%","Course resources completed"],["Streak",(data?.streak||0)+" days","Consecutive study days"],["Study days",data?.studyDays||0,"Days with activity"],["Next focus",data?.recommendation||"Start studying","Recommended focus"]].map(([a,b,c])=><div key={a} className="bg-white dark:bg-[#1c1c2b] rounded-3xl p-4 shadow-sm"><p className="text-[10px] font-black tracking-wider text-accent">{a.toUpperCase()}</p><p className="text-xl font-black text-ink dark:text-white mt-2 truncate">{b}</p><p className="text-[11px] text-gray-500 mt-1">{c}</p></div>)}
      </section>
      <section className="bg-white dark:bg-[#1c1c2b] rounded-3xl p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1"><h2 className="font-black text-lg text-ink dark:text-white">Adaptive study plan</h2><p className="text-xs text-gray-500 mt-1">The plan prioritizes unfinished topics and your weakest areas.</p></div>
          <select value={courseId} onChange={e=>{setCourseId(e.target.value);load(e.target.value)}} className="search-box"><option value="">All Study Hub</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select>
        </div>
        <form onSubmit={createPlan} className="mt-4 flex flex-col sm:flex-row gap-2">
          <input value={goal} onChange={e=>setGoal(e.target.value)} maxLength={500} placeholder="Goal: Prepare for my semester exam in 7 days" className="search-box flex-1"/>
          <button disabled={creating||!goal.trim()} className="rounded-2xl bg-brand-gradient text-white px-5 py-3 text-sm font-bold disabled:opacity-40">{creating?"Creating…":"Create plan"}</button>
        </form>
      </section>
      {data?.weakTopics?.length>0&&<section className="bg-white dark:bg-[#1c1c2b] rounded-3xl p-5 shadow-sm"><h2 className="font-black text-ink dark:text-white">Weak topics</h2><div className="grid sm:grid-cols-2 gap-2 mt-3">{data.weakTopics.map(t=><div key={t.id} className="rounded-2xl border dark:border-white/10 p-3"><div className="flex justify-between"><b className="text-sm text-ink dark:text-white">{t.title}</b><span className="text-xs text-accent font-bold">{t.pct}%</span></div><div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full mt-2 overflow-hidden"><div className="h-full bg-brand-gradient" style={{width:t.pct+"%"}}/></div></div>)}</div></section>}
      {data?.quizPerformance?.length>0&&<section className="bg-white dark:bg-[#1c1c2b] rounded-3xl p-5 shadow-sm"><h2 className="font-black text-ink dark:text-white">Quiz performance</h2><div className="mt-3 space-y-2">{data.quizPerformance.map(q=><div key={q.id} className="flex items-center gap-3"><span className="text-xs font-semibold text-ink dark:text-white flex-1">{q.title}</span><span className="text-xs font-black">{q.best}%</span></div>)}</div></section>}
      {plans.length>0&&<section className="bg-white dark:bg-[#1c1c2b] rounded-3xl p-5 shadow-sm"><h2 className="font-black text-ink dark:text-white">Saved plans</h2><div className="mt-3 space-y-2">{plans.map(p=><details key={p.id} className="rounded-2xl border dark:border-white/10 p-3"><summary className="cursor-pointer text-sm font-bold text-ink dark:text-white">{p.title} · {p.goal}</summary><div className="mt-3 space-y-2">{(Array.isArray(p.plan)?p.plan:(p.plan?.items||[])).map(item=><div key={item.day} className="rounded-xl bg-gray-50 dark:bg-[#151522] p-3"><b className="text-xs">Day {item.day}: {item.title||item.focus}</b><ul className="text-xs text-gray-500 mt-1">{item.tasks?.map(x=><li key={x}>• {x}</li>)}</ul></div>)}</div></details>)}</div></section>}
    </main>
  </div>;
}

