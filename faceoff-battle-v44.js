/* ========================================
   Face-to-Face Battle Logic v44

   目的
   ----------------------------------------
   ・対面方式専用
   ・出場者選定は変更しない
   ・Pair生成は変更しない
   ・Judge / TK選定は変更しない
   ・Pair確定後のBattle組みだけ改善する

   評価優先順位
   ----------------------------------------
   1. 同Roleの再対戦人数を最小化
   2. 対戦履歴の合計回数を最小化
   3. 1組あたりの最大対戦回数を最小化
   4. 前Round最終Battle → 次Round Battle1
      の連続参加を最小化

   ※ Pairそのものはv38で決定済みなので、
      Pair履歴・Dance公平性には触れない。
======================================== */


/*
  v38本来の処理を退避。

  想定外のPair数やエラー時には、
  これまでのv38へ戻せるようにする。
*/
const createBattlesWithProtectedFirstV38OriginalV44 =
  createBattlesWithProtectedFirstV38;


/* ========================================
   Battle生成
======================================== */

createBattlesWithProtectedFirstV38 =
function (
  pairs,
  previousFinalIds
) {

  if (
    !Array.isArray(pairs) ||
    pairs.length < 2 ||
    pairs.length % 2 !== 0
  ) {

    return createBattlesWithProtectedFirstV38OriginalV44(
      pairs,
      previousFinalIds
    );
  }


  /*
    Pair数が非常に多い場合は
    全探索の組み合わせ数が急増する。

    現在の実運用では8Pair程度を想定しているため、
    10Pairを超えた場合だけ従来v38へ戻す。
  */
  if (
    pairs.length > 10
  ) {

    return createBattlesWithProtectedFirstV38OriginalV44(
      pairs,
      previousFinalIds
    );
  }


  const protectedIds =
    normalizePreviousFinalIdsV44(
      previousFinalIds
    );


  /*
    例：
    8Pairなら
    2Pair × 4Battle
    の全組み合わせ105通りを作る。
  */
  const allBattlePatterns =
    createAllBattlePatternsV44(
      pairs
    );


  if (
    allBattlePatterns.length === 0
  ) {

    return createBattlesWithProtectedFirstV38OriginalV44(
      pairs,
      previousFinalIds
    );
  }


  let bestEvaluation =
    null;

  let bestPatterns =
    [];


  allBattlePatterns.forEach(
    function (battles) {

      const evaluation =
        evaluateBattlePatternV44(
          battles
        );


      if (
        bestEvaluation === null ||
        compareBattleEvaluationV44(
          evaluation,
          bestEvaluation
        ) < 0
      ) {

        bestEvaluation =
          evaluation;

        bestPatterns =
          [
            battles
          ];

      } else if (
        compareBattleEvaluationV44(
          evaluation,
          bestEvaluation
        ) === 0
      ) {

        bestPatterns.push(
          battles
        );
      }

    }
  );


  /*
    対戦履歴として完全に同等の候補が複数ある場合のみ、
    Round境界を比較する。
  */
  let bestBoundaryOverlap =
    Infinity;

  let boundaryCandidates =
    [];


  bestPatterns.forEach(
    function (battles) {

      const ordered =
        chooseBestFirstBattleV44(
          battles,
          protectedIds
        );


      if (
        ordered.boundaryOverlap <
        bestBoundaryOverlap
      ) {

        bestBoundaryOverlap =
          ordered.boundaryOverlap;

        boundaryCandidates =
          [
            ordered.battles
          ];

      } else if (
        ordered.boundaryOverlap ===
        bestBoundaryOverlap
      ) {

        boundaryCandidates.push(
          ordered.battles
        );
      }

    }
  );


  if (
    boundaryCandidates.length === 0
  ) {

    return createBattlesWithProtectedFirstV38OriginalV44(
      pairs,
      previousFinalIds
    );
  }


  /*
    すべての評価が同一ならランダム。

    これにより毎回まったく同じBattle構成へ
    固定されるのを防ぐ。
  */
  return getRandomItem(
    boundaryCandidates
  );
};


/* ========================================
   全Battle組み合わせ生成
======================================== */

function createAllBattlePatternsV44(
  pairs
) {

  if (
    pairs.length === 0
  ) {

    return [
      []
    ];
  }


  const firstPair =
    pairs[0];

  const results =
    [];


  for (
    let i = 1;
    i < pairs.length;
    i++
  ) {

    const secondPair =
      pairs[i];


    const remainingPairs =
      pairs.filter(
        function (
          pair,
          index
        ) {

          return (
            index !== 0 &&
            index !== i
          );
        }
      );


    const remainingPatterns =
      createAllBattlePatternsV44(
        remainingPairs
      );


    remainingPatterns.forEach(
      function (pattern) {

        results.push(
          [
            {
              pairA:
                firstPair,

              pairB:
                secondPair,

              judges:
                [],

              timekeeper:
                null
            },

            ...pattern
          ]
        );

      }
    );
  }


  return results;
}


/* ========================================
   Round全体評価
======================================== */

function evaluateBattlePatternV44(
  battles
) {

  let repeatedRoleCount =
    0;

  let totalOpponentHistory =
    0;

  let maximumOpponentHistory =
    0;


  battles.forEach(
    function (battle) {

      const leaderHistory =
        getOpponentHistoryCount(
          leaderOpponentHistory,
          battle.pairA.leader,
          battle.pairB.leader
        );


      const followerHistory =
        getOpponentHistoryCount(
          followerOpponentHistory,
          battle.pairA.follower,
          battle.pairB.follower
        );


      /*
        Leader再戦1件、
        Follower再戦1件を
        それぞれ別に数える。
      */
      if (
        leaderHistory > 0
      ) {

        repeatedRoleCount++;
      }


      if (
        followerHistory > 0
      ) {

        repeatedRoleCount++;
      }


      totalOpponentHistory +=
        leaderHistory +
        followerHistory;


      maximumOpponentHistory =
        Math.max(
          maximumOpponentHistory,
          leaderHistory,
          followerHistory
        );

    }
  );


  return {

    repeatedRoleCount:
      repeatedRoleCount,

    totalOpponentHistory:
      totalOpponentHistory,

    maximumOpponentHistory:
      maximumOpponentHistory

  };
}


