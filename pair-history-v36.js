/* ========================================
   Hustle Battle Generator
   Pair History Display v36

   管理者用Pair履歴を

   ・未成立Pair
   ・成立済Pair

   に分けて表示する。

   さらに現在Roundについて
   初めて成立したPair数を表示する。
======================================== */


/* ========================================
   Pair成立可否

   現在のRole設定で、
   2人がLeader + Followerとして
   組める可能性があるか判定する。
======================================== */

function canFormPairV36(
  participantA,
  participantB
) {
  if (
    !participantA ||
    !participantB
  ) {
    return false;
  }


  if (
    String(participantA.id) ===
    String(participantB.id)
  ) {
    return false;
  }


  if (
    getParticipationType(
      participantA
    ) !== "dance"
    ||
    getParticipationType(
      participantB
    ) !== "dance"
  ) {
    return false;
  }


  const aCanLead =
    participantA.role === "leader"
    ||
    participantA.role === "both";


  const aCanFollow =
    participantA.role === "follower"
    ||
    participantA.role === "both";


  const bCanLead =
    participantB.role === "leader"
    ||
    participantB.role === "both";


  const bCanFollow =
    participantB.role === "follower"
    ||
    participantB.role === "both";


  return (
    (
      aCanLead &&
      bCanFollow
    )
    ||
    (
      bCanLead &&
      aCanFollow
    )
  );
}


/* ========================================
   現在成立可能な全Pair取得

   ・Dance参加
   ・現在参加中
   ・Role上成立可能

   を対象にする。
======================================== */

function getPossiblePairsV36() {
  const danceParticipants =
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


  const possiblePairs = [];


  for (
    let i = 0;
    i < danceParticipants.length - 1;
    i++
  ) {

    for (
      let j = i + 1;
      j < danceParticipants.length;
      j++
    ) {

      const participantA =
        danceParticipants[i];


      const participantB =
        danceParticipants[j];


      if (
        !canFormPairV36(
          participantA,
          participantB
        )
      ) {
        continue;
      }


      possiblePairs.push({
        participantA:
          participantA,

        participantB:
          participantB,

        key:
          getHistoryKey(
            participantA,
            participantB
          )
      });
    }
  }


  return possiblePairs;
}


/* ========================================
   今回RoundのPair取得
======================================== */

