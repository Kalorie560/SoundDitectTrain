# SoundDitect

リアルタイム音声異常検知AIアプリケーション / Real-time Sound Anomaly Detection AI Application

[🇯🇵 日本語](#日本語) | [🇺🇸 English](#english)

---

## 日本語

### 概要

SoundDitectは、PCのマイクからリアルタイムで入力される音声ストリームを分析し、衝撃音などの「異常音」を検知してユーザーに通知する高応答・高精度なWebアプリケーションです。

### 主な機能

- 🎤 **リアルタイム音声監視**: PCのマイクから1秒間隔で音声を分析
- 🧠 **AI異常検知**: 1D-CNN + Attention機構による高精度な異常音検知
- 💻 **Webベースインターフェース**: ブラウザで動作する直感的な日本語UI
- 📊 **リアルタイム可視化**: 音声波形とスペクトラムの実時間表示
- 📈 **実験管理**: ClearMLによる学習プロセスの記録・管理
- ⚡ **メモリ効率**: ストリーミング処理による大容量データ対応
- 🔄 **動作モード選択**: リアルタイム処理またはオフライン一括処理を選択可能

### 動作モード

SoundDitectは、PCの性能や使用用途に応じて2つの動作モードから選択できます：

#### ⚡ リアルタイムモード（デフォルト）
- **用途**: 高性能PC向け、即座の異常検知が必要な場面
- **動作**: 録音中にリアルタイムで1秒間隔の判定を実行
- **特徴**:
  - 録音と同時に判定結果が表示される
  - WebSocketによる低遅延通信
  - 連続監視に最適
- **推奨環境**: Intel Core i7-10th gen / AMD Ryzen 7 4700U 以上

#### 📊 オフラインモード
- **用途**: 中〜低性能PC向け、詳細な分析が必要な場面
- **動作**: 指定時間（5〜60秒）録音完了後に一括処理
- **特徴**:
  - 録音完了後に全データを一括で分析
  - 波形全体と判定結果の詳細な可視化
  - 時系列での判定結果とタイムライン表示
  - 統計情報（OK/NG数、平均信頼度など）の提供
- **推奨環境**: Intel Core i5-8th gen / AMD Ryzen 5 3600 以上

### 技術選定理由

#### AI アーキテクチャ
- **1D-CNN with Attention**: 音声の時系列パターンと重要な特徴の両方を効果的に捉える
- **PyTorch**: 柔軟な モデル設計と実験に適している
- **ClearML**: 実験の再現性と結果管理に最適

#### バックエンド・フロントエンド
- **FastAPI**: 非同期処理とWebSocketに対応、高速なAPIサーバー
- **Web Audio API**: ブラウザから直接マイクアクセス、低遅延処理
- **WebSocket**: リアルタイム双方向通信で即座の結果通知

### システム要件

#### 推奨スペック（1秒毎の判定結果表示）

**CPU要件:**
- **最小**: Intel Core i5-8th gen / AMD Ryzen 5 3600 以上
- **推奨**: Intel Core i7-10th gen / AMD Ryzen 7 4700U 以上  
- **最適**: Intel Core i7-12th gen / AMD Ryzen 7 5800X 以上

**GPU要件:**
- **CPU使用時**: GPUは不要（統合グラフィックスで十分）
- **GPU使用時（オプション）**: NVIDIA GTX 1060 / RTX 3050 以上（CUDA対応）
- **推奨GPU**: NVIDIA RTX 3060 / RTX 4060 以上（高速推論用）

**メモリ要件:**
- **最小**: 4GB RAM
- **推奨**: 8GB RAM 以上
- **最適**: 16GB RAM 以上（複数セッション対応）

**ストレージ要件:**
- **必要容量**: 2GB以上の空き容量
- **推奨**: SSD（高速なファイルアクセス）

**ネットワーク要件:**
- **ローカル使用**: 不要
- **リモートアクセス**: 100Mbps以上の安定した接続

> 💡 **パフォーマンス注記**: リアルタイム1秒毎の判定を実現するため、上記スペックを満たすことを強く推奨します。古いハードウェアでは判定遅延が発生する可能性があります。

### セットアップと実行手順

#### 1. 環境準備

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

#### 2. ClearML設定（必須）

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

#### 3. 学習データの準備

> 📝 **重要**: モデル学習を行う場合は、独自のJSONデータファイルを`./data`ディレクトリに配置してください。

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

#### 4. モデル学習（オプション）

```bash
# モデルを学習（すべての設定はconfig.yamlから読み込まれます）
# 注意: 事前に学習データをdataディレクトリに配置してください
python scripts/train_model.py
```

#### 5. サーバー起動

```bash
# サーバーを起動
python run_server.py
```

#### 6. アプリケーション使用

1. ブラウザで `http://localhost:8000` にアクセス
2. マイクアクセスを許可
3. **動作モードの選択**：
   - **リアルタイム**: 即座の判定が必要な場合（デフォルト）
   - **オフライン**: 詳細分析が必要な場合（録音時間：5〜60秒で設定）
4. 「録音開始」ボタンをクリック
5. 選択したモードに応じて結果を確認：
   - **リアルタイム**: 録音中にリアルタイムで判定結果が表示
   - **オフライン**: 録音完了後に波形可視化と詳細分析結果が表示

### プロジェクト構造

```
SoundDitect/
├── config.yaml              # 設定ファイル
├── requirements.txt          # Python依存関係
├── run_server.py            # サーバー起動スクリプト
├── backend/                 # バックエンドコード
│   ├── main.py             # FastAPIアプリケーション
│   ├── audio_processor.py  # 音声処理
│   ├── model_manager.py    # AIモデル管理
│   └── websocket_manager.py # WebSocket管理
├── frontend/                # フロントエンドコード
│   ├── index.html          # メインUI
│   ├── styles.css          # スタイルシート
│   ├── audio-processor.js  # 音声処理（クライアント）
│   ├── websocket-client.js # WebSocket通信
│   ├── ui-controller.js    # UI制御
│   └── app.js              # メインアプリケーション
├── scripts/                 # ユーティリティスクリプト
│   ├── train_model.py      # モデル学習
│   └── setup_clearml.py    # ClearML設定スクリプト
├── models/                  # 学習済みモデル保存先
├── data/                    # 学習データ
├── logs/                    # ログファイル
└── outputs/                 # 実験結果
```

### データ仕様

学習データは以下のJSON形式で提供されます：

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
  "fs": 44100,        // サンプリング周波数（必須）
  "metric": "RMS"     // 測定指標（オプション）
}
```

**重要**: システムは新旧両方のデータ形式に対応しています：
- **新形式**: `{"waveforms": [...], "labels": ["OK", "NG"]}` (推奨)
- **旧形式**: `[{"Waveform": [...], "Labels": 0}]` (互換性のため)

### アーキテクチャ解説

#### AIモデル
1. **前処理**: バンドパスフィルタ + 正規化
2. **1D-CNN**: 時系列パターンの特徴抽出
3. **Multi-Head Attention**: 重要な時間フレームに注目
4. **分類器**: 正常/異常の2クラス分類

#### リアルタイム処理
1. **音声キャプチャ**: Web Audio APIで44.1kHzサンプリング
2. **前処理**: ノイズ除去とフィルタリング
3. **WebSocket送信**: Base64エンコードで音声データ転送
4. **AI推論**: サーバーサイドでモデル推論
5. **結果表示**: 1秒以内にUI更新

#### オフライン処理
1. **音声収録**: 指定時間（5〜60秒）の音声を一時保存
2. **一括送信**: 録音完了後にHTTP POSTで音声データ送信
3. **バッチ処理**: `/api/analyze_batch`エンドポイントで一括分析
4. **波形生成**: 全体波形データとタイムライン生成
5. **結果可視化**: 判定結果オーバーレイと統計情報表示

### ClearML実験管理

```bash
# ClearML設定（初回のみ）
clearml-init

