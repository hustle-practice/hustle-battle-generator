/* ========================================
   Hustle Battle Generator
   Pickup Battle v40

   v39からの変更
   ----------------------------------------
   ・Battle / Roundの評価順位は変更しない
   ・探索回数も基本維持
   ・Pair候補の全件sort()を廃止
   ・上位候補のみ保持する方式へ変更
   ・Pair履歴 / 直前Round Pair情報を
     Round生成中キャッシュ
   ・結果品質をなるべく維持しながら
     計算量のみ削減

   Pickup仕様
   ----------------------------------------
   ・2 / 3 / 4 / 5 Pair同時
   ・1BattleのPair数は指定数固定
   ・端数分は再出場
   ・再出場時もPairを変更
   ・BothはBattleごとにRole可変
   ・同一Battleで同じ人は1回のみ
   ・前Round未出場者を優先
   ・Dance公平性
   ・同一Round同一Pairを強く回避
   ・未成立Pair優先
   ・前Round最後→次Round最初を回避
   ・同Round連続Danceを回避
   ・Judge 3人
   ・Timekeeper 1人
======================================== */


/* ========================================
   DOM
======================================== */

const battleFormatSelect =
  document.getElementById(
    "battleFormatSelect"
  );

const pickupSettings =
  document.getElementById(
    "pickupSettings"
  );

const pickupPairCountSelect =
  document.getElementById(
    "pickupPairCountSelect"
  );

const roundFormatDescription =
  document.getElementById(
    "roundFormatDescription"
  );


/* ========================================
   Generate Roundイベント切替
======================================== */

generateRoundButton.removeEventListener(
  "click",
  generateRoundV38
);

generateRoundButton.addEventListener(
  "click",
  generateRoundByFormatV40
);


async function generateRoundByFormatV40() {

  const format =
    battleFormatSelect
      ? battleFormatSelect.value
      : "faceToFace";


  if (
    format === "pickup"
  ) {

    await generatePickupRoundV40();

  } else {

    await generateRoundV38();
  }
}


/* ========================================
   UI切替
======================================== */

function updateBattleFormatUIV40() {

  if (
    !battleFormatSelect
    ||
    !pickupSettings
  ) {
    return;
  }


  const isPickup =
    battleFormatSelect.value ===
    "pickup";


  pickupSettings.classList.toggle(
    "hidden",
    !isPickup
  );


  if (
    roundFormatDescription
  ) {

    roundFormatDescription.textContent =
      isPickup
        ? "複数Pairが同時に踊るピックアップ方式です。Pair数を選択してください。"
        : "2Pairが対面する従来のBattle方式です。";
  }
}


if (
  battleFormatSelect
) {

  battleFormatSelect.addEventListener(
    "change",
    updateBattleFormatUIV40
  );
}


updateBattleFormatUIV40();


/* ========================================
   Role
======================================== */

function canLeadV40(
  participant
) {

  return (
    participant.role === "leader"
    ||
    participant.role === "both"
  );
}


function canFollowV40(
  participant
) {

  return (
    participant.role === "follower"
    ||
    participant.role === "both"
  );
}


/* ========================================
   Pickup Round生成
======================================== */

async function generatePickupRoundV40() {

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


  /*
    v40高速化ポイント。

    Pair履歴はRound生成の探索中には変化しない。

    v39では何十万回も
    getPairHistoryCount()
    getHistoryKey()
    previousRoundPairKeys.has()
    を呼んでいた。

    v40では最初に1回だけ計算して
    Mapへ保存する。
  */

  const pairMetricCache =
    buildPickupPairMetricCacheV40(
      activeDanceParticipants,
      previousRoundPairKeys
    );


  const schedule =
    createPickupScheduleV40(
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
     Dance / Pair履歴更新
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
     今回Danceなし
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
   Pair固定情報キャッシュ

   Map key:
   "leaderId|followerId"

   value:
   {
     pairKey,
     historyCount,
     existingPair,
     previousRoundPair
   }
======================================== */

function buildPickupPairMetricCacheV40(
  danceParticipants,
  previousRoundPairKeys
) {

  const cache =
    new Map();


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


          if (
            String(
              leader.id
            ) ===
            String(
              follower.id
            )
          ) {
            return;
          }


          const cacheKey =
            getPickupPairCacheKeyV40(
              leader.id,
              follower.id
            );


          const pairKey =
            getHistoryKey(
              leader,
              follower
            );


          const historyCount =
            getPairHistoryCount(
              leader,
              follower
            );


          cache.set(
            cacheKey,
            {

              pairKey:
                pairKey,

              historyCount:
                historyCount,

              existingPair:
                historyCount > 0
                  ? 1
                  : 0,

              previousRoundPair:
                previousRoundPairKeys.has(
                  pairKey
                )
                  ? 1
                  : 0
            }
          );
        }
      );
    }
  );


  return cache;
}


