# ブロック崩し

ブラウザで遊べる、スマホ対応のシンプルなブロック崩しゲームです。

## 公開URL

GitHub Pagesを有効にしたら、以下のURLで遊べます。

https://ibsg2020jp-crypto.github.io/Block-Breaker/

## 遊び方

- スマホ / タブレット：画面下部をドラッグしてパドルを移動、タップでボール発射
- PC：マウス移動またはドラッグでパドルを移動、クリックでボール発射
- キーボード：`←` / `→` で移動、`Space` で発射、`P` で一時停止

## ゲーム内容

- 全ての破壊対象ブロックを壊すとステージクリア
- ボールが落ちると残機が減少
- 残機0で落下、または制限時間0で失敗
- スイッチやワープなどのギミックあり
- スコア、評価ランク、ベストタイム、実績を保存

## 実行方法

GitHub Pagesで公開するか、ローカルサーバーで起動してください。

```bash
python3 -m http.server 8000
```

その後、ブラウザで以下を開きます。

```txt
http://localhost:8000
```

## ファイル構成

```txt
.
├── index.html
├── README.md
├── REQUIREMENTS.md
├── src
│   ├── audio.js
│   ├── game.js
│   ├── main.js
│   ├── physics.js
│   ├── stages.js
│   └── storage.js
└── styles
    └── style.css
```

## 保存について

進行状況、ベストタイム、実績、設定はブラウザの `localStorage` に保存されます。
外部サーバーやログインは不要です。
