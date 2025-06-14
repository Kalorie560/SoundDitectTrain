# モデルディレクトリ / Models Directory

## 概要 / Overview

このディレクトリは学習済みモデルファイルを格納する場所です。
This directory contains trained model files.

## ファイル構造 / File Structure

```
models/
├── README.md (このファイル / This file)
└── best_model.pth (学習済みモデル / Trained model - 作成後 / Created after training)
```

## 学習済みモデルについて / About Trained Models

### 現在の状況 / Current Status
- **学習済みモデルは現在ありません** / **No trained model currently available**
- システムはベースラインモデルを自動生成して動作します / System automatically creates a baseline model for operation
- より高精度な検知のために、実際の音声データでモデルを学習することを推奨します / For better accuracy, training with actual audio data is recommended

### ベースラインモデルの動作 / Baseline Model Behavior
学習済みモデルが見つからない場合、システムは以下のように動作します：
When no trained model is found, the system operates as follows:

1. **自動初期化** / **Automatic Initialization**: シンプルなベースライン重みでモデルを初期化 / Initialize model with simple baseline weights
2. **基本的な検知機能** / **Basic Detection**: 音量・振幅ベースの簡易判定を実行 / Perform simple volume/amplitude-based detection
3. **デモンストレーション機能** / **Demonstration Mode**: システムの基本動作を確認可能 / Allows verification of basic system operation

### モデル学習の実行方法 / How to Train a Model

#### 1. 学習データの準備 / Prepare Training Data
```bash
# dataディレクトリにJSONファイルを配置
# Place JSON files in the data directory
data/
├── normal_sounds.json    # 正常音声データ / Normal sound data
└── anomaly_sounds.json   # 異常音声データ / Anomaly sound data
```

#### 2. 学習データフォーマット / Training Data Format
```json
{
  "waveforms": [
    [0.1, 0.2, -0.1, ...],  // 音声波形データ (44100サンプル/秒)
    [0.05, 0.15, -0.05, ...]
  ],
  "labels": ["OK", "NG"],     // "OK" = 正常, "NG" = 異常
  "fs": 44100                 // サンプリング周波数
}
```

#### 3. 学習の実行 / Execute Training
```bash
# 学習スクリプトの実行
python scripts/train_model.py

# または学習APIの使用
curl -X POST http://localhost:8000/api/train
```

## トラブルシューティング / Troubleshooting

### Q: "Model file not found" エラーが表示される
**A:** これは正常な動作です。学習済みモデルがない場合、システムは自動的にベースラインモデルを作成します。

### Q: 検知精度が低い
**A:** ベースラインモデルは簡易的な判定のみ行います。実際の音声データで学習したモデルを使用することで精度が向上します。

### Q: "Model file not found" error appears
**A:** This is normal behavior. When no trained model exists, the system automatically creates a baseline model.

### Q: Detection accuracy is low
**A:** The baseline model performs only simple detection. Accuracy improves by using a model trained on actual audio data.

## 推奨設定 / Recommended Settings

### システム要件 / System Requirements
- **メモリ**: 4GB以上推奨 / 4GB+ recommended
- **CPU**: Intel i5以上推奨 / Intel i5+ recommended  
- **ストレージ**: 2GB以上の空き容量 / 2GB+ free space

### パフォーマンス最適化 / Performance Optimization
- GPU使用時は `config.yaml` で `use_gpu: true` に設定 / Set `use_gpu: true` in config.yaml when using GPU
- 大容量データの場合はバッチサイズを調整 / Adjust batch size for large datasets
- ClearMLログを無効にしてリソース使用量を削減 / Disable ClearML logging to reduce resource usage

---

このファイルは SoundDitect システムの一部です。
This file is part of the SoundDitect system.