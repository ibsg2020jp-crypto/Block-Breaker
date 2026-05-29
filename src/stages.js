export const BLOCK_DEFS = {
  normal: { label: "通常", hp: 1, score: 100, color: "#72d7ff", breakable: true },
  hard: { label: "硬い", hp: 2, score: 200, color: "#9aa7ff", breakable: true },
  score: { label: "高得点", hp: 1, score: 500, color: "#ffe08a", breakable: true },
  switch: { label: "スイッチ", hp: 1, score: 250, color: "#8ff0a4", breakable: true },
  solid: { label: "反射", hp: Infinity, score: 0, color: "#5b6475", breakable: false },
  locked: { label: "封印", hp: Infinity, score: 0, color: "#3f4a5e", breakable: false }
};

export const STAGES = [
  {
    id: 1,
    name: "はじまりの壁",
    timeLimit: 90,
    lives: 3,
    targetTime: 55,
    dialogueBefore: [
      "静かなブロックの壁が道をふさいでいる。",
      "まずはボールを跳ね返して、全部壊してみよう。"
    ],
    dialogueAfter: ["道が少し開けた。次は少しかたいブロックが待っている。"],
    layout: [
      ["normal", "normal", "normal", "normal", "normal", "normal"],
      ["normal", "score", "normal", "normal", "score", "normal"],
      ["normal", "normal", "normal", "normal", "normal", "normal"]
    ],
    warps: []
  },
  {
    id: 2,
    name: "かたい守り",
    timeLimit: 100,
    lives: 3,
    targetTime: 70,
    dialogueBefore: [
      "色の濃いブロックは一度では壊れない。",
      "反射角を狙って、同じ場所に何度も当てよう。"
    ],
    dialogueAfter: ["かたい守りを抜けた。奥にスイッチの気配がある。"],
    layout: [
      ["normal", "hard", "hard", "hard", "hard", "normal"],
      ["normal", "normal", "score", "score", "normal", "normal"],
      ["hard", "normal", "normal", "normal", "normal", "hard"],
      ["normal", "normal", "hard", "hard", "normal", "normal"]
    ],
    warps: []
  },
  {
    id: 3,
    name: "スイッチ回廊",
    timeLimit: 110,
    lives: 3,
    targetTime: 80,
    dialogueBefore: [
      "緑のスイッチを壊すと、封印されたブロックが壊せるようになる。",
      "順番を考えると、すばやく突破できそうだ。"
    ],
    dialogueAfter: ["スイッチで道を開く感覚をつかめた。次は空間がゆがむ。"],
    layout: [
      ["locked", "locked", "normal", "normal", "locked", "locked"],
      ["normal", "switch", "hard", "hard", "switch", "normal"],
      ["normal", "normal", "score", "score", "normal", "normal"],
      ["solid", "normal", "normal", "normal", "normal", "solid"]
    ],
    switchEffect: {
      convertLockedTo: "normal",
      timeBonus: 8
    },
    warps: []
  },
  {
    id: 4,
    name: "ワープゲート",
    timeLimit: 120,
    lives: 3,
    targetTime: 90,
    dialogueBefore: [
      "光る輪に触れると、ボールが別の場所へワープする。",
      "ワープ後の軌道を利用して、届きにくいブロックを狙おう。"
    ],
    dialogueAfter: ["ワープを抜けて、最後の試験場が見えてきた。"],
    layout: [
      ["normal", "normal", "hard", "hard", "normal", "normal"],
      ["score", "solid", "normal", "normal", "solid", "score"],
      ["normal", "normal", "hard", "hard", "normal", "normal"],
      ["normal", "normal", "normal", "normal", "normal", "normal"]
    ],
    warps: [
      { in: { x: 76, y: 360 }, out: { x: 284, y: 170 }, label: "A" },
      { in: { x: 284, y: 360 }, out: { x: 76, y: 170 }, label: "B" }
    ]
  },
  {
    id: 5,
    name: "静かな最終試験",
    timeLimit: 135,
    lives: 3,
    targetTime: 100,
    dialogueBefore: [
      "最後はスイッチとワープの総合ステージ。",
      "焦らず、でも素早く。静かに完全クリアを目指そう。"
    ],
    dialogueAfter: ["すべてのブロックが崩れ、静かな達成感だけが残った。"],
    layout: [
      ["locked", "hard", "score", "score", "hard", "locked"],
      ["normal", "switch", "normal", "normal", "switch", "normal"],
      ["hard", "solid", "hard", "hard", "solid", "hard"],
      ["normal", "normal", "score", "score", "normal", "normal"],
      ["normal", "hard", "normal", "normal", "hard", "normal"]
    ],
    switchEffect: {
      convertLockedTo: "score",
      timeBonus: 10
    },
    warps: [
      { in: { x: 64, y: 396 }, out: { x: 296, y: 170 }, label: "A" },
      { in: { x: 296, y: 396 }, out: { x: 64, y: 170 }, label: "B" }
    ]
  }
];
