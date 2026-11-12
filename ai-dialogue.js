/* THE DETECTIVE — local adaptive dialogue layer
   Offline dialogue helper. It does not call a cloud AI or change case solutions. */
(() => {
  "use strict";
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const stop = new Set(["انا","انت","انتي","هو","هي","في","من","على","عن","ده","دي","دا","كان","كانت","كنت","مش","ما","ماذا","هل","يا","طب","طيب","لو","ايه","ازاي","فين","امتى","the","and","you","are","was","were","what","when","where","why","how","did","do","does","is","it","a","an","to","of","in","on"]);
  const normalize = s => String(s || "").toLowerCase()
    .replace(/[\u064B-\u065F\u0670ـ]/g,"")
    .replace(/[أإآ]/g,"ا").replace(/ة/g,"ه").replace(/ى/g,"ي")
    .replace(/[^\p{L}\p{N}\s]/gu," ").split(/\s+/)
    .filter(w => w.length > 1 && !stop.has(w));
  const overlap = (a,b) => {
    const A = new Set(normalize(a)), B = new Set(normalize(b));
    let n = 0; A.forEach(w => { if(B.has(w)) n++; });
    return n / Math.max(1, Math.min(A.size, B.size));
  };
  const getChat = () => {
    S.aiChat = S.aiChat || {};
    const key = String(cn) + ":" + String(sel);
    return S.aiChat[key] = S.aiChat[key] || [];
  };
  const addBox = () => {
    const host = document.getElementById("questionList");
    if (!host || document.getElementById("tdAiDialogue")) return;
    const s = suspects[sel];
    if (!s) return;
    const history = getChat();
    const rows = history.map(m => '<div class="td-ai-msg '+(m.who==="you"?"you":"npc")+'"><small>'+(m.who==="you"?"أنت":"المشتبه به")+'</small><p>'+esc(m.text)+'</p></div>').join("");
    const box = document.createElement("section");
    box.id = "tdAiDialogue";
    box.className = "td-ai-panel";
    box.innerHTML = '<div class="td-ai-head"><span>✦</span><div><b>وضع الحوار الذكي</b><small>محاكاة محلية تكيفية · يعمل دون إنترنت</small></div><i>LOCAL AI</i></div>'+
      '<div class="td-ai-log" id="tdAiLog">'+(rows || '<p class="td-ai-empty">اكتب سؤالك بطريقتك. ردود الشخصية تتغير حسب صياغة السؤال ومستوى التوتر والأدلة المتاحة.</p>')+'</div>'+
      '<form id="tdAiForm" class="td-ai-form"><input id="tdAiInput" maxlength="240" autocomplete="off" placeholder="اكتب سؤالك للمشتبه به..." aria-label="سؤالك للمشتبه به"><button type="submit">إرسال</button></form>'+
      '<div class="td-ai-note">ملاحظة: هذا محرك حوار محلي تجريبي، وليس اتصالاً بنموذج لغوي سحابي.</div>';
    host.appendChild(box);
    const form = box.querySelector("#tdAiForm");
    form.addEventListener("submit", ev => {
      ev.preventDefault();
      const input = box.querySelector("#tdAiInput");
      const value = input.value.trim();
      if (!value) return;
      input.value = "";
      window.tdAiAsk(value);
    });
    const log = box.querySelector("#tdAiLog");
    log.scrollTop = log.scrollHeight;
  };
  const originalQuestionList = window.questionList;
  if (typeof originalQuestionList === "function") {
    window.questionList = function() {
      originalQuestionList();
      addBox();
    };
  }
  window.tdAiAsk = function(text) {
    const s = suspects[sel];
    if (!s) return;
    const history = getChat();
    history.push({who:"you",text});
    const tension = (S.t && S.t[sel]) || 0;
    const candidates = (s.qs || []).map((q,i) => ({
      q, i, score: Math.max(overlap(text,q[0]), overlap(text,q[1]))
    })).sort((a,b)=>b.score-a.score);
    const best = candidates[0];
    let reply = "";
    if (/(كدب|كذاب|بتكدب|تناقض|اثبت|دليل|بصم|كاميرا|رساله|اتصال|مكال|وقت|ساعة|فلوس|فلوس|مصلحه|سبب|دافع|فين|مكان)/.test(text) && tension >= 2) {
      reply = "استنى… إنت بتتهمني بحاجة؟ أنا جاوبتك قبل كده. لو معاك دليل واضح حطه قدامي بدل ما تفضل تلف حوالين السؤال.";
    } else if (best && best.score >= 0.18) {
      reply = best.q[1];
      if (tension >= 3) reply += " وبصراحة، أنا مش مرتاح لطريقة الأسئلة دي.";
      else if (tension === 0 && history.length <= 2) reply = "اسمع، هحاول أكون واضح معاك. " + reply;
    } else if (/(خايف|خوف|قلقان|تهديد|هدد)/.test(text)) {
      reply = tension >= 2 ? "أنا مش خايف… بس واضح إن في حد عايز يخلينا نسكت. مش هقدر أقول أكتر من كده دلوقتي." : "أنا قلقان من اللي ممكن يحصل، بس محتاج أعرف إن كلامي مش هيعرّضني للخطر.";
    } else if (/(ليه|لماذا|عشان|علشان|سبب|دافع)/.test(text)) {
      reply = "السؤال عن السبب مش سهل. اسألني عن اللي حصل في الليلة دي بالتحديد، أو واجهني بتوقيت أو دليل عندك.";
    } else if (/(فين|اين|مكان|كنت فين)/.test(text)) {
      reply = "أنا قلتلك اللي فاكره عن تحركاتي. لو تقصد وقت معين، حددهولي بالدقيقة وأنا هحاول أراجع كلامي.";
    } else if (/(مين|من|شفت|شاف|قابلت)/.test(text)) {
      reply = "مش هقدر أحدد شخص من غير ما أكون متأكد. اسألني عن الشخص أو الموقف اللي تقصده بالاسم.";
    } else {
      const fallback = [
        "مش فاهم قصدك بالضبط. ممكن تسألني عن الوقت أو المكان أو الأشخاص اللي كانوا موجودين؟",
        "السؤال ده واسع شوية. حدّدلي جزء من الليلة دي وأنا هجاوبك على قد ما أقدر.",
        "أنا مش هخمن. اسألني سؤال مباشر عن اللي شفته أو عملته."
      ];
      reply = fallback[(history.length + sel) % fallback.length];
      if (tension >= 3) reply = "أنا جاوبت على اللي أعرفه. مش هكرر كلامي لمجرد إنك بتضغط عليّ.";
    }
    history.push({who:"npc",text:reply});
    if (typeof spend === "function") spend(2);
    if (S.t) S.t[sel] = Math.min(5, tension + (best && best.score >= 0.18 ? 0 : 1));
    save();
    const log = document.getElementById("tdAiLog");
    if (log) {
      if (history.length === 2) log.innerHTML = "";
      log.insertAdjacentHTML("beforeend",
        '<div class="td-ai-msg you"><small>أنت</small><p>'+esc(text)+'</p></div>'+
        '<div class="td-ai-msg npc"><small>'+esc(s.name)+'</small><p>'+esc(reply)+'</p></div>');
      log.scrollTop = log.scrollHeight;
    }
  };
  const style = document.createElement("style");
  style.textContent = `
    .td-ai-panel{margin-top:16px;padding:13px;border:1px solid #8e754b;border-radius:15px;background:linear-gradient(145deg,#171f32,#0c1421);box-shadow:0 8px 24px #0004}
    .td-ai-head{display:flex;align-items:center;gap:9px;color:#e7c981}.td-ai-head>span{font-size:25px}.td-ai-head b,.td-ai-head small{display:block}.td-ai-head b{font-size:14px}.td-ai-head small{font-size:10px;color:#9ba9bc;margin-top:3px}.td-ai-head i{margin-right:auto;font:700 9px monospace;color:#8bd0a7;border:1px solid #416a57;border-radius:20px;padding:4px 7px}
    .td-ai-log{height:190px;overflow:auto;padding:8px 2px;display:flex;flex-direction:column;gap:8px;margin-top:10px}.td-ai-empty{color:#9ba9bc;font-size:12px;line-height:1.9;text-align:center;margin:auto}
    .td-ai-msg{max-width:88%;padding:8px 10px;border-radius:11px;font-size:12px;line-height:1.8}.td-ai-msg small{display:block;font-size:9px;opacity:.7;margin-bottom:2px}.td-ai-msg p{margin:0}.td-ai-msg.you{align-self:flex-start;background:#234638;color:#e5f6eb;border-bottom-right-radius:3px}.td-ai-msg.npc{align-self:flex-end;background:#263345;color:#f1eee8;border:1px solid #526078;border-bottom-left-radius:3px}
    .td-ai-form{display:flex;gap:7px;margin-top:8px}.td-ai-form input{min-width:0;flex:1;background:#080f19;color:#fff;border:1px solid #47566a;border-radius:9px;padding:10px;font:inherit;font-size:12px}.td-ai-form button{background:#d6b477;color:#171717;border:0;border-radius:9px;padding:0 15px;font-weight:800}.td-ai-note{font-size:9px;color:#8795a8;margin-top:8px;text-align:center}
  `;
  document.head.appendChild(style);
  const oldOpen = window.openTool;
  if (typeof oldOpen === "function") {
    window.openTool = function(k,i) { const r=oldOpen.apply(this,arguments); if(k==="interrogate") setTimeout(addBox,0); return r; };
  }
})();