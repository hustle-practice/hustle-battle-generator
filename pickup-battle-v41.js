
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


  return improvePickupPartnersV41(
    bestSchedule,
    pairMetricCache,
    previousFinalIds
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
