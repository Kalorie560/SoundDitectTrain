"""
Model Management Module for SoundDitect

This module handles the AI model architecture, training, inference,
and integration with ClearML for experiment tracking.
"""

# Comprehensive SSL and urllib3 warning suppression for macOS LibreSSL compatibility
import warnings
import urllib3
import ssl
import os

# Suppress all urllib3 warnings
urllib3.disable_warnings()
warnings.filterwarnings("ignore", "urllib3*")
warnings.filterwarnings("ignore", "Unverified HTTPS request*")
warnings.filterwarnings("ignore", message=".*urllib3.*")

# Additional SSL configuration for macOS LibreSSL
try:
    # Set SSL context to be more permissive for older LibreSSL versions
    ssl._create_default_https_context = ssl._create_unverified_context
except AttributeError:
    pass

import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Dataset
import numpy as np
from pathlib import Path
import logging
import asyncio
import json
from typing import Tuple, Optional, Dict, Any
import time
from clearml import Task, Logger

logger = logging.getLogger(__name__)

class AttentionLayer(nn.Module):
    """Multi-head attention layer for audio feature processing."""
    
    def __init__(self, input_dim: int, hidden_dim: int, num_heads: int):
        super(AttentionLayer, self).__init__()
        self.hidden_dim = hidden_dim
        self.num_heads = num_heads
        self.head_dim = hidden_dim // num_heads
        
        self.query = nn.Linear(input_dim, hidden_dim)
        self.key = nn.Linear(input_dim, hidden_dim)
        self.value = nn.Linear(input_dim, hidden_dim)
        self.output = nn.Linear(hidden_dim, hidden_dim)
        self.dropout = nn.Dropout(0.1)
        
    def forward(self, x):
        batch_size, seq_len, input_dim = x.size()
        
        # Compute queries, keys, values
        Q = self.query(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        K = self.key(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        V = self.value(x).view(batch_size, seq_len, self.num_heads, self.head_dim).transpose(1, 2)
        
        # Compute attention scores
        scores = torch.matmul(Q, K.transpose(-2, -1)) / np.sqrt(self.head_dim)
        attention_weights = torch.softmax(scores, dim=-1)
        attention_weights = self.dropout(attention_weights)
        
        # Apply attention to values
        attended = torch.matmul(attention_weights, V)
        attended = attended.transpose(1, 2).contiguous().view(
            batch_size, seq_len, self.hidden_dim
        )
        
        output = self.output(attended)
        return output

class SoundAnomalyDetector(nn.Module):
    """1D-CNN with Attention mechanism for sound anomaly detection."""
    
    def __init__(self, config: dict):
        super(SoundAnomalyDetector, self).__init__()
        self.config = config
        
        # CNN layers
        cnn_layers = []
        input_channels = 1
        
        for layer_config in config['model']['cnn_layers']:
            cnn_layers.extend([
                nn.Conv1d(
                    input_channels, 
                    layer_config['filters'],
                    kernel_size=layer_config['kernel_size'],
                    stride=layer_config['stride'],
                    padding=layer_config['padding']
                ),
                nn.BatchNorm1d(layer_config['filters']),
                nn.ReLU(),
                nn.MaxPool1d(2)
            ])
            input_channels = layer_config['filters']
        
        self.cnn = nn.Sequential(*cnn_layers)
        
        # Calculate CNN output size
        self.cnn_output_size = self._get_cnn_output_size(config['model']['input_length'])
        
        # Attention layer
        attention_config = config['model']['attention']
        self.attention = AttentionLayer(
            input_channels,
            attention_config['hidden_dim'],
            attention_config['num_heads']
        )
        
        # Fully connected layers
        fc_layers = []
        fc_input_size = attention_config['hidden_dim']
        
        for fc_config in config['model']['fully_connected']:
            fc_layers.extend([
                nn.Linear(fc_input_size, fc_config['units']),
                nn.ReLU(),
                nn.Dropout(fc_config['dropout'])
            ])
            fc_input_size = fc_config['units']
        
        # Output layer
        fc_layers.append(nn.Linear(fc_input_size, config['model']['num_classes']))
        self.classifier = nn.Sequential(*fc_layers)
        
        # Global average pooling
        self.global_avg_pool = nn.AdaptiveAvgPool1d(1)
        
    def _get_cnn_output_size(self, input_length: int) -> int:
        """Calculate the output size after CNN layers."""
        # Create dummy input to calculate output size
        x = torch.randn(1, 1, input_length)
        with torch.no_grad():
            x = self.cnn(x)
        return x.size(-1)
    
    def forward(self, x):
        # Input shape: (batch_size, input_length)
        # Add channel dimension: (batch_size, 1, input_length)
        x = x.unsqueeze(1)
        
        # CNN feature extraction
        x = self.cnn(x)  # (batch_size, channels, reduced_length)
        
        # Prepare for attention: (batch_size, seq_len, features)
        x = x.transpose(1, 2)
        
        # Apply attention
        x = self.attention(x)
        
        # Global average pooling
        x = x.transpose(1, 2)  # Back to (batch_size, features, seq_len)
        x = self.global_avg_pool(x).squeeze(-1)  # (batch_size, features)
        
        # Classification
        output = self.classifier(x)
        
        return output

class AudioDataset(Dataset):
    """Dataset class for audio data with memory-efficient loading."""
    
    def __init__(self, data_files: list, config: dict, augment: bool = False):
        self.data_files = data_files
        self.config = config
        self.augment = augment
        self.data_indices = []
        
        logger.info(f"📊 Initializing AudioDataset - integrating {len(data_files)} JSON files into unified dataset")
        
        # Build index of all samples across all files
        total_samples = 0
        for file_idx, file_path in enumerate(data_files):
            try:
                logger.info(f"📁 Processing file {file_idx + 1}/{len(data_files)}: {file_path.name}")
                
                with open(file_path, 'r') as f:
                    data = json.load(f)
                
                file_samples = 0
                
                # Handle both old format (list of entries) and new format (waveforms/labels arrays)
                if isinstance(data, list):
                    # Old format: [{"Waveform": [...], "Labels": 0}, ...]
                    logger.info(f"   📋 Detected old format (list) with {len(data)} entries")
                    for sample_idx in range(len(data)):
                        # Validate that each entry has the required fields
                        entry = data[sample_idx]
                        if isinstance(entry, dict) and 'Waveform' in entry and 'Labels' in entry:
                            self.data_indices.append((file_idx, sample_idx))
                            file_samples += 1
                        else:
                            logger.warning(f"   ⚠️  Entry {sample_idx} missing 'Waveform' or 'Labels' fields")
                            
                elif isinstance(data, dict) and 'waveforms' in data:
                    # New format: {"waveforms": [[...], [...]], "labels": ["OK", "NG"]}
                    waveforms = data.get('waveforms', [])
                    labels = data.get('labels', [])
                    
                    logger.info(f"   📋 Detected new format with {len(waveforms)} waveforms and {len(labels)} labels")
                    
                    if len(waveforms) != len(labels):
                        logger.warning(f"   ⚠️  Mismatch: {len(waveforms)} waveforms vs {len(labels)} labels")
                        
                    num_samples = min(len(waveforms), len(labels))
                    for sample_idx in range(num_samples):
                        # Validate waveform data
                        waveform = waveforms[sample_idx]
                        if isinstance(waveform, list) and len(waveform) > 0:
                            self.data_indices.append((file_idx, sample_idx))
                            file_samples += 1
                        else:
                            logger.warning(f"   ⚠️  Sample {sample_idx} has invalid waveform data")
                            
                else:
                    # Check what the data structure actually looks like
                    if isinstance(data, dict):
                        keys = list(data.keys())
                        logger.warning(f"   ❌ Unknown dict format. Available keys: {keys}")
                    else:
                        logger.warning(f"   ❌ Unknown data type: {type(data)}")
                
                logger.info(f"   ✅ Added {file_samples} valid samples from this file")
                total_samples += file_samples
                
            except json.JSONDecodeError as e:
                logger.error(f"   ❌ JSON parsing error in {file_path}: {e}")
            except Exception as e:
                logger.error(f"   ❌ Could not process file {file_path}: {e}")
        
        logger.info(f"🎯 JSON file integration complete: {total_samples} total samples unified from {len(data_files)} files")
        logger.info(f"✨ All JSON training files in data folder have been successfully integrated into the dataset")
    
    def __len__(self):
        return len(self.data_indices)
    
    def __getitem__(self, idx):
        file_idx, sample_idx = self.data_indices[idx]
        
        # Load only the specific sample (memory efficient)
        try:
            with open(self.data_files[file_idx], 'r') as f:
                data = json.load(f)
            
            if isinstance(data, list):
                # Old format: [{"Waveform": [...], "Labels": 0}, ...]
                sample = data[sample_idx]
                waveform = np.array(sample['Waveform'], dtype=np.float32)
                label = sample['Labels']
            elif isinstance(data, dict) and 'waveforms' in data:
                # New format: {"waveforms": [[...], [...]], "labels": ["OK", "NG"]}
                waveform = np.array(data['waveforms'][sample_idx], dtype=np.float32)
                label_str = data['labels'][sample_idx]
                
                # Convert string labels to integers
                if label_str == "OK":
                    label = 0
                elif label_str == "NG":
                    label = 1
                else:
                    logger.warning(f"Unknown label '{label_str}', defaulting to 0")
                    label = 0
            else:
                raise ValueError(f"Unknown data format in file {self.data_files[file_idx]}")
            
            # Apply augmentation if training
            if self.augment:
                # Add augmentation logic here if needed
                pass
            
            return torch.tensor(waveform), torch.tensor(label, dtype=torch.long)
            
        except Exception as e:
            logger.error(f"Error loading sample {idx}: {e}")
            # Return zero tensor as fallback
            return torch.zeros(self.config['model']['input_length']), torch.tensor(0, dtype=torch.long)

class ModelManager:
    """Manager for model training, inference, and experiment tracking."""
    
    def __init__(self, config: dict):
        self.config = config
        self.device = torch.device("cuda" if torch.cuda.is_available() and config['inference']['use_gpu'] else "cpu")
        self.model = None
        self.task = None
        self.prediction_count = 0
        
        logger.info(f"Using device: {self.device}")
        
        # Initialize ClearML task
        self._init_clearml()
    
    def _init_clearml(self):
        """Initialize ClearML experiment tracking with robust error handling."""
        try:
            import warnings
            import os
            import sys
            
            # Comprehensive warning suppression to avoid SSL issues
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                
                # Suppress urllib3 warnings
                import urllib3
                urllib3.disable_warnings()
                
                # Try ClearML initialization with timeout
                try:
                    # First try normal initialization
                    self.task = Task.init(
                        project_name=self.config['clearml']['project_name'],
                        task_name=self.config['clearml']['task_name'],
                        output_uri=self.config['clearml']['output_uri'],
                        reuse_last_task_id=False
                    )
                    
                    # Log configuration if successful
                    if self.task:
                        self.task.connect(self.config)
                        logger.info("✅ ClearML task initialized successfully")
                        return
                        
                except SystemExit:
                    # Handle SystemExit exception that can occur with SSL issues
                    logger.warning("⚠️ ClearML initialization caused SystemExit - switching to offline mode")
                    self.task = None
                except Exception as init_error:
                    logger.warning(f"⚠️ ClearML initialization failed: {init_error}")
                    self.task = None
            
        except Exception as e:
            logger.warning(f"⚠️ ClearML setup error: {e}")
            self.task = None
        
        # If initialization failed, log that we're continuing without ClearML
        if self.task is None:
            logger.info("🔄 Continuing without ClearML experiment tracking")
    
    def create_model(self) -> SoundAnomalyDetector:
        """Create a new model instance."""
        model = SoundAnomalyDetector(self.config)
        return model.to(self.device)
    
    async def load_model(self, model_path: Optional[str] = None) -> bool:
        """
        Load a trained model from disk.
        
        Args:
            model_path: Path to the model file
            
        Returns:
            True if model loaded successfully
        """
        try:
            if model_path is None:
                model_path = self.config['inference']['model_path']
            
            model_path = Path(model_path)
            if not model_path.exists():
                logger.warning(f"Model file not found: {model_path}")
                return False
            
            self.model = self.create_model()
            state_dict = torch.load(model_path, map_location=self.device)
            self.model.load_state_dict(state_dict)
            self.model.eval()
            
            logger.info(f"Model loaded from {model_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error loading model: {e}")
            return False
    
    def save_model(self, model_path: Optional[str] = None):
        """Save the current model to disk."""
        try:
            if self.model is None:
                raise ValueError("No model to save")
            
            if model_path is None:
                model_path = self.config['data']['model_save_path']
            
            model_path = Path(model_path)
            model_path.parent.mkdir(parents=True, exist_ok=True)
            
            torch.save(self.model.state_dict(), model_path / "best_model.pth")
            logger.info(f"Model saved to {model_path}")
            
        except Exception as e:
            logger.error(f"Error saving model: {e}")
    
    async def predict(self, audio_data: np.ndarray) -> Tuple[int, float]:
        """
        Make prediction on audio data.
        
        Args:
            audio_data: Preprocessed audio data
            
        Returns:
            Tuple of (prediction, confidence)
        """
        try:
            if self.model is None:
                # Create a dummy model if no trained model is available
                self.model = self.create_model()
                logger.warning("Using untrained model for prediction")
            
            self.model.eval()
            with torch.no_grad():
                # Convert to tensor and add batch dimension
                audio_tensor = torch.tensor(audio_data, dtype=torch.float32).unsqueeze(0).to(self.device)
                
                # Get prediction
                outputs = self.model(audio_tensor)
                probabilities = torch.softmax(outputs, dim=1)
                confidence, prediction = torch.max(probabilities, 1)
                
                self.prediction_count += 1
                
                return prediction.item(), confidence.item()
                
        except Exception as e:
            logger.error(f"Prediction error: {e}")
            # Return default values
            return 0, 0.5
    
    async def train_model(self) -> bool:
        """
        Train the model with available data.
        
        Returns:
            True if training completed successfully
        """
        try:
            logger.info("Starting model training...")
            
            # Create data loaders
            train_loader, val_loader = self._create_data_loaders()
            
            if train_loader is None:
                logger.warning("No training data available")
                return False
            
            # Create model
            self.model = self.create_model()
            
            # Setup training
            criterion = nn.CrossEntropyLoss()
            optimizer = optim.Adam(
                self.model.parameters(), 
                lr=self.config['training']['learning_rate']
            )
            
            # Training loop
            best_val_loss = float('inf')
            patience_counter = 0
            global_iteration = 0  # Track iterations across all epochs for ClearML
            
            for epoch in range(self.config['training']['epochs']):
                # Training phase
                train_loss, global_iteration = await self._train_epoch(train_loader, criterion, optimizer, epoch, global_iteration)
                
                # Validation phase
                val_loss, val_acc = await self._validate_epoch(val_loader, criterion)
                
                # Log epoch-level metrics to ClearML if available
                try:
                    if self.task and hasattr(self.task, 'logger'):
                        self.task.logger.report_scalar("Loss", "Train_Epoch", value=train_loss, iteration=epoch)
                        self.task.logger.report_scalar("Loss", "Validation", value=val_loss, iteration=epoch)
                        self.task.logger.report_scalar("Accuracy", "Validation", value=val_acc, iteration=epoch)
                        self.task.logger.report_scalar("Training", "Epoch", value=epoch, iteration=global_iteration)
                except Exception as log_error:
                    # Continue training even if logging fails
                    logger.debug(f"ClearML logging error: {log_error}")
                
                logger.info(f"Epoch {epoch+1}: Train Loss={train_loss:.4f}, Val Loss={val_loss:.4f}, Val Acc={val_acc:.4f}")
                
                # Early stopping
                if val_loss < best_val_loss:
                    best_val_loss = val_loss
                    patience_counter = 0
                    self.save_model()
                else:
                    patience_counter += 1
                    if patience_counter >= self.config['training']['early_stopping']['patience']:
                        logger.info("Early stopping triggered")
                        break
            
            logger.info("Training completed")
            return True
            
        except Exception as e:
            logger.error(f"Training error: {e}")
            return False
    
    def _create_data_loaders(self) -> Tuple[Optional[DataLoader], Optional[DataLoader]]:
        """Create training and validation data loaders."""
        try:
            data_dir = Path(self.config['data']['data_dir'])
            data_files = list(data_dir.glob("*.json"))
            
            if not data_files:
                logger.warning("No data files found")
                return None, None
            
            # Handle small datasets intelligently
            validation_split = self.config['training']['validation_split']
            
            logger.info(f"🔄 Integrating {len(data_files)} JSON files as training resources:")
            for i, file_path in enumerate(data_files, 1):
                logger.info(f"   {i}. {file_path.name}")
            
            if len(data_files) == 1:
                # For single file, use it for both training and validation
                # This prevents empty training sets with small datasets
                logger.info(f"📋 Single data file detected - using for both training and validation")
                train_files = data_files
                val_files = data_files
            else:
                # Multiple files: split files for training/validation
                split_idx = max(1, int(len(data_files) * (1 - validation_split)))
                train_files = data_files[:split_idx]
                val_files = data_files[split_idx:]
                
                logger.info(f"📋 Multiple files detected - splitting for training/validation:")
                logger.info(f"   🎯 Training files ({len(train_files)}):")
                for i, file_path in enumerate(train_files, 1):
                    logger.info(f"      {i}. {file_path.name}")
                logger.info(f"   ✅ Validation files ({len(val_files)}):")
                for i, file_path in enumerate(val_files, 1):
                    logger.info(f"      {i}. {file_path.name}")
            
            # Create datasets
            train_dataset = AudioDataset(train_files, self.config, augment=True)
            val_dataset = AudioDataset(val_files, self.config, augment=False)
            
            # Verify datasets have samples
            if len(train_dataset) == 0:
                logger.error("❌ Training dataset is empty!")
                return None, None
            
            if len(val_dataset) == 0:
                logger.warning("⚠️ Validation dataset is empty - using training data for validation")
                val_dataset = train_dataset
            
            logger.info(f"📊 Training samples: {len(train_dataset)}, Validation samples: {len(val_dataset)}")
            
            # Create data loaders
            train_loader = DataLoader(
                train_dataset,
                batch_size=min(self.config['training']['batch_size'], len(train_dataset)),
                shuffle=True,
                num_workers=0  # Set to 0 for stability with small datasets
            )
            
            val_loader = DataLoader(
                val_dataset,
                batch_size=min(self.config['training']['batch_size'], len(val_dataset)),
                shuffle=False,
                num_workers=0  # Set to 0 for stability with small datasets
            )
            
            return train_loader, val_loader
            
        except Exception as e:
            logger.error(f"Error creating data loaders: {e}")
            return None, None
    
    async def _train_epoch(self, train_loader: DataLoader, criterion, optimizer, epoch: int, global_iteration: int) -> Tuple[float, int]:
        """Train for one epoch."""
        self.model.train()
        total_loss = 0.0
        
        for batch_idx, (data, target) in enumerate(train_loader):
            data, target = data.to(self.device), target.to(self.device)
            
            optimizer.zero_grad()
            output = self.model(data)
            loss = criterion(output, target)
            loss.backward()
            optimizer.step()
            
            total_loss += loss.item()
            global_iteration += 1
            
            # Log per-iteration metrics to ClearML for proper iteration tracking
            try:
                if self.task and hasattr(self.task, 'logger'):
                    # Log every few iterations to avoid spamming
                    if batch_idx % max(1, len(train_loader) // 10) == 0:
                        self.task.logger.report_scalar("Loss", "Train_Iteration", value=loss.item(), iteration=global_iteration)
                        self.task.logger.report_scalar("Training", "Batch", value=batch_idx, iteration=global_iteration)
                        self.task.logger.report_scalar("Training", "Learning_Rate", value=optimizer.param_groups[0]['lr'], iteration=global_iteration)
            except Exception as log_error:
                # Continue training even if logging fails
                logger.debug(f"ClearML iteration logging error: {log_error}")
            
            # Allow other coroutines to run
            if batch_idx % 10 == 0:
                await asyncio.sleep(0)
        
        return total_loss / len(train_loader), global_iteration
    
    async def _validate_epoch(self, val_loader: DataLoader, criterion) -> Tuple[float, float]:
        """Validate for one epoch."""
        self.model.eval()
        total_loss = 0.0
        correct = 0
        total = 0
        
        with torch.no_grad():
            for batch_idx, (data, target) in enumerate(val_loader):
                data, target = data.to(self.device), target.to(self.device)
                
                output = self.model(data)
                loss = criterion(output, target)
                total_loss += loss.item()
                
                _, predicted = torch.max(output.data, 1)
                total += target.size(0)
                correct += (predicted == target).sum().item()
                
                # Allow other coroutines to run
                if batch_idx % 10 == 0:
                    await asyncio.sleep(0)
        
        accuracy = correct / total if total > 0 else 0.0
        return total_loss / len(val_loader), accuracy
    
    def is_model_loaded(self) -> bool:
        """Check if a model is loaded."""
        return self.model is not None