# 実験の可視化
clearml-serving --open
```

### カスタマイズ

`config.yaml`ファイルを編集して以下をカスタマイズできます：
- モデルアーキテクチャパラメータ
- 学習設定（エポック数、バッチサイズなど）
- 音声処理設定（サンプリング周波数、フィルタ設定）
- ClearMLプロジェクト設定

---

## English

### Overview

SoundDitect is a high-responsiveness, high-precision web application that analyzes real-time audio streams from PC microphones to detect "anomalous sounds" such as impact sounds and notify users.

### Key Features

- 🎤 **Real-time Audio Monitoring**: Analyzes audio from PC microphone at 1-second intervals
- 🧠 **AI Anomaly Detection**: High-precision anomalous sound detection using 1D-CNN + Attention mechanism
- 💻 **Web-based Interface**: Intuitive Japanese UI running in browsers
- 📊 **Real-time Visualization**: Real-time display of audio waveforms and spectrums
- 📈 **Experiment Management**: Recording and management of learning processes with ClearML
- ⚡ **Memory Efficiency**: Streaming processing for large-scale data handling
- 🔄 **Operation Mode Selection**: Choose between real-time processing or offline batch processing

### Operation Modes

SoundDitect offers two operation modes to accommodate different PC performance levels and use cases:

#### ⚡ Real-time Mode (Default)
- **Use Case**: High-performance PCs, immediate anomaly detection required
- **Operation**: Real-time 1-second interval detection during recording
- **Features**:
  - Detection results displayed simultaneously with recording
  - Low-latency communication via WebSocket
  - Optimal for continuous monitoring
- **Recommended Environment**: Intel Core i7-10th gen / AMD Ryzen 7 4700U or higher

#### 📊 Offline Mode
- **Use Case**: Mid to low-performance PCs, detailed analysis required
- **Operation**: Batch processing after completing recording (5-60 seconds configurable)
- **Features**:
  - Comprehensive analysis of entire recording after completion
  - Detailed visualization of full waveform with detection results
  - Timeline display with time-series detection results
  - Statistical information (OK/NG counts, average confidence, etc.)
- **Recommended Environment**: Intel Core i5-8th gen / AMD Ryzen 5 3600 or higher

### Technical Design Decisions

#### AI Architecture
- **1D-CNN with Attention**: Effectively captures both temporal patterns and important features in audio
- **PyTorch**: Suitable for flexible model design and experimentation
- **ClearML**: Optimal for experiment reproducibility and result management

#### Backend/Frontend
- **FastAPI**: Supports asynchronous processing and WebSocket, high-speed API server
- **Web Audio API**: Direct microphone access from browser, low-latency processing
- **WebSocket**: Real-time bidirectional communication for immediate result notification

### System Requirements

#### Recommended Specifications (for 1-second interval detection)

**CPU Requirements:**
- **Minimum**: Intel Core i5-8th gen / AMD Ryzen 5 3600 or higher
- **Recommended**: Intel Core i7-10th gen / AMD Ryzen 7 4700U or higher  
- **Optimal**: Intel Core i7-12th gen / AMD Ryzen 7 5800X or higher

**GPU Requirements:**
- **CPU Mode**: No GPU required (integrated graphics sufficient)
- **GPU Mode (Optional)**: NVIDIA GTX 1060 / RTX 3050 or higher (CUDA compatible)
- **Recommended GPU**: NVIDIA RTX 3060 / RTX 4060 or higher (for high-speed inference)

**Memory Requirements:**
- **Minimum**: 4GB RAM
- **Recommended**: 8GB RAM or higher
- **Optimal**: 16GB RAM or higher (for multiple sessions)

**Storage Requirements:**
- **Required Space**: 2GB+ free space
- **Recommended**: SSD (for fast file access)

**Network Requirements:**
- **Local Use**: Not required
- **Remote Access**: 100Mbps+ stable connection

> 💡 **Performance Note**: To achieve real-time 1-second interval detection, we strongly recommend meeting the above specifications. Older hardware may experience detection delays.

### Setup and Execution

#### 1. Environment Setup

```bash
# Clone repository
git clone https://github.com/Kalorie560/SoundDitect.git
cd SoundDitect

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Upgrade pip to latest version (important)
pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt
```

#### 2. ClearML Setup (Required)

```bash
# Configure ClearML (choose one of the following methods)

