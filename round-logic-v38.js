/* ========================================
   Hustle Battle Generator
   Round Logic v38

   v37からの変更点

   1. Dance出場回数の公平性は維持

   2. 同じ公平性の候補内では、
      前Round最終Battle
      → 次Round Battle1
      の連続参加人数を最優先で最小化

   3. 0人重複が可能なら必ず0人を選択

   4. Pair自体はRound境界対策のために
      後から組み直さない

   5. その後に
      ・未成立Pair
      ・直前Round同一Pair
      ・Pair成立回数
      を評価

   6. Judge / Timekeeperロジックは
      v37の方針を維持
======================================== */


/* ========================================
   script.jsのGenerate Roundを
   v38へ差し替え
======================================== */

generateRoundButton.removeEventListener(
  "click",
  generateRound
);

generateRoundButton.addEventListener(
  "click",
  generateRoundV38
);


/* ========================================
   Round生成 v38
======================================== */

async function generateRoundV38() {
  if (!isCurrentUserAdmin) {
    return;
  }


  const previousFinalBattleParticipantIds =
    getPreviousFinalBattleParticipantIds();


  const previousRoundPairKeys =
    getPreviousRoundPairKeys();


  const activeDanceParticipants =
    participants.filter(
      function (participant) {
        return (
          participant.active !== false
          &&
          getParticipationType(
            participant
          ) === "dance"
        );
      }
    );


  if (
    activeDanceParticipants.length < 4
  ) {
    alert(
      "Dance参加中の人が4人以上必要です。"
    );

    return;
  }


  /* =====================================
     Role振り分け

     Bothの扱いは従来仕様を維持。
  ====================================== */

  const fixedLeaders =
    activeDanceParticipants.filter(
      function (participant) {
        return (
          participant.role ===
          "leader"
        );
      }
    );


  const fixedFollowers =
    activeDanceParticipants.filter(
      function (participant) {
        return (
          participant.role ===
          "follower"
        );
      }
    );


  const both =
    sortByDanceCount(
      activeDanceParticipants.filter(
        function (participant) {
          return (
            participant.role ===
            "both"
          );
        }
      )
    );


  const leaders =
    [...fixedLeaders];


  const followers =
    [...fixedFollowers];


  both.forEach(
    function (participant) {

      if (
        leaders.length <
        followers.length
      ) {
        leaders.push(
          participant
        );

      } else if (
        followers.length <
        leaders.length
      ) {
        followers.push(
          participant
        );

      } else {

        if (
          Math.random() < 0.5
        ) {
          leaders.push(
            participant
          );

        } else {
          followers.push(
            participant
          );
        }
      }
    }
  );


  const possiblePairCount =
    Math.min(
      leaders.length,
      followers.length
    );


  /*
    1Battle = 2Pair。

    Battleを成立させるため、
    Pair数は偶数にする。

    Lead7 / Follow8
    → 6Pair
    → 3Battle
  */
  const usablePairCount =
    Math.floor(
      possiblePairCount / 2
    ) * 2;


  if (
    usablePairCount < 2
  ) {
    alert(
      "2ペアを作成できません。Role構成を確認してください。"
    );

    return;
  }


  /* =====================================
     v38 Pair選定

     優先順位：

     1. Dance出場回数の公平性
     2. Round境界の連続参加人数
     3. 未成立Pair
     4. 直前Round同一Pair
     5. Pair成立回数
  ====================================== */

  const optimizedResult =
    createOptimizedPairsV38(
      leaders,
      followers,
      usablePairCount,
      previousRoundPairKeys,
      previousFinalBattleParticipantIds
    );


  if (
    !optimizedResult
    ||
    optimizedResult.pairs.length !==
      usablePairCount
  ) {
    alert(
      "Pairを正常に作成できませんでした。"
    );

    return;
  }


  const optimizedPairs =
    optimizedResult.pairs;


  /* =====================================
     Battle生成

     v38では、
     最初のBattleをPairの組み直しなしで
     最適化する。

     つまりPair構成自体は保持する。
  ====================================== */

  let battles =
    createBattlesWithProtectedFirstV38(
      optimizedPairs,
      previousFinalBattleParticipantIds
    );


  if (
    battles.length === 0
  ) {
    alert(
      "Battleを正常に作成できませんでした。"
    );

    return;
  }


  /* =====================================
     Dance回数・Pair履歴更新
  ====================================== */

  const usedIds =
    new Set();


  battles.forEach(
    function (battle) {

      [
        battle.pairA,
        battle.pairB
      ].forEach(
        function (pair) {

          usedIds.add(
            pair.leader.id
          );


          usedIds.add(
            pair.follower.id
          );


          pair.leader.danceCount++;


          pair.follower.danceCount++;


          pair.leader.danceFairCount =
            getDanceFairCount(
              pair.leader
            ) + 1;


          pair.follower.danceFairCount =
            getDanceFairCount(
              pair.follower
            ) + 1;


          addPairHistory(
            pair.leader,
            pair.follower
          );
        }
      );


      addOpponentHistory(
        leaderOpponentHistory,
        battle.pairA.leader,
        battle.pairB.leader
      );


      addOpponentHistory(
        followerOpponentHistory,
        battle.pairA.follower,
        battle.pairB.follower
      );
    }
  );


  /* =====================================
     Judge選定

     v37方針を維持。

     ・Battle1は前Round最終担当者を回避
     ・同一RoundでJudge済みの人を回避
  ====================================== */

  const roundJudgeUsedIds =
    new Set();


  battles.forEach(
    function (
      battle,
      battleIndex
    ) {

      const avoidIds =
        new Set();


      /*
        Battle1：
        前Round最終Battleの担当者を
        可能な限りJudgeからも避ける。
      */

      if (
        battleIndex === 0
      ) {

        previousFinalBattleParticipantIds
          .forEach(
            function (id) {

              avoidIds.add(
                String(id)
              );
            }
          );
      }


      /*
        同じRoundですでにJudgeをした人を
        可能な限り避ける。
      */

      roundJudgeUsedIds.forEach(
        function (id) {

          avoidIds.add(
            String(id)
          );
        }
      );


      battle.judges =
        selectJudgesForBattleV38(
          battle,
          3,
          avoidIds
        );


      battle.judges.forEach(
        function (judge) {

          judge.judgeCount++;


          judge.judgeFairCount =
            getJudgeFairCount(
              judge
            ) + 1;


          roundJudgeUsedIds.add(
            String(
              judge.id
            )
          );
        }
      );
    }
  );


  /* =====================================
     Timekeeper

     Battle単位で選ぶ。

     優先順位：

     1. そのBattleのDanceではない
     2. そのBattleのJudgeではない
     3. 同RoundでT未担当
     4. T回数が少ない

     候補なしの場合のみJudge兼任。
  ====================================== */

  const roundTimekeeperUsedIds =
    new Set();


  battles.forEach(
    function (battle) {

      const timekeeper =
        selectTimekeeperForBattleV38(
          battle,
          roundTimekeeperUsedIds
        );


      battle.timekeeper =
        timekeeper;


      if (timekeeper) {

        timekeeper.timekeeperCount =
          getNumberOrZero(
            timekeeper.timekeeperCount
          ) + 1;


        timekeeper.timekeeperFairCount =
          getTimekeeperFairCount(
            timekeeper
          ) + 1;


        roundTimekeeperUsedIds.add(
          String(
            timekeeper.id
          )
        );
      }
    }
  );


  /* =====================================
     Dance未出場者
  ====================================== */

  const waitingParticipants =
    activeDanceParticipants.filter(
      function (participant) {

        return (
          !usedIds.has(
            participant.id
          )
        );
      }
    );


  /* =====================================
     保存
  ====================================== */

  currentRound++;


  lastRoundData =
    serializeRound(
      battles,
      waitingParticipants,
      currentRound
    );


  syncStatsFromParticipants();


  await saveEventState();


  renderAll();
}


/* ========================================
   Pair最適化 v38

   Leader / Followerの
   出場候補を全て比較。

   第2回条件：
   Lead7人 → 6人選出 = 7通り
   Follow8人 → 6人選出 = 28通り

   合計196通りなので十分軽量。
======================================== */

function createOptimizedPairsV38(
  leaders,
  followers,
  requiredPairCount,
  previousRoundPairKeys,
  previousFinalIds
) {

  if (
    requiredPairCount <= 0
  ) {
    return null;
  }


  if (
    leaders.length <
      requiredPairCount
    ||
    followers.length <
      requiredPairCount
  ) {
    return null;
  }


  const leaderSelections =
    createCombinations(
      leaders,
      requiredPairCount
    );


  const followerSelections =
    createCombinations(
      followers,
      requiredPairCount
    );


  if (
    leaderSelections.length === 0
    ||
    followerSelections.length === 0
  ) {
    return null;
  }


  let bestCandidate =
    null;


  leaderSelections.forEach(
    function (selectedLeaders) {

      const leaderSpread =
        getProjectedDanceSpreadV38(
          leaders,
          selectedLeaders
        );


      followerSelections.forEach(
        function (selectedFollowers) {

          const followerSpread =
            getProjectedDanceSpreadV38(
              followers,
              selectedFollowers
            );


          /*
            選ばれたメンバー内で
            Pair構成まで最適化。

            Round境界もここで評価する。
          */

          const pairResult =
            createBestPairAssignmentV38(
              selectedLeaders,
              selectedFollowers,
              previousRoundPairKeys,
              previousFinalIds
            );


          if (!pairResult) {
            return;
          }


          const candidate = {

            pairs:
              pairResult.pairs,


            /*
              Role別で見て
              Round終了後に最も大きい
              Dance回数差。
            */

            maximumSpread:
              Math.max(
                leaderSpread,
                followerSpread
              ),


            totalSpread:
              leaderSpread
              +
              followerSpread,


            /*
              前Round最終Battle
              → 次Round Battle1

              の最少重複人数。
            */

            boundaryOverlap:
              pairResult.boundaryOverlap,


            repeatedPairCount:
              pairResult.repeatedPairCount,


            consecutivePairCount:
              pairResult.consecutivePairCount,


            totalHistoryCount:
              pairResult.totalHistoryCount,


            randomTie:
              Math.random()
          };


          if (
            bestCandidate === null
            ||
            compareRoundPairCandidateV38(
              candidate,
              bestCandidate
            ) < 0
          ) {

            bestCandidate =
              candidate;
          }
        }
      );
    }
  );


  return bestCandidate;
}