/* ========================================
   Battle評価比較
======================================== */

function compareBattleEvaluationV44(
  a,
  b
) {

  /*
    最優先：
    再対戦そのものの件数。

    未対戦相手が存在するなら、
    まず再戦を作らない。
  */
  if (
    a.repeatedRoleCount !==
    b.repeatedRoleCount
  ) {

    return (
      a.repeatedRoleCount -
      b.repeatedRoleCount
    );
  }


  /*
    再戦件数が同じなら、
    過去対戦回数の合計が少ない方。
  */
  if (
    a.totalOpponentHistory !==
    b.totalOpponentHistory
  ) {

    return (
      a.totalOpponentHistory -
      b.totalOpponentHistory
    );
  }


  /*
    合計も同じなら、
    特定相手への集中を避ける。
  */
  if (
    a.maximumOpponentHistory !==
    b.maximumOpponentHistory
  ) {

    return (
      a.maximumOpponentHistory -
      b.maximumOpponentHistory
    );
  }


  return 0;
}


/* ========================================
   Battle1選定
======================================== */

function chooseBestFirstBattleV44(
  battles,
  previousFinalIds
) {

  if (
    battles.length <= 1
  ) {

    return {

      battles:
        [...battles],

      boundaryOverlap:
        battles.length === 1
          ? getPreviousRoundOverlapV44(
              battles[0],
              previousFinalIds
            )
          : 0

    };
  }


  let minimumOverlap =
    Infinity;

  let candidates =
    [];


  battles.forEach(
    function (
      battle,
      index
    ) {

      const overlap =
        getPreviousRoundOverlapV44(
          battle,
          previousFinalIds
        );


      if (
        overlap <
        minimumOverlap
      ) {

        minimumOverlap =
          overlap;

        candidates =
          [
            {
              battle:
                battle,

              index:
                index
            }
          ];

      } else if (
        overlap ===
        minimumOverlap
      ) {

        candidates.push(
          {
            battle:
              battle,

            index:
              index
          }
        );
      }

    }
  );


  /*
    Round境界も同じなら、
    Battle1自身の対戦履歴が少ない方を優先。
  */
  let minimumFirstOpponentHistory =
    Infinity;

  let firstCandidates =
    [];


  candidates.forEach(
    function (candidate) {

      const history =
        getSingleBattleHistoryV44(
          candidate.battle
        );


      if (
        history <
        minimumFirstOpponentHistory
      ) {

        minimumFirstOpponentHistory =
          history;

        firstCandidates =
          [
            candidate
          ];

      } else if (
        history ===
        minimumFirstOpponentHistory
      ) {

        firstCandidates.push(
          candidate
        );
      }

    }
  );


  const selected =
    getRandomItem(
      firstCandidates
    );


  const remaining =
    battles.filter(
      function (
        battle,
        index
      ) {

        return (
          index !==
          selected.index
        );
      }
    );


  /*
    Battle2以降は評価上同等なので、
    固定化を避けるためランダム。
  */
  const shuffledRemaining =
    typeof shuffleArray ===
    "function"
      ? shuffleArray(
          remaining
        )
      : remaining;


  return {

    battles:
      [
        selected.battle,
        ...shuffledRemaining
      ],

    boundaryOverlap:
      minimumOverlap

  };
}


/* ========================================
   1Battleの履歴合計
======================================== */

function getSingleBattleHistoryV44(
  battle
) {

  const leaderHistory =
    getOpponentHistoryCount(
      leaderOpponentHistory,
      battle.pairA.leader,
      battle.pairB.leader
    );


  const followerHistory =
    getOpponentHistoryCount(
      followerOpponentHistory,
      battle.pairA.follower,
      battle.pairB.follower
    );


  return (
    leaderHistory +
    followerHistory
  );
}


/* ========================================
   前Round最終Battleとの重複
======================================== */

function getPreviousRoundOverlapV44(
  battle,
  previousFinalIds
) {

  if (
    !previousFinalIds ||
    previousFinalIds.size === 0
  ) {

    return 0;
  }


  const dancerIds =
    [
      battle.pairA.leader.id,
      battle.pairA.follower.id,
      battle.pairB.leader.id,
      battle.pairB.follower.id
    ];


  let overlap =
    0;


  dancerIds.forEach(
    function (id) {

      if (
        previousFinalIds.has(
          String(id)
        )
      ) {

        overlap++;
      }

    }
  );


  return overlap;
}


/* ========================================
   前Round ID正規化
======================================== */

function normalizePreviousFinalIdsV44(
  previousFinalIds
) {

  let source =
    previousFinalIds;


  /*
    v38側から渡されなかった場合のみ、
    既存の取得関数を使用。
  */
  if (
    !source &&
    typeof getPreviousFinalBattleParticipantIds ===
      "function"
  ) {

    source =
      getPreviousFinalBattleParticipantIds();
  }


  if (
    source instanceof Set
  ) {

    return new Set(
      Array.from(source).map(
        function (id) {

          return String(id);
        }
      )
    );
  }


  if (
    Array.isArray(source)
  ) {

    return new Set(
      source.map(
        function (id) {

          return String(id);
        }
      )
    );
  }


  return new Set();
}