# Method 1: Use automatic setup script (recommended)
python scripts/setup_clearml.py

# Method 2: Manual setup
clearml-init

# Method 3: Use environment variables
export CLEARML_WEB_HOST=https://app.clear.ml
export CLEARML_API_HOST=https://api.clear.ml
export CLEARML_FILES_HOST=https://files.clear.ml
export CLEARML_API_ACCESS_KEY=your_access_key_here
export CLEARML_API_SECRET_KEY=your_secret_key_here
```

> 🌟 **ClearML Account**: Create an account at [https://app.clear.ml](https://app.clear.ml) and obtain credentials from your profile page.

#### 3. Prepare Training Data

> 📝 **Important**: To train models, place your JSON data files in the `./data` directory.

**Data Format Requirements**:
```json
{
  "waveforms": [
    [0.0, 0.01, -0.01, 0.02, ...],  // 44100 audio samples (1 second)
    [0.0, 0.0, 0.02, 0.05, ...]
  ],
  "labels": [
    "OK",   // Normal sound
    "NG"    // Anomaly sound
  ],
  "fs": 44100,        // Sampling frequency
  "metric": "RMS"     // Measurement metric
}
```

#### 4. Train Model (Optional)

```bash
# Train model (all settings are read from config.yaml)
# Note: Training data must be placed in data directory first
python scripts/train_model.py
```

#### 5. Start Server

```bash
# Start server
python run_server.py
```

#### 6. Use Application

1. Access `http://localhost:8000` in browser
2. Allow microphone access
3. **Select Operation Mode**:
   - **Real-time**: For immediate detection needs (default)
   - **Offline**: For detailed analysis (configurable recording time: 5-60 seconds)
