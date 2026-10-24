/* ========================================
   Hustle Battle Generator
   Pickup Battle v39

   対面方式v38は変更しない。

   ピックアップ方式のみ追加する。

   主な仕様
   ----------------------------------------
   ・2 / 3 / 4 / 5 Pair同時を選択可能
   ・1BattleのPair数は常に指定数を維持
   ・端数分は同一Round内で再出場
   ・再出場時もPairは組み替える
   ・BothはBattleごとにLeader / Follower可変
   ・同一Battleで同じ人は1回だけ
   ・前Round未出場者を次Roundで優先
   ・Dance回数を公平化
   ・同一Round同一Pairを強く回避
   ・未成立Pairを優先
   ・前Round最後 → 次Round最初の連続を回避
   ・同一Round内の連続Danceを回避
   ・Judge 3人
   ・Timekeeper 1人
   ・対戦履歴は更新しない
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

   v38で登録済みのイベントを外し、
   v39の振り分け関数へ変更。

   対面方式の場合は
   generateRoundV38() をそのまま呼ぶ。
======================================== */

generateRoundButton.removeEventListener(
  "click",
  generateRoundV38
);

generateRoundButton.addEventListener(
  "click",
  generateRoundByFormatV39
);


async function generateRoundByFormatV39() {
  const format =
    battleFormatSelect
      ? battleFormatSelect.value
      : "faceToFace";


  if (format === "pickup") {
    await generatePickupRoundV39();

  } else {
    await generateRoundV38();
  }
}


/* ========================================
   方式選択UI
======================================== */

