/* Hustle Battle Generator — read-only Pickup preview.
   The LIVE Firebase SDK is used ONLY to read a frozen snapshot of 3 collections.
   The unchanged application scripts execute with an IN-MEMORY substitute SDK.
   No live Firebase object is available to application source code. */
'use strict';
(async function () {
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const live = window.firebase;
  const box = document.createElement('section');
  box.id = 'pickupPreviewTool';
  box.style.cssText = 'position:relative;z-index:3;margin:12px auto;max-width:900px;padding:16px;border:3px solid #216c8c;border-radius:12px;background:#f0f8fc;color:#102c3a;font:15px/1.6 sans-serif;box-sizing:border-box';
  box.innerHTML = '<h2 style="margin:0 0 5px">Pickup Battle 実機検証（読み取り専用）</h2>' +
    '<p style="margin:4px 0 10px">本番の参加者・履歴を一度だけ読み込み、隔離したメモリ内でRoundを試作します。Firestoreへの保存機能はありません。</p>' +
    '<div id="previewStatus">管理者ログインを確認しています…</div>' +
    '<div id="previewChoices" style="display:none;gap:7px;flex-wrap:wrap;margin:12px 0"></div>' +
    '<pre id="previewResult" style="white-space:pre-wrap;overflow-wrap:anywhere;margin:10px 0 0;font:13px/1.6 ui-monospace,monospace"></pre>';
  document.body.insertBefore(box, document.body.firstChild);
  const status = box.querySelector('#previewStatus');
  const buttons = box.querySelector('#previewChoices');
  const output = box.querySelector('#previewResult');
  const setStatus = s => { status.textContent = s; };
  const addLine = s => { output.textContent += s + '\n'; };
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

  // Only the outer bootstrap holds these LIVE Firebase references.
  // The application scripts below receive an entirely different fake SDK.
  const project = {
    apiKey: 'AIzaSyCDgc7y6_gOpdXcqiuakwaBpYZPC0euXlI',
    authDomain: 'hustle-battle-generator.firebaseapp.com',
    projectId: 'hustle-battle-generator',
    storageBucket: 'hustle-battle-generator.firebasestorage.app',
    messagingSenderId: '985205666015',
    appId: '1:985205666015:web:f17deffad37585696bb96a'
  };
  try {
    if (location.hostname !== 'hustle-practice.github.io' &&
        location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      throw new Error('確認済みホスト以外では起動しません。');
    }
    if (!live || typeof live.auth !== 'function' || typeof live.firestore !== 'function') {
      throw new Error('Firebase SDKが読み込まれていません。');
    }
    if (!live.apps.length) live.initializeApp(project);
    const liveAuth = live.auth();
    const liveDb = live.firestore();
    if (liveDb.app.options.projectId !== project.projectId) {
      throw new Error('Firebaseプロジェクトが一致しません。');
    }
    const user = await new Promise((resolve, reject) => {
      let unsubscribe = () => {};
      unsubscribe = liveAuth.onAuthStateChanged(u => { unsubscribe(); resolve(u); }, reject);
    });
    if (!user || user.isAnonymous) {
      throw new Error('本番アプリで管理者ログインした後、このページを同じブラウザで開いてください。');
    }
    const adminDoc = await liveDb.collection('admins').doc(user.uid).get();
    const role = adminDoc.exists ? (adminDoc.data() || {}).role : null;
    if (role !== 'admin' && role !== 'owner') {
      throw new Error('このアカウントには管理者権限がありません。');
    }
    setStatus('本番データを読み取り中…');
    const [peopleSnapshot, eventSnapshot] = await Promise.all([
      liveDb.collection('participants').get(),
      liveDb.collection('eventState').doc('current').get()
    ]);
    if (!eventSnapshot.exists) {
      throw new Error('現在のRound履歴がありません。検証を中止します。');
    }
    const originalPeople = [];
    peopleSnapshot.forEach(doc => originalPeople.push({id:doc.id, data:clone(doc.data())}));
    const originalState = clone(eventSnapshot.data());
    if (originalPeople.length === 0) throw new Error('参加者情報がありません。');

    // Remove the public SDK namespace before loading any real application code.
    // From this point the real application can access only frozen in-memory data.
    const fakeUser = {uid:user.uid, email:user.email, isAnonymous:false};
    const snap = data => ({exists:data != null, data:()=>clone(data)});
    const fakeDb = {
      app:{options:{projectId:'in-memory-readonly-preview'}},
      collection(name) {
        const collectionData = name === 'participants' ? originalPeople : [];
        return {
          onSnapshot(ok) {
            Promise.resolve().then(() => ok({forEach(fn) {
              for (const person of collectionData) {
                fn({id:person.id,data:()=>clone(person.data)});
              }
            }}));
            return () => {};
          },
          doc(id) {
            const data = name === 'admins' && id === fakeUser.uid ? {role} :
              name === 'eventState' && id === 'current' ? originalState :
              name === 'participants' ? (originalPeople.find(p=>p.id===id)||{}).data : null;
            return {
              get:async()=>snap(data),
              onSnapshot(ok) {Promise.resolve().then(()=>ok(snap(data)));return ()=>{};},
              // Purely in-memory acknowledgements; NO NETWORK IMPLEMENTATION.
              set:async()=>{},
              update:async()=>{},
              delete:async()=>{}
            };
          },
          add:async()=>{throw Error('読み取り専用のため禁止');}
        };
      },
      batch(){throw Error('読み取り専用のため禁止');},
      runTransaction(){throw Error('読み取り専用のため禁止');}
    };
    const fakeAuth = {
      currentUser:fakeUser,
      onAuthStateChanged(fn){Promise.resolve().then(()=>fn(fakeUser));return ()=>{};},
      signInAnonymously:async()=>{throw Error('検証ページでは認証変更できません');},
      signOut:async()=>{throw Error('検証ページでは認証変更できません');},
      signInWithPopup:async()=>{throw Error('検証ページでは認証変更できません');}
    };
    const fakeFirebase = {
      apps:[],
      initializeApp(options){this.apps.push({options});return this.apps[0];},
      auth:()=>fakeAuth,
      firestore:()=>fakeDb
    };
    fakeFirebase.auth.GoogleAuthProvider = function () {this.setCustomParameters=()=>{};};
    fakeFirebase.firestore.FieldValue = {serverTimestamp:()=>({localOnly:true})};
    window.firebase = fakeFirebase;
    if (window.firebase !== fakeFirebase) throw new Error('隔離用Firebaseの設定に失敗しました。');

    const sources = [
      'script.js?v=34', 'participant-link.js?v=32',
      'admin-delegation.js?v=33', 'round-logic-v38.js?v=38',
      'faceoff-battle-v44.js?v=44', 'pair-history-v36.js?v=36',
      'pickup-battle-v40.js?v=40', 'pickup-battle-v41.js?v=41-hybrid1'
    ];
    const load = url => new Promise((resolve,reject)=>{
      const s=document.createElement('script');
      s.src=url; s.onload=resolve;
      s.onerror=()=>reject(new Error('本番コードを取得できません: '+url));
      document.body.appendChild(s);
    });
    for (const source of sources) await load(source);
    // The app's Firestore save function is bypassed for a second safety layer.
    saveEventState = async function () {};
    for (let attempt=0;attempt<80;attempt++) {
      if (participantsLoaded && eventStateLoaded && isCurrentUserAdmin) break;
      await wait(50);
    }
    if (!participantsLoaded || !eventStateLoaded || !isCurrentUserAdmin) {
      throw new Error('隔離アプリの初期化が完了しませんでした。');
    }
    document.getElementById('generateRound').disabled = true;
    document.getElementById('resetRoundData').disabled = true;
    document.getElementById('adminLogoutButton').disabled = true;
    document.getElementById('registrationCard').classList.add('hidden');
    document.getElementById('roundControlCard').classList.add('hidden');
    // The preview page exposes ONLY the sandbox test controls.
    // Hide the cloned production UI to prevent mistaken interactions.
    const originalMain = document.querySelector('main.container');
    if (originalMain) originalMain.style.display = 'none';
    setStatus('読込完了。本番Round ' + currentRound + ' ／ 参加者 ' + participants.length + ' 人。下のPair数を選んでください。');
    buttons.style.display='flex';

    function stateSnapshot() {
      return {
        participants:clone(participants), currentRound,
        participantStats:clone(participantStats), pairHistory:clone(pairHistory),
        leaderOpponentHistory:clone(leaderOpponentHistory),
        followerOpponentHistory:clone(followerOpponentHistory),
        lastRoundData:clone(lastRoundData),
        diagnosis:clone(pickupRecoveryDiagnosticV41)
      };
    }
    function restore(s) {
      participants=clone(s.participants);currentRound=s.currentRound;
      participantStats=clone(s.participantStats);
      pairHistory=clone(s.pairHistory);
      leaderOpponentHistory=clone(s.leaderOpponentHistory);
      followerOpponentHistory=clone(s.followerOpponentHistory);
      lastRoundData=clone(s.lastRoundData);
      pickupRecoveryDiagnosticV41=clone(s.diagnosis);
      applyStatsToParticipants();
      renderAll();
    }
    const frozen = stateSnapshot();
    const allIds = new Map(frozen.participants.map(p=>[String(p.id),p]));
    const roleLead = p=>p && (p.role==='leader'||p.role==='both');
    const roleFollow = p=>p && (p.role==='follower'||p.role==='both');
    function validate(result, n, previousWaiting) {
      const problems=[];
      if (!result || result.format!=='pickup' || result.pickupPairCount!==n ||
          result.roundNumber!==frozen.currentRound+1 || !Array.isArray(result.battles)) {
        return {problems:['Round番号または形式が一致しません'],repeats:0};
      }
      const expected = calculatePickupBattleCountV40(
        frozen.participants.filter(p=>p.active!==false && getParticipationType(p)==='dance'),n);
      if (result.battles.length!==expected) problems.push('Battle数が一致しません');
      let repeats=0, pairs=0;const seen=new Set(),allDancers=new Set();
      for (let bi=0;bi<result.battles.length;bi++) {
        const b=result.battles[bi], dancing=new Set(), judged=new Set();
        if (!Array.isArray(b.pairs)||b.pairs.length!==n) problems.push('Battle '+(bi+1)+' のPair数が不正');
        for (const pair of (b.pairs||[])) {
          const li=String(pair.leaderId), fi=String(pair.followerId);
          const l=allIds.get(li), f=allIds.get(fi);
          if (!roleLead(l)||!roleFollow(f)||li===fi||dancing.has(li)||dancing.has(fi)) problems.push('Battle '+(bi+1)+'：Role/出場者重複');
          dancing.add(li);dancing.add(fi);allDancers.add(li);allDancers.add(fi);pairs++;
          const key=[li,fi].sort().join('|');
          if (seen.has(key)) problems.push('同じRound内でPair重複');
          seen.add(key);
          if ((frozen.pairHistory[key]?.count||0)>0) repeats++;
        }
        if (!Array.isArray(b.judgeIds)||b.judgeIds.length!==3) problems.push('Battle '+(bi+1)+'：Judge不足');
        for (const raw of (b.judgeIds||[])) {
          const id=String(raw),p=allIds.get(id);
          if (!p || p.active===false || !p.judgeAvailable || dancing.has(id)||judged.has(id)) problems.push('Battle '+(bi+1)+'：Judge割当不正');
          judged.add(id);
        }
        const tk=b.timekeeperId==null?null:String(b.timekeeperId);
        if (!tk || !allIds.has(tk) || dancing.has(tk)) problems.push('Battle '+(bi+1)+'：TK割当不正');
      }
      for (const id of previousWaiting) {
        if (!allDancers.has(String(id))) problems.push('前Round未出場者が未救済: '+String(id));
      }
      return {problems, repeats,pairs,battles:result.battles.length,waiting:result.waitingIds?.length||0};
    }
    async function run(pairCount) {
      for (const b of buttons.querySelectorAll('button')) b.disabled=true;
      output.textContent='';
      setStatus('検証中：'+pairCount+'Pair（本番Firestoreには保存しません）');
      let previousAlert=window.alert, previousRandom=Math.random;
      let warnings=[];
      try {
        restore(frozen);
        // Freeze preview input per trial; the production data never changes.
        const previousWaiting=[...getPreviousWaitingIdsV40()].map(String);
        document.getElementById('battleFormatSelect').value='pickup';
        document.getElementById('pickupPairCountSelect').value=String(pairCount);
        window.alert = msg => warnings.push(String(msg));
        const started=performance.now();
        await generatePickupRoundV41();
        const elapsed=Math.round(performance.now()-started);
        const result=clone(lastRoundData);
        if (currentRound !== frozen.currentRound+1) {
          addLine(pairCount+'Pair: Round生成なし');
          for (const msg of warnings) addLine(msg);
        } else {
          const checked=validate(result,pairCount,previousWaiting);
          addLine(pairCount+'Pair: '+(checked.problems.length?'要確認':'構造チェックOK'));
          addLine('Round '+result.roundNumber+' ／ '+checked.battles+'Battle ／ '+checked.pairs+'Pair');
          addLine('過去成立済みPairの再使用 '+checked.repeats+'組');
          addLine('今回の未出場 '+checked.waiting+'人 ／ 計算時間 '+elapsed+'ms');
          if (checked.problems.length) addLine('注意: '+[...new Set(checked.problems)].join(' ／ '));
          if (warnings.length) addLine('生成側の診断: '+warnings.join(' ／ '));
        }
      } catch (error) {
        addLine(pairCount+'Pair: エラー '+(error.message||String(error)));
        console.error(error);
      } finally {
        window.alert=previousAlert;
        Math.random=previousRandom;
        restore(frozen);
        setStatus('本番Round '+frozen.currentRound+' は未変更。検証結果を確認してください。');
        for (const b of buttons.querySelectorAll('button')) b.disabled=false;
      }
    }
    for (const n of [2,3,4,5]) {
      const b=document.createElement('button');b.type='button';b.textContent=n+'Pairを試す';
      b.style.cssText='border:1px solid #1e5c7e;border-radius:8px;background:#fff;color:#17445d;padding:9px 14px;font-weight:bold;font-size:15px';
      b.addEventListener('click',()=>run(n));buttons.appendChild(b);
    }
  } catch (error) {
    setStatus('検証を開始できません: '+(error.message||String(error)));
    console.error(error);
  }
})();
