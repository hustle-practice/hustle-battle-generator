/* ========================================
   Hustle Battle Generator
   Face-to-Face Pair Logic v43

   対面方式のPair生成を改善。

   v42：
   完成したPairをどのBattleにするかを全体評価

   v43：
   Pairを決める段階から複数候補を残し、
   v42でBattleまで組んだ結果を先読みして
   最終Pair構成を選ぶ。

   変更しないもの
   ----------------------------------------
   ・Dance出場者選定
   ・Dance公平性
   ・Judge
   ・Timekeeper
   ・Pair履歴そのもの
   ・Round境界回避
   ・Pickup方式

   Pair構成の優先順位
   ----------------------------------------
   1. 成立済Pair数を最小化
   2. Pair履歴合計を最小化
   3. Pair履歴最大値を最小化
   4. 前Round最後→次Round最初を最小化
   5. 同Role再対戦Battle数を最小化
   6. 同Role対戦履歴合計を最小化

   Pair履歴を犠牲にしてまで
   対戦相手を変更する仕様にはしない。
======================================== */


/* ========================================
   元のPair生成を退避
======================================== */

const createFairPairsOriginalV43 =
  createFairPairs;


/* ========================================
   Pair生成をv43へ差し替え
======================================== */

createFairPairs =
  function (
    leaders,
    followers
  ) {

    /*
      通常は同数だが、
      想定外の状態では既存ロジックへ戻す。
    */

    if (
      !Array.isArray(
        leaders
      )
      ||
      !Array.isArray(
        followers
      )
      ||
      leaders.length === 0
      ||
      leaders.length !==
        followers.length
    ) {

      return (
        createFairPairsOriginalV43(
          leaders,
          followers
        )
      );
    }


    /*
      v42の評価関数が存在しない場合も
      元ロジックへ戻す。
    */

    if (
      typeof createAllBattlePairingsV42 !==
        "function"
      ||
      typeof evaluateBattlePairingV42 !==
        "function"
      ||
      typeof compareBattlePairingResultV42 !==
        "function"
    ) {

      return (
        createFairPairsOriginalV43(
          leaders,
          followers
        )
      );
    }


    const orderedLeaders =
      sortByDanceCount(
        leaders
      );


    /*
      Pair候補をBeam Search。

      8Pairの場合でも全8!を調べず、
      良い候補を最大240通り残す。

      Pair履歴条件を最優先しながら
      ランダム性も残す。
    */

    const PAIR_BEAM_WIDTH =
      240;


    let states = [
      {
        pairs: [],

        availableFollowers:
          [...followers],

        repeatedPairCount:
          0,

        pairHistoryTotal:
          0,

        maximumPairHistory:
          0,

        randomTie:
          Math.random()
      }
    ];


    orderedLeaders.forEach(
      function (
        leader
      ) {

        const expandedStates =
          [];


        states.forEach(
          function (
            state
          ) {

            state.availableFollowers.forEach(
              function (
                follower
              ) {

                const historyCount =
                  getPairHistoryCount(
                    leader,
                    follower
                  );


                const remainingFollowers =
                  state.availableFollowers.filter(
                    function (
                      candidate
                    ) {

                      return (
                        String(
                          candidate.id
                        )
                        !==
                        String(
                          follower.id
                        )
                      );
                    }
                  );


                expandedStates.push(
                  {
                    pairs:
                      [
                        ...state.pairs,
                        {
                          leader:
                            leader,

                          follower:
                            follower
                        }
                      ],

                    availableFollowers:
                      remainingFollowers,

                    repeatedPairCount:
                      state.repeatedPairCount
                      +
                      (
                        historyCount > 0
                          ? 1
                          : 0
                      ),

                    pairHistoryTotal:
                      state.pairHistoryTotal
                      +
                      historyCount,

                    maximumPairHistory:
                      Math.max(
                        state.maximumPairHistory,
                        historyCount
                      ),

                    randomTie:
                      Math.random()
                  }
                );
              }
            );
          }
        );


        expandedStates.sort(
          comparePartialPairStateV43
        );


        states =
          expandedStates.slice(
            0,
            PAIR_BEAM_WIDTH
          );
      }
    );


    if (
      states.length === 0
    ) {

      return (
        createFairPairsOriginalV43(
          leaders,
          followers
        )
      );
    }


    /*
      Pair履歴が最良の候補だけを残す。

      ここでPair履歴条件を固定してから、
      同Role対戦履歴を評価する。

      → Pair公平性を壊さないため。
    */

    states.sort(
      comparePairHistoryOnlyV43
    );


    const bestPairHistoryState =
      states[0];


    const pairHistoryEquivalentStates =
      states.filter(
        function (
          state
        ) {

          return (
            state.repeatedPairCount ===
              bestPairHistoryState.repeatedPairCount
            &&
            state.pairHistoryTotal ===
              bestPairHistoryState.pairHistoryTotal
            &&
            state.maximumPairHistory ===
              bestPairHistoryState.maximumPairHistory
          );
        }
      );


    /*
      前Round最後Battle情報。
    */

    let previousFinalIds =
      new Set();


    if (
      typeof getPreviousFinalBattleParticipantIds ===
      "function"
    ) {

      const ids =
        getPreviousFinalBattleParticipantIds();


      if (
        ids instanceof Set
      ) {

        previousFinalIds =
          ids;
      }
    }


    /*
      Pair履歴条件が同じ候補について、
      v42でBattleまで実際に組んだ場合の
      最良結果を比較する。
    */

    let bestState =
      null;


    let bestBattleResult =
      null;


    pairHistoryEquivalentStates.forEach(
      function (
        state
      ) {

        const battleResult =
          getBestBattleResultForPairStateV43(
            state.pairs,
            previousFinalIds
          );


        if (
          !battleResult
        ) {

          return;
        }


        if (
          bestBattleResult === null
          ||
          compareBattlePairingResultV42(
            battleResult,
            bestBattleResult
          ) < 0
        ) {

          bestState =
            state;


          bestBattleResult =
            battleResult;
        }
      }
    );


    if (
      bestState
    ) {

      return (
        bestState.pairs
      );
    }


    /*
      Battle先読みができなかった場合も
      Pair履歴最良候補を使用。
    */

    return (
      bestPairHistoryState.pairs
    );
  };


