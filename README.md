# SoundDitect

音声異常検知AIモデル訓練システム / Sound Anomaly Detection AI Training System

---

## 概要

SoundDitectは、JSONデータファイルから音声異常検知AIモデルを訓練・生成する専用システムです。
1D-CNN + Attention機構を使用した高精度な音声異常検知モデルの学習が可能です。

## 主な機能

- 🧠 **AIモデル訓練**: 1D-CNN + Attention機構による高精度な異常音検知モデル
- 📊 **JSONデータ学習**: dataディレクトリ内のJSONファイルを使用した自動学習
- 📈 **実験管理**: ClearMLによる学習プロセスの記録・管理
- ⚡ **メモリ効率**: 大容量データに対応したストリーミング処理
- 🔧 **設定管理**: config.yamlによる詳細な学習パラメータ設定

## セットアップと実行手順

### 1. 環境準備

#### ローカル環境での実行

```bash
# リポジトリをクローン
git clone https://github.com/Kalorie560/SoundDitect.git
cd SoundDitect

# 仮想環境を作成・有効化
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# pipを最新バージョンにアップグレード（重要）
pip install --upgrade pip

# 依存関係をインストール
pip install -r requirements.txt
```

#### Google Colab での実行（推奨）

Google Colab T4 GPU を使用することで、高速かつ効率的な学習が可能です：

```python
# Colab セルで実行
!git clone https://github.com/Kalorie560/SoundDitectTrain.git
%cd SoundDitectTrain

# 依存関係のインストール
!pip install -r requirements.txt

# Colab用追加ライブラリ
!pip install nest-asyncio

# Colab最適化設定ファイルを確認
!ls config_colab.yaml
```

**Colab 専用最適化機能:**
- 🎮 T4 GPU メモリ効率化（16GB VRAM最適化）
- 💾 システムメモリ制限（12-13GB RAM対応）
- ⚡ 混合精度学習による高速化
- 🔧 カーネルサイズ63対応の最適化
- ⏱️ 12時間セッション制限対応

### 2. ClearML設定（推奨）

```bash
# ClearMLを設定（以下のいずれかの方法を選択）

# 方法1: 自動設定スクリプトを使用（推奨）
python scripts/setup_clearml.py

# 方法2: 手動設定
clearml-init

# 方法3: 環境変数で設定
export CLEARML_WEB_HOST=https://app.clear.ml
export CLEARML_API_HOST=https://api.clear.ml
export CLEARML_FILES_HOST=https://files.clear.ml
export CLEARML_API_ACCESS_KEY=your_access_key_here
export CLEARML_API_SECRET_KEY=your_secret_key_here
```