function updateBattleFormatUIV39() {
  if (
    !battleFormatSelect ||
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


  if (roundFormatDescription) {

    if (isPickup) {

      roundFormatDescription.textContent =
        "複数Pairが同時に踊るピックアップ方式です。Pair数を選択してください。";

    } else {

      roundFormatDescription.textContent =
        "2Pairが対面する従来のBattle方式です。";
    }
  }
}


if (battleFormatSelect) {

  battleFormatSelect.addEventListener(
    "change",
    updateBattleFormatUIV39
  );
}


updateBattleFormatUIV39();


/* ========================================
   Role判定
======================================== */

function canLeadV39(
  participant
) {
  return (
    participant.role === "leader"
    ||
    participant.role === "both"
  );
}


function canFollowV39(
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

async function generatePickupRoundV39() {
  if (!isCurrentUserAdmin) {
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


  /*
    1Battleで必要なDance人数
  */

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
      canLeadV39
    );


  const possibleFollowers =
    activeDanceParticipants.filter(
      canFollowV39
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
    calculatePickupBattleCountV39(
      activeDanceParticipants,
      pairCount
    );


  const previousFinalIds =
    getPreviousFinalBattleParticipantIds();


  const previousRoundPairKeys =
    getPreviousRoundPairKeys();


  const previousWaitingIds =
    getPreviousWaitingIdsV39();


  /*
    Round全体を複数回試行し、
    最も条件の良いScheduleを採用する。

    Battleを1つずつ確定してしまうと
    最後のBattleでPair選択肢がなくなるため、
    Round全体の候補を比較する。
  */

  const schedule =
    createPickupScheduleV39(
      activeDanceParticipants,
      pairCount,
      battleNumber,
      previousFinalIds,
      previousRoundPairKeys,
      previousWaitingIds
    );


  if (
    !schedule ||
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
     Dance回数・Pair履歴更新
  ====================================== */

  const roundDanceCounts =
    new Map();


  activeDanceParticipants.forEach(
    function (participant) {

      roundDanceCounts.set(
        String(participant.id),
        0
      );
    }
  );


  schedule.forEach(
    function (battle) {

      battle.pairs.forEach(
        function (pair) {

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


          /*
            Pair履歴は
            対面 / Pickup共通。
          */

          addPairHistory(
            pair.leader,
            pair.follower
          );
        }
      );
    }
  );


  /* =====================================
     Judge選定

     既存思想を維持。

     ・そのBattleのDancerは除外
     ・同一RoundでJudge済みを回避
     ・Battle1では前Round最終担当者を回避
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
          function (id) {

            avoidIds.add(
              String(id)
            );
          }
        );
      }


      roundJudgeUsedIds.forEach(
        function (id) {

          avoidIds.add(
            String(id)
          );
        }
      );


      battle.judges =
        selectPickupJudgesV39(
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

     Judge決定後にBattle単位で選ぶ。

     ・そのBattleでDanceしていない
     ・Judgeでもない
     ・同RoundでT未担当
     ・T回数が少ない

     候補0の場合のみJudge兼任。
  ====================================== */

  const roundTimekeeperUsedIds =
    new Set();


  schedule.forEach(
    function (battle) {

      const timekeeper =
        selectPickupTimekeeperV39(
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
     今回一度もDanceしなかった人
  ====================================== */

  const waitingParticipants =
    activeDanceParticipants.filter(
      function (participant) {

        return (
          (
            roundDanceCounts.get(
              String(
                participant.id
              )
            ) || 0
          )
          === 0
        );
      }
    );


  currentRound++;


  lastRoundData =
    serializePickupRoundV39(
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
   Battle数計算

   条件：
   ・全員を最低1回出せるだけのDance枠
   ・固定Leaderを最低1回出せるLeader枠
   ・固定Followerを最低1回出せるFollower枠

   の最大値。

   例：
   Lead7 / Follow8 / 3Pair

   全体：
   ceil(15 / 6) = 3

   Leader：
   ceil(7 / 3) = 3

   Follow：
   ceil(8 / 3) = 3

   → 3Battle
======================================== */

function calculatePickupBattleCountV39(
  danceParticipants,
  pairCount
) {

  const fixedLeaders =
    danceParticipants.filter(
      function (participant) {

        return (
          participant.role ===
          "leader"
        );
      }
    ).length;


  const fixedFollowers =
    danceParticipants.filter(
      function (participant) {

        return (
          participant.role ===
          "follower"
        );
      }
    ).length;


  const byTotal =
    Math.ceil(
      danceParticipants.length /
      (
        pairCount * 2
      )
    );


  const byLeader =
    Math.ceil(
      fixedLeaders /
      pairCount
    );


  const byFollower =
    Math.ceil(
      fixedFollowers /
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
   前RoundDance未出場者
======================================== */

function getPreviousWaitingIdsV39() {
  const result =
    new Set();


  if (
    !lastRoundData ||
    !Array.isArray(
      lastRoundData.waitingIds
    )
  ) {
    return result;
  }


  lastRoundData.waitingIds.forEach(
    function (id) {

      result.add(
        String(id)
      );
    }
  );


  return result;
}


/* ========================================
   Round Schedule生成

   ランダム探索を複数回行い、
   Round全体スコアが最良のものを採用。

   人数15名前後を想定しているため
   十分軽量。
======================================== */

function createPickupScheduleV39(
  danceParticipants,
  pairCount,
  battleNumber,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds
) {

  let bestSchedule =
    null;


  let bestScore =
    null;


  /*
    試行回数。

    同じ条件でも候補を複数探索し、
    Battle後半でのPair重複を減らす。
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
      function (participant) {

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
        createPickupBattleCandidateV39(
          danceParticipants,
          pairCount,
          battleIndex,
          roundAppearances,
          roundPairKeys,
          previousBattleDancerIds,
          previousFinalIds,
          previousRoundPairKeys,
          previousWaitingIds
        );


      if (!battle) {

        failed = true;

        break;
      }


      battles.push(
        battle
      );


      const currentBattleIds =
        new Set();


      battle.pairs.forEach(
        function (pair) {

          [
            pair.leader,
            pair.follower
          ].forEach(
            function (participant) {

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


          roundPairKeys.add(
            getHistoryKey(
              pair.leader,
              pair.follower
            )
          );
        }
      );


      previousBattleDancerIds =
        currentBattleIds;
    }


    if (
      failed ||
      battles.length !==
        battleNumber
    ) {
      continue;
    }


    const score =
      scorePickupScheduleV39(
        battles,
        danceParticipants,
        previousFinalIds,
        previousRoundPairKeys,
        previousWaitingIds
      );


    if (
      bestScore === null ||
      comparePickupScheduleScoresV39(
        score,
        bestScore
      ) < 0
    ) {

      bestScore =
        score;


      bestSchedule =
        battles;


      /*
        非常に良いScheduleなら
        無駄な探索を減らす。

        ・全員最低1回
        ・前Round未出場者全員出場
        ・Round内Pair重複0
        ・成立済Pair0
        ・境界重複0
        ・連続Dance0

        が全て満たされた場合。
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
   1Battle候補生成

   Battleを何度か作り、
   最良候補を返す。
======================================== */

function createPickupBattleCandidateV39(
  danceParticipants,
  pairCount,
  battleIndex,
  roundAppearances,
  roundPairKeys,
  previousBattleDancerIds,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds
) {

  let bestBattle =
    null;


  let bestScore =
    null;


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
        createPickupPairCandidatesV39(
          danceParticipants,
          usedIds,
          battleIndex,
          roundAppearances,
          roundPairKeys,
          previousBattleDancerIds,
          previousFinalIds,
          previousRoundPairKeys,
          previousWaitingIds
        );


      if (
        candidates.length === 0
      ) {

        failed = true;

        break;
      }


      candidates.sort(
        comparePickupPairChoiceV39
      );


      /*
        完全に1位だけを取り続けると
        Battle後半で詰まる場合があるため、
        上位候補から少しランダムに選ぶ。
      */

      const candidatePool =
        candidates.slice(
          0,
          Math.min(
            5,
            candidates.length
          )
        );


      const selected =
        getRandomItem(
          candidatePool
        );


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
      failed ||
      pairs.length !==
        pairCount
    ) {
      continue;
    }


    const battle = {

      pairs:
        pairs,

      judges: [],

      timekeeper: null
    };


    const score =
      scorePickupBattleV39(
        battle,
        battleIndex,
        roundAppearances,
        roundPairKeys,
        previousBattleDancerIds,
        previousFinalIds,
        previousRoundPairKeys,
        previousWaitingIds
      );


    if (
      bestScore === null ||
      comparePickupBattleScoresV39(
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
   Pair候補作成

   同一Battleでは
   同じ人を2回使用しない。
======================================== */

function createPickupPairCandidatesV39(
  danceParticipants,
  usedIds,
  battleIndex,
  roundAppearances,
  roundPairKeys,
  previousBattleDancerIds,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds
) {

  const candidates =
    [];


  danceParticipants.forEach(
    function (leader) {

      if (
        !canLeadV39(
          leader
        )
      ) {
        return;
      }


      if (
        usedIds.has(
          String(
            leader.id
          )
        )
      ) {
        return;
      }


      danceParticipants.forEach(
        function (follower) {

          if (
            !canFollowV39(
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


          if (
            usedIds.has(
              String(
                follower.id
              )
            )
          ) {
            return;
          }


          const pairKey =
            getHistoryKey(
              leader,
              follower
            );


          const leaderId =
            String(
              leader.id
            );


          const followerId =
            String(
              follower.id
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
              pairKey
            )
              ? 1
              : 0;


          const historyCount =
            getPairHistoryCount(
              leader,
              follower
            );


          const existingPair =
            historyCount > 0
              ? 1
              : 0;


          const previousRoundPair =
            previousRoundPairKeys.has(
              pairKey
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
              existingPair,

            previousRoundPair:
              previousRoundPair,

            historyCount:
              historyCount,

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

   Battle生成中のガイド。

   Round全体では後から
   別途Schedule評価する。
======================================== */

function comparePickupPairChoiceV39(
  a,
  b
) {

  /*
    前Round未出場者を優先
  */

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


  /*
    今Round未出場者を優先
  */

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


  /*
    公平性
  */

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


  /*
    同一Round同Pairは強く回避
  */

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


  /*
    未成立Pair優先
  */

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


  /*
    直前Round同Pair回避
  */

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


  /*
    Pair関連を優先した後に
    Round境界連続回避。
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
    同一Round内連続回避。
  */

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
   Battle単体評価
======================================== */

function scorePickupBattleV39(
  battle,
  battleIndex,
  roundAppearances,
  roundPairKeys,
  previousBattleDancerIds,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds
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
    function (pair) {

      const pairKey =
        getHistoryKey(
          pair.leader,
          pair.follower
        );


      const historyCount =
        getPairHistoryCount(
          pair.leader,
          pair.follower
        );


      if (
        roundPairKeys.has(
          pairKey
        )
      ) {
        sameRoundPairRepeats++;
      }


      if (
        historyCount > 0
      ) {
        existingPairCount++;
      }


      if (
        previousRoundPairKeys.has(
          pairKey
        )
      ) {
        previousRoundPairCount++;
      }


      historyTotal +=
        historyCount;


      [
        pair.leader,
        pair.follower
      ].forEach(
        function (participant) {

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
   Battle候補比較
======================================== */

function comparePickupBattleScoresV39(
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

function scorePickupScheduleV39(
  battles,
  danceParticipants,
  previousFinalIds,
  previousRoundPairKeys,
  previousWaitingIds
) {

  const appearanceCounts =
    new Map();


  danceParticipants.forEach(
    function (participant) {

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
        function (pair) {

          const key =
            getHistoryKey(
              pair.leader,
              pair.follower
            );


          usedPairCounts.set(
            key,
            (
              usedPairCounts.get(
                key
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


          if (
            previousRoundPairKeys.has(
              key
            )
          ) {
            previousRoundPairCount++;
          }


          historyTotal +=
            historyCount;


          [
            pair.leader,
            pair.follower
          ].forEach(
            function (participant) {

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
    function (participant) {

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
      function (value) {

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
    function (count) {

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
   Round全体候補比較

   今回合意した優先順位。

   1. 前Round未出場者
   2. 今Round全員最低1回
   3. Dance公平性
   4. 同一Round同Pair
   5. 未成立Pair
   6. 直前Round同Pair
   7. Pair履歴回数
   8. 前Round最後→次Round最初
   9. 同一Round連続Dance
======================================== */

function comparePickupScheduleScoresV39(
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
   Judge選定
======================================== */

function selectPickupJudgesV39(
  battle,
  requestedCount,
  avoidIds = new Set()
) {

  const dancerIds =
    new Set();


  battle.pairs.forEach(
    function (pair) {

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
   Timekeeper
======================================== */

function selectPickupTimekeeperV39(
  battle,
  usedTimekeeperIds
) {

  const dancerIds =
    new Set();


  battle.pairs.forEach(
    function (pair) {

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


  if (
    idleCandidates.length > 0
  ) {

    return selectFairPickupTimekeeperV39(
      idleCandidates,
      usedTimekeeperIds
    );
  }


  /*
    本当に候補がいない場合だけ
    Judgeと兼任。
  */

  if (
    battle.judges.length > 0
  ) {

    return selectFairPickupTimekeeperV39(
      battle.judges,
      usedTimekeeperIds
    );
  }


  return null;
}


function selectFairPickupTimekeeperV39(
  candidates,
  usedTimekeeperIds
) {

  if (
    !candidates ||
    candidates.length === 0
  ) {
    return null;
  }


  const unused =
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
    unused.length > 0
      ? unused
      : candidates;


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


  const best =
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
    best
  );
}


/* ========================================
   Pickup Round保存形式
======================================== */

function serializePickupRoundV39(
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
        function (battle) {

          return {

            pairs:
              battle.pairs.map(
                function (pair) {

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
                function (judge) {

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
        function (participant) {

          return participant.id;
        }
      )
  };
}


/* ========================================
   前Round最終Battle参加者

   v38既存関数を拡張。

   Pickupの場合は
   全PairのDancer + Judgeを対象。

   対面の場合は既存関数を使用。
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
        function (pair) {

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
      function (id) {

        result.add(
          String(id)
        );
      }
    );


    return result;
  };


/* ========================================
   直前Round Pair一覧

   Pickup全Pairに対応。

   対面方式の場合は既存v38を使用。
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
      function (battle) {

        (
          battle.pairs ||
          []
        ).forEach(
          function (pair) {

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
   Pair履歴v36
   「今回のPair」Pickup対応
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
        function (battle) {

          (
            battle.pairs ||
            []
          ).forEach(
            function (pair) {

              const leader =
                findParticipantById(
                  pair.leaderId
                );


              const follower =
                findParticipantById(
                  pair.followerId
                );


              if (
                !leader ||
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
   Pickup Round表示

   対面方式は既存renderCurrentRoundを使用。
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


    renderPickupCurrentRoundV39();
  };


function renderPickupCurrentRoundV39() {
  if (
    !lastRoundData
    ||
    !Array.isArray(
      lastRoundData.battles
    )
  ) {

    roundResultCard
      .classList
      .add("hidden");

    return;
  }


  const battles =
    [];


  lastRoundData.battles.forEach(
    function (storedBattle) {

      const pairs =
        [];


      (
        storedBattle.pairs ||
        []
      ).forEach(
        function (storedPair) {

          const leader =
            findParticipantById(
              storedPair.leaderId
            );


          const follower =
            findParticipantById(
              storedPair.followerId
            );


          if (
            leader &&
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
          function (id) {

            return (
              findParticipantById(
                id
              )
            );
          }
        )
        .filter(Boolean);


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
      .add("hidden");

    return;
  }


  const waiting =
    (
      lastRoundData.waitingIds ||
      []
    )
    .map(
      function (id) {

        return (
          findParticipantById(
            id
          )
        );
      }
    )
    .filter(Boolean);


  renderPickupRoundV39(
    battles,
    waiting,
    lastRoundData.roundNumber,
    lastRoundData.pickupPairCount
  );
}


/* ========================================
   Pickup Round描画
======================================== */

function renderPickupRoundV39(
  battles,
  waiting,
  roundNumber,
  pairCount
) {

  roundResultCard
    .classList
    .remove("hidden");


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
        function (pair) {

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
          function (judge) {

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


      if (isMyDance) {

        personalDanceBattles.push(
          battleNumber
        );
      }


      if (isMyJudge) {

        personalJudgeBattles.push(
          battleNumber
        );
      }


      if (isMyTimekeeper) {

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


        if (isMyDance) {

          labels.push(
            "YOUR BATTLE"
          );
        }


        if (isMyJudge) {

          labels.push(
            "YOU JUDGE"
          );
        }


        if (isMyTimekeeper) {

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


  /* =====================================
     個人表示
  ====================================== */

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
      .remove("hidden");

  } else {

    roundPersonalStatus
      .classList
      .add("hidden");
  }


  /* =====================================
     Dance未出場
  ====================================== */

  waitingList.innerHTML =
    "";


  if (
    waiting.length === 0
  ) {

    waitingArea
      .classList
      .add("hidden");

  } else {

    waitingArea
      .classList
      .remove("hidden");


    waiting.forEach(
      function (participant) {

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