/* ========================================
   Beam Search途中比較

   Pair履歴だけを見る。
======================================== */

function comparePartialPairStateV43(
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
    a.pairHistoryTotal !==
    b.pairHistoryTotal
  ) {

    return (
      a.pairHistoryTotal
      -
      b.pairHistoryTotal
    );
  }


  if (
    a.maximumPairHistory !==
    b.maximumPairHistory
  ) {

    return (
      a.maximumPairHistory
      -
      b.maximumPairHistory
    );
  }


  return (
    a.randomTie
    -
    b.randomTie
  );
}


/* ========================================
   完成Pair構成のPair履歴比較
======================================== */

function comparePairHistoryOnlyV43(
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
    a.pairHistoryTotal !==
    b.pairHistoryTotal
  ) {

    return (
      a.pairHistoryTotal
      -
      b.pairHistoryTotal
    );
  }


  if (
    a.maximumPairHistory !==
    b.maximumPairHistory
  ) {

    return (
      a.maximumPairHistory
      -
      b.maximumPairHistory
    );
  }


  return (
    a.randomTie
    -
    b.randomTie
  );
}


/* ========================================
   1つのPair構成に対して
   v42の全Battle分けを評価
======================================== */

function getBestBattleResultForPairStateV43(
  pairs,
  previousFinalIds
) {

  if (
    !Array.isArray(
      pairs
    )
    ||
    pairs.length < 2
    ||
    pairs.length % 2 !== 0
  ) {

    return null;
  }


  /*
    v42と同じく、
    大人数時の組み合わせ爆発を防ぐ。
  */

  if (
    pairs.length > 10
  ) {

    return null;
  }


  const battlePairings =
    createAllBattlePairingsV42(
      pairs
    );


  if (
    !Array.isArray(
      battlePairings
    )
    ||
    battlePairings.length === 0
  ) {

    return null;
  }


  let bestResult =
    null;


  battlePairings.forEach(
    function (
      pairing
    ) {

      const result =
        evaluateBattlePairingV42(
          pairing,
          previousFinalIds
        );


      if (
        bestResult === null
        ||
        compareBattlePairingResultV42(
          result,
          bestResult
        ) < 0
      ) {

        bestResult =
          result;
      }
    }
  );


  return bestResult;
}