function getCurrentRoundPairsV36() {
  const result = [];


  if (
    !lastRoundData
    ||
    !Array.isArray(
      lastRoundData.battles
    )
  ) {
    return result;
  }


  lastRoundData.battles.forEach(
    function (battle) {

      [
        battle.pairA,
        battle.pairB
      ].forEach(
        function (pair) {

          if (
            !pair
            ||
            pair.leaderId == null
            ||
            pair.followerId == null
          ) {
            return;
          }


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
}


/* ========================================
   今回初成立Pair数

   Round生成後はPair履歴がすでに+1されている。

   現在の履歴回数が1回なら、
   今回初めて成立したPairと判断できる。
======================================== */

function getCurrentRoundFirstPairCountV36() {
  const currentPairs =
    getCurrentRoundPairsV36();


  let firstCount = 0;


  currentPairs.forEach(
    function (pair) {

      const history =
        pairHistory[
          pair.key
        ];


      if (
        history
        &&
        getNumberOrZero(
          history.count
        ) === 1
      ) {
        firstCount++;
      }
    }
  );


  return {
    firstCount:
      firstCount,

    totalCount:
      currentPairs.length
  };
}


/* ========================================
   Pair表示名
======================================== */

function getPairDisplayNameV36(
  participantA,
  participantB
) {
  return (
    participantA.name
    +
    " + "
    +
    participantB.name
  );
}


/* ========================================
   履歴行作成
======================================== */

function createPairHistoryRowV36(
  nameText,
  countText = ""
) {
  const row =
    document.createElement(
      "div"
    );


  row.className =
    "history-row";


  const names =
    document.createElement(
      "div"
    );


  names.className =
    "history-names";


  names.textContent =
    nameText;


  const count =
    document.createElement(
      "div"
    );


  count.className =
    "history-count";


  count.textContent =
    countText;


  row.appendChild(
    names
  );


  row.appendChild(
    count
  );


  return row;
}


/* ========================================
   折りたたみグループ作成
======================================== */

function createPairGroupV36(
  title,
  count,
  openByDefault
) {
  const details =
    document.createElement(
      "details"
    );


  details.open =
    openByDefault;


  const summary =
    document.createElement(
      "summary"
    );


  summary.className =
    "history-summary";


  const label =
    document.createElement(
      "span"
    );


  label.textContent =
    title;


  const number =
    document.createElement(
      "span"
    );


  number.className =
    "history-summary-note";


  number.textContent =
    count +
    "組";


  summary.appendChild(
    label
  );


  summary.appendChild(
    number
  );


  const content =
    document.createElement(
      "div"
    );


  content.className =
    "history-content";


  details.appendChild(
    summary
  );


  details.appendChild(
    content
  );


  return {
    details:
      details,

    content:
      content
  };
}


/* ========================================
   Pair履歴描画 v36

   既存renderPairHistoryを上書き。
======================================== */

renderPairHistory =
  function () {

    pairHistoryList.innerHTML =
      "";


    /* =====================================
       今回Roundサマリー
    ====================================== */

    if (
      lastRoundData
    ) {

      const currentSummary =
        getCurrentRoundFirstPairCountV36();


      if (
        currentSummary.totalCount > 0
      ) {

        const summaryBox =
          document.createElement(
            "div"
          );


        summaryBox.className =
          "save-note";


        summaryBox.textContent =
          "今回のPair：初成立 "
          +
          currentSummary.firstCount
          +
          "組 / 全"
          +
          currentSummary.totalCount
          +
          "組";


        pairHistoryList.appendChild(
          summaryBox
        );
      }
    }


    /* =====================================
       現在成立可能なPair
    ====================================== */

    const possiblePairs =
      getPossiblePairsV36();


    const unformedPairs = [];


    possiblePairs.forEach(
      function (pair) {

        const history =
          pairHistory[
            pair.key
          ];


        if (
          !history
          ||
          getNumberOrZero(
            history.count
          ) === 0
        ) {

          unformedPairs.push(
            pair
          );
        }
      }
    );


    unformedPairs.sort(
      function (a, b) {

        return (
          getPairDisplayNameV36(
            a.participantA,
            a.participantB
          )
          .localeCompare(
            getPairDisplayNameV36(
              b.participantA,
              b.participantB
            ),
            "ja"
          )
        );
      }
    );


    /* =====================================
       成立済Pair

       実際に履歴が存在するPairを対象。

       Role変更後でも過去に成立したPairは
       履歴として残す。
    ====================================== */

    const formedPairs =
      Object.values(
        pairHistory
      )
      .filter(
        function (item) {

          return (
            getNumberOrZero(
              item.count
            ) > 0

            &&

            findParticipantById(
              item.participantAId
            )

            &&

            findParticipantById(
              item.participantBId
            )
          );
        }
      )
      .sort(
        function (a, b) {

          if (
            b.count !==
            a.count
          ) {

            return (
              b.count -
              a.count
            );
          }


          const participantA1 =
            findParticipantById(
              a.participantAId
            );


          const participantA2 =
            findParticipantById(
              a.participantBId
            );


          const participantB1 =
            findParticipantById(
              b.participantAId
            );


          const participantB2 =
            findParticipantById(
              b.participantBId
            );


          return (
            getPairDisplayNameV36(
              participantA1,
              participantA2
            )
            .localeCompare(
              getPairDisplayNameV36(
                participantB1,
                participantB2
              ),
              "ja"
            )
          );
        }
      );


    /* =====================================
       未成立Pair
    ====================================== */

    const unformedGroup =
      createPairGroupV36(
        "未成立Pair",
        unformedPairs.length,
        false
      );


    if (
      unformedPairs.length === 0
    ) {

      const empty =
        document.createElement(
          "div"
        );


      empty.className =
        "empty-message";


      empty.textContent =
        "現在参加中のメンバーでは、未成立Pairはありません。";


      unformedGroup.content
        .appendChild(
          empty
        );

    } else {

      unformedPairs.forEach(
        function (pair) {

          unformedGroup.content
            .appendChild(
              createPairHistoryRowV36(
                getPairDisplayNameV36(
                  pair.participantA,
                  pair.participantB
                ),
                "0回"
              )
            );
        }
      );
    }


    pairHistoryList.appendChild(
      unformedGroup.details
    );


    /* =====================================
       成立済Pair
    ====================================== */

    const formedGroup =
      createPairGroupV36(
        "成立済Pair",
        formedPairs.length,
        true
      );


    if (
      formedPairs.length === 0
    ) {

      const empty =
        document.createElement(
          "div"
        );


      empty.className =
        "empty-message";


      empty.textContent =
        "成立済Pairはまだありません。";


      formedGroup.content
        .appendChild(
          empty
        );

    } else {

      formedPairs.forEach(
        function (item) {

          const participantA =
            findParticipantById(
              item.participantAId
            );


          const participantB =
            findParticipantById(
              item.participantBId
            );


          formedGroup.content
            .appendChild(
              createPairHistoryRowV36(
                getPairDisplayNameV36(
                  participantA,
                  participantB
                ),
                item.count +
                "回"
              )
            );
        }
      );
    }


    pairHistoryList.appendChild(
      formedGroup.details
    );


    /*
      v36では独自に空表示を処理するので、
      既存のPair履歴Emptyは非表示にする。
    */

    pairHistoryEmpty.style.display =
      "none";
  };


/* ========================================
   読み込み直後にも反映
======================================== */

renderPairHistory();