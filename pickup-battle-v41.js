
/* ========================================
   Hustle Battle Generator
   Pickup Battle v41

   v40の表示・保存・Judge・Timekeeper等は
   そのまま利用し、
   重いRound生成部分のみ差し替える。

   優先順位（v41の評価調整）
   ----------------------------------------
   1. 前Round未出場者を次Roundで最低1回
   2. Dance参加者の未出場をできるだけ減らす
   3. Round全体のDance公平性の最大差を抑える
   4. 同一Round同Pair回避
   5. 未成立Pair優先
   6. 成立済Pairなら履歴回数が少ない
   7. Dance公平性の細かな偏差を調整
   8. 前Round最後→次Round最初を最小化
   9. 同一Round内連続Danceを最小化
   10. Judge / Timekeeper公平性
======================================== */


/* ========================================
   Pickup再探索の診断情報
   生成方式や探索結果の判定には使用しない。
======================================== */
let pickupRecoveryDiagnosticV41 = null;


/* ========================================
   v40 Generateイベントを解除し、
   v41へ切替
======================================== */

generateRoundButton.removeEventListener(
  "click",
  generateRoundByFormatV40
);

generateRoundButton.addEventListener(
  "click",
  generateRoundByFormatV41
);


async function generateRoundByFormatV41() {

  const format =
    battleFormatSelect
      ? battleFormatSelect.value
      : "faceToFace";


  if (
    format === "pickup"
  ) {

    await generatePickupRoundV41();

  } else {

    await generateRoundV38();
  }
}


/* ========================================
   Pickup Round生成 v41
======================================== */