> 🌟 **ClearMLアカウント**: [https://app.clear.ml](https://app.clear.ml) でアカウント作成後、プロフィールページから認証情報を取得してください。

### 3. 学習データの準備

独自のJSONデータファイルを`./data`ディレクトリに配置してください。

**データ形式要件**:
```json
{
  "waveforms": [
    [0.0, 0.01, -0.01, 0.02, ...],  // 44100個の音声サンプル（1秒分）
    [0.0, 0.0, 0.02, 0.05, ...]
  ],
  "labels": [
    "OK",   // 正常音
    "NG"    // 異常音
  ],
  "fs": 44100,        // サンプリング周波数
  "metric": "RMS"     // 測定指標
}
```

**重要**: システムは新旧両方のデータ形式に対応しています：
- **新形式**: `{"waveforms": [...], "labels": ["OK", "NG"]}` (推奨)
- **旧形式**: `[{"Waveform": [...], "Labels": 0}]` (互換性のため)

### 4. モデル学習

#### ローカル環境での学習

```bash
# モデルを学習（すべての設定はconfig.yamlから読み込まれます）
python scripts/train_model.py
```

#### Google Colab での学習（推奨）

```python
# Colab セルで実行 - カーネルサイズ63に最適化済み
!python scripts/train_model_colab.py
```

**Colab学習時の注意事項:**
- 📱 **データアップロード**: JSON学習ファイルをColab のファイルブラウザでアップロード
- ⏱️ **学習時間**: 推定時間が表示されます（12時間制限内で完了するよう最適化済み）
- 💾 **モデル保存**: 学習完了後は `models/` フォルダからダウンロード
- 🔧 **設定**: `config_colab.yaml` を使用してT4に最適化

**Colab での効率的な使用方法:**
```python
# データアップロード（Colab セル）
from google.colab import files
uploaded = files.upload()  # JSONファイルを選択

# データフォルダに移動
!mkdir -p data
!mv *.json data/

# メモリ使用量確認
!free -h && nvidia-smi

# 学習開始（進捗監視付き）
!python scripts/train_model_colab.py

# 完了後、モデルダウンロード
from google.colab import files
!zip -r models.zip models/
files.download('models.zip')
```

### 5. 早期停止（Early Stopping）について

学習中に「Early stopping triggered」というメッセージが表示される場合があります。これは正常な動作です。

**早期停止が発動する条件:**

1. **検証損失の監視**: 各エポック後に検証データでの損失（validation loss）を計算
2. **改善の判定**: 検証損失が前回のベスト値より改善しない場合、忍耐カウンター（patience counter）が増加
3. **停止の発動**: 忍耐カウンターが設定値に達すると自動的に学習を停止

**設定パラメータ:**

```yaml
# config.yaml または config_colab.yaml
training:
  early_stopping:
    patience: 10  # 検証損失が改善しない連続エポック数
```

**早期停止の動作詳細:**

```
エポック 1: 検証損失 0.5 → ベスト更新、忍耐カウンター = 0
エポック 2: 検証損失 0.6 → 改善なし、忍耐カウンター = 1
エポック 3: 検証損失 0.4 → ベスト更新、忍耐カウンター = 0
...
エポック N: 忍耐カウンター = 10 → "Early stopping triggered" → 学習終了
```

**早期停止のメリット:**
- 🛡️ **過学習防止**: モデルが訓練データに過度に適応することを防ぐ
- ⏱️ **時間節約**: 不要な学習を避けて効率的に最適なモデルを獲得
- 💾 **自動保存**: 最良性能時のモデルが自動的に保存される
- 🎯 **最適化**: 検証データでの性能が最も良いタイミングで学習完了

**早期停止が頻繁に発生する場合の対処:**
- `patience` 値を大きくする（例: 10 → 20）
- 学習率を下げる（例: 0.001 → 0.0001）
- バッチサイズを調整する
- データの前処理方法を見直す

## プロジェクト構造

```
SoundDitect/
├── config.yaml              # 設定ファイル（ローカル環境用）
├── config_colab.yaml        # Colab T4 最適化設定ファイル ⭐新規
├── requirements.txt          # Python依存関係
├── backend/                 # バックエンドコード
│   ├── audio_processor.py  # 音声前処理
│   ├── model_manager.py    # AIモデル管理（AMP対応）
│   └── memory_manager.py   # メモリ管理（Colab最適化）
├── scripts/                 # ユーティリティスクリプト
│   ├── train_model.py      # モデル学習（標準）
│   ├── train_model_colab.py # Colab専用学習スクリプト ⭐新規
│   └── setup_clearml.py    # ClearML設定スクリプト
├── models/                  # 学習済みモデル保存先
├── data/                    # 学習データ
├── logs/                    # ログファイル
└── outputs/                 # 実験結果
```

**⭐ Colab 最適化ファイル:**
- `config_colab.yaml`: T4 GPU に最適化されたパラメータ設定
- `train_model_colab.py`: Colab 環境での自動最適化とメモリ監視
- カーネルサイズ63を維持しつつ、メモリ効率を最大化

## システム要件

### ローカル環境

**CPU要件:**
- **最小**: Intel Core i5-8th gen / AMD Ryzen 5 3600 以上
- **推奨**: Intel Core i7-10th gen / AMD Ryzen 7 4700U 以上  

**GPU要件:**
- **CPU使用時**: GPUは不要（統合グラフィックスで十分）
- **GPU使用時（オプション）**: NVIDIA GTX 1060 / RTX 3050 以上（CUDA対応）

**メモリ要件:**
- **最小**: 4GB RAM
- **推奨**: 8GB RAM 以上

**ストレージ要件:**
- **必要容量**: 2GB以上の空き容量
- **推奨**: SSD（高速なファイルアクセス）

### Google Colab 環境（推奨）

**✅ Colab 無料版:**
- **GPU**: NVIDIA T4 (16GB VRAM) - 自動最適化対応
- **CPU**: Intel Xeon (2コア)
- **RAM**: 12-13GB - 専用最適化済み
- **ストレージ**: 100GB (セッション制限あり)
- **学習時間**: 最大12時間/セッション

**💡 Colab 利用のメリット:**
- 💰 無料でT4 GPU使用可能
- 🔧 環境構築不要（即座に学習開始）
- ⚡ カーネルサイズ63対応の最適化済み
- 📱 どこからでもアクセス可能
- 🤖 自動メモリ管理

## AIモデルアーキテクチャ

1. **前処理**: バンドパスフィルタ + 正規化
2. **1D-CNN**: 時系列パターンの特徴抽出
3. **Multi-Head Attention**: 重要な時間フレームに注目
4. **分類器**: 正常/異常の2クラス分類

## ClearML実験管理

```bash
# ClearML設定（初回のみ）
clearml-init

# 実験の可視化
clearml-serving --open
```

## カスタマイズ

`config.yaml`ファイルを編集して以下をカスタマイズできます：
- モデルアーキテクチャパラメータ
- 学習設定（エポック数、バッチサイズなど）
- 音声処理設定（サンプリング周波数、フィルタ設定）
- ClearMLプロジェクト設定

## トラブルシューティング

### ローカル環境

**ModuleNotFoundError: No module named 'yaml'**
- PyYAMLが正しくインストールされていない場合に発生します
- 解決方法:
  ```bash
  pip install --upgrade pip
  pip install pyyaml==6.0.1
  pip install -r requirements.txt
  ```

**モデル学習エラー: 'num_samples should be a positive integer value, but got num_samples=0'**
- **原因**: データ分割問題またはJSONファイルの形式エラー
- **解決方法**:
  1. ./dataディレクトリに正しい形式のJSONファイルを配置
  2. データ形式を確認: `{'waveforms': [[...]], 'labels': ['OK', 'NG'], 'fs': 44100}`

**ClearML SSL接続エラー**
- **対処**: エラーが発生してもモデル学習は継続されます（ClearMLなしで実行）

### Google Colab 環境

**❌ 「セッションがクラッシュしました」エラー**
- **原因**: メモリ不足（通常はバッチサイズが大きすぎる）
- **解決方法**:
  ```python
  # config_colab.yaml の batch_size を更に削減
  batch_size: 2  # 4から2に変更
  # または input_length を削減
  input_length: 11025  # 0.25秒に短縮
  ```

**⏱️ 「12時間制限でセッション終了」**
- **対処**: 学習を再開可能
  ```python
  # 前回の中断点から学習再開
  !python scripts/train_model_colab.py --resume
  ```

**📱 「データアップロードに失敗」**
- **解決方法**:
  ```python
  # Google Drive 経由でデータ読み込み
  from google.colab import drive
  drive.mount('/content/drive')
  !cp /content/drive/MyDrive/your_data/*.json data/
  ```

**🔧 「カーネルサイズ63で Out of Memory」**
- 既に最適化済みですが、さらなる調整が必要な場合:
  ```yaml
  # config_colab.yaml で調整
  model:
    input_length: 11025  # さらに短縮
    cnn_layers:
      - filters: 16      # フィルタ数削減
        kernel_size: 63   # カーネルサイズは維持
  training:
    batch_size: 1        # 最小バッチサイズ
  ```

## ライセンス

This project is licensed under the MIT License - see the LICENSE file for details.