function getPickupPairCacheKeyV40(
  leaderId,
  followerId
) {

  return (
    String(
      leaderId
    )
    +
    "|"
    +
    String(
      followerId
    )
  );
}


function getPickupPairMetricV40(
  leader,
  follower,
  pairMetricCache
) {

  const key =
    getPickupPairCacheKeyV40(
      leader.id,
      follower.id
    );


  const cached =
    pairMetricCache.get(
      key
    );


  if (
    cached
  ) {
    return cached;
  }


  /*
    通常ここには来ないが、
    念のためfallback。
  */

  const pairKey =
    getHistoryKey(
      leader,
      follower
    );


  const historyCount =
    getPairHistoryCount(
      leader,
      follower
    );


  const result = {

    pairKey:
      pairKey,

    historyCount:
      historyCount,

    existingPair:
      historyCount > 0
        ? 1
        : 0,

    previousRoundPair:
      0
  };


  pairMetricCache.set(
    key,
    result
  );


  return result;
}


/* ========================================
   Battle数
======================================== */

function calculatePickupBattleCountV40(
  danceParticipants,
  pairCount
) {

  const fixedLeaders =
    danceParticipants.filter(
      function (
        participant
      ) {

        return (
          participant.role ===
          "leader"
        );
      }
    ).length;


  const fixedFollowers =
    danceParticipants.filter(
      function (
        participant
      ) {

        return (
          participant.role ===
          "follower"
        );
      }
    ).length;


  const byTotal =
    Math.ceil(
      danceParticipants.length
      /
      (
        pairCount * 2
      )
    );


  const byLeader =
    Math.ceil(
      fixedLeaders
      /
      pairCount
    );


  const byFollower =
    Math.ceil(
      fixedFollowers
      /
      pairCount
    );


  return Math.max(
    1,
    byTotal,
    byLeader,
    byFollower
  );
}


/* ========================================
   前Round未出場者
======================================== */

function getPreviousWaitingIdsV40() {

  const result =
    new Set();


  if (
    !lastRoundData
    ||
    !Array.isArray(
      lastRoundData.waitingIds
    )
  ) {

    return result;
  }


  lastRoundData.waitingIds.forEach(
    function (
      id
    ) {

      result.add(
        String(
          id
        )
      );
    }
  );


  return result;
}


/* ========================================
   Schedule探索
======================================== */

function createPickupScheduleV40(
  danceParticipants,
  pairCount,
  battleNumber,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds,
  pairMetricCache
) {

  let bestSchedule =
    null;


  let bestScore =
    null;


  /*
    v40では探索回数自体は
    v39と同じ700回を維持。

    まず品質を落とさず、
    1回あたりの処理を軽くする。
  */

  const scheduleAttempts =
    700;


  for (
    let attempt = 0;
    attempt < scheduleAttempts;
    attempt++
  ) {

    const roundAppearances =
      new Map();


    danceParticipants.forEach(
      function (
        participant
      ) {

        roundAppearances.set(
          String(
            participant.id
          ),
          0
        );
      }
    );


    const roundPairKeys =
      new Set();


    let previousBattleDancerIds =
      new Set();


    const battles =
      [];


    let failed =
      false;


    for (
      let battleIndex = 0;
      battleIndex < battleNumber;
      battleIndex++
    ) {

      const battle =
        createPickupBattleCandidateV40(
          danceParticipants,
          pairCount,
          battleIndex,
          roundAppearances,
          roundPairKeys,
          previousBattleDancerIds,
          previousFinalIds,
          previousWaitingIds,
          pairMetricCache
        );


      if (
        !battle
      ) {

        failed =
          true;

        break;
      }


      battles.push(
        battle
      );


      const currentBattleIds =
        new Set();


      battle.pairs.forEach(
        function (
          pair
        ) {

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


              roundAppearances.set(
                id,
                (
                  roundAppearances.get(
                    id
                  ) || 0
                ) + 1
              );


              currentBattleIds.add(
                id
              );
            }
          );


          const metric =
            getPickupPairMetricV40(
              pair.leader,
              pair.follower,
              pairMetricCache
            );


          roundPairKeys.add(
            metric.pairKey
          );
        }
      );


      previousBattleDancerIds =
        currentBattleIds;
    }


    if (
      failed
      ||
      battles.length !==
        battleNumber
    ) {

      continue;
    }


    const score =
      scorePickupScheduleV40(
        battles,
        danceParticipants,
        previousFinalIds,
        previousRoundPairKeys,
        previousWaitingIds,
        pairMetricCache
      );


    if (
      bestScore === null
      ||
      comparePickupScheduleScoresV40(
        score,
        bestScore
      ) < 0
    ) {

      bestScore =
        score;


      bestSchedule =
        battles;


      /*
        v39から存在する
        完全条件での早期終了。

        条件を緩めると
        Pair品質低下の可能性があるため、
        v40ではまだ変更しない。
      */

      if (
        score.previousWaitingMissed === 0
        &&
        score.missedParticipants === 0
        &&
        score.sameRoundPairRepeats === 0
        &&
        score.existingPairCount === 0
        &&
        score.boundaryOverlap === 0
        &&
        score.adjacentOverlap === 0
      ) {

        break;
      }
    }
  }


  return bestSchedule;
}