4. Click "録音開始" (Start Recording) button
5. Check results according to selected mode:
   - **Real-time**: Detection results displayed in real-time during recording
   - **Offline**: Waveform visualization and detailed analysis results shown after recording completion

### Project Structure

```
SoundDitect/
├── config.yaml              # Configuration file
├── requirements.txt          # Python dependencies
├── run_server.py            # Server startup script
├── backend/                 # Backend code
│   ├── main.py             # FastAPI application
│   ├── audio_processor.py  # Audio processing
│   ├── model_manager.py    # AI model management
│   └── websocket_manager.py # WebSocket management
├── frontend/                # Frontend code
│   ├── index.html          # Main UI
│   ├── styles.css          # Stylesheets
│   ├── audio-processor.js  # Audio processing (client)
│   ├── websocket-client.js # WebSocket communication
│   ├── ui-controller.js    # UI control
│   └── app.js              # Main application
├── scripts/                 # Utility scripts
│   ├── train_model.py      # Model training
│   └── setup_clearml.py    # ClearML setup script
├── models/                  # Trained model storage
├── data/                    # Training data
├── logs/                    # Log files
└── outputs/                 # Experiment results
```

### Data Specification

Training data is provided in the following JSON format:

```json
{
  "waveforms": [
    [0.0, 0.01, -0.01, 0.02, ...],  // 44100 audio samples (1 second)
    [0.0, 0.0, 0.02, 0.05, ...]
  ],
  "labels": [
    "OK",   // Normal sound
    "NG"    // Anomaly sound
  ],
  "fs": 44100,        // Sampling frequency (required)
  "metric": "RMS"     // Measurement metric (optional)
}
```

**Important**: The system supports both new and legacy data formats:
- **New format**: `{"waveforms": [...], "labels": ["OK", "NG"]}` (recommended)
- **Legacy format**: `[{"Waveform": [...], "Labels": 0}]` (for compatibility)

### Architecture Overview

#### AI Model
1. **Preprocessing**: Bandpass filter + normalization
2. **1D-CNN**: Feature extraction of temporal patterns
3. **Multi-Head Attention**: Focus on important time frames
4. **Classifier**: Binary classification (normal/anomaly)

#### Real-time Processing
1. **Audio Capture**: Web Audio API with 44.1kHz sampling
2. **Preprocessing**: Noise removal and filtering
3. **WebSocket Transmission**: Base64-encoded audio data transfer
4. **AI Inference**: Server-side model inference
5. **Result Display**: UI update within 1 second

#### Offline Processing
1. **Audio Recording**: Temporary storage of audio for specified duration (5-60 seconds)
2. **Batch Transmission**: HTTP POST transmission of audio data after recording completion
3. **Batch Processing**: Comprehensive analysis via `/api/analyze_batch` endpoint
4. **Waveform Generation**: Full waveform data and timeline generation
5. **Result Visualization**: Detection result overlay with statistical information display

### ClearML Experiment Management

```bash
# Configure ClearML (first time only)
clearml-init

# Visualize experiments
clearml-serving --open
```

### Customization

