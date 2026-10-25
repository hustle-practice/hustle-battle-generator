/* ========================================
   Hustle Battle Generator
   Face-to-Face Opponent Logic v42

   対面方式v38の
   「Pair完成後のBattle割当」だけを改善。

   変更しないもの
   ----------------------------------------
   ・Dance出場公平性
   ・Pair生成
   ・未成立Pair優先
   ・Pair履歴
   ・Judge
   ・Timekeeper
   ・Pickup方式

   改善内容
   ----------------------------------------
   完成したPairを2PairずつBattleへ分ける
   全組み合わせを比較する。

   優先順位：

   1. 前Round最後 → 次Round Battle1
      の連続参加人数を最小化

   2. Round全体で
      Leader / Followerの
      過去対戦履歴を最小化

   3. 再対戦が特定Battleへ
      集中しすぎないようにする

   4. Battle1自体の
      対戦履歴も少ない方を優先

   8PairならBattle分けは105通りなので
   総当たりでも十分軽量。
======================================== */


/* ========================================
   v38の元関数を退避
======================================== */

const createBattlesWithProtectedFirstV38OriginalV42 =
  createBattlesWithProtectedFirstV38;


/* ========================================
   v38のBattle生成関数を差し替え

   generateRoundV38() 自体は変更しない。

   そのためPickup v41から
   対面方式へ戻した場合も
   自動的にこのv42が使用される。
======================================== */

