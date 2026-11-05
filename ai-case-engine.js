/* THE-DETECTIVE case-aware AI bridge
 * Safe-by-default: no API key is stored in this file or in the APK.
 * Configure a secure same-origin backend at window.TD_AI_CONFIG.endpoint.
 */
(function(){
  'use strict';
  const cfg = window.TD_AI_CONFIG = window.TD_AI_CONFIG || { endpoint: '' };
  const norm = v => String(v || '').toLowerCase()
    .replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي')
    .replace(/[ًٌٍَُِّْـ]/g,'').replace(/[^\u0600-\u06FFa-z0-9 ]/g,' ')
    .replace(/\s+/g,' ').trim();
  const words = v => norm(v).split(' ').filter(x => x.length > 2);
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function dossier(){
    const suspect = suspects[sel];
    const knownClues = (S.c || []).map(id => clues.find(x => x.id === id)).filter(Boolean)
      .map(x => ({title:x.title, description:x.desc}));
    const otherPeople = suspects.filter((x,i)=>i!==sel).map(x=>({name:x.name,role:x.role}));
    return {
      caseId: cn + 1,
      caseTitle: c.t,
      caseBrief: c.p,
      casePublicDescription: c.cf,
      suspect: {
        name:suspect.name, role:suspect.role, motiveAsRecorded:suspect.motive,
        alibi:suspect.alibi, initialStatement:suspect.statement,
        knownQuestionAnswerPairs:suspect.qs || []
      },
      otherSuspects: otherPeople,
      evidenceKnownToInvestigator: knownClues
    };
  }

  function systemPrompt(d){
    return [
      'أنت شخصية مشتبه بها داخل لعبة THE-DETECTIVE. أجب باللهجة المصرية الطبيعية وبصوت الشخصية المحددة فقط.',
      'التزم حصرياً بملف القضية والحقائق المتاحة للشخصية. لا تخترع أحداثاً أو أدلة أو مواعيد أو اعترافات.',
      'لا تكشف الجاني أو الحل النهائي أو أي معلومة سرية غير موجودة في ملف الشخصية. لا تستنتج أن المشتبه به يعرف ما لا يعرفه.',
      'لو السؤال خارج القضية، ارفضه داخل الشخصية وأعد المحقق للتحقيق. لو لا تعرف الإجابة قل ذلك بوضوح.',
      'إذا واجهك المحقق بدليل، تفاعل معه فقط بقدر ما تسمح به إجابة الشخصية والحقائق المعروفة.',
      'لا تضف أدلة جديدة إلى اللعبة ولا تغيّر حقائق القضية. أجب باختصار وواقعية، ولا تذكر أنك نموذج ذكاء اصطناعي.',
      'بيانات القضية المسموح بها لهذه الشخصية (JSON):',
      JSON.stringify(d)
    ].join('\n');
  }

  function offlineReply(question, d){
    const s = suspects[sel], qWords = words(question);
    let best = null, bestScore = 0;
    (s.qs || []).forEach(pair => {
      const set = new Set(words(pair[0]));
      const score = qWords.filter(w=>set.has(w)).length;
      if(score > bestScore){bestScore=score;best=pair[1];}
    });
    if(best && bestScore >= 2) return best;
    const qn = norm(question);
    for(const id of (S.c || [])){
      const clue = clues.find(x=>x.id===id);
      const response = s.conf && s.conf[id];
      if(clue && response && (qn.includes(norm(clue.title)) || words(clue.title).some(w=>qWords.includes(w)))) return response;
    }
    if(/مين|تشك|متهم|قاتل/.test(qn)) return 'أنا مش هقدر أتهم حد من غير دليل. اسألني عن اللي شفته أو اللي حصل معايا، وسيب الأدلة تتكلم.';
    if(/فين|مكان|كنت|وجود|روحت|رحت/.test(qn)) return s.alibi || 'قلتلك اللي فاكره عن تحركاتي، ومش هقدر أأكد حاجة مش متأكد منها.';
    if(/ليه|سبب|دافع|مصلحه/.test(qn)) return s.motive ? 'موضوع الدوافع مش معناه إني ارتكبت جريمة. اسألني عن الوقائع اللي تخصني.' : 'مش عندي تفسير للسؤال ده من المعلومات اللي أعرفها.';
    return 'مش فاهم تقصد إيه تحديداً. اسألني عن وقت، مكان، شخص، أو دليل مرتبط بالقضية، وأنا هرد في حدود اللي أعرفه.';
  }

  async function ask(question){
    const d = dossier();
    if(cfg.endpoint){
      try{
        const history = ((S.aiChat || {})[sel] || []).slice(-12);
        const response = await fetch(cfg.endpoint, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body:JSON.stringify({caseId:d.caseId,suspectId:sel,system:systemPrompt(d),question,history})
        });
        if(!response.ok) throw new Error('AI endpoint unavailable');
        const payload = await response.json();
        if(payload && typeof payload.reply === 'string' && payload.reply.trim()) return {reply:payload.reply.trim(),source:'ai'};
      }catch(err){ /* free/offline fallback; never expose secrets or technical errors */ }
    }
    return {reply:offlineReply(question,d),source:'offline'};
  }

  function addComposer(){
    const host = document.getElementById('questionList');
    if(!host || host.querySelector('#tdAiComposer')) return;
    const wrap = document.createElement('div');
    wrap.id='tdAiComposer'; wrap.className='panel';
    wrap.style.marginTop='14px';
    wrap.innerHTML='<p class="tag">اسأل سؤال من عندك</p><textarea id="tdAiQuestion" rows="3" maxlength="500" placeholder="اكتب سؤالك للمشتبه به..."></textarea><button class="btn" id="tdAiSend" style="margin-top:8px;width:100%">إرسال السؤال</button><p class="muted" id="tdAiMode" style="margin-top:7px">الاستجواب الذكي · الردود الاحتياطية متاحة</p><div id="tdAiAnswer"></div>';
    host.appendChild(wrap);
    document.getElementById('tdAiSend').addEventListener('click',sendQuestion);
  }

  async function sendQuestion(){
    const input=document.getElementById('tdAiQuestion'), button=document.getElementById('tdAiSend');
    const output=document.getElementById('tdAiAnswer'), mode=document.getElementById('tdAiMode');
    const question=(input.value||'').trim();
    if(!question) return;
    button.disabled=true; button.textContent='بيفكر...';
    const result=await ask(question);
    const line=document.createElement('div'); line.className='msg'; line.textContent=result.reply;
    const asked=document.createElement('div'); asked.className='msg me'; asked.textContent=question;
    output.appendChild(asked); output.appendChild(line);
    S.aiChat=S.aiChat||{}; S.aiChat[sel]=S.aiChat[sel]||[];
    S.aiChat[sel].push({q:question,a:result.reply,source:result.source});
    if(S.aiChat[sel].length>30) S.aiChat[sel]=S.aiChat[sel].slice(-30);
    save();
    mode.textContent=result.source==='ai'?'متصل بمحرك الذكاء الاصطناعي':'وضع الردود الاحتياطية';
    input.value=''; button.disabled=false; button.textContent='إرسال السؤال';
  }

  const originalQuestionList=window.questionList;
  if(typeof originalQuestionList==='function'){
    window.questionList=function(){ originalQuestionList(); addComposer(); };
  }
  const originalLoadCase=window.loadCase;
  if(typeof originalLoadCase==='function'){
    window.loadCase=function(i){ const result=originalLoadCase(i); return result; };
  }
  window.TDCaseAI={dossier,systemPrompt,ask,offlineReply};
})();