/* ========================================
   Battle候補
======================================== */

function createPickupBattleCandidateV40(
  danceParticipants,
  pairCount,
  battleIndex,
  roundAppearances,
  roundPairKeys,
  previousBattleDancerIds,
  previousFinalIds,
  previousWaitingIds,
  pairMetricCache
) {

  let bestBattle =
    null;


  let bestScore =
    null;


  /*
    v39同様100回。

    ここもまず削減しない。
  */

  const battleAttempts =
    100;


  for (
    let attempt = 0;
    attempt < battleAttempts;
    attempt++
  ) {

    const usedIds =
      new Set();


    const pairs =
      [];


    let failed =
      false;


    for (
      let pairIndex = 0;
      pairIndex < pairCount;
      pairIndex++
    ) {

      const candidates =
        createPickupPairCandidatesV40(
          danceParticipants,
          usedIds,
          battleIndex,
          roundAppearances,
          roundPairKeys,
          previousBattleDancerIds,
          previousFinalIds,
          previousWaitingIds,
          pairMetricCache
        );


      if (
        candidates.length === 0
      ) {

        failed =
          true;

        break;
      }


      /*
        v39：
        candidates.sort(...)
        → 全候補を完全ソート。

        v40：
        上位5件だけを1回走査で抽出。

        最終的に使用するのは
        元々上位5件だけなので、
        選択条件は変えない。
      */

      const candidatePool =
        getTopPickupPairCandidatesV40(
          candidates,
          5
        );


      const selected =
        getRandomItem(
          candidatePool
        );


      if (
        !selected
      ) {

        failed =
          true;

        break;
      }


      pairs.push({

        leader:
          selected.leader,

        follower:
          selected.follower
      });


      usedIds.add(
        String(
          selected.leader.id
        )
      );


      usedIds.add(
        String(
          selected.follower.id
        )
      );
    }


    if (
      failed
      ||
      pairs.length !==
        pairCount
    ) {

      continue;
    }


    const battle = {

      pairs:
        pairs,

      judges: [],

      timekeeper:
        null
    };


    const score =
      scorePickupBattleV40(
        battle,
        battleIndex,
        roundAppearances,
        roundPairKeys,
        previousBattleDancerIds,
        previousFinalIds,
        previousWaitingIds,
        pairMetricCache
      );


    if (
      bestScore === null
      ||
      comparePickupBattleScoresV40(
        score,
        bestScore
      ) < 0
    ) {

      bestScore =
        score;


      bestBattle =
        battle;
    }
  }


  return bestBattle;
}


/* ========================================
   上位N候補のみ抽出

   全件sortをしない。

   topListは最大5件なので、
   候補数が多くても処理量が小さい。
======================================== */

