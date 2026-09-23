/* ========================================
   Hustle Battle Generator
   Round Logic v35

   改善点

   1. 出場者選定とPair選定を一体化
   2. 未経験Pairを強く優先
   3. 直前Roundの同一Pairを強く回避
   4. TimekeeperをBattle単位で選出
   5. そのBattleのDance / Judge以外を最優先
   6. 同一Round内のTimekeeper重複を回避
======================================== */


/* ========================================
   v34 Generate Roundをv35へ差し替え
======================================== */

generateRoundButton.removeEventListener(
  "click",
  generateRound
);

generateRoundButton.addEventListener(
  "click",
  generateRoundV35
);


/* ========================================
   Round生成 v35
======================================== */

async function generateRoundV35() {
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
          participant.active !== false &&
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
     v35
     出場者＋Pairを同時最適化
  ====================================== */

  const optimizedPairs =
    createOptimizedPairsV35(
      leaders,
      followers,
      usablePairCount,
      previousRoundPairKeys
    );


  if (
    optimizedPairs.length !==
    usablePairCount
  ) {
    alert(
      "Pairを正常に作成できませんでした。"
    );

    return;
  }


  const selectedLeaders =
    optimizedPairs.map(
      function (pair) {
        return pair.leader;
      }
    );


  const selectedFollowers =
    optimizedPairs.map(
      function (pair) {
        return pair.follower;
      }
    );


  /* =====================================
     Battle生成
  ====================================== */

  let battles =
    createFairBattles(
      optimizedPairs
    );


  /*
    まずはPairを変更せず、
    Battle順の入替だけで
    前Round最終Battleとの連続を避ける。
  */

  const couldAvoidByReordering =
    moveZeroOverlapBattleToFront(
      battles,
      previousFinalBattleParticipantIds
    );


  /*
    Battle順だけで回避できない場合のみ
    Battle1を再構成。
  */

  if (!couldAvoidByReordering) {

    battles =
      createRoundBattlesWithProtectedFirstBattle(
        selectedLeaders,
        selectedFollowers,
        previousFinalBattleParticipantIds,
        previousRoundPairKeys
      );
  }


  /* =====================================
     Dance回数・Pair履歴
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

     v34の改善を継続。

     ・Battle1では前Round最終担当者を回避
     ・同じRoundですでにJudgeをした人を回避
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
        前Round最終Battleとの連続を
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
        同一RoundですでにJudgeをした人を
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
        selectJudgesForBattleV35(
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
     v35 Timekeeper

     ★重要★

     Round全体の未出場者ではなく、
     各Battle単位で判定。

     優先順位

     1. そのBattleのDanceではない
     2. そのBattleのJudgeではない
     3. 同RoundでまだTをしていない
     4. T回数が少ない

     候補が0人の場合のみJudge兼任。
  ====================================== */

  const roundTimekeeperUsedIds =
    new Set();


  battles.forEach(
    function (battle) {

      const timekeeper =
        selectTimekeeperForBattleV35(
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
     Round全体のDance未出場者
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
   Pair最適化 v35

   出場者を先に完全固定せず、
   Leader / Followerの選出とPairを
   同時に評価する。

   優先順位

   1. Dance出場回数の公平性
   2. 未経験Pair
   3. 直前Round同一Pair回避
   4. Pair回数
======================================== */

function createOptimizedPairsV35(
  leaders,
  followers,
  requiredPairCount,
  previousRoundPairKeys
) {

  if (
    requiredPairCount <= 0
  ) {
    return [];
  }


  if (
    leaders.length <
      requiredPairCount ||
    followers.length <
      requiredPairCount
  ) {
    return [];
  }


  let maximumPairHistory = 0;


  leaders.forEach(
    function (leader) {

      followers.forEach(
        function (follower) {

          maximumPairHistory =
            Math.max(
              maximumPairHistory,

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
    Pair履歴回数より
    直前Round重複を強く評価。
  */

  const consecutiveWeight =
    (
      requiredPairCount *
      (
        maximumPairHistory + 1
      )
    ) + 1;


  /*
    「組んだことがある」
    ペナルティ。

    未経験Pairを最優先する。
  */

  const repeatedPairWeight =
    (
      requiredPairCount *
      consecutiveWeight
    )
    +
    (
      requiredPairCount *
      (
        maximumPairHistory + 1
      )
    )
    + 1;


  /*
    Dance公平性を最優先するため、
    Pair関連の最大コストより
    大きな重みを設定。
  */

  const maximumPairCost =
    repeatedPairWeight
    +
    consecutiveWeight
    +
    maximumPairHistory
    + 1;


  const fairnessWeight =
    (
      requiredPairCount *
      maximumPairCost
    ) + 1;


  /* =====================================
     Min-Cost Flow
  ====================================== */

  const source = 0;

  const leaderStart = 1;

  const followerStart =
    leaderStart +
    leaders.length;

  const sink =
    followerStart +
    followers.length;

  const nodeCount =
    sink + 1;


  const graph =
    Array.from(
      {
        length:
          nodeCount
      },

      function () {
        return [];
      }
    );


  /* =====================================
     Source → Leader
  ====================================== */

  leaders.forEach(
    function (
      leader,
      leaderIndex
    ) {

      const fairnessCost =
        getDanceFairCount(
          leader
        )
        *
        fairnessWeight;


      addFlowEdgeV35(
        graph,

        source,

        leaderStart +
          leaderIndex,

        1,

        fairnessCost,

        {
          type:
            "leader",

          participant:
            leader
        }
      );
    }
  );


  /* =====================================
     Leader → Follower
  ====================================== */

  leaders.forEach(
    function (
      leader,
      leaderIndex
    ) {

      followers.forEach(
        function (
          follower,
          followerIndex
        ) {

          const historyCount =
            getPairHistoryCount(
              leader,
              follower
            );


          const historyKey =
            getHistoryKey(
              leader,
              follower
            );


          const repeatedPenalty =
            historyCount > 0
              ? repeatedPairWeight
              : 0;


          const consecutivePenalty =
            previousRoundPairKeys.has(
              historyKey
            )
              ? consecutiveWeight
              : 0;


          const randomTie =
            Math.random() *
            0.000001;


          const pairCost =
            repeatedPenalty
            +
            consecutivePenalty
            +
            historyCount
            +
            randomTie;


          addFlowEdgeV35(
            graph,

            leaderStart +
              leaderIndex,

            followerStart +
              followerIndex,

            1,

            pairCost,

            {
              type:
                "pair",

              leader:
                leader,

              follower:
                follower
            }
          );
        }
      );
    }
  );


  /* =====================================
     Follower → Sink
  ====================================== */

  followers.forEach(
    function (
      follower,
      followerIndex
    ) {

      const fairnessCost =
        getDanceFairCount(
          follower
        )
        *
        fairnessWeight;


      addFlowEdgeV35(
        graph,

        followerStart +
          followerIndex,

        sink,

        1,

        fairnessCost,

        {
          type:
            "follower",

          participant:
            follower
        }
      );
    }
  );


  const result =
    runMinCostFlowV35(
      graph,
      source,
      sink,
      requiredPairCount
    );


  if (
    result.flow !==
    requiredPairCount
  ) {
    return [];
  }


  const pairs = [];


  leaders.forEach(
    function (
      leader,
      leaderIndex
    ) {

      const node =
        leaderStart +
        leaderIndex;


      graph[node].forEach(
        function (edge) {

          if (
            !edge.meta ||
            edge.meta.type !==
              "pair"
          ) {
            return;
          }


          if (
            edge.originalCapacity === 1 &&
            edge.capacity === 0
          ) {

            pairs.push({
              leader:
                edge.meta.leader,

              follower:
                edge.meta.follower
            });
          }
        }
      );
    }
  );


  return pairs;
}


/* ========================================
   Min-Cost Flow Edge
======================================== */

function addFlowEdgeV35(
  graph,
  from,
  to,
  capacity,
  cost,
  meta = null
) {

  const forward = {

    to: to,

    reverseIndex:
      graph[to].length,

    capacity:
      capacity,

    originalCapacity:
      capacity,

    cost:
      cost,

    meta:
      meta
  };


  const reverse = {

    to: from,

    reverseIndex:
      graph[from].length,

    capacity: 0,

    originalCapacity: 0,

    cost:
      -cost,

    meta: null
  };


  graph[from].push(
    forward
  );


  graph[to].push(
    reverse
  );
}


/* ========================================
   Min-Cost Flow実行
======================================== */

function runMinCostFlowV35(
  graph,
  source,
  sink,
  requiredFlow
) {

  let flow = 0;

  let totalCost = 0;


  const nodeCount =
    graph.length;


  while (
    flow <
    requiredFlow
  ) {

    const distance =
      new Array(
        nodeCount
      ).fill(
        Infinity
      );


    const previousNode =
      new Array(
        nodeCount
      ).fill(
        -1
      );


    const previousEdge =
      new Array(
        nodeCount
      ).fill(
        -1
      );


    distance[source] = 0;


    for (
      let iteration = 0;
      iteration <
        nodeCount - 1;
      iteration++
    ) {

      let updated =
        false;


      for (
        let from = 0;
        from < nodeCount;
        from++
      ) {

        if (
          distance[from] ===
          Infinity
        ) {
          continue;
        }


        graph[from].forEach(
          function (
            edge,
            edgeIndex
          ) {

            if (
              edge.capacity <= 0
            ) {
              return;
            }


            const nextDistance =
              distance[from] +
              edge.cost;


            if (
              nextDistance <
              distance[
                edge.to
              ]
            ) {

              distance[
                edge.to
              ] =
                nextDistance;


              previousNode[
                edge.to
              ] =
                from;


              previousEdge[
                edge.to
              ] =
                edgeIndex;


              updated =
                true;
            }
          }
        );
      }


      if (!updated) {
        break;
      }
    }


    if (
      distance[sink] ===
      Infinity
    ) {
      break;
    }


    let addFlow =
      requiredFlow -
      flow;


    let node =
      sink;


    while (
      node !== source
    ) {

      const from =
        previousNode[node];


      const edgeIndex =
        previousEdge[node];


      if (
        from < 0 ||
        edgeIndex < 0
      ) {

        addFlow = 0;

        break;
      }


      const edge =
        graph[from][
          edgeIndex
        ];


      addFlow =
        Math.min(
          addFlow,
          edge.capacity
        );


      node =
        from;
    }


    if (
      addFlow <= 0
    ) {
      break;
    }


    node =
      sink;


    while (
      node !== source
    ) {

      const from =
        previousNode[node];


      const edgeIndex =
        previousEdge[node];


      const edge =
        graph[from][
          edgeIndex
        ];


      edge.capacity -=
        addFlow;


      graph[
        edge.to
      ][
        edge.reverseIndex
      ].capacity +=
        addFlow;


      node =
        from;
    }


    flow +=
      addFlow;


    totalCost +=
      distance[sink] *
      addFlow;
  }


  return {

    flow:
      flow,

    cost:
      totalCost
  };
}


/* ========================================
   Judge選定 v35

   基本はv34と同じ。

   ・そのBattleのDance参加者は除外
   ・同一Round Judge重複を回避
======================================== */

function selectJudgesForBattleV35(
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
    回避対象を除いても必要人数が揃うなら、
    Judge経験済みの人などは完全に外す。

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
        bestScore === null ||
        compareJudgeScores(
          score,
          bestScore
        ) < 0
      ) {

        bestScore =
          score;


        bestCombinations =
          [
            combination
          ];

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
   Timekeeper v35

   ★Battle単位で判定★

   第1候補：
   ・そのBattleのDanceではない
   ・そのBattleのJudgeではない

   第2条件：
   ・同一RoundでまだTをしていない

   第3条件：
   ・T回数が少ない

   候補がいない場合のみJudge兼任。
======================================== */

function selectTimekeeperForBattleV35(
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

    他BattleでDanceする人でもOK。
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


  /*
    通常はこちら。

    15人なら、
    Dance4 + Judge3 = 7人を除いた
    最大8人が候補になる。
  */

  if (
    idleCandidates.length > 0
  ) {

    return selectFairTimekeeperV35(
      idleCandidates,
      usedTimekeeperIds
    );
  }


  /*
    Dance・Judge以外が1人もいない場合のみ
    Judgeから兼任。

    小人数の場合のフォールバック。
  */

  if (
    battle.judges.length > 0
  ) {

    return selectFairTimekeeperV35(
      battle.judges,
      usedTimekeeperIds
    );
  }


  return null;
}


/* ========================================
   Timekeeper公平選定
======================================== */

function selectFairTimekeeperV35(
  candidates,
  usedTimekeeperIds
) {

  if (
    !candidates ||
    candidates.length === 0
  ) {
    return null;
  }


  /*
    同一RoundでまだTimekeeperをしていない人を
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
    T回数が少ない人を優先。
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