async function generatePickupRoundV41() {

  pickupRecoveryDiagnosticV41 = null;

  if (
    !isCurrentUserAdmin
  ) {
    return;
  }


  const pairCount =
    Number(
      pickupPairCountSelect.value
    );


  if (
    ![2, 3, 4, 5].includes(
      pairCount
    )
  ) {

    alert(
      "同時に踊るPair数を選択してください。"
    );

    return;
  }


  const activeDanceParticipants =
    participants.filter(
      function (
        participant
      ) {

        return (
          participant.active !== false
          &&
          getParticipationType(
            participant
          ) === "dance"
        );
      }
    );


  const requiredDancers =
    pairCount * 2;


  if (
    activeDanceParticipants.length <
    requiredDancers
  ) {

    alert(
      "この設定では1Battleに "
      +
      requiredDancers
      +
      "人必要です。\n\n"
      +
      "現在のDance参加者："
      +
      activeDanceParticipants.length
      +
      "人"
    );

    return;
  }


  const possibleLeaders =
    activeDanceParticipants.filter(
      canLeadV40
    );


  const possibleFollowers =
    activeDanceParticipants.filter(
      canFollowV40
    );


  if (
    possibleLeaders.length <
    pairCount
  ) {

    alert(
      "Leaderとして踊れる人が不足しています。\n\n"
      +
      "必要："
      +
      pairCount
      +
      "人\n"
      +
      "現在："
      +
      possibleLeaders.length
      +
      "人"
    );

    return;
  }


  if (
    possibleFollowers.length <
    pairCount
  ) {

    alert(
      "Followerとして踊れる人が不足しています。\n\n"
      +
      "必要："
      +
      pairCount
      +
      "人\n"
      +
      "現在："
      +
      possibleFollowers.length
      +
      "人"
    );

    return;
  }


  const battleNumber =
    calculatePickupBattleCountV40(
      activeDanceParticipants,
      pairCount
    );


  const previousFinalIds =
    getPreviousFinalBattleParticipantIds();


  const previousRoundPairKeys =
    getPreviousRoundPairKeys();


  const previousWaitingIds =
    getPreviousWaitingIdsV40();


  const pairMetricCache =
    buildPickupPairMetricCacheV40(
      activeDanceParticipants,
      previousRoundPairKeys
    );


  const schedule =
    createPickupScheduleV41(
      activeDanceParticipants,
      pairCount,
      battleNumber,
      previousFinalIds,
      previousRoundPairKeys,
      previousWaitingIds,
      pairMetricCache
    );


  if (
    !schedule
    ||
    schedule.length !==
      battleNumber
  ) {

    alert(
      "この人数・Role構成ではPickup Battleを作成できませんでした。\n"
      +
      "Pair数を減らすか、Role構成を確認してください。"
    );

    return;
  }


  /* =====================================
     Dance / Pair履歴
  ====================================== */

  const roundDanceCounts =
    new Map();


  activeDanceParticipants.forEach(
    function (
      participant
    ) {

      roundDanceCounts.set(
        String(
          participant.id
        ),
        0
      );
    }
  );


  schedule.forEach(
    function (
      battle
    ) {

      battle.pairs.forEach(
        function (
          pair
        ) {

          const leaderId =
            String(
              pair.leader.id
            );


          const followerId =
            String(
              pair.follower.id
            );


          roundDanceCounts.set(
            leaderId,
            (
              roundDanceCounts.get(
                leaderId
              ) || 0
            ) + 1
          );


          roundDanceCounts.set(
            followerId,
            (
              roundDanceCounts.get(
                followerId
              ) || 0
            ) + 1
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
    }
  );


  /* =====================================
     Judge
  ====================================== */

  const roundJudgeUsedIds =
    new Set();


  schedule.forEach(
    function (
      battle,
      battleIndex
    ) {

      const avoidIds =
        new Set();


      if (
        battleIndex === 0
      ) {

        previousFinalIds.forEach(
          function (
            id
          ) {

            avoidIds.add(
              String(
                id
              )
            );
          }
        );
      }


      roundJudgeUsedIds.forEach(
        function (
          id
        ) {

          avoidIds.add(
            String(
              id
            )
          );
        }
      );


      battle.judges =
        selectPickupJudgesV40(
          battle,
          3,
          avoidIds
        );


      battle.judges.forEach(
        function (
          judge
        ) {

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
  ====================================== */

  const roundTimekeeperUsedIds =
    new Set();


  schedule.forEach(
    function (
      battle
    ) {

      const timekeeper =
        selectPickupTimekeeperV40(
          battle,
          roundTimekeeperUsedIds
        );


      battle.timekeeper =
        timekeeper;


      if (
        timekeeper
      ) {

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
     今回Dance未出場
  ====================================== */

  const waitingParticipants =
    activeDanceParticipants.filter(
      function (
        participant
      ) {

        return (
          (
            roundDanceCounts.get(
              String(
                participant.id
              )
            ) || 0
          ) === 0
        );
      }
    );


  currentRound++;


  lastRoundData =
    serializePickupRoundV40(
      schedule,
      waitingParticipants,
      currentRound,
      pairCount
    );


  syncStatsFromParticipants();


  await saveEventState();


  renderAll();


}


/* ========================================
   Pickup Schedule v41
======================================== */

function createPickupScheduleV41(
  danceParticipants,
  pairCount,
  battleNumber,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds,
  pairMetricCache
) {

  const ROUND_BEAM_WIDTH =
    8;


  const BATTLE_RESULT_LIMIT =
    6;


  let roundStates = [
    createInitialPickupRoundStateV41(
      danceParticipants
    )
  ];


  for (
    let battleIndex = 0;
    battleIndex < battleNumber;
    battleIndex++
  ) {

    const nextRoundStates =
      [];


    roundStates.forEach(
      function (
        roundState
      ) {

        const battleCandidates =
          createPickupBattleCandidatesV41(
            danceParticipants,
            pairCount,
            battleIndex,
            roundState,
            previousFinalIds,
            previousWaitingIds,
            pairMetricCache,
            BATTLE_RESULT_LIMIT
          );


        battleCandidates.forEach(
          function (
            battleCandidate
          ) {

            nextRoundStates.push(
              applyPickupBattleToRoundStateV41(
                roundState,
                battleCandidate,
                pairMetricCache
              )
            );
          }
        );
      }
    );


    if (
      nextRoundStates.length === 0
    ) {

      return null;
    }


    nextRoundStates.sort(
      function (
        a,
        b
      ) {

        return comparePartialPickupRoundStateV41(
          a,
          b,
          danceParticipants,
          previousWaitingIds
        );
      }
    );


    roundStates =
      nextRoundStates.slice(
        0,
        ROUND_BEAM_WIDTH
      );
  }


  let bestSchedule =
    null;


  let bestScore =
    null;


  roundStates.forEach(
    function (
      state
    ) {

      const score =
        scorePickupScheduleV40(
          state.battles,
          danceParticipants,
          previousFinalIds,
          previousRoundPairKeys,
          previousWaitingIds,
          pairMetricCache
        );


      if (
        bestScore === null
        ||
        comparePickupScheduleScoresV41(
          score,
          bestScore
        ) < 0
      ) {

        bestScore =
          score;


        bestSchedule =
          state.battles;
      }
    }
  );


  const repairedSchedule = improvePickupPartnersV41(
    bestSchedule,
    pairMetricCache,
    previousFinalIds
  );

  return recoverPickupUnpairedScheduleV41(
    repairedSchedule,
    danceParticipants,
    pairCount,
    previousFinalIds,
    previousRoundPairKeys,
    previousWaitingIds,
    pairMetricCache
  );
}


/* ========================================
   最終Round評価 v41

   v40のスコア算出式は変更しない。
   最大Dance回数差を維持しつつ、
   Pair履歴を細かな偏差より先に比較する。
======================================== */

function comparePickupScheduleScoresV41(
  a,
  b
) {

  if (
    a.previousWaitingMissed !==
    b.previousWaitingMissed
  ) {
    return a.previousWaitingMissed - b.previousWaitingMissed;
  }

  if (
    a.missedParticipants !==
    b.missedParticipants
  ) {
    return a.missedParticipants - b.missedParticipants;
  }

  if (
    a.fairnessSpread !==
    b.fairnessSpread
  ) {
    return a.fairnessSpread - b.fairnessSpread;
  }

  if (
    a.sameRoundPairRepeats !==
    b.sameRoundPairRepeats
  ) {
    return a.sameRoundPairRepeats - b.sameRoundPairRepeats;
  }

  if (
    a.existingPairCount !==
    b.existingPairCount
  ) {
    return a.existingPairCount - b.existingPairCount;
  }

  if (
    a.previousRoundPairCount !==
    b.previousRoundPairCount
  ) {
    return a.previousRoundPairCount - b.previousRoundPairCount;
  }

  if (
    a.historyTotal !==
    b.historyTotal
  ) {
    return a.historyTotal - b.historyTotal;
  }

  if (
    a.fairnessTotalDeviation !==
    b.fairnessTotalDeviation
  ) {
    return a.fairnessTotalDeviation - b.fairnessTotalDeviation;
  }

  if (
    a.boundaryOverlap !==
    b.boundaryOverlap
  ) {
    return a.boundaryOverlap - b.boundaryOverlap;
  }

  if (
    a.adjacentOverlap !==
    b.adjacentOverlap
  ) {
    return a.adjacentOverlap - b.adjacentOverlap;
  }

  return a.randomTie - b.randomTie;
}


/* ========================================
   Round初期状態
======================================== */

function createInitialPickupRoundStateV41(
  danceParticipants
) {

  const appearances =
    new Map();


  danceParticipants.forEach(
    function (
      participant
    ) {

      appearances.set(
        String(
          participant.id
        ),
        0
      );
    }
  );


  return {

    battles: [],

    appearances:
      appearances,

    pairKeys:
      new Set(),

    previousBattleDancerIds:
      new Set()
  };
}


/* ========================================
   Battle候補 Beam Search
======================================== */

function createPickupBattleCandidatesV41(
  danceParticipants,
  pairCount,
  battleIndex,
  roundState,
  previousFinalIds,
  previousWaitingIds,
  pairMetricCache,
  resultLimit
) {

  const PAIR_BEAM_WIDTH =
    18;


  let pairStates = [
    {

      pairs: [],

      usedIds:
        new Set(),

      previousWaitingUsed:
        0,

      uncoveredUsed:
        0,

      fairnessCost:
        0,

      sameRoundPairRepeats:
        0,

      existingPairCount:
        0,

      previousRoundPairCount:
        0,

      historyTotal:
        0,

      boundaryOverlap:
        0,

      adjacentOverlap:
        0,

      randomTie:
        Math.random()
    }
  ];


  for (
    let pairIndex = 0;
    pairIndex < pairCount;
    pairIndex++
  ) {

    const expandedStates =
      [];


    pairStates.forEach(
      function (
        pairState
      ) {

        const pairCandidates =
          createPairCandidatesForBeamV41(
            danceParticipants,
            battleIndex,
            roundState,
            pairState,
            previousFinalIds,
            previousWaitingIds,
            pairMetricCache
          );


        const bestPairCandidates =
          getTopPairCandidatesForBeamV41(
            pairCandidates,
            12
          );


        bestPairCandidates.forEach(
          function (
            pairCandidate
          ) {

            expandedStates.push(
              appendPairToBeamStateV41(
                pairState,
                pairCandidate
              )
            );
          }
        );
      }
    );


    if (
      expandedStates.length === 0
    ) {

      return [];
    }


    expandedStates.sort(
      comparePickupPairBeamStateV41
    );


    pairStates =
      expandedStates.slice(
        0,
        PAIR_BEAM_WIDTH
      );
  }


  pairStates.sort(
    comparePickupPairBeamStateV41
  );


  return pairStates
    .slice(
      0,
      resultLimit
    )
    .map(
      function (
        state
      ) {

        return {

          pairs:
            state.pairs,

          judges: [],

          timekeeper: null
        };
      }
    );
}


/* ========================================
   Pair候補
======================================== */

function createPairCandidatesForBeamV41(
  danceParticipants,
  battleIndex,
  roundState,
  pairState,
  previousFinalIds,
  previousWaitingIds,
  pairMetricCache
) {

  const candidates =
    [];


  danceParticipants.forEach(
    function (
      leader
    ) {

      if (
        !canLeadV40(
          leader
        )
      ) {

        return;
      }


      const leaderId =
        String(
          leader.id
        );


      if (
        pairState.usedIds.has(
          leaderId
        )
      ) {

        return;
      }


      danceParticipants.forEach(
        function (
          follower
        ) {

          if (
            !canFollowV40(
              follower
            )
          ) {

            return;
          }


          const followerId =
            String(
              follower.id
            );


          if (
            leaderId ===
            followerId
          ) {

            return;
          }


          if (
            pairState.usedIds.has(
              followerId
            )
          ) {

            return;
          }


          const metric =
            getPickupPairMetricV40(
              leader,
              follower,
              pairMetricCache
            );


          const leaderRoundCount =
            roundState.appearances.get(
              leaderId
            ) || 0;


          const followerRoundCount =
            roundState.appearances.get(
              followerId
            ) || 0;


          const previousWaitingBonus =
            (
              previousWaitingIds.has(
                leaderId
              )
              &&
              leaderRoundCount === 0
                ? 1
                : 0
            )
            +
            (
              previousWaitingIds.has(
                followerId
              )
              &&
              followerRoundCount === 0
                ? 1
                : 0
            );


          const uncoveredBonus =
            (
              leaderRoundCount === 0
                ? 1
                : 0
            )
            +
            (
              followerRoundCount === 0
                ? 1
                : 0
            );


          const fairnessCost =
            (
              getDanceFairCount(
                leader
              )
              +
              leaderRoundCount
            )
            +
            (
              getDanceFairCount(
                follower
              )
              +
              followerRoundCount
            );


          const sameRoundPair =
            roundState.pairKeys.has(
              metric.pairKey
            )
              ? 1
              : 0;


          let boundaryOverlap =
            0;


          if (
            battleIndex === 0
          ) {

            if (
              previousFinalIds.has(
                leaderId
              )
            ) {

              boundaryOverlap++;
            }


            if (
              previousFinalIds.has(
                followerId
              )
            ) {

              boundaryOverlap++;
            }
          }


          let adjacentOverlap =
            0;


          if (
            roundState.previousBattleDancerIds.has(
              leaderId
            )
          ) {

            adjacentOverlap++;
          }


          if (
            roundState.previousBattleDancerIds.has(
              followerId
            )
          ) {

            adjacentOverlap++;
          }


          candidates.push({

            leader:
              leader,

            follower:
              follower,

            pairKey:
              metric.pairKey,

            previousWaitingBonus:
              previousWaitingBonus,

            uncoveredBonus:
              uncoveredBonus,

            fairnessCost:
              fairnessCost,

            sameRoundPair:
              sameRoundPair,

            existingPair:
              metric.existingPair,

            previousRoundPair:
              metric.previousRoundPair,

            historyCount:
              metric.historyCount,

            boundaryOverlap:
              boundaryOverlap,

            adjacentOverlap:
              adjacentOverlap,

            randomTie:
              Math.random()
          });
        }
      );
    }
  );


  return candidates;
}


/* ========================================
   Pair候補 上位N
======================================== */

function getTopPairCandidatesForBeamV41(
  candidates,
  limit
) {

  const top =
    [];


  candidates.forEach(
    function (
      candidate
    ) {

      let insertIndex =
        top.length;


      for (
        let i = 0;
        i < top.length;
        i++
      ) {

        if (
          compareSinglePickupPairCandidateV41(
            candidate,
            top[i]
          ) < 0
        ) {

          insertIndex =
            i;

          break;
        }
      }


      if (
        insertIndex <
        limit
      ) {

        top.splice(
          insertIndex,
          0,
          candidate
        );


        if (
          top.length >
          limit
        ) {

          top.pop();
        }

      } else if (
        top.length <
        limit
      ) {

        top.push(
          candidate
        );
      }
    }
  );


  return top;
}


/* ========================================
   単一Pair比較
======================================== */

function compareSinglePickupPairCandidateV41(
  a,
  b
) {

  if (
    a.previousWaitingBonus !==
    b.previousWaitingBonus
  ) {

    return (
      b.previousWaitingBonus
      -
      a.previousWaitingBonus
    );
  }


  if (
    a.uncoveredBonus !==
    b.uncoveredBonus
  ) {

    return (
      b.uncoveredBonus
      -
      a.uncoveredBonus
    );
  }



  if (
    a.sameRoundPair !==
    b.sameRoundPair
  ) {

    return (
      a.sameRoundPair
      -
      b.sameRoundPair
    );
  }


  if (
    a.existingPair !==
    b.existingPair
  ) {

    return (
      a.existingPair
      -
      b.existingPair
    );
  }


  if (
    a.previousRoundPair !==
    b.previousRoundPair
  ) {

    return (
      a.previousRoundPair
      -
      b.previousRoundPair
    );
  }


  if (
    a.historyCount !==
    b.historyCount
  ) {

    return (
      a.historyCount
      -
      b.historyCount
    );
  }

  if (
    a.fairnessCost !==
    b.fairnessCost
  ) {

    return (
      a.fairnessCost
      -
      b.fairnessCost
    );
  }


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
    a.adjacentOverlap !==
    b.adjacentOverlap
  ) {

    return (
      a.adjacentOverlap
      -
      b.adjacentOverlap
    );
  }


  return (
    a.randomTie
    -
    b.randomTie
  );
}


/* ========================================
   Pair追加
======================================== */

function appendPairToBeamStateV41(
  state,
  pairCandidate
) {

  const newUsedIds =
    new Set(
      state.usedIds
    );


  newUsedIds.add(
    String(
      pairCandidate.leader.id
    )
  );


  newUsedIds.add(
    String(
      pairCandidate.follower.id
    )
  );


  return {

    pairs:
      [
        ...state.pairs,
        {
          leader:
            pairCandidate.leader,

          follower:
            pairCandidate.follower
        }
      ],

    usedIds:
      newUsedIds,

    previousWaitingUsed:
      state.previousWaitingUsed
      +
      pairCandidate.previousWaitingBonus,

    uncoveredUsed:
      state.uncoveredUsed
      +
      pairCandidate.uncoveredBonus,

    fairnessCost:
      state.fairnessCost
      +
      pairCandidate.fairnessCost,

    sameRoundPairRepeats:
      state.sameRoundPairRepeats
      +
      pairCandidate.sameRoundPair,

    existingPairCount:
      state.existingPairCount
      +
      pairCandidate.existingPair,

    previousRoundPairCount:
      state.previousRoundPairCount
      +
      pairCandidate.previousRoundPair,

    historyTotal:
      state.historyTotal
      +
      pairCandidate.historyCount,

    boundaryOverlap:
      state.boundaryOverlap
      +
      pairCandidate.boundaryOverlap,

    adjacentOverlap:
      state.adjacentOverlap
      +
      pairCandidate.adjacentOverlap,

    randomTie:
      Math.random()
  };
}


/* ========================================
   Battle途中候補比較
======================================== */

function comparePickupPairBeamStateV41(
  a,
  b
) {

  if (
    a.previousWaitingUsed !==
    b.previousWaitingUsed
  ) {

    return (
      b.previousWaitingUsed
      -
      a.previousWaitingUsed
    );
  }


  if (
    a.uncoveredUsed !==
    b.uncoveredUsed
  ) {

    return (
      b.uncoveredUsed
      -
      a.uncoveredUsed
    );
  }



  if (
    a.sameRoundPairRepeats !==
    b.sameRoundPairRepeats
  ) {

    return (
      a.sameRoundPairRepeats
      -
      b.sameRoundPairRepeats
    );
  }


  if (
    a.existingPairCount !==
    b.existingPairCount
  ) {

    return (
      a.existingPairCount
      -
      b.existingPairCount
    );
  }


  if (
    a.previousRoundPairCount !==
    b.previousRoundPairCount
  ) {

    return (
      a.previousRoundPairCount
      -
      b.previousRoundPairCount
    );
  }


  if (
    a.historyTotal !==
    b.historyTotal
  ) {

    return (
      a.historyTotal
      -
      b.historyTotal
    );
  }

  if (
    a.fairnessCost !==
    b.fairnessCost
  ) {

    return (
      a.fairnessCost
      -
      b.fairnessCost
    );
  }


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
    a.adjacentOverlap !==
    b.adjacentOverlap
  ) {

    return (
      a.adjacentOverlap
      -
      b.adjacentOverlap
    );
  }


  return (
    a.randomTie
    -
    b.randomTie
  );
}


/* ========================================
   BattleをRound状態へ反映
======================================== */

function applyPickupBattleToRoundStateV41(
  roundState,
  battle,
  pairMetricCache
) {

  const appearances =
    new Map(
      roundState.appearances
    );


  const pairKeys =
    new Set(
      roundState.pairKeys
    );


  const currentBattleIds =
    new Set();


  battle.pairs.forEach(
    function (
      pair
    ) {

      const leaderId =
        String(
          pair.leader.id
        );


      const followerId =
        String(
          pair.follower.id
        );


      appearances.set(
        leaderId,
        (
          appearances.get(
            leaderId
          ) || 0
        ) + 1
      );


      appearances.set(
        followerId,
        (
          appearances.get(
            followerId
          ) || 0
        ) + 1
      );


      currentBattleIds.add(
        leaderId
      );


      currentBattleIds.add(
        followerId
      );


      const metric =
        getPickupPairMetricV40(
          pair.leader,
          pair.follower,
          pairMetricCache
        );


      pairKeys.add(
        metric.pairKey
      );
    }
  );


  return {

    battles:
      [
        ...roundState.battles,
        battle
      ],

    appearances:
      appearances,

    pairKeys:
      pairKeys,

    previousBattleDancerIds:
      currentBattleIds
  };
}


/* ========================================
   Round途中候補比較
======================================== */

function comparePartialPickupRoundStateV41(
  a,
  b,
  danceParticipants,
  previousWaitingIds
) {

  const scoreA =
    getPartialPickupRoundScoreV41(
      a,
      danceParticipants,
      previousWaitingIds
    );


  const scoreB =
    getPartialPickupRoundScoreV41(
      b,
      danceParticipants,
      previousWaitingIds
    );


  if (
    scoreA.previousWaitingCovered !==
    scoreB.previousWaitingCovered
  ) {

    return (
      scoreB.previousWaitingCovered
      -
      scoreA.previousWaitingCovered
    );
  }


  if (
    scoreA.uniqueCovered !==
    scoreB.uniqueCovered
  ) {

    return (
      scoreB.uniqueCovered
      -
      scoreA.uniqueCovered
    );
  }


  if (
    scoreA.fairnessSpread !==
    scoreB.fairnessSpread
  ) {

    return (
      scoreA.fairnessSpread
      -
      scoreB.fairnessSpread
    );
  }



  if (
    scoreA.sameRoundPairRepeats !==
    scoreB.sameRoundPairRepeats
  ) {

    return (
      scoreA.sameRoundPairRepeats
      -
      scoreB.sameRoundPairRepeats
    );
  }


  if (
    scoreA.existingPairCount !==
    scoreB.existingPairCount
  ) {

    return (
      scoreA.existingPairCount
      -
      scoreB.existingPairCount
    );
  }


  if (
    scoreA.historyTotal !==
    scoreB.historyTotal
  ) {

    return (
      scoreA.historyTotal
      -
      scoreB.historyTotal
    );
  }

  if (
    scoreA.fairnessDeviation !==
    scoreB.fairnessDeviation
  ) {

    return (
      scoreA.fairnessDeviation
      -
      scoreB.fairnessDeviation
    );
  }


  if (
    scoreA.boundaryOverlap !==
    scoreB.boundaryOverlap
  ) {

    return (
      scoreA.boundaryOverlap
      -
      scoreB.boundaryOverlap
    );
  }


  if (
    scoreA.adjacentOverlap !==
    scoreB.adjacentOverlap
  ) {

    return (
      scoreA.adjacentOverlap
      -
      scoreB.adjacentOverlap
    );
  }


  return (
    scoreA.randomTie
    -
    scoreB.randomTie
  );
}


/* ========================================
   Round途中評価
======================================== */

function getPartialPickupRoundScoreV41(
  state,
  danceParticipants,
  previousWaitingIds
) {

  let previousWaitingCovered =
    0;


  let uniqueCovered =
    0;


  const projectedCounts =
    [];


  danceParticipants.forEach(
    function (
      participant
    ) {

      const id =
        String(
          participant.id
        );


      const appearances =
        state.appearances.get(
          id
        ) || 0;


      if (
        appearances > 0
      ) {

        uniqueCovered++;
      }


      if (
        appearances > 0
        &&
        previousWaitingIds.has(
          id
        )
      ) {

        previousWaitingCovered++;
      }


      projectedCounts.push(
        getDanceFairCount(
          participant
        )
        +
        appearances
      );
    }
  );


  let fairnessSpread =
    0;


  let fairnessDeviation =
    0;


  if (
    projectedCounts.length > 0
  ) {

    fairnessSpread =
      Math.max(
        ...projectedCounts
      )
      -
      Math.min(
        ...projectedCounts
      );


    const average =
      projectedCounts.reduce(
        function (
          total,
          value
        ) {

          return (
            total + value
          );
        },
        0
      )
      /
      projectedCounts.length;


    projectedCounts.forEach(
      function (
        value
      ) {

        fairnessDeviation +=
          Math.abs(
            value -
            average
          );
      }
    );
  }


  const pairCounts =
    new Map();


  let existingPairCount =
    0;


  let historyTotal =
    0;


  let boundaryOverlap =
    0;


  let adjacentOverlap =
    0;


  let previousBattleIds =
    new Set();


  state.battles.forEach(
    function (
      battle,
      battleIndex
    ) {

      const currentBattleIds =
        new Set();


      battle.pairs.forEach(
        function (
          pair
        ) {

          const pairKey =
            getHistoryKey(
              pair.leader,
              pair.follower
            );


          pairCounts.set(
            pairKey,
            (
              pairCounts.get(
                pairKey
              ) || 0
            ) + 1
          );


          const historyCount =
            getPairHistoryCount(
              pair.leader,
              pair.follower
            );


          if (
            historyCount > 0
          ) {

            existingPairCount++;
          }


          historyTotal +=
            historyCount;


          [
            pair.leader,
            pair.follower
          ].forEach(
            function (
              participant
            ) {

              const id =
                String(
                  participant.id
                );


              currentBattleIds.add(
                id
              );


              if (
                battleIndex > 0
                &&
                previousBattleIds.has(
                  id
                )
              ) {

                adjacentOverlap++;
              }
            }
          );
        }
      );


      previousBattleIds =
        currentBattleIds;
    }
  );


  let sameRoundPairRepeats =
    0;


  pairCounts.forEach(
    function (
      count
    ) {

      if (
        count > 1
      ) {

        sameRoundPairRepeats +=
          count - 1;
      }
    }
  );


  return {

    previousWaitingCovered:
      previousWaitingCovered,

    uniqueCovered:
      uniqueCovered,

    fairnessSpread:
      fairnessSpread,

    fairnessDeviation:
      fairnessDeviation,

    sameRoundPairRepeats:
      sameRoundPairRepeats,

    existingPairCount:
      existingPairCount,

    historyTotal:
      historyTotal,

    boundaryOverlap:
      boundaryOverlap,

    adjacentOverlap:
      adjacentOverlap,

    randomTie:
      Math.random()
  };
}


/* ========================================
   Pickup Round再調整（出場回数を固定）

   ・全員のDance回数とRole別回数を変更しない
   ・Battle内の重複参加は禁止
   ・元の連続出場/前Round境界を増やさない
   ・Judge候補人数を各Battleで減らさない
   ・履歴評価が厳密に良くなる場合のみ採用
======================================== */

function improvePickupPartnersV41(schedule, pairMetricCache, previousFinalIds) {
  if (!schedule || schedule.length === 0) {
    return schedule;
  }

  const original = scorePickupReassignmentV41(
    schedule,
    pairMetricCache,
    previousFinalIds
  );

  const originalJudgeCounts = schedule.map(
    battle => getPickupAvailableJudgeCountV41(battle)
  );

  if (
    original.sameRoundPairRepeats === 0 &&
    original.existingPairCount === 0
  ) {
    return schedule;
  }

  let current = schedule;
  let currentScore = original;
  const MAX_PASSES = 12;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const swaps = getPickupRoleSwapsV41(current);
    let best = null;
    let bestScore = currentScore;

    for (const swap of swaps) {
      const candidate = swapPickupRoleParticipantsV41(
        current,
        swap
      );

      if (!candidate ||
          !isPickupReassignmentSafeV41(
            candidate,
            original,
            originalJudgeCounts,
            swap,
            previousFinalIds
          )) {
        continue;
      }

      const score = scorePickupReassignmentV41(
        candidate,
        pairMetricCache,
        previousFinalIds
      );

      if (comparePickupPartnerHistoryV41(score, bestScore) < 0) {
        best = candidate;
        bestScore = score;
      }
    }

    /*
      単一の交換で改善できない場合は、
      2回の交換をまとめて検証する。
      途中の一時的な悪化は許容するが、
      完成後の制約は元のRoundより悪化させない。
    */
    if (!best) {
      for (const firstSwap of swaps) {
        const intermediate =
          swapPickupRoleParticipantsV41(
            current,
            firstSwap
          );
        if (!intermediate) {
          continue;
        }

        for (const secondSwap of swaps) {
          const candidate =
            swapPickupRoleParticipantsV41(
              intermediate,
              secondSwap
            );

          if (!candidate ||
              !isPickupReassignmentSafeV41(
                candidate,
                original,
                originalJudgeCounts,
                firstSwap,
                previousFinalIds
              ) ||
              !isPickupReassignmentSafeV41(
                candidate,
                original,
                originalJudgeCounts,
                secondSwap,
                previousFinalIds
              )) {
            continue;
          }

          const score =
            scorePickupReassignmentV41(
              candidate,
              pairMetricCache,
              previousFinalIds
            );

          if (
            comparePickupPartnerHistoryV41(
              score,
              bestScore
            ) < 0
          ) {
            best = candidate;
            bestScore = score;
          }
        }
      }
    }

    if (!best) {
      break;
    }

    current = best;
    currentScore = bestScore;
  }

  return current;
}


/* ========================================
   Pairまたは出場Battleを交換する候補
======================================== */

function getPickupRoleSwapsV41(schedule) {
  const positions = [];

  schedule.forEach((battle, battleIndex) => {
    battle.pairs.forEach((pair, pairIndex) => {
      positions.push({battleIndex, pairIndex});
    });
  });

  const swaps = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      swaps.push({
        first: positions[i],
        second: positions[j],
        role: "leader"
      });
      swaps.push({
        first: positions[i],
        second: positions[j],
        role: "follower"
      });
    }
  }
  return swaps;
}


function swapPickupRoleParticipantsV41(schedule, swap) {
  const {first, second, role} = swap;
  const firstBattle = schedule[first.battleIndex];
  const secondBattle = schedule[second.battleIndex];
  const firstPerson = firstBattle.pairs[first.pairIndex][role];
  const secondPerson = secondBattle.pairs[second.pairIndex][role];

  if (String(firstPerson.id) === String(secondPerson.id)) {
    return null;
  }

  const result = schedule.slice();
  const cloneBattle = index => {
    if (result[index] === schedule[index]) {
      result[index] = {
        ...schedule[index],
        pairs: schedule[index].pairs.map(pair => ({...pair}))
      };
    }
  };

  cloneBattle(first.battleIndex);
  cloneBattle(second.battleIndex);

  result[first.battleIndex].pairs[first.pairIndex][role] = secondPerson;
  result[second.battleIndex].pairs[second.pairIndex][role] = firstPerson;

  const indices = new Set([first.battleIndex, second.battleIndex]);
  for (const index of indices) {
    const ids = [];
    for (const pair of result[index].pairs) {
      ids.push(String(pair.leader.id));
      ids.push(String(pair.follower.id));
    }
    if (new Set(ids).size !== ids.length) {
      return null;
    }
  }

  return result;
}


/* ========================================
   Judge候補の人数を減らさない
======================================== */

function getPickupAvailableJudgeCountV41(battle) {
  const dancerIds = new Set();
  battle.pairs.forEach(pair => {
    dancerIds.add(String(pair.leader.id));
    dancerIds.add(String(pair.follower.id));
  });

  return participants.filter(person =>
    person.active !== false &&
    person.judgeAvailable &&
    !dancerIds.has(String(person.id))
  ).length;
}


function isPickupReassignmentSafeV41(
  candidate,
  originalScore,
  originalJudgeCounts,
  swap,
  previousFinalIds
) {
  const touched = new Set([
    swap.first.battleIndex,
    swap.second.battleIndex
  ]);

  for (const index of touched) {
    if (getPickupAvailableJudgeCountV41(candidate[index]) <
        originalJudgeCounts[index]) {
      return false;
    }
  }

  const score = scorePickupReassignmentV41(
    candidate,
    null,
    previousFinalIds
  );

  return (
    score.adjacentOverlap <= originalScore.adjacentOverlap &&
    score.boundaryOverlap <= originalScore.boundaryOverlap
  );
}


function scorePickupReassignmentV41(schedule, pairMetricCache, previousFinalIds) {
  const keys = new Set();
  const score = {
    sameRoundPairRepeats: 0,
    existingPairCount: 0,
    previousRoundPairCount: 0,
    historyTotal: 0,
    adjacentOverlap: 0,
    boundaryOverlap: 0
  };
  let previousIds = null;

  schedule.forEach((battle, battleIndex) => {
    const ids = new Set();
    battle.pairs.forEach(pair => {
      const metric = pairMetricCache
        ? getPickupPairMetricV40(
            pair.leader, pair.follower, pairMetricCache
          )
        : null;
      if (metric && keys.has(metric.pairKey)) {
        score.sameRoundPairRepeats++;
      }
      if (metric) {
        keys.add(metric.pairKey);
        score.existingPairCount += metric.existingPair;
        score.previousRoundPairCount += metric.previousRoundPair;
        score.historyTotal += metric.historyCount;
      }
      ids.add(String(pair.leader.id));
      ids.add(String(pair.follower.id));
    });

    if (battleIndex === 0 && previousFinalIds) {
      for (const id of ids) {
        if (previousFinalIds.has(id)) {
          score.boundaryOverlap++;
        }
      }
    }

    if (previousIds) {
      for (const id of ids) {
        if (previousIds.has(id)) {
          score.adjacentOverlap++;
        }
      }
    }
    previousIds = ids;
  });

  return score;
}


function comparePickupPartnerHistoryV41(a, b) {
  for (const key of [
    'sameRoundPairRepeats',
    'existingPairCount',
    'previousRoundPairCount',
    'historyTotal'
  ]) {
    if (a[key] !== b[key]) {
      return a[key] - b[key];
    }
  }
  return 0;
}


/* ========================================
   未成立Pairのみの再構成（候補が少ない終盤だけ）

   v41の通常生成・Pair交換で再成立が残った場合、
   未成立Pairの組合せをRound単位で検証する。

   ・2〜5Pair共通
   ・Dance公平性の最大差、前Round未出場者救済を悪化させない
   ・連続出場／Round境界／Judge候補数を悪化させない
   ・探索上限を設定し、終わらなければ従来結果を返す
   ・履歴保存、Judge/TK割当処理は変更しない
======================================== */

function recoverPickupUnpairedScheduleV41(
  schedule,
  danceParticipants,
  pairCount,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds,
  pairMetricCache
) {
  // 実行のたびにリセット。旧診断結果が残らないようにする。
  pickupRecoveryDiagnosticV41 = {
    reason: "未実行",
    repeatedBefore: 0,
    repeatedAfter: 0,
    sameRoundAfter: 0,
    freshCount: 0,
    needed: 0,
    options: 0,
    states: 0,
    rejectedAdjacent: 0,
    rejectedBoundary: 0,
    rejectedJudge: 0,
    completed: 0,
    rejectedFinalConstraints: 0
  };
  const diagnosis = pickupRecoveryDiagnosticV41;

  if (!schedule || schedule.length === 0) {
    diagnosis.reason = "生成データなし";
    return schedule;
  }

  const original = scorePickupScheduleV40(
    schedule,
    danceParticipants,
    previousFinalIds,
    previousRoundPairKeys,
    previousWaitingIds,
    pairMetricCache
  );

  diagnosis.repeatedBefore = original.existingPairCount;
  diagnosis.repeatedAfter = original.existingPairCount;
  diagnosis.sameRoundAfter = original.sameRoundPairRepeats;

  if (original.existingPairCount === 0 &&
      original.sameRoundPairRepeats === 0) {
    diagnosis.reason = "再成立なし";
    return schedule;
  }

  const needed = schedule.length * pairCount;
  diagnosis.needed = needed;
  const freshPairs = [];

  danceParticipants.forEach(leader => {
    if (!canLeadV40(leader)) return;
    danceParticipants.forEach(follower => {
      if (!canFollowV40(follower) ||
          String(leader.id) === String(follower.id)) return;
      const metric = getPickupPairMetricV40(
        leader, follower, pairMetricCache
      );
      if (metric.existingPair === 0) {
        freshPairs.push({leader, follower});
      }
    });
  });

  // 多数の未成立Pairが残る段階は既存Beam Searchを優先。
  // 終盤の選択肢が少ない場合だけ、探索範囲を限定して検証する。
  const MAX_FRESH = pairCount <= 2 ? 24 : 18;
  diagnosis.freshCount = freshPairs.length;
  if (freshPairs.length < needed) {
    diagnosis.reason = "未成立Pairが必要数より少ない";
    return schedule;
  }
  if (freshPairs.length > MAX_FRESH) {
    diagnosis.reason = "未成立Pair多数のため再探索対象外";
    return schedule;
  }

  const originalJudgeCounts = schedule.map(
    battle => getPickupAvailableJudgeCountV41(battle)
  );

  const options = [];
  const OPTION_LIMIT = 1200;

  function buildBattleOptions(from, chosen, ids, edgeBits) {
    if (options.length >= OPTION_LIMIT) return;
    if (chosen.length === pairCount) {
      options.push({
        pairs: chosen.slice(),
        ids: new Set(ids),
        edgeBits
      });
      return;
    }
    for (let i = from; i < freshPairs.length; i++) {
      const pair = freshPairs[i];
      const lid = String(pair.leader.id);
      const fid = String(pair.follower.id);
      if (ids.has(lid) || ids.has(fid)) continue;
      ids.add(lid);
      ids.add(fid);
      chosen.push(pair);
      buildBattleOptions(i + 1, chosen, ids, edgeBits | (1 << i));
      chosen.pop();
      ids.delete(lid);
      ids.delete(fid);
      if (options.length >= OPTION_LIMIT) break;
    }
  }

  buildBattleOptions(0, [], new Set(), 0);
  diagnosis.options = options.length;
  if (!options.length) {
    diagnosis.reason = "Battle候補を作成できない";
    return schedule;
  }

  const MAX_STATES = 25000;
  let states = 0;
  let found = null;
  const partial = [];

  function search(battleIndex, usedEdges, previousIds, adjacentCount, boundaryCount) {
    if (found || states >= MAX_STATES) return;
    if (battleIndex === schedule.length) {
      diagnosis.completed++;
      const candidate = partial.map(option => ({
        pairs: option.pairs.map(pair => ({
          leader: pair.leader,
          follower: pair.follower
        })),
        judges: [],
        timekeeper: null
      }));

      const result = scorePickupScheduleV40(
        candidate,
        danceParticipants,
        previousFinalIds,
        previousRoundPairKeys,
        previousWaitingIds,
        pairMetricCache
      );

      if (result.previousWaitingMissed > original.previousWaitingMissed ||
          result.missedParticipants > original.missedParticipants ||
          result.fairnessSpread > original.fairnessSpread ||
          result.sameRoundPairRepeats > original.sameRoundPairRepeats ||
          result.existingPairCount >= original.existingPairCount ||
          result.boundaryOverlap > original.boundaryOverlap ||
          result.adjacentOverlap > original.adjacentOverlap) {
        diagnosis.rejectedFinalConstraints++;
        return;
      }

      for (let i = 0; i < candidate.length; i++) {
        if (getPickupAvailableJudgeCountV41(candidate[i]) <
            originalJudgeCounts[i]) return;
      }

      found = candidate;
      return;
    }

    for (const option of options) {
      if (++states > MAX_STATES) return;
      if ((usedEdges & option.edgeBits) !== 0) continue;

      let nextAdjacent = adjacentCount;
      if (previousIds) {
        for (const id of option.ids) {
          if (previousIds.has(id)) nextAdjacent++;
        }
      }
      if (nextAdjacent > original.adjacentOverlap) {
        diagnosis.rejectedAdjacent++;
        continue;
      }

      let nextBoundary = boundaryCount;
      if (battleIndex === 0) {
        for (const id of option.ids) {
          if (previousFinalIds.has(id)) nextBoundary++;
        }
      }
      if (nextBoundary > original.boundaryOverlap) {
        diagnosis.rejectedBoundary++;
        continue;
      }

      const preview = {pairs: option.pairs};
      if (getPickupAvailableJudgeCountV41(preview) <
          originalJudgeCounts[battleIndex]) {
        diagnosis.rejectedJudge++;
        continue;
      }

      partial.push(option);
      search(
        battleIndex + 1,
        usedEdges | option.edgeBits,
        option.ids,
        nextAdjacent,
        nextBoundary
      );
      partial.pop();
      if (found || states >= MAX_STATES) return;
    }
  }

  search(0, 0, null, 0, 0);
  diagnosis.states = states;
  if (found) {
    diagnosis.repeatedAfter = 0;
    diagnosis.sameRoundAfter = 0;
    diagnosis.reason = "未成立Pairのみで組み直し成功";
  } else if (states >= MAX_STATES) {
    diagnosis.reason = "探索25,000回の上限に到達";
  } else if (options.length >= OPTION_LIMIT) {
    diagnosis.reason = "Battle候補1,200件の上限に到達";
  } else {
    diagnosis.reason = "探索範囲内では条件に合う案なし";
  }
  return found || schedule;
}


/* ========================================
   Pickup v41 検証版：限定条件ハイブリッド
   元の recoverPickupUnpairedScheduleV41 は変更しない。
   2Pair・固定Role・全アクティブ参加者Judge可能のときだけ
   未成立Pair優先、続いて再成立1組許容の探索を試す。
   それ以外は元のv41の結果をそのまま採用する。
======================================== */

const pickupOriginalRecoveryV41 = recoverPickupUnpairedScheduleV41;

// 限定条件・再成立1組まで許容する探索。元の有効なRoundは常に保持。
  function searchPickupOneRepeatHybridV41(schedule, danceParticipants, pairCount,
     previousFinalIds, previousRoundPairKeys, previousWaitingIds, pairMetricCache, limit=10000) {
    const stats = {states:0, completed:0, options:0, passed:0, skipped:null, ms:0};
    const start = performance.now();
    const finish=(value)=>({schedule:value, stats:{...stats,ms:performance.now()-start}});
    if (!schedule || pairCount!==2 || schedule.length!==5) {stats.skipped='not 2pair 5 battle'; return finish(schedule);}
    if(danceParticipants.some(p=>p.role==="both"))limit=Math.min(limit,1000);
    const existingEarly=schedule.reduce((n,b)=>n+b.pairs.filter(p=>getPickupPairMetricV40(p.leader,p.follower,pairMetricCache).existingPair>0).length,0);
    if(existingEarly<=1){stats.skipped='original repeated <= 1';return finish(schedule);}
    const scoreStable=(...args)=>{const saved=Math.random;Math.random=()=>0.5;try{return scorePickupScheduleV40(...args)}finally{Math.random=saved}};
    const score0=scoreStable(schedule, danceParticipants,previousFinalIds,previousRoundPairKeys, previousWaitingIds, pairMetricCache);
    if(score0.existingPairCount<=1||score0.sameRoundPairRepeats>0) {stats.skipped='original repeated <= 1';return finish(schedule);}
    const oldJ=schedule.map(b=>getPickupAvailableJudgeCountV41(b));
  
    // Judge/TK仮割当による追加安全判定（採用前のみ）。
    // Copies participants and uses a private RNG to avoid perturbing Round RNG and counters.
    function dryRunStaffSpread(sch, seed) {
      const savedParticipants=participants, savedRandom=Math.random;
      let state=seed>>>0;
      const seeded=()=>{state ^=state<<13;state ^=state>>>17;state ^=state<<5;return (state>>>0)/4294967296;};
      participants=savedParticipants.map(p=>({...p}));
      Math.random=seeded;
      try {
        const judgeUsed=new Set();
        const battles=sch.map(b=>({pairs:b.pairs,judges:[],timekeeper:null}));
        for(let i=0;i<battles.length;i++) {
          const avoid=new Set(judgeUsed);
          if(i===0)for(const id of previousFinalIds)avoid.add(String(id));
          const judges=selectPickupJudgesV40(battles[i],3,avoid);
          battles[i].judges=judges;
          for(const j of judges){j.judgeCount++;j.judgeFairCount=getJudgeFairCount(j)+1;judgeUsed.add(String(j.id));}
        }
        const tkUsed=new Set();
        for(const battle of battles) {
          const tk=selectPickupTimekeeperV40(battle,tkUsed);
          if(tk){tk.timekeeperCount=getNumberOrZero(tk.timekeeperCount)+1;
            tk.timekeeperFairCount=getTimekeeperFairCount(tk)+1;tkUsed.add(String(tk.id));}
        }
        const active=participants.filter(p=>p.active!==false);
        const activeJudges=active.filter(p=>p.judgeAvailable);
        const spread=(ps,key)=>Math.max(...ps.map(p=>p[key]))-Math.min(...ps.map(p=>p[key]));
        return {tk:spread(active,'timekeeperFairCount'),judge:spread(activeJudges,'judgeFairCount')};
      }finally{participants=savedParticipants; Math.random=savedRandom;}
    }
    function sameOrBetterStaff(candidate) {
      stats.staffChecks=(stats.staffChecks||0)+1;
      if(stats.staffChecks>4)return false;
      const seeds=[0x12345678,0xABCDEF01,0x09876543];
      for(const seed of seeds){
        const before=dryRunStaffSpread(schedule,seed), after=dryRunStaffSpread(candidate,seed);
        if(after.tk>before.tk || after.judge>before.judge) return false;
      }
      return true;
    }
  
    const fresh=[], repeat=[], keys=new Set();
    for(const l of danceParticipants){if(!canLeadV40(l))continue;
      for(const f of danceParticipants){if(l.id===f.id||!canFollowV40(f))continue;
        const metric=getPickupPairMetricV40(l,f,pairMetricCache);
        if(keys.has(metric.pairKey))continue;
        keys.add(metric.pairKey);
        const p={leader:l,follower:f,key:metric.pairKey,repeated:metric.existingPair>0,history:metric.historyCount,
          ids:[String(l.id),String(f.id)]};
        (p.repeated?repeat:fresh).push(p);
      }
    }
    if(fresh.length<9){stats.skipped='too few fresh pairs';return finish(schedule);}
    const options=[];
    const combined=fresh.concat(repeat);
    for(let i=0;i<combined.length;i++){
      for(let j=i+1;j<combined.length;j++){
        const p=combined[i],q=combined[j],num=p.repeated+q.repeated;
        if(num>1)continue;
        if(p.ids.some(id=>q.ids.includes(id)))continue;
        options.push({pairs:[p,q],keys:[p.key,q.key],ids:[...p.ids,...q.ids],repeats:num, judgeCount:0,idx:options.length});
      }
    }
    for(const o of options){o.judgeCount=getPickupAvailableJudgeCountV41({pairs:o.pairs});}
    stats.options=options.length;
    const app=new Map(danceParticipants.map(p=>[String(p.id),0]));
    const fair=new Map(danceParticipants.map(p=>[String(p.id),getDanceFairCount(p)]));
    const waiting=new Set([...previousWaitingIds].map(String));
    const prevFirst=new Set([...previousFinalIds].map(String));
    const originalMissed=score0.missedParticipants, originalWait=score0.previousWaitingMissed;
    const targetCover=danceParticipants.length-originalMissed, targetWait=waiting.size-originalWait;
    const chosen=[],used=new Set();let found=null;
    function dfs(depth, repeats, prevIds,adj, boundary,covered,waitCovered){
      if(found||stats.states>=limit||stats.staffChecks>=4) return;
      const remaining=schedule.length-depth;
      if(repeats>1||repeats+remaining*2<1 || covered+remaining*4<targetCover || waitCovered+remaining*4<targetWait)return;
      if(depth===schedule.length){
        stats.completed++;
        if(repeats!==1)return;
        const out=chosen.map(opt=>({pairs:opt.pairs.map(p=>({leader:p.leader,follower:p.follower})),judges:[],timekeeper:null}));
        const s=scoreStable(out,danceParticipants,previousFinalIds,previousRoundPairKeys,previousWaitingIds,pairMetricCache);
        const valid=s.previousWaitingMissed<=score0.previousWaitingMissed && s.missedParticipants<=score0.missedParticipants &&
           s.fairnessSpread<=score0.fairnessSpread && s.fairnessTotalDeviation<=score0.fairnessTotalDeviation+1e-8 &&
           s.sameRoundPairRepeats<=score0.sameRoundPairRepeats && s.existingPairCount<score0.existingPairCount &&
           s.boundaryOverlap<=score0.boundaryOverlap && s.adjacentOverlap<=score0.adjacentOverlap &&
           out.every((b,i)=>getPickupAvailableJudgeCountV41(b)>=oldJ[i]);
        if(valid && sameOrBetterStaff(out)){found=out;stats.passed++;}
        return;
      }
      // degrees of unused potential Pair per participant (fresh + allowed repeat)
      const degree=new Map(danceParticipants.map(p=>[String(p.id),0]));
      for(const p of combined){if(used.has(p.key)||p.repeated&&repeats===1)continue;
        for(const id of p.ids)degree.set(id,degree.get(id)+1);
      }
      let uncoveredNoPartner=0, uncoveredWaitNoPartner=0;
      for(const [id,n] of app){if(n===0 && degree.get(id)===0){uncoveredNoPartner++;if(waiting.has(id))uncoveredWaitNoPartner++;}}
      if(uncoveredNoPartner>originalMissed || uncoveredWaitNoPartner>originalWait) return;
      const next=[];
      for(const o of options){
        if(repeats+o.repeats>1 || o.judgeCount<oldJ[depth] || o.keys.some(k=>used.has(k)))continue;
        let nAdj=adj, nBound=boundary, freshD=0,freshWait=0, scarcity=0, fairCost=0;
        if(prevIds){for(const id of o.ids)if(prevIds.has(id))nAdj++;}
        if(nAdj>score0.adjacentOverlap)continue;
        if(depth===0){for(const id of o.ids)if(prevFirst.has(id))nBound++;}
        if(nBound>score0.boundaryOverlap)continue;
        for(const id of o.ids){
          const ap=app.get(id);
          if(!ap){freshD++;if(waiting.has(id))freshWait++;const deg=degree.get(id);if(deg>0)scarcity+=1000/deg;}
          fairCost+=fair.get(id)+ap;
        }
        if(covered+freshD+(remaining-1)*4<targetCover || waitCovered+freshWait+(remaining-1)*4<targetWait)continue;
        next.push({o,nAdj,nBound,freshD,freshWait,scarcity,fairCost, index:o.idx});
      }
      next.sort((a,b)=>b.freshWait-a.freshWait||b.freshD-a.freshD||b.scarcity-a.scarcity||a.fairCost-b.fairCost||
         a.o.repeats-b.o.repeats||a.nAdj-b.nAdj||a.index-b.index);
      for(const ent of next){
        if(stats.states>=limit||found||stats.staffChecks>=4)break;
        stats.states++;
        const o=ent.o;
        o.keys.forEach(k=>used.add(k));o.ids.forEach(id=>app.set(id,app.get(id)+1));chosen.push(o);
        dfs(depth+1,repeats+o.repeats,new Set(o.ids),ent.nAdj,ent.nBound,covered+ent.freshD,waitCovered+ent.freshWait);
        chosen.pop();o.ids.forEach(id=>app.set(id,app.get(id)-1));o.keys.forEach(k=>used.delete(k));
      }
    }
    dfs(0,0,null,0,0,0,0);
    return finish(found||schedule);
  }

function searchPickupScarcityHybridV41(
  schedule,
  danceParticipants,
  pairCount,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds,
  pairMetricCache
) {
  // 実行のたびにリセット。旧診断結果が残らないようにする。
  pickupRecoveryDiagnosticV41 = {
    reason: "未実行",
    repeatedBefore: 0,
    repeatedAfter: 0,
    sameRoundAfter: 0,
    freshCount: 0,
    needed: 0,
    options: 0,
    states: 0,
    rejectedAdjacent: 0,
    rejectedBoundary: 0,
    rejectedJudge: 0,
    completed: 0,
    rejectedFinalConstraints: 0
  };
  const diagnosis = pickupRecoveryDiagnosticV41;

  if (!schedule || schedule.length === 0) {
    diagnosis.reason = "生成データなし";
    return schedule;
  }

  const original = scorePickupScheduleV40(
    schedule,
    danceParticipants,
    previousFinalIds,
    previousRoundPairKeys,
    previousWaitingIds,
    pairMetricCache
  );

  diagnosis.repeatedBefore = original.existingPairCount;
  diagnosis.repeatedAfter = original.existingPairCount;
  diagnosis.sameRoundAfter = original.sameRoundPairRepeats;

  if (original.existingPairCount === 0 &&
      original.sameRoundPairRepeats === 0) {
    diagnosis.reason = "再成立なし";
    return schedule;
  }

  const needed = schedule.length * pairCount;
  diagnosis.needed = needed;
  const freshPairs = [];

  danceParticipants.forEach(leader => {
    if (!canLeadV40(leader)) return;
    danceParticipants.forEach(follower => {
      if (!canFollowV40(follower) ||
          String(leader.id) === String(follower.id)) return;
      const metric = getPickupPairMetricV40(
        leader, follower, pairMetricCache
      );
      if (metric.existingPair === 0) {
        freshPairs.push({leader, follower});
      }
    });
  });

  // 多数の未成立Pairが残る段階は既存Beam Searchを優先。
  // 終盤の選択肢が少ない場合だけ、探索範囲を限定して検証する。
  const MAX_FRESH = pairCount <= 2 ? 24 : 18;
  diagnosis.freshCount = freshPairs.length;
  if (freshPairs.length < needed) {
    diagnosis.reason = "未成立Pairが必要数より少ない";
    return schedule;
  }
  if (freshPairs.length > MAX_FRESH) {
    diagnosis.reason = "未成立Pair多数のため再探索対象外";
    return schedule;
  }

  const originalJudgeCounts = schedule.map(
    battle => getPickupAvailableJudgeCountV41(battle)
  );

  const options = [];
  const OPTION_LIMIT = 1200;

  function buildBattleOptions(from, chosen, ids, edgeBits) {
    if (options.length >= OPTION_LIMIT) return;
    if (chosen.length === pairCount) {
      options.push({
        pairs: chosen.slice(),
        ids: new Set(ids),
        edgeBits
      });
      return;
    }
    for (let i = from; i < freshPairs.length; i++) {
      const pair = freshPairs[i];
      const lid = String(pair.leader.id);
      const fid = String(pair.follower.id);
      if (ids.has(lid) || ids.has(fid)) continue;
      ids.add(lid);
      ids.add(fid);
      chosen.push(pair);
      buildBattleOptions(i + 1, chosen, ids, edgeBits | (1 << i));
      chosen.pop();
      ids.delete(lid);
      ids.delete(fid);
      if (options.length >= OPTION_LIMIT) break;
    }
  }

  buildBattleOptions(0, [], new Set(), 0);
  diagnosis.options = options.length;
  if (!options.length) {
    diagnosis.reason = "Battle候補を作成できない";
    return schedule;
  }

  const MAX_STATES = 25000;
  let states = 0;
  let found = null;
  const partial = [];

  function search(battleIndex, usedEdges, previousIds, adjacentCount, boundaryCount) {
    if (found || states >= MAX_STATES) return;
    if (battleIndex === schedule.length) {
      diagnosis.completed++;
      const candidate = partial.map(option => ({
        pairs: option.pairs.map(pair => ({
          leader: pair.leader,
          follower: pair.follower
        })),
        judges: [],
        timekeeper: null
      }));

      const result = scorePickupScheduleV40(
        candidate,
        danceParticipants,
        previousFinalIds,
        previousRoundPairKeys,
        previousWaitingIds,
        pairMetricCache
      );

      if (result.previousWaitingMissed > original.previousWaitingMissed ||
          result.missedParticipants > original.missedParticipants ||
          result.fairnessSpread > original.fairnessSpread ||
          result.sameRoundPairRepeats > original.sameRoundPairRepeats ||
          result.existingPairCount >= original.existingPairCount ||
          result.boundaryOverlap > original.boundaryOverlap ||
          result.adjacentOverlap > original.adjacentOverlap) {
        diagnosis.rejectedFinalConstraints++;
        return;
      }

      for (let i = 0; i < candidate.length; i++) {
        if (getPickupAvailableJudgeCountV41(candidate[i]) <
            originalJudgeCounts[i]) return;
      }

      found = candidate;
      return;
    }

    for (const option of options) {
      if (++states > MAX_STATES) return;
      if ((usedEdges & option.edgeBits) !== 0) continue;

      let nextAdjacent = adjacentCount;
      if (previousIds) {
        for (const id of option.ids) {
          if (previousIds.has(id)) nextAdjacent++;
        }
      }
      if (nextAdjacent > original.adjacentOverlap) {
        diagnosis.rejectedAdjacent++;
        continue;
      }

      let nextBoundary = boundaryCount;
      if (battleIndex === 0) {
        for (const id of option.ids) {
          if (previousFinalIds.has(id)) nextBoundary++;
        }
      }
      if (nextBoundary > original.boundaryOverlap) {
        diagnosis.rejectedBoundary++;
        continue;
      }

      const preview = {pairs: option.pairs};
      if (getPickupAvailableJudgeCountV41(preview) <
          originalJudgeCounts[battleIndex]) {
        diagnosis.rejectedJudge++;
        continue;
      }

      partial.push(option);
      search(
        battleIndex + 1,
        usedEdges | option.edgeBits,
        option.ids,
        nextAdjacent,
        nextBoundary
      );
      partial.pop();
      if (found || states >= MAX_STATES) return;
    }
  }

  search(0, 0, null, 0, 0);
  diagnosis.states = states;

  // 2Pairだけ：従来探索が失敗した場合に限り、動的な順序で追加探索する。
  // 元のRoundは保持し、全制約を満たす改善案以外を採用しない。
  diagnosis.extraStates = 0;
  diagnosis.extraCompleted = 0;
  if (!found && pairCount === 2) {
    const EXTRA_STATE_LIMIT = 5000;
    const appearance = new Map(
      danceParticipants.map(person => [String(person.id), 0])
    );
    const fairBase = new Map(
      danceParticipants.map(person => [
        String(person.id), getDanceFairCount(person)
      ])
    );
    const eligibleJudgeCounts = options.map(option =>
      getPickupAvailableJudgeCountV41({pairs: option.pairs})
    );
    const waitingIds = new Set(
      [...previousWaitingIds].map(id => String(id))
    );
    const originalMissedLimit = original.missedParticipants;
    const originalWaitingLimit = original.previousWaitingMissed;
    const additionalPartial = [];
    let extraStates = 0;
    let extraCompleted = 0;

    function dynamicSearch(depth, usedEdges, previousIds, adjacent, boundary,
                           covered, waitingCovered) {
      if (found || extraStates >= EXTRA_STATE_LIMIT) return;

      const remainingSlots = (schedule.length - depth) * pairCount * 2;
      const totalWaiting = danceParticipants.filter(person =>
        waitingIds.has(String(person.id))
      ).length;
      if (covered + remainingSlots < danceParticipants.length - originalMissedLimit ||
          waitingCovered + remainingSlots < totalWaiting - originalWaitingLimit) {
        return;
      }

      if (depth === schedule.length) {
        extraCompleted++;
        const candidate = additionalPartial.map(option => ({
          pairs: option.pairs.map(pair => ({
            leader: pair.leader,
            follower: pair.follower
          })),
          judges: [],
          timekeeper: null
        }));
        const score = scorePickupScheduleV40(
          candidate, danceParticipants, previousFinalIds,
          previousRoundPairKeys, previousWaitingIds, pairMetricCache
        );
        if (score.previousWaitingMissed <= original.previousWaitingMissed &&
            score.missedParticipants <= original.missedParticipants &&
            score.fairnessSpread <= original.fairnessSpread &&
            score.fairnessTotalDeviation <= original.fairnessTotalDeviation + 1e-8 &&
            score.sameRoundPairRepeats === 0 &&
            score.existingPairCount < original.existingPairCount &&
            score.boundaryOverlap <= original.boundaryOverlap &&
            score.adjacentOverlap <= original.adjacentOverlap) {
          found = candidate;
        }
        return;
      }

      // 未使用の未成立Pairに接続している人数を調べる。
      // これ以上一度も出場できない人が、元案の未出場人数を超える枝は除外する。
      // Judge / 連続Danceを無視した楽観的な判定なので、安全な必要条件のみ扱う。
      const remainingDegrees = new Map(
        danceParticipants.map(person => [String(person.id), 0])
      );
      for (let edgeIndex = 0; edgeIndex < freshPairs.length; edgeIndex++) {
        if ((usedEdges & (1 << edgeIndex)) !== 0) continue;
        const available = freshPairs[edgeIndex];
        const leaderId = String(available.leader.id);
        const followerId = String(available.follower.id);
        remainingDegrees.set(leaderId, remainingDegrees.get(leaderId) + 1);
        remainingDegrees.set(followerId, remainingDegrees.get(followerId) + 1);
      }
      let isolatedUncovered = 0;
      let isolatedWaiting = 0;
      for (const person of danceParticipants) {
        const id = String(person.id);
        if (appearance.get(id) !== 0 || remainingDegrees.get(id) > 0) continue;
        isolatedUncovered++;
        if (waitingIds.has(id)) isolatedWaiting++;
      }
      if (isolatedUncovered > originalMissedLimit ||
          isolatedWaiting > originalWaitingLimit) {
        diagnosis.extraImpossibleBranches =
          (diagnosis.extraImpossibleBranches || 0) + 1;
        return;
      }

      const nextOptions = [];
      for (let index = 0; index < options.length; index++) {
        const option = options[index];
        if ((usedEdges & option.edgeBits) !== 0 ||
            eligibleJudgeCounts[index] < originalJudgeCounts[depth]) {
          continue;
        }
        let nextAdjacent = adjacent;
        if (previousIds) {
          for (const id of option.ids) {
            if (previousIds.has(id)) nextAdjacent++;
          }
        }
        if (nextAdjacent > original.adjacentOverlap) continue;

        let nextBoundary = boundary;
        if (depth === 0) {
          for (const id of option.ids) {
            if (previousFinalIds.has(id)) nextBoundary++;
          }
        }
        if (nextBoundary > original.boundaryOverlap) continue;

        let freshWaiting = 0;
        let freshDancers = 0;
        let fairnessPriority = 0;
        for (const id of option.ids) {
          const count = appearance.get(id);
          if (count === 0) {
            freshDancers++;
            if (waitingIds.has(id)) freshWaiting++;
          }
          fairnessPriority += (fairBase.get(id) || 0) + count;
        }
        let scarcityPriority = 0;
        for (const id of option.ids) {
          const degree = remainingDegrees.get(id);
          if (appearance.get(id) === 0 && degree > 0) {
            scarcityPriority += 1000 / degree;
          }
        }
        nextOptions.push({
          option,
          freshWaiting,
          freshDancers,
          scarcityPriority,
          fairnessPriority,
          nextAdjacent,
          nextBoundary,
          judgeMargin: eligibleJudgeCounts[index] - originalJudgeCounts[depth],
          index
        });
      }

      // 毎Battleの残り出場枠に応じて再評価。ランダムな並べ替えは行わない。
      nextOptions.sort((a, b) =>
        (b.freshWaiting - a.freshWaiting) ||
        (b.freshDancers - a.freshDancers) ||
        (b.scarcityPriority - a.scarcityPriority) ||
        (a.fairnessPriority - b.fairnessPriority) ||
        (a.nextAdjacent - b.nextAdjacent) ||
        (a.nextBoundary - b.nextBoundary) ||
        (b.judgeMargin - a.judgeMargin) ||
        (a.index - b.index)
      );

      for (const entry of nextOptions) {
        if (++extraStates > EXTRA_STATE_LIMIT) break;
        const option = entry.option;
        for (const id of option.ids) {
          appearance.set(id, appearance.get(id) + 1);
        }
        additionalPartial.push(option);
        dynamicSearch(
          depth + 1,
          usedEdges | option.edgeBits,
          option.ids,
          entry.nextAdjacent,
          entry.nextBoundary,
          covered + entry.freshDancers,
          waitingCovered + entry.freshWaiting
        );
        additionalPartial.pop();
        for (const id of option.ids) {
          appearance.set(id, appearance.get(id) - 1);
        }
        if (found || extraStates >= EXTRA_STATE_LIMIT) break;
      }
    }

    dynamicSearch(0, 0, null, 0, 0, 0, 0);
    diagnosis.extraStates = extraStates;
    diagnosis.extraCompleted = extraCompleted;
  }
  if (found) {
    diagnosis.repeatedAfter = 0;
    diagnosis.sameRoundAfter = 0;
    diagnosis.reason = diagnosis.extraStates > 0
      ? "動的追加探索で未成立Pairのみの組み直し成功"
      : "未成立Pairのみで組み直し成功";
  } else if (states >= MAX_STATES) {
    diagnosis.reason = diagnosis.extraStates > 0
      ? "探索25,000回＋動的追加探索で改善なし"
      : "探索25,000回の上限に到達";
  } else if (options.length >= OPTION_LIMIT) {
    diagnosis.reason = "Battle候補1,200件の上限に到達";
  } else {
    diagnosis.reason = "探索範囲内では条件に合う案なし";
  }
  return found || schedule;
}

// 通常生成／v40の保存・表示・Judge/TKには手を加えず、再探索だけ切り替える。
recoverPickupUnpairedScheduleV41 = function pickupHybridRecoveryV41(
  schedule,
  danceParticipants,
  pairCount,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds,
  pairMetricCache
) {
  const args = [schedule, danceParticipants, pairCount, previousFinalIds,
    previousRoundPairKeys, previousWaitingIds, pairMetricCache];
  const eligible = pairCount === 2 &&
    Array.isArray(danceParticipants) &&
    danceParticipants.every(person =>
      person.role === "leader" || person.role === "follower") &&
    participants.filter(person => person.active !== false)
      .every(person => person.judgeAvailable === true);

  if (!eligible) {
    return pickupOriginalRecoveryV41(...args);
  }

  try {
    const zeroFirst = searchPickupScarcityHybridV41(...args);
    const result = searchPickupOneRepeatHybridV41(
      zeroFirst, danceParticipants, pairCount, previousFinalIds,
      previousRoundPairKeys, previousWaitingIds, pairMetricCache, 10000
    );
    if (result.stats.passed > 0) {
      pickupRecoveryDiagnosticV41.repeatedAfter = 1;
      pickupRecoveryDiagnosticV41.sameRoundAfter = 0;
      pickupRecoveryDiagnosticV41.reason = "限定条件：再成立1組への改善成功";
      pickupRecoveryDiagnosticV41.oneRepeatStates = result.stats.states;
    }
    return result.schedule;
  } catch (error) {
    // 追加探索で例外が起きても元の有効なRoundを壊さない。
    console.error("Pickup追加探索を中断し、元のRoundを維持します。", error);
    if (pickupRecoveryDiagnosticV41) {
      pickupRecoveryDiagnosticV41.reason = "追加探索エラー：元のRoundを維持";
    }
    return schedule;
  }
};