createBattlesWithProtectedFirstV38 =
  function (
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
      対面方式は1Battle = 2Pair。

      万一奇数Pairになった場合は
      v38の元処理へ戻す。
    */

    if (
      pairs.length % 2 !== 0
    ) {

      return (
        createBattlesWithProtectedFirstV38OriginalV42(
          pairs,
          previousFinalIds
        )
      );
    }


    /*
      通常運用では6～8Pair程度を想定。

      10Pairまでは全Battle分けを
      総当たりする。

      12Pair以上になると組み合わせ数が
      急増するため、その場合のみ
      v38へフォールバックする。

      これはスマホでの速度を守るため。
    */

    if (
      pairs.length > 10
    ) {

      return (
        createBattlesWithProtectedFirstV38OriginalV42(
          pairs,
          previousFinalIds
        )
      );
    }


    const battlePairings =
      createAllBattlePairingsV42(
        pairs
      );


    if (
      battlePairings.length === 0
    ) {

      return (
        createBattlesWithProtectedFirstV38OriginalV42(
          pairs,
          previousFinalIds
        )
      );
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
          !bestResult
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


    if (
      !bestResult
      ||
      !Array.isArray(
        bestResult.battles
      )
    ) {

      return (
        createBattlesWithProtectedFirstV38OriginalV42(
          pairs,
          previousFinalIds
        )
      );
    }


    return bestResult.battles;
  };


/* ========================================
   Pairを2PairずつBattleへ分ける
   全組み合わせを生成

   例：
   8Pair → 4Battle

   Battleの順番はここでは考えない。

   重複を避けるため、
   常に残りPairの先頭を1つ固定し、
   相手だけを順番に変える。
======================================== */

function createAllBattlePairingsV42(
  pairs
) {

  if (
    pairs.length === 0
  ) {

    return [
      []
    ];
  }


  if (
    pairs.length < 2
  ) {

    return [];
  }


  const firstPair =
    pairs[0];


  const results =
    [];


  for (
    let opponentIndex = 1;
    opponentIndex < pairs.length;
    opponentIndex++
  ) {

    const opponentPair =
      pairs[
        opponentIndex
      ];


    const remainingPairs =
      [];


    for (
      let i = 1;
      i < pairs.length;
      i++
    ) {

      if (
        i !== opponentIndex
      ) {

        remainingPairs.push(
          pairs[i]
        );
      }
    }


    const remainingPairings =
      createAllBattlePairingsV42(
        remainingPairs
      );


    remainingPairings.forEach(
      function (
        remainingBattles
      ) {

        results.push(
          [
            {
              pairA:
                firstPair,

              pairB:
                opponentPair,

              judges: [],

              timekeeper:
                null
            },

            ...remainingBattles
          ]
        );
      }
    );
  }


  return results;
}


/* ========================================
   1つのBattle分けを評価

   Battle1候補は、
   そのBattle分けに含まれる全Battleから
   最適なものを選ぶ。

   つまり、
   「最初のBattleだけ先に固定」
   はしない。
======================================== */

function evaluateBattlePairingV42(
  battles,
  previousFinalIds
) {

  let totalOpponentScore =
    0;


  let maximumOpponentScore =
    0;


  let repeatedBattleCount =
    0;


  const opponentScores =
    [];


  battles.forEach(
    function (
      battle
    ) {

      const score =
        getBattleOpponentScoreV42(
          battle.pairA,
          battle.pairB
        );


      opponentScores.push(
        score
      );


      totalOpponentScore +=
        score;


      maximumOpponentScore =
        Math.max(
          maximumOpponentScore,
          score
        );


      if (
        score > 0
      ) {

        repeatedBattleCount++;
      }
    }
  );


  /*
    このBattle分けの中で、
    Battle1にする最適なBattleを探す。

    まず前Round最終Battleとの
    Dance重複人数。

    同数なら、
    対戦履歴の少ないBattleを優先。
  */

  let bestFirstIndex =
    0;


  let bestBoundaryOverlap =
    Infinity;


  let bestFirstOpponentScore =
    Infinity;


  const firstBattleCandidates =
    [];


  battles.forEach(
    function (
      battle,
      index
    ) {

      const overlap =
        getBattleDanceOverlapV42(
          battle,
          previousFinalIds
        );


      const opponentScore =
        opponentScores[
          index
        ];


      if (
        overlap <
        bestBoundaryOverlap
      ) {

        bestBoundaryOverlap =
          overlap;


        bestFirstOpponentScore =
          opponentScore;


        firstBattleCandidates.length =
          0;


        firstBattleCandidates.push(
          index
        );

      } else if (
        overlap ===
        bestBoundaryOverlap
      ) {

        if (
          opponentScore <
          bestFirstOpponentScore
        ) {

          bestFirstOpponentScore =
            opponentScore;


          firstBattleCandidates.length =
            0;


          firstBattleCandidates.push(
            index
          );

        } else if (
          opponentScore ===
          bestFirstOpponentScore
        ) {

          firstBattleCandidates.push(
            index
          );
        }
      }
    }
  );


  if (
    firstBattleCandidates.length > 0
  ) {

    bestFirstIndex =
      firstBattleCandidates[
        Math.floor(
          Math.random()
          *
          firstBattleCandidates.length
        )
      ];
  }


  /*
    Battle1を先頭へ。

    残りBattleは、
    対戦履歴の少ないものを前へ置く。

    Danceは同一Round1回なので、
    Battle2以降の順番は
    Dance疲労には影響しない。
  */

  const firstBattle =
    battles[
      bestFirstIndex
    ];


  const remainingBattles =
    battles
      .filter(
        function (
          battle,
          index
        ) {

          return (
            index !==
            bestFirstIndex
          );
        }
      )
      .map(
        function (
          battle
        ) {

          return {

            battle:
              battle,

            score:
              getBattleOpponentScoreV42(
                battle.pairA,
                battle.pairB
              ),

            random:
              Math.random()
          };
        }
      )
      .sort(
        function (
          a,
          b
        ) {

          if (
            a.score !==
            b.score
          ) {

            return (
              a.score
              -
              b.score
            );
          }


          return (
            a.random
            -
            b.random
          );
        }
      )
      .map(
        function (
          item
        ) {

          return item.battle;
        }
      );


  return {

    battles:
      [
        firstBattle,
        ...remainingBattles
      ],


    /*
      v38で導入した
      Round境界回避を最優先。
    */

    boundaryOverlap:
      bestBoundaryOverlap,


    /*
      再対戦が存在するBattle数。

      例えば
      ・1Battleだけ再対戦あり
      ・3Battleで再対戦あり

      なら前者を優先。
    */

    repeatedBattleCount:
      repeatedBattleCount,


    /*
      Round全体の対戦履歴スコア。
    */

    totalOpponentScore:
      totalOpponentScore,


    /*
      最も悪いBattleのスコア。

      同じ合計なら、
      1Battleに再対戦が集中しない方を
      優先する補助評価。
    */

    maximumOpponentScore:
      maximumOpponentScore,


    /*
      Battle1自体の対戦履歴。
    */

    firstOpponentScore:
      bestFirstOpponentScore,


    randomTie:
      Math.random()
  };
}


/* ========================================
   Battle分け同士の比較

   優先順位：

   1. Round境界
   2. 再対戦が発生するBattle数
   3. Round全体の対戦履歴
   4. 最悪Battleの対戦履歴
   5. Battle1の対戦履歴
======================================== */

function compareBattlePairingResultV42(
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
    a.repeatedBattleCount !==
    b.repeatedBattleCount
  ) {

    return (
      a.repeatedBattleCount
      -
      b.repeatedBattleCount
    );
  }


  if (
    a.totalOpponentScore !==
    b.totalOpponentScore
  ) {

    return (
      a.totalOpponentScore
      -
      b.totalOpponentScore
    );
  }


  if (
    a.maximumOpponentScore !==
    b.maximumOpponentScore
  ) {

    return (
      a.maximumOpponentScore
      -
      b.maximumOpponentScore
    );
  }


  if (
    a.firstOpponentScore !==
    b.firstOpponentScore
  ) {

    return (
      a.firstOpponentScore
      -
      b.firstOpponentScore
    );
  }


  return (
    a.randomTie
    -
    b.randomTie
  );
}


/* ========================================
   対戦履歴スコア

   v38 / script.js側の
   getBattleOpponentScore() を利用。

   数値として取得できない場合だけ0。
======================================== */

function getBattleOpponentScoreV42(
  pairA,
  pairB
) {

  if (
    typeof getBattleOpponentScore !==
    "function"
  ) {

    return 0;
  }


  const score =
    Number(
      getBattleOpponentScore(
        pairA,
        pairB
      )
    );


  return (
    Number.isFinite(
      score
    )
      ? score
      : 0
  );
}


/* ========================================
   前Round最終BattleとのDance重複人数
======================================== */

function getBattleDanceOverlapV42(
  battle,
  previousFinalIds
) {

  if (
    !previousFinalIds
    ||
    previousFinalIds.size === 0
  ) {

    return 0;
  }


  const dancerIds = [
    battle.pairA.leader.id,
    battle.pairA.follower.id,
    battle.pairB.leader.id,
    battle.pairB.follower.id
  ];


  let overlap =
    0;


  dancerIds.forEach(
    function (
      id
    ) {

      if (
        previousFinalIds.has(
          String(
            id
          )
        )
      ) {

        overlap++;
      }
    }
  );


  return overlap;
}