function getTopPickupPairCandidatesV40(
  candidates,
  limit
) {

  const topList =
    [];


  candidates.forEach(
    function (
      candidate
    ) {

      let insertIndex =
        topList.length;


      for (
        let i = 0;
        i < topList.length;
        i++
      ) {

        if (
          comparePickupPairChoiceV40(
            candidate,
            topList[i]
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

        topList.splice(
          insertIndex,
          0,
          candidate
        );


        if (
          topList.length >
          limit
        ) {

          topList.pop();
        }

      } else if (
        topList.length <
        limit
      ) {

        topList.push(
          candidate
        );
      }
    }
  );


  return topList;
}


/* ========================================
   Pair候補
======================================== */

function createPickupPairCandidatesV40(
  danceParticipants,
  usedIds,
  battleIndex,
  roundAppearances,
  roundPairKeys,
  previousBattleDancerIds,
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
        usedIds.has(
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
            usedIds.has(
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
            roundAppearances.get(
              leaderId
            ) || 0;


          const followerRoundCount =
            roundAppearances.get(
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


          const sameRoundPair =
            roundPairKeys.has(
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
            previousBattleDancerIds.has(
              leaderId
            )
          ) {
            adjacentOverlap++;
          }


          if (
            previousBattleDancerIds.has(
              followerId
            )
          ) {
            adjacentOverlap++;
          }


          const projectedFairTotal =
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


          candidates.push({

            leader:
              leader,

            follower:
              follower,

            previousWaitingBonus:
              previousWaitingBonus,

            uncoveredBonus:
              uncoveredBonus,

            projectedFairTotal:
              projectedFairTotal,

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
   Pair候補比較
======================================== */

function comparePickupPairChoiceV40(
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
    a.projectedFairTotal !==
    b.projectedFairTotal
  ) {

    return (
      a.projectedFairTotal
      -
      b.projectedFairTotal
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
   Battle評価
======================================== */

function scorePickupBattleV40(
  battle,
  battleIndex,
  roundAppearances,
  roundPairKeys,
  previousBattleDancerIds,
  previousFinalIds,
  previousWaitingIds,
  pairMetricCache
) {

  let previousWaitingUsed =
    0;


  let uncoveredUsed =
    0;


  let sameRoundPairRepeats =
    0;


  let existingPairCount =
    0;


  let previousRoundPairCount =
    0;


  let historyTotal =
    0;


  let boundaryOverlap =
    0;


  let adjacentOverlap =
    0;


  let projectedFairTotal =
    0;


  battle.pairs.forEach(
    function (
      pair
    ) {

      const metric =
        getPickupPairMetricV40(
          pair.leader,
          pair.follower,
          pairMetricCache
        );


      if (
        roundPairKeys.has(
          metric.pairKey
        )
      ) {

        sameRoundPairRepeats++;
      }


      existingPairCount +=
        metric.existingPair;


      previousRoundPairCount +=
        metric.previousRoundPair;


      historyTotal +=
        metric.historyCount;


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


          const roundCount =
            roundAppearances.get(
              id
            ) || 0;


          if (
            previousWaitingIds.has(
              id
            )
            &&
            roundCount === 0
          ) {

            previousWaitingUsed++;
          }


          if (
            roundCount === 0
          ) {

            uncoveredUsed++;
          }


          projectedFairTotal +=
            getDanceFairCount(
              participant
            )
            +
            roundCount;


          if (
            battleIndex === 0
            &&
            previousFinalIds.has(
              id
            )
          ) {

            boundaryOverlap++;
          }


          if (
            previousBattleDancerIds.has(
              id
            )
          ) {

            adjacentOverlap++;
          }
        }
      );
    }
  );


  return {

    previousWaitingUsed:
      previousWaitingUsed,

    uncoveredUsed:
      uncoveredUsed,

    projectedFairTotal:
      projectedFairTotal,

    sameRoundPairRepeats:
      sameRoundPairRepeats,

    existingPairCount:
      existingPairCount,

    previousRoundPairCount:
      previousRoundPairCount,

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
   Battle比較
======================================== */

function comparePickupBattleScoresV40(
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
    a.projectedFairTotal !==
    b.projectedFairTotal
  ) {

    return (
      a.projectedFairTotal
      -
      b.projectedFairTotal
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
   Round全体評価
======================================== */

function scorePickupScheduleV40(
  battles,
  danceParticipants,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds,
  pairMetricCache
) {

  const appearanceCounts =
    new Map();


  danceParticipants.forEach(
    function (
      participant
    ) {

      appearanceCounts.set(
        String(
          participant.id
        ),
        0
      );
    }
  );


  const usedPairCounts =
    new Map();


  let existingPairCount =
    0;


  let previousRoundPairCount =
    0;


  let historyTotal =
    0;


  let boundaryOverlap =
    0;


  let adjacentOverlap =
    0;


  let previousBattleIds =
    new Set();


  battles.forEach(
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

          const metric =
            getPickupPairMetricV40(
              pair.leader,
              pair.follower,
              pairMetricCache
            );


          usedPairCounts.set(
            metric.pairKey,
            (
              usedPairCounts.get(
                metric.pairKey
              ) || 0
            ) + 1
          );


          existingPairCount +=
            metric.existingPair;


          previousRoundPairCount +=
            metric.previousRoundPair;


          historyTotal +=
            metric.historyCount;


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


              appearanceCounts.set(
                id,
                (
                  appearanceCounts.get(
                    id
                  ) || 0
                ) + 1
              );


              currentBattleIds.add(
                id
              );


              if (
                battleIndex === 0
                &&
                previousFinalIds.has(
                  id
                )
              ) {

                boundaryOverlap++;
              }


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


  let previousWaitingMissed =
    0;


  let missedParticipants =
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
        appearanceCounts.get(
          id
        ) || 0;


      if (
        previousWaitingIds.has(
          id
        )
        &&
        appearances === 0
      ) {

        previousWaitingMissed++;
      }


      if (
        appearances === 0
      ) {

        missedParticipants++;
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


  const fairnessSpread =
    projectedCounts.length > 0
      ? (
          Math.max(
            ...projectedCounts
          )
          -
          Math.min(
            ...projectedCounts
          )
        )
      : 0;


  let fairnessTotalDeviation =
    0;


  if (
    projectedCounts.length > 0
  ) {

    const average =
      projectedCounts.reduce(
        function (
          sum,
          value
        ) {

          return (
            sum + value
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

        fairnessTotalDeviation +=
          Math.abs(
            value -
            average
          );
      }
    );
  }


  let sameRoundPairRepeats =
    0;


  usedPairCounts.forEach(
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

    previousWaitingMissed:
      previousWaitingMissed,

    missedParticipants:
      missedParticipants,

    fairnessSpread:
      fairnessSpread,

    fairnessTotalDeviation:
      fairnessTotalDeviation,

    sameRoundPairRepeats:
      sameRoundPairRepeats,

    existingPairCount:
      existingPairCount,

    previousRoundPairCount:
      previousRoundPairCount,

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
   Round比較

   v39と優先順位は同じ。
======================================== */

function comparePickupScheduleScoresV40(
  a,
  b
) {

  if (
    a.previousWaitingMissed !==
    b.previousWaitingMissed
  ) {

    return (
      a.previousWaitingMissed
      -
      b.previousWaitingMissed
    );
  }


  if (
    a.missedParticipants !==
    b.missedParticipants
  ) {

    return (
      a.missedParticipants
      -
      b.missedParticipants
    );
  }


  if (
    a.fairnessSpread !==
    b.fairnessSpread
  ) {

    return (
      a.fairnessSpread
      -
      b.fairnessSpread
    );
  }


  if (
    a.fairnessTotalDeviation !==
    b.fairnessTotalDeviation
  ) {

    return (
      a.fairnessTotalDeviation
      -
      b.fairnessTotalDeviation
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
   Judge
======================================== */

function selectPickupJudgesV40(
  battle,
  requestedCount,
  avoidIds = new Set()
) {

  const dancerIds =
    new Set();


  battle.pairs.forEach(
    function (
      pair
    ) {

      dancerIds.add(
        String(
          pair.leader.id
        )
      );


      dancerIds.add(
        String(
          pair.follower.id
        )
      );
    }
  );


  const allCandidates =
    participants.filter(
      function (
        participant
      ) {

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
      function (
        participant
      ) {

        return (
          !avoidIds.has(
            String(
              participant.id
            )
          )
        );
      }
    );


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
    function (
      combination
    ) {

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
   Timekeeper
======================================== */

function selectPickupTimekeeperV40(
  battle,
  usedTimekeeperIds
) {

  const dancerIds =
    new Set();


  battle.pairs.forEach(
    function (
      pair
    ) {

      dancerIds.add(
        String(
          pair.leader.id
        )
      );


      dancerIds.add(
        String(
          pair.follower.id
        )
      );
    }
  );


  const judgeIds =
    new Set(
      battle.judges.map(
        function (
          judge
        ) {

          return String(
            judge.id
          );
        }
      )
    );


  const idleCandidates =
    participants.filter(
      function (
        participant
      ) {

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

    return selectFairPickupTimekeeperV40(
      idleCandidates,
      usedTimekeeperIds
    );
  }


  if (
    battle.judges.length > 0
  ) {

    return selectFairPickupTimekeeperV40(
      battle.judges,
      usedTimekeeperIds
    );
  }


  return null;
}


function selectFairPickupTimekeeperV40(
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


  const unused =
    candidates.filter(
      function (
        participant
      ) {

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
    unused.length > 0
      ? unused
      : candidates;


  let minimumCount =
    Infinity;


  pool.forEach(
    function (
      participant
    ) {

      minimumCount =
        Math.min(
          minimumCount,
          getTimekeeperFairCount(
            participant
          )
        );
    }
  );


  const best =
    pool.filter(
      function (
        participant
      ) {

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
    best
  );
}


/* ========================================
   保存
======================================== */

function serializePickupRoundV40(
  battles,
  waitingParticipants,
  roundNumber,
  pairCount
) {

  return {

    format:
      "pickup",

    pickupPairCount:
      pairCount,

    roundNumber:
      roundNumber,

    battles:
      battles.map(
        function (
          battle
        ) {

          return {

            pairs:
              battle.pairs.map(
                function (
                  pair
                ) {

                  return {

                    leaderId:
                      pair.leader.id,

                    followerId:
                      pair.follower.id
                  };
                }
              ),

            judgeIds:
              battle.judges.map(
                function (
                  judge
                ) {

                  return judge.id;
                }
              ),

            timekeeperId:
              battle.timekeeper
                ? battle.timekeeper.id
                : null
          };
        }
      ),

    waitingIds:
      waitingParticipants.map(
        function (
          participant
        ) {

          return participant.id;
        }
      )
  };
}


/* ========================================
   前Round最終Battle
   Pickup対応
======================================== */

const getPreviousFinalBattleParticipantIdsV38 =
  getPreviousFinalBattleParticipantIds;


getPreviousFinalBattleParticipantIds =
  function () {

    if (
      !lastRoundData
      ||
      lastRoundData.format !==
        "pickup"
    ) {

      return (
        getPreviousFinalBattleParticipantIdsV38()
      );
    }


    const result =
      new Set();


    if (
      !Array.isArray(
        lastRoundData.battles
      )
      ||
      lastRoundData.battles.length === 0
    ) {

      return result;
    }


    const finalBattle =
      lastRoundData.battles[
        lastRoundData.battles.length - 1
      ];


    if (
      Array.isArray(
        finalBattle.pairs
      )
    ) {

      finalBattle.pairs.forEach(
        function (
          pair
        ) {

          if (
            pair.leaderId != null
          ) {

            result.add(
              String(
                pair.leaderId
              )
            );
          }


          if (
            pair.followerId != null
          ) {

            result.add(
              String(
                pair.followerId
              )
            );
          }
        }
      );
    }


    (
      finalBattle.judgeIds ||
      []
    ).forEach(
      function (
        id
      ) {

        result.add(
          String(
            id
          )
        );
      }
    );


    return result;
  };


/* ========================================
   前Round Pair
   Pickup対応
======================================== */

const getPreviousRoundPairKeysV38 =
  getPreviousRoundPairKeys;


getPreviousRoundPairKeys =
  function () {

    if (
      !lastRoundData
      ||
      lastRoundData.format !==
        "pickup"
    ) {

      return (
        getPreviousRoundPairKeysV38()
      );
    }


    const keys =
      new Set();


    if (
      !Array.isArray(
        lastRoundData.battles
      )
    ) {

      return keys;
    }


    lastRoundData.battles.forEach(
      function (
        battle
      ) {

        (
          battle.pairs ||
          []
        ).forEach(
          function (
            pair
          ) {

            if (
              pair.leaderId == null
              ||
              pair.followerId == null
            ) {

              return;
            }


            keys.add(
              getHistoryKeyFromIds(
                pair.leaderId,
                pair.followerId
              )
            );
          }
        );
      }
    );


    return keys;
  };


/* ========================================
   Pair履歴表示
======================================== */

if (
  typeof getCurrentRoundPairsV36 ===
  "function"
) {

  const originalGetCurrentRoundPairsV36 =
    getCurrentRoundPairsV36;


  getCurrentRoundPairsV36 =
    function () {

      if (
        !lastRoundData
        ||
        lastRoundData.format !==
          "pickup"
      ) {

        return (
          originalGetCurrentRoundPairsV36()
        );
      }


      const result =
        [];


      (
        lastRoundData.battles ||
        []
      ).forEach(
        function (
          battle
        ) {

          (
            battle.pairs ||
            []
          ).forEach(
            function (
              pair
            ) {

              const leader =
                findParticipantById(
                  pair.leaderId
                );


              const follower =
                findParticipantById(
                  pair.followerId
                );


              if (
                !leader
                ||
                !follower
              ) {

                return;
              }


              result.push({

                leader:
                  leader,

                follower:
                  follower,

                key:
                  getHistoryKey(
                    leader,
                    follower
                  )
              });
            }
          );
        }
      );


      return result;
    };
}


/* ========================================
   Round表示切替
======================================== */

const renderCurrentRoundV38 =
  renderCurrentRound;


renderCurrentRound =
  function () {

    if (
      !lastRoundData
      ||
      lastRoundData.format !==
        "pickup"
    ) {

      renderCurrentRoundV38();

      return;
    }


    renderPickupCurrentRoundV40();
  };


function renderPickupCurrentRoundV40() {

  if (
    !lastRoundData
    ||
    !Array.isArray(
      lastRoundData.battles
    )
  ) {

    roundResultCard
      .classList
      .add(
        "hidden"
      );

    return;
  }


  const battles =
    [];


  lastRoundData.battles.forEach(
    function (
      storedBattle
    ) {

      const pairs =
        [];


      (
        storedBattle.pairs ||
        []
      ).forEach(
        function (
          storedPair
        ) {

          const leader =
            findParticipantById(
              storedPair.leaderId
            );


          const follower =
            findParticipantById(
              storedPair.followerId
            );


          if (
            leader
            &&
            follower
          ) {

            pairs.push({

              leader:
                leader,

              follower:
                follower
            });
          }
        }
      );


      if (
        pairs.length === 0
      ) {

        return;
      }


      const judges =
        (
          storedBattle.judgeIds ||
          []
        )
        .map(
          function (
            id
          ) {

            return (
              findParticipantById(
                id
              )
            );
          }
        )
        .filter(
          Boolean
        );


      const timekeeper =
        storedBattle.timekeeperId != null
          ? findParticipantById(
              storedBattle.timekeeperId
            )
          : null;


      battles.push({

        pairs:
          pairs,

        judges:
          judges,

        timekeeper:
          timekeeper
      });
    }
  );


  if (
    battles.length === 0
  ) {

    roundResultCard
      .classList
      .add(
        "hidden"
      );

    return;
  }


  const waiting =
    (
      lastRoundData.waitingIds ||
      []
    )
    .map(
      function (
        id
      ) {

        return (
          findParticipantById(
            id
          )
        );
      }
    )
    .filter(
      Boolean
    );


  renderPickupRoundV40(
    battles,
    waiting,
    lastRoundData.roundNumber,
    lastRoundData.pickupPairCount
  );
}


/* ========================================
   Pickup表示
======================================== */

function renderPickupRoundV40(
  battles,
  waiting,
  roundNumber,
  pairCount
) {

  roundResultCard
    .classList
    .remove(
      "hidden"
    );


  roundTitle.textContent =
    "Round "
    +
    roundNumber
    +
    "（Pickup / "
    +
    pairCount
    +
    " Pair）";


  battleCount.textContent =
    battles.length
    +
    " Battle";


  battleList.innerHTML =
    "";


  const currentParticipant =
    getCurrentParticipant();


  const currentId =
    currentParticipant
      ? String(
          currentParticipant.id
        )
      : null;


  const personalDanceBattles =
    [];


  const personalJudgeBattles =
    [];


  const personalTimekeeperBattles =
    [];


  battles.forEach(
    function (
      battle,
      battleIndex
    ) {

      const battleNumber =
        battleIndex + 1;


      const dancerIds =
        [];


      battle.pairs.forEach(
        function (
          pair
        ) {

          dancerIds.push(
            String(
              pair.leader.id
            )
          );


          dancerIds.push(
            String(
              pair.follower.id
            )
          );
        }
      );


      const judgeIds =
        battle.judges.map(
          function (
            judge
          ) {

            return String(
              judge.id
            );
          }
        );


      const timekeeperId =
        battle.timekeeper
          ? String(
              battle.timekeeper.id
            )
          : null;


      const isMyDance =
        currentId
        &&
        dancerIds.includes(
          currentId
        );


      const isMyJudge =
        currentId
        &&
        judgeIds.includes(
          currentId
        );


      const isMyTimekeeper =
        currentId
        &&
        timekeeperId ===
          currentId;


      if (
        isMyDance
      ) {

        personalDanceBattles.push(
          battleNumber
        );
      }


      if (
        isMyJudge
      ) {

        personalJudgeBattles.push(
          battleNumber
        );
      }


      if (
        isMyTimekeeper
      ) {

        personalTimekeeperBattles.push(
          battleNumber
        );
      }


      const card =
        document.createElement(
          "div"
        );


      card.className =
        "battle-card";


      if (
        isMyDance
        ||
        isMyJudge
        ||
        isMyTimekeeper
      ) {

        card.classList.add(
          "my-battle"
        );
      }


      const titleRow =
        document.createElement(
          "div"
        );


      titleRow.className =
        "battle-title-row";


      const title =
        document.createElement(
          "div"
        );


      title.className =
        "battle-title";


      title.textContent =
        "Battle "
        +
        battleNumber;


      titleRow.appendChild(
        title
      );


      if (
        isMyDance
        ||
        isMyJudge
        ||
        isMyTimekeeper
      ) {

        const badge =
          document.createElement(
            "span"
          );


        badge.className =
          "my-battle-badge";


        const labels =
          [];


        if (
          isMyDance
        ) {

          labels.push(
            "YOUR BATTLE"
          );
        }


        if (
          isMyJudge
        ) {

          labels.push(
            "YOU JUDGE"
          );
        }


        if (
          isMyTimekeeper
        ) {

          labels.push(
            "TIMEKEEP"
          );
        }


        badge.textContent =
          labels.join(
            " / "
          );


        titleRow.appendChild(
          badge
        );
      }


      card.appendChild(
        titleRow
      );


      battle.pairs.forEach(
        function (
          pair,
          pairIndex
        ) {

          card.appendChild(
            createPairElement(
              "Pair "
              +
              (
                pairIndex + 1
              ),
              pair
            )
          );
        }
      );


      card.appendChild(
        createJudgeElement(
          battle.judges
        )
      );


      card.appendChild(
        createTimekeeperElement(
          battle.timekeeper
        )
      );


      battleList.appendChild(
        card
      );
    }
  );


  if (
    currentParticipant
  ) {

    const messages =
      [];


    if (
      personalDanceBattles.length > 0
    ) {

      messages.push(
        "Dance：Battle "
        +
        personalDanceBattles.join(
          " / "
        )
      );

    } else if (
      getParticipationType(
        currentParticipant
      ) === "dance"
    ) {

      messages.push(
        "今回はDanceなし"
      );
    }


    if (
      personalJudgeBattles.length > 0
    ) {

      messages.push(
        "Judge：Battle "
        +
        personalJudgeBattles.join(
          " / "
        )
      );
    }


    if (
      personalTimekeeperBattles.length > 0
    ) {

      messages.push(
        "Timekeeper：Battle "
        +
        personalTimekeeperBattles.join(
          " / "
        )
      );
    }


    roundPersonalStatus.textContent =
      messages.join(
        "　"
      );


    roundPersonalStatus
      .classList
      .remove(
        "hidden"
      );

  } else {

    roundPersonalStatus
      .classList
      .add(
        "hidden"
      );
  }


  waitingList.innerHTML =
    "";


  if (
    waiting.length === 0
  ) {

    waitingArea
      .classList
      .add(
        "hidden"
      );

  } else {

    waitingArea
      .classList
      .remove(
        "hidden"
      );


    waiting.forEach(
      function (
        participant
      ) {

        const item =
          document.createElement(
            "span"
          );


        item.className =
          "waiting-person";


        if (
          isCurrentParticipant(
            participant
          )
        ) {

          item.classList.add(
            "my-waiting"
          );
        }


        item.textContent =
          participant.name
          +
          "（D"
          +
          participant.danceCount
          +
          "）";


        waitingList.appendChild(
          item
        );
      }
    );
  }
}