Edit the `config.yaml` file to customize:
- Model architecture parameters
- Training settings (epochs, batch size, etc.)
- Audio processing settings (sampling frequency, filter settings)
- ClearML project settings

---

## トラブルシューティング

### よくある問題

**ModuleNotFoundError: No module named 'yaml'**
- PyYAMLが正しくインストールされていない場合に発生します
- 解決方法1: 依存関係を再インストール:
  ```bash
  pip install --upgrade pip
  pip uninstall pyyaml
  pip install pyyaml==6.0.1
  pip install -r requirements.txt
  ```
- 解決方法2: 仮想環境をクリーンアップ:
  ```bash
  deactivate
  rm -rf venv
  python -m venv venv
  source venv/bin/activate  # Windows: venv\Scripts\activate
  pip install --upgrade pip
  pip install -r requirements.txt
  ```

**urllib3 OpenSSL警告（macOS）**
- `urllib3 v2 only supports OpenSSL 1.1.1+` 警告が表示される場合
- macOSのLibreSSL 2.8.3との互換性問題です
- 解決方法: requirements.txtに含まれる最新の互換パッケージにより自動解決されます
- 手動で修正する場合:
  ```bash
  pip install --upgrade pip
  pip install urllib3==1.26.18 requests==2.31.0 certifi==2023.11.17 pyOpenSSL==23.3.0
  ```
- 警告は表示されても機能に影響はありません

**マイクアクセス拒否エラー**
- ブラウザの許可設定を確認
- 本番環境ではHTTPSを使用
- ブラウザキャッシュをクリア

**モデル学習エラー: 'num_samples should be a positive integer value, but got num_samples=0'**
- **原因**: 単一JSONファイル使用時のデータ分割問題（検証用分割が全データを取得し、学習用が空になる）
- **修正済み**: 最新版では自動的に単一ファイルを学習・検証両方に使用するよう修正
- **解決方法**:
  1. 最新版に更新（この問題は修正済み）
  2. ./dataディレクトリに正しい形式のJSONファイルを配置
  3. データ形式を確認: `{'waveforms': [[...]], 'labels': ['OK', 'NG'], 'fs': 44100}`
  4. JSONファイルが正しい構造になっているか確認
  5. 詳細なエラーログを確認してデータ読み込み状況を把握

**ClearML SSL接続エラー（SystemError: exception SystemExit()）**
- **原因**: macOS LibreSSLとの SSL handshake エラー
- **修正済み**: 自動的にオフラインモードにフォールバックする機能を追加
- **対処**: エラーが発生してもモデル学習は継続されます（ClearMLなしで実行）

**その他のモデル学習エラー**
- データ形式が仕様に合っているか確認
- 利用可能メモリを確認
- 必要に応じてバッチサイズを削減

**WebSocket接続エラー・タイムアウト問題**
- **現象**: 接続が頻繁に切断される、タイムアウトエラーが発生する
- **原因**: ネットワーク不安定、プロキシ設定、ファイアウォール
- **解決方法**:
  ```bash
  # 1. ファイアウォール設定の確認
  # Windows: Windows Defenderでポート8000を許可
  # macOS: システム環境設定 > セキュリティとプライバシー > ファイアウォール
  
  # 2. プロキシ設定の確認
  # 企業ネットワークの場合、IT部門にWebSocket通信許可を依頼
  
  # 3. サーバー再起動
  python run_server.py
  ```
- **最新の修正**: タイムアウト時間を30秒に延長、自動再接続機能を強化

**モデルから判定結果が出力されない問題**
- **現象**: 音声は録音されているが判定結果が表示されない
- **修正済み**: 最新版では詳細なログ出力と自動回復機能を追加
- **デバッグ方法**:
  ```bash
  # ブラウザ開発者コンソールで以下を確認
  # 1. WebSocket接続状況: "Connected to server" メッセージ
  # 2. 録音セッション開始: "Recording session started" メッセージ  
  # 3. 判定結果受信: "Detection result received" メッセージ
  # 4. サーバーログで "Prediction result" メッセージを確認
  ```
- **対処法**:
  - サーバーを再起動
  - ブラウザキャッシュをクリア
  - マイクアクセス許可を再設定

**録音停止後の再接続エラー**
- **修正済み**: 接続状態とセッション管理を改善
- **現在の動作**: 録音停止時に適切なクリーンアップを実行し、即座に再録音可能

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.