/* ========================================
   Round終了後のDance回数差
======================================== */

function getProjectedDanceSpreadV38(
  roleParticipants,
  selectedParticipants
) {

  if (
    !roleParticipants
    ||
    roleParticipants.length === 0
  ) {
    return 0;
  }


  const selectedIds =
    new Set(
      selectedParticipants.map(
        function (participant) {

          return String(
            participant.id
          );
        }
      )
    );


  const projectedCounts =
    roleParticipants.map(
      function (participant) {

        const currentCount =
          getDanceFairCount(
            participant
          );


        return (
          currentCount
          +
          (
            selectedIds.has(
              String(
                participant.id
              )
            )
              ? 1
              : 0
          )
        );
      }
    );


  return (
    Math.max(
      ...projectedCounts
    )
    -
    Math.min(
      ...projectedCounts
    )
  );
}


/* ========================================
   Round候補比較 v38

   優先順位：

   1. Dance公平性
   2. Round境界連続人数
   3. 成立済Pair数
   4. 直前Round同一Pair
   5. Pair成立回数
   6. 同条件ならランダム
======================================== */

function compareRoundPairCandidateV38(
  a,
  b
) {

  /*
    ① Dance公平性
  */

  if (
    a.maximumSpread !==
    b.maximumSpread
  ) {

    return (
      a.maximumSpread
      -
      b.maximumSpread
    );
  }


  if (
    a.totalSpread !==
    b.totalSpread
  ) {

    return (
      a.totalSpread
      -
      b.totalSpread
    );
  }


  /*
    ② Round境界

    同じ公平性なら、
    前Round最後 → 次Round最初の
    連続参加人数を最優先で減らす。

    0人にできる候補があれば
    0人が必ず勝つ。
  */

  if (
    a.boundaryOverlap !==
    b.boundaryOverlap
  ) {

    return (
      a.boundaryOverlap
      -
      b.boundaryOverlap
    );
  }


  /*
    ③ 未成立Pair優先

    repeatedPairCountが少ないほど、
    今回使われる未成立Pairが多い。
  */

  if (
    a.repeatedPairCount !==
    b.repeatedPairCount
  ) {

    return (
      a.repeatedPairCount
      -
      b.repeatedPairCount
    );
  }


  /*
    ④ 直前Round同一Pair回避
  */

  if (
    a.consecutivePairCount !==
    b.consecutivePairCount
  ) {

    return (
      a.consecutivePairCount
      -
      b.consecutivePairCount
    );
  }


  /*
    ⑤ 成立済Pairを使う場合は
       成立回数の少ないものを優先。
  */

  if (
    a.totalHistoryCount !==
    b.totalHistoryCount
  ) {

    return (
      a.totalHistoryCount
      -
      b.totalHistoryCount
    );
  }


  return (
    a.randomTie
    -
    b.randomTie
  );
}


/* ========================================
   Pair割当 v38

   選択済みLeader / Followerに対して
   1対1Pairを作る。

   v38では、

   ・Battle1にできる2Pairの
     Round境界重複人数
   ・未成立Pair
   ・直前RoundPair
   ・履歴回数

   をまとめて評価する。

   DP方式で最適なPair割当を探す。
======================================== */

function createBestPairAssignmentV38(
  selectedLeaders,
  selectedFollowers,
  previousRoundPairKeys,
  previousFinalIds
) {

  const pairCount =
    selectedLeaders.length;


  if (
    pairCount < 2
    ||
    selectedFollowers.length !==
      pairCount
  ) {
    return null;
  }


  /*
    DP状態：

    mask
      使用済みFollower

    min1 / min2
      Pair単位で見た
      前Round最終担当者との重複人数の
      小さい方から2Pair分。

    Battle1は2Pairなので、
    min1 + min2 が
    作成可能なBattle1の
    最小重複人数になる。
  */

  let states =
    new Map();


  states.set(
    "0|9|9",
    {
      mask: 0,

      min1: 9,

      min2: 9,

      repeatedPairCount: 0,

      consecutivePairCount: 0,

      totalHistoryCount: 0,

      assignment: [],

      randomTie:
        Math.random()
    }
  );


  for (
    let leaderIndex = 0;
    leaderIndex < pairCount;
    leaderIndex++
  ) {

    const nextStates =
      new Map();


    const leader =
      selectedLeaders[
        leaderIndex
      ];


    states.forEach(
      function (state) {

        for (
          let followerIndex = 0;
          followerIndex < pairCount;
          followerIndex++
        ) {

          const bit =
            1 << followerIndex;


          if (
            state.mask & bit
          ) {
            continue;
          }


          const follower =
            selectedFollowers[
              followerIndex
            ];


          const historyCount =
            getPairHistoryCount(
              leader,
              follower
            );


          const pairKey =
            getHistoryKey(
              leader,
              follower
            );


          /*
            このPairに含まれる
            前Round最終Battle参加者数。

            0 / 1 / 2 のいずれか。
          */

          let pairOverlap = 0;


          if (
            previousFinalIds
            &&
            previousFinalIds.has(
              String(
                leader.id
              )
            )
          ) {
            pairOverlap++;
          }


          if (
            previousFinalIds
            &&
            previousFinalIds.has(
              String(
                follower.id
              )
            )
          ) {
            pairOverlap++;
          }


          const newMinimums =
            updateTwoSmallestV38(
              state.min1,
              state.min2,
              pairOverlap
            );


          const newMask =
            state.mask | bit;


          const candidate = {

            mask:
              newMask,


            min1:
              newMinimums[0],


            min2:
              newMinimums[1],


            repeatedPairCount:
              state.repeatedPairCount
              +
              (
                historyCount > 0
                  ? 1
                  : 0
              ),


            consecutivePairCount:
              state.consecutivePairCount
              +
              (
                previousRoundPairKeys.has(
                  pairKey
                )
                  ? 1
                  : 0
              ),


            totalHistoryCount:
              state.totalHistoryCount
              +
              historyCount,


            assignment:
              [
                ...state.assignment,
                followerIndex
              ],


            randomTie:
              Math.random()
          };


          /*
            min1/min2が同じ状態なら、
            Pair履歴側の優先順位で
            最も良いものだけ残す。
          */

          const key =
            newMask
            +
            "|"
            +
            candidate.min1
            +
            "|"
            +
            candidate.min2;


          const existing =
            nextStates.get(
              key
            );


          if (
            !existing
            ||
            compareAssignmentHistoryV38(
              candidate,
              existing
            ) < 0
          ) {

            nextStates.set(
              key,
              candidate
            );
          }
        }
      }
    );


    states =
      nextStates;
  }


  if (
    states.size === 0
  ) {
    return null;
  }


  let best =
    null;


  states.forEach(
    function (state) {

      const boundaryOverlap =
        state.min1
        +
        state.min2;


      const candidate = {
        ...state,

        boundaryOverlap:
          boundaryOverlap
      };


      if (
        best === null
        ||
        compareCompletedAssignmentV38(
          candidate,
          best
        ) < 0
      ) {

        best =
          candidate;
      }
    }
  );


  if (!best) {
    return null;
  }


  const pairs = [];


  selectedLeaders.forEach(
    function (
      leader,
      leaderIndex
    ) {

      const followerIndex =
        best.assignment[
          leaderIndex
        ];


      if (
        followerIndex == null
        ||
        followerIndex < 0
        ||
        followerIndex >=
          selectedFollowers.length
      ) {
        return;
      }


      pairs.push({
        leader:
          leader,

        follower:
          selectedFollowers[
            followerIndex
          ]
      });
    }
  );


  if (
    pairs.length !==
    pairCount
  ) {
    return null;
  }


  return {

    pairs:
      pairs,


    boundaryOverlap:
      best.boundaryOverlap,


    repeatedPairCount:
      best.repeatedPairCount,


    consecutivePairCount:
      best.consecutivePairCount,


    totalHistoryCount:
      best.totalHistoryCount
  };
}


/* ========================================
   2つの最小値を更新

   Battle1 = 2Pairなので、
   全Pair中の重複人数が少ない2Pairを
   覚えておけばよい。
======================================== */

function updateTwoSmallestV38(
  min1,
  min2,
  value
) {

  if (
    value < min1
  ) {

    return [
      value,
      min1
    ];
  }


  if (
    value < min2
  ) {

    return [
      min1,
      value
    ];
  }


  return [
    min1,
    min2
  ];
}


/* ========================================
   同じDP状態内での比較

   min1/min2は既に同じなので、

   1. 成立済Pair数
   2. 直前RoundPair
   3. 履歴回数

   で比較する。
======================================== */

function compareAssignmentHistoryV38(
  a,
  b
) {

  if (
    a.repeatedPairCount !==
    b.repeatedPairCount
  ) {

    return (
      a.repeatedPairCount
      -
      b.repeatedPairCount
    );
  }


  if (
    a.consecutivePairCount !==
    b.consecutivePairCount
  ) {

    return (
      a.consecutivePairCount
      -
      b.consecutivePairCount
    );
  }


  if (
    a.totalHistoryCount !==
    b.totalHistoryCount
  ) {

    return (
      a.totalHistoryCount
      -
      b.totalHistoryCount
    );
  }


  return (
    a.randomTie
    -
    b.randomTie
  );
}


/* ========================================
   完成したPair割当の比較

   1. Round境界重複
   2. 成立済Pair数
   3. 直前RoundPair
   4. 履歴回数
======================================== */

function compareCompletedAssignmentV38(
  a,
  b
) {

  if (
    a.boundaryOverlap !==
    b.boundaryOverlap
  ) {

    return (
      a.boundaryOverlap
      -
      b.boundaryOverlap
    );
  }


  if (
    a.repeatedPairCount !==
    b.repeatedPairCount
  ) {

    return (
      a.repeatedPairCount
      -
      b.repeatedPairCount
    );
  }


  if (
    a.consecutivePairCount !==
    b.consecutivePairCount
  ) {

    return (
      a.consecutivePairCount
      -
      b.consecutivePairCount
    );
  }


  if (
    a.totalHistoryCount !==
    b.totalHistoryCount
  ) {

    return (
      a.totalHistoryCount
      -
      b.totalHistoryCount
    );
  }


  return (
    a.randomTie
    -
    b.randomTie
  );
}


/* ========================================
   Battle生成 v38

   Pairは既に確定済み。

   Pairを組み直さず、

   「どの2PairをBattle1にするか」

   だけを最適化する。

   優先順位：

   1. 前Round最終担当者との重複人数
   2. 同Role対戦履歴
   3. 同条件ならランダム
======================================== */

function createBattlesWithProtectedFirstV38(
  pairs,
  previousFinalIds
) {

  if (
    !Array.isArray(
      pairs
    )
    ||
    pairs.length < 2
  ) {
    return [];
  }


  /*
    Round1など、
    前Round情報がない場合は
    従来のBattle生成をそのまま使用。
  */

  if (
    !previousFinalIds
    ||
    previousFinalIds.size === 0
  ) {

    return createFairBattles(
      pairs
    );
  }


  let minimumOverlap =
    Infinity;


  let minimumOpponentScore =
    Infinity;


  let bestCandidates =
    [];


  for (
    let i = 0;
    i < pairs.length - 1;
    i++
  ) {

    for (
      let j = i + 1;
      j < pairs.length;
      j++
    ) {

      const pairA =
        pairs[i];


      const pairB =
        pairs[j];


      const battle = {
        pairA:
          pairA,

        pairB:
          pairB,

        judges: [],

        timekeeper:
          null
      };


      const overlap =
        getBattleDanceOverlapCount(
          battle,
          previousFinalIds
        );


      const opponentScore =
        getBattleOpponentScore(
          pairA,
          pairB
        );


      if (
        overlap <
        minimumOverlap
      ) {

        minimumOverlap =
          overlap;


        minimumOpponentScore =
          opponentScore;


        bestCandidates =
          [{
            indexA: i,
            indexB: j,
            pairA: pairA,
            pairB: pairB
          }];

      } else if (
        overlap ===
        minimumOverlap
      ) {

        if (
          opponentScore <
          minimumOpponentScore
        ) {

          minimumOpponentScore =
            opponentScore;


          bestCandidates =
            [{
              indexA: i,
              indexB: j,
              pairA: pairA,
              pairB: pairB
            }];

        } else if (
          opponentScore ===
          minimumOpponentScore
        ) {

          bestCandidates.push({
            indexA: i,
            indexB: j,
            pairA: pairA,
            pairB: pairB
          });
        }
      }
    }
  }


  if (
    bestCandidates.length === 0
  ) {

    return createFairBattles(
      pairs
    );
  }


  const selected =
    getRandomItem(
      bestCandidates
    );


  const battles = [
    {
      pairA:
        selected.pairA,

      pairB:
        selected.pairB,

      judges: [],

      timekeeper:
        null
    }
  ];


  /*
    Battle1で使ったPairだけ除き、
    残りは従来の対戦履歴ロジックで
    Battleを作る。
  */

  const remainingPairs =
    pairs.filter(
      function (
        pair,
        index
      ) {

        return (
          index !==
          selected.indexA
          &&
          index !==
          selected.indexB
        );
      }
    );


  if (
    remainingPairs.length >= 2
  ) {

    const remainingBattles =
      createFairBattles(
        remainingPairs
      );


    battles.push(
      ...remainingBattles
    );
  }


  return battles;
}


/* ========================================
   Judge v38

   v37と同じ方針。
======================================== */

function selectJudgesForBattleV38(
  battle,
  requestedCount,
  avoidIds = new Set()
) {

  const dancerIds =
    new Set([
      String(
        battle.pairA.leader.id
      ),

      String(
        battle.pairA.follower.id
      ),

      String(
        battle.pairB.leader.id
      ),

      String(
        battle.pairB.follower.id
      )
    ]);


  const allCandidates =
    participants.filter(
      function (participant) {

        return (
          participant.active !== false

          &&

          participant.judgeAvailable

          &&

          !dancerIds.has(
            String(
              participant.id
            )
          )
        );
      }
    );


  if (
    allCandidates.length === 0
  ) {
    return [];
  }


  const judgeCount =
    Math.min(
      requestedCount,
      allCandidates.length
    );


  const preferredCandidates =
    allCandidates.filter(
      function (participant) {

        return (
          !avoidIds.has(
            String(
              participant.id
            )
          )
        );
      }
    );


  /*
    回避対象を除いても
    必要人数が揃うなら完全に除外。

    足りない場合のみ再登板可能。
  */

  const candidates =
    preferredCandidates.length >=
      judgeCount
      ? preferredCandidates
      : allCandidates;


  const combinations =
    createCombinations(
      candidates,
      judgeCount
    );


  let bestScore =
    null;


  let bestCombinations =
    [];


  combinations.forEach(
    function (combination) {

      const score =
        getJudgeCombinationScore(
          combination,
          avoidIds
        );


      if (
        bestScore === null
        ||
        compareJudgeScores(
          score,
          bestScore
        ) < 0
      ) {

        bestScore =
          score;


        bestCombinations =
          [combination];

      } else if (
        compareJudgeScores(
          score,
          bestScore
        ) === 0
      ) {

        bestCombinations.push(
          combination
        );
      }
    }
  );


  return (
    getRandomItem(
      bestCombinations
    )
    ||
    []
  );
}


/* ========================================
   Timekeeper v38

   Battle単位。

   DanceでもJudgeでもない人を優先。

   他BattleでDanceする人でも
   Timekeeper候補になってよい。
======================================== */

function selectTimekeeperForBattleV38(
  battle,
  usedTimekeeperIds
) {

  const dancerIds =
    new Set([
      String(
        battle.pairA.leader.id
      ),

      String(
        battle.pairA.follower.id
      ),

      String(
        battle.pairB.leader.id
      ),

      String(
        battle.pairB.follower.id
      )
    ]);


  const judgeIds =
    new Set(
      battle.judges.map(
        function (judge) {

          return String(
            judge.id
          );
        }
      )
    );


  /*
    そのBattleで

    ・Danceしていない
    ・Judgeでもない

    人を候補にする。
  */

  const idleCandidates =
    participants.filter(
      function (participant) {

        const id =
          String(
            participant.id
          );


        return (
          participant.active !== false

          &&

          !dancerIds.has(
            id
          )

          &&

          !judgeIds.has(
            id
          )
        );
      }
    );


  if (
    idleCandidates.length > 0
  ) {

    return selectFairTimekeeperV38(
      idleCandidates,
      usedTimekeeperIds
    );
  }


  /*
    Dance・Judge以外が
    本当に1人もいない場合のみ
    Judgeから兼任。
  */

  if (
    battle.judges.length > 0
  ) {

    return selectFairTimekeeperV38(
      battle.judges,
      usedTimekeeperIds
    );
  }


  return null;
}


/* ========================================
   Timekeeper公平選定
======================================== */

function selectFairTimekeeperV38(
  candidates,
  usedTimekeeperIds
) {

  if (
    !candidates
    ||
    candidates.length === 0
  ) {
    return null;
  }


  /*
    同一RoundでまだTimekeeperを
    していない人を最優先。
  */

  const unusedCandidates =
    candidates.filter(
      function (participant) {

        return (
          !usedTimekeeperIds.has(
            String(
              participant.id
            )
          )
        );
      }
    );


  const pool =
    unusedCandidates.length > 0
      ? unusedCandidates
      : candidates;


  /*
    その中でT回数の少ない人。
  */

  let minimumCount =
    Infinity;


  pool.forEach(
    function (participant) {

      minimumCount =
        Math.min(
          minimumCount,

          getTimekeeperFairCount(
            participant
          )
        );
    }
  );


  const bestCandidates =
    pool.filter(
      function (participant) {

        return (
          getTimekeeperFairCount(
            participant
          )
          ===
          minimumCount
        );
      }
    );


  return getRandomItem(
    bestCandidates
  );
}