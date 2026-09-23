/* ========================================
   Hustle Battle Generator
   Round Logic v37

   改善点

   1. Dance公平性を「選出前」ではなく
      「Round終了後の回数差」で評価

   2. 公平性を維持できる候補の中で
      未成立Pairを最大限優先

   3. 直前Roundと同じPairを強く回避

   4. Pair成立回数の少ない組み合わせを優先

   5. Pair決定後はRound境界対策のために
      Pairを組み直さない

   6. TimekeeperはBattle単位で
      Dance / Judge以外から優先選出
======================================== */


/* ========================================
   script.jsのGenerate Roundを
   v37へ差し替え
======================================== */

generateRoundButton.removeEventListener(
  "click",
  generateRound
);

generateRoundButton.addEventListener(
  "click",
  generateRoundV37
);


/* ========================================
   Round生成 v37
======================================== */

async function generateRoundV37() {
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
    1Battle = 2Pairなので
    Pair数は偶数にする。

    例：
    Lead 7 / Follow 8

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
     v37 Pair選定

     出場者選定とPair選定を
     同時に比較する。
  ====================================== */

  const optimizedResult =
    createOptimizedPairsV37(
      leaders,
      followers,
      usablePairCount,
      previousRoundPairKeys
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
  ====================================== */

  let battles =
    createFairBattles(
      optimizedPairs
    );


  /*
    v37：

    Pair最適化後はPairを組み直さない。

    前Round最終Battleとの連続回避は
    Battle順の変更だけで対応する。

    0人重複が可能なら0人を最優先。
    無理なら重複人数が最少のBattleを
    Battle1へ移動する。
  */

  moveBestBattleToFrontV37(
    battles,
    previousFinalBattleParticipantIds
  );


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
        Battle1だけ、
        前Round最終Battle担当者を
        可能な限り避ける。
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
        selectJudgesForBattleV37(
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
        selectTimekeeperForBattleV37(
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
   Pair最適化 v37

   まずLeader / Followerについて
   「今回出場する人」の全候補を作る。

   各候補についてRound終了後の
   Dance回数差を計算。

   その公平性が同等の候補同士で

   ・未成立Pair数
   ・直前RoundPair
   ・Pair成立回数

   を比較する。
======================================== */

function createOptimizedPairsV37(
  leaders,
  followers,
  requiredPairCount,
  previousRoundPairKeys
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


  /*
    今回出場させるLeader候補。

    Lead7 / 6人出場なら
    7通り。
  */

  const leaderSelections =
    createCombinations(
      leaders,
      requiredPairCount
    );


  /*
    Follow8 / 6人出場なら
    28通り。
  */

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


  /*
    Leader候補 × Follower候補を
    全て比較する。

    第2回条件：
    7 × 28 = 196通り

    なので十分軽量。
  */

  leaderSelections.forEach(
    function (selectedLeaders) {

      const leaderSpread =
        getProjectedDanceSpreadV37(
          leaders,
          selectedLeaders
        );


      followerSelections.forEach(
        function (selectedFollowers) {

          const followerSpread =
            getProjectedDanceSpreadV37(
              followers,
              selectedFollowers
            );


          const pairResult =
            createBestPairAssignmentV37(
              selectedLeaders,
              selectedFollowers,
              previousRoundPairKeys
            );


          if (!pairResult) {
            return;
          }


          const candidate = {

            pairs:
              pairResult.pairs,


            /*
              最も悪いRole側の
              出場回数差。
            */

            maximumSpread:
              Math.max(
                leaderSpread,
                followerSpread
              ),


            /*
              同じmaximumSpreadなら、
              Lead/Follow両方の差合計も比較。
            */

            totalSpread:
              leaderSpread
              +
              followerSpread,


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
            compareRoundPairCandidateV37(
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

function getProjectedDanceSpreadV37(
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
   Round候補比較

   優先順位：

   1. Round終了後のDance回数差
   2. Lead/Followの差合計
   3. 成立済Pairの数を最少化
   4. 直前Round同一Pairを最少化
   5. Pair成立回数合計を最少化
   6. ランダム
======================================== */

function compareRoundPairCandidateV37(
  a,
  b
) {

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
    同じ公平性なら、
    未成立Pairを最大限使用する。

    repeatedPairCountが少ないほど
    未成立Pairが多い。
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
    成立済Pairを使う必要がある場合でも、
    直前Roundと同じPairはさらに避ける。
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
    それでも同じなら、
    成立回数が少ない組み合わせを優先。
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
   選ばれたメンバー内で
   最良Pairを作る
======================================== */

function createBestPairAssignmentV37(
  selectedLeaders,
  selectedFollowers,
  previousRoundPairKeys
) {

  const pairCount =
    selectedLeaders.length;


  if (
    pairCount === 0
    ||
    selectedFollowers.length !==
      pairCount
  ) {
    return null;
  }


  let maximumHistoryCount = 0;


  selectedLeaders.forEach(
    function (leader) {

      selectedFollowers.forEach(
        function (follower) {

          maximumHistoryCount =
            Math.max(
              maximumHistoryCount,

              getPairHistoryCount(
                leader,
                follower
              )
            );
        }
      );
    }
  );


  /*
    Pair成立回数の合計より
    「直前Round同一Pair」の方を強くする。
  */

  const maximumHistoryTotal =
    pairCount *
    maximumHistoryCount;


  const consecutiveWeight =
    maximumHistoryTotal + 1;


  /*
    直前Roundペナルティと履歴回数全部より
    「成立済Pairを1組使う」方を強くする。

    これにより未成立Pair最大化が
    最優先になる。
  */

  const maximumLowerPriorityTotal =
    (
      pairCount *
      consecutiveWeight
    )
    +
    maximumHistoryTotal;


  const repeatedPairWeight =
    maximumLowerPriorityTotal + 1;


  const costMatrix =
    selectedLeaders.map(
      function (leader) {

        return selectedFollowers.map(
          function (follower) {

            const historyCount =
              getPairHistoryCount(
                leader,
                follower
              );


            const key =
              getHistoryKey(
                leader,
                follower
              );


            const repeatedPenalty =
              historyCount > 0
                ? 1
                : 0;


            const consecutivePenalty =
              previousRoundPairKeys.has(
                key
              )
                ? 1
                : 0;


            return (
              repeatedPenalty *
              repeatedPairWeight

              +

              consecutivePenalty *
              consecutiveWeight

              +

              historyCount
            );
          }
        );
      }
    );


  /*
    script.js既存のHungarian Algorithmを使用。
  */

  const assignment =
    solveMinimumCostAssignment(
      costMatrix
    );


  if (
    !assignment
    ||
    assignment.length !==
      pairCount
  ) {
    return null;
  }


  const pairs = [];


  let repeatedPairCount = 0;

  let consecutivePairCount = 0;

  let totalHistoryCount = 0;


  selectedLeaders.forEach(
    function (
      leader,
      leaderIndex
    ) {

      const followerIndex =
        assignment[
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


      const follower =
        selectedFollowers[
          followerIndex
        ];


      const historyCount =
        getPairHistoryCount(
          leader,
          follower
        );


      const key =
        getHistoryKey(
          leader,
          follower
        );


      if (
        historyCount > 0
      ) {
        repeatedPairCount++;
      }


      if (
        previousRoundPairKeys.has(
          key
        )
      ) {
        consecutivePairCount++;
      }


      totalHistoryCount +=
        historyCount;


      pairs.push({
        leader:
          leader,

        follower:
          follower
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

    repeatedPairCount:
      repeatedPairCount,

    consecutivePairCount:
      consecutivePairCount,

    totalHistoryCount:
      totalHistoryCount
  };
}


/* ========================================
   Round境界

   Pairは絶対に組み直さず、
   Battle順だけ変更する。
======================================== */

function moveBestBattleToFrontV37(
  battles,
  avoidIds
) {

  if (
    !Array.isArray(
      battles
    )
    ||
    battles.length === 0
  ) {
    return;
  }


  if (
    !avoidIds
    ||
    avoidIds.size === 0
  ) {
    return;
  }


  let minimumOverlap =
    Infinity;


  let bestIndexes =
    [];


  battles.forEach(
    function (
      battle,
      index
    ) {

      const overlap =
        getBattleDanceOverlapCount(
          battle,
          avoidIds
        );


      if (
        overlap <
        minimumOverlap
      ) {

        minimumOverlap =
          overlap;


        bestIndexes =
          [index];

      } else if (
        overlap ===
        minimumOverlap
      ) {

        bestIndexes.push(
          index
        );
      }
    }
  );


  if (
    bestIndexes.length === 0
  ) {
    return;
  }


  const selectedIndex =
    getRandomItem(
      bestIndexes
    );


  if (
    selectedIndex !== 0
  ) {

    [
      battles[0],
      battles[selectedIndex]
    ] = [
      battles[selectedIndex],
      battles[0]
    ];
  }
}


/* ========================================
   Judge v37
======================================== */

function selectJudgesForBattleV37(
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
    3人揃う場合は、
    Judge済みの人などを完全除外。

    足りない場合のみ再登板可。
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
   Timekeeper v37

   Battle単位。

   DanceでもJudgeでもない人を優先。

   他BattleでDanceしている人は
   Timekeeper候補になってよい。
======================================== */

function selectTimekeeperForBattleV37(
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


  /*
    通常はこちら。

    そのBattleで
    DanceにもJudgeにも入っていない人。
  */

  if (
    idleCandidates.length > 0
  ) {

    return selectFairTimekeeperV37(
      idleCandidates,
      usedTimekeeperIds
    );
  }


  /*
    候補が本当に0人の場合のみ
    Judgeと兼任。
  */

  if (
    battle.judges.length > 0
  ) {

    return selectFairTimekeeperV37(
      battle.judges,
      usedTimekeeperIds
    );
  }


  return null;
}


/* ========================================
   Timekeeper公平選定
======================================== */

function selectFairTimekeeperV37(
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
    同一RoundでまだTをしていない人を
    最優先。
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
    その中でT回数が少ない人。
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