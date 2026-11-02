# オオハマボウの樹皮の縄（2026-11-02、科学班、オーナー決定）

オーナー決定（11/02）：オオハマボウの樹皮の内側を、縄の材料に使ってよい（native-woods.md §1 の案）。
値の印は params.ts と同じ（sourced／assumed）。工程の計算は科学の側、住人の暮らしへのつなぎは本体。

## 作り方（太平洋の島々の hau／fau の縄）
| 段 | すること | 印 |
|---|---|---|
| 1. 枝をとる | 若い幹か若い枝を切る。薪のために切ったオオハマボウの枝（#201 の fuel:）や、林 A の株から出た芽を使う | sourced（切り方）／assumed（つなぎ） |
| 2. 皮をはぐ | 縦に切れ目を入れ、手で皮をはぐ。生のうちがはぎやすい | sourced（canoeplants.com、Hōkūleʻa の舟づくり） |
| 3. 浸す | 皮を水に浸す。外の皮がゆるみ、内側のクリーム色のなめらかな繊維が残る。浸すと繊維が強くなる（PROTA） | sourced（浸すこと）／**assumed（日数：島の時計で 7〜14 日）**。日数の資料は見つからなかった |
| 4. こそげる・洗う | 外の皮をこそげ落とす（細い縄ほど丁寧に） | sourced |
| 5. 乾かす | 日陰で乾かす | assumed |
| 6. なう | より合わせる、または編む。いまのヤシの殻の縄（cord-host の撚り糸 3 本合わせ）と同じ手順でよい | sourced（より・編み）／assumed（手順を共有） |

## ヤシの殻の縄（coir）とのちがい（世界の使い分けの案）
| | オオハマボウの樹皮 | ヤシの殻（いま） |
|---|---|---|
| 強さ | ジュートに似る（ジュートの繊維は coir より強い） | 中くらい |
| 海水 | 浸すと強くなるが、長く海にあると傷む（assumed） | 海水に強く、太平洋では舟の縛りに使われた |
| 向き | 陸の仕事：鍋を吊る、小屋・家を縛る、網、かご | 海の仕事：筏の縛り、帆 |
- 材料が 2 つあると、「海には殻の縄、陸には樹皮の縄」という住人の選び方（と失敗）が生まれる。
- 量（assumed）：若い枝 1 本（長さ 2 m、太さ 3〜4 cm）から乾いた繊維 30〜60 g。1 m の縄（太さ 6 mm）に 15〜25 g。

## 決めてあること・まだのこと
- 決めてある：使ってよい（オーナー）。
- まだ：浸す日数（島の時計）・繊維の量・強さの値は assumed。確かめる資料を探す。工程の名前と catalog の形は、本体と科学の側で決める。

## オオバギの萌芽（native-woods.md の続き）
- 11/02 に探したが、Macaranga tanarius の切り株から芽が出るかの資料は見つからない。**「切ったら植え直す木」のまま**にする。

## 出典
- canoeplants.com hau：https://canoeplants.com/hau.html
- Hōkūleʻa 舟づくりの植物：https://archive.hokulea.com/buildplants.html
- ビショップ博物館 hau：https://data.bishopmuseum.org/ethnobotanydb/ethnobotany.php?ID=hau&b=d
- PROTA：https://uses.plantnet-project.org/en/Hibiscus_tiliaceus_(PROTA)

## 本体の形（11/02）と、入るときの値の表（科学班の用意、すべて assumed）
本体の形：3 段（はぐ／浸す／こそげて乾かす）、lot の質に `fiber`（bark・coir）と `soakWater`（sea・fresh）、使い分けの決まりは住人に渡さない。

| id（案） | 値 | 意味 | 印 |
|---|---|---|---|
| `hauPeelFreshH` | 島の時計で 24 時間 | 切ってからこの間は、皮がはぎやすい。過ぎると、はげる量が下がる | assumed |
| `hauPeelLateYield` | 0.5 | 乾いた枝からはげる割合（生の枝を 1 として） | assumed |
| `hauBarkPerBranchMg` | 生の樹皮 150〜300 g（若い枝 1 本：長さ 2 m、太さ 3〜4 cm） | はいだ量 | assumed |
| `hauFiberOfBark` | 0.2 | 生の樹皮から、乾いた繊維になる割合（→ 枝 1 本で 30〜60 g） | assumed |
| `hauSoakMinD`・`hauSoakMaxD` | 島の時計で 7 日・14 日 | これより短いと外の皮が残る（こそげにくく、繊維が少ない）。長いと繊維が弱りはじめる | assumed（日数の資料なし） |
| `hauOverSoakLoss` | 14 日を過ぎて 1 島日ごとに強さ −3 % | 浸しすぎ | assumed |
| `hauDryD` | 島の時計で 2〜3 日（日陰） | 乾かす | assumed |
| `hauRopeMgPerM` | 15〜25 g/m（太さ 6 mm） | 縄 1 m に要る繊維 | assumed |
| `hauStrength` | 殻の縄の 1.5 倍 | 同じ太さの縄の切れにくさ（ジュートは coir より強い） | assumed（相対値。出典：PROTA「ジュートに似る」） |
| `hauSeaDecayPerD` | 海に浸かっている 1 島日ごとに強さ −2 % | 海での傷み | assumed |
| `coirSeaDecayPerD` | 海に浸かっている 1 島日ごとに強さ −0.3 % | 殻の縄の海での傷み（いまの cord の値があればそちらに合わせる） | assumed |
| `soakWater` の効き目 | sea と fresh で同じ | どちらがよいかの資料なし | assumed |

- 確かめ方（入ったら）：浸す日数を 5・10・20 島日で回し、繊維の量と強さが表どおりに変わること。海の仕事に樹皮の縄を使った筏の縛りが、殻の